use crate::credentials::{delete_secret, get_secret};
use reqwest::blocking::{multipart, Client};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::fs::File;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Duration;

const VK_API_VERSION: &str = "5.199";

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("vk http client")
    })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkUserInfo {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub screen_name: Option<String>,
    pub photo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkCommunityInfo {
    pub id: i64,
    pub name: String,
    pub screen_name: Option<String>,
    pub photo_url: Option<String>,
    pub can_post: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkResolvedObject {
    #[serde(rename = "type")]
    pub object_type: String,
    pub object_id: i64,
    pub screen_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkPublicationCapability {
    pub can_post: bool,
    pub can_post_as_group: Option<bool>,
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_upload_photos: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkWallPostResult {
    pub post_id: i64,
    pub owner_id: i64,
}

#[derive(Debug, Deserialize)]
struct VkApiResponse<T> {
    response: Option<T>,
    error: Option<VkApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct VkApiErrorBody {
    error_code: i64,
    error_msg: String,
}

#[derive(Debug, Deserialize)]
struct VkUploadServer {
    upload_url: String,
}

#[derive(Debug, Deserialize)]
struct VkSavedPhoto {
    id: i64,
    owner_id: i64,
}

fn map_vk_api_error(code: i64, message: &str) -> String {
    format!("VK_API:{code}:{message}")
}

#[derive(Clone, Copy)]
enum VkApiAuthStyle {
    BearerVkRu,
    QueryVkRu,
    QueryVkCom,
}

fn try_call_vk_api<T: DeserializeOwned>(
    method: &str,
    token: &str,
    params: &[(&str, String)],
    auth: VkApiAuthStyle,
) -> Result<T, String> {
    let base = match auth {
        VkApiAuthStyle::BearerVkRu | VkApiAuthStyle::QueryVkRu => "https://api.vk.ru",
        VkApiAuthStyle::QueryVkCom => "https://api.vk.com",
    };
    let url = format!("{base}/method/{method}");
    let mut form: Vec<(&str, String)> = vec![("v", VK_API_VERSION.to_string())];
    if matches!(auth, VkApiAuthStyle::QueryVkRu | VkApiAuthStyle::QueryVkCom) {
        form.push(("access_token", token.to_string()));
    }
    form.extend_from_slice(params);

    let mut request = http_client()
        .post(&url)
        .header("User-Agent", "Reizoko/1.0")
        .form(&form);
    if matches!(auth, VkApiAuthStyle::BearerVkRu) {
        request = request.header("Authorization", format!("Bearer {token}"));
    }

    let response = request
        .send()
        .map_err(|error| format!("VK_NETWORK:{error}"))?;

    let status = response.status();
    let text = response
        .text()
        .map_err(|error| format!("VK_NETWORK:read_body:{error}"))?;
    if text.trim().is_empty() {
        return Err(format!("VK_NETWORK:empty_body:status={status}"));
    }

    let envelope: Value = serde_json::from_str(&text).map_err(|error| {
        let preview: String = text.chars().take(160).collect();
        format!("VK_NETWORK:invalid_json:status={status}:{error}:preview={preview}")
    })?;

    if let Some(error) = envelope.get("error") {
        let code = error
            .get("error_code")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let message = error
            .get("error_msg")
            .and_then(|value| value.as_str())
            .unwrap_or("VK API error");
        return Err(map_vk_api_error(code, message));
    }

    let response_value = envelope
        .get("response")
        .cloned()
        .ok_or_else(|| "VK_API:empty_response".to_string())?;

    serde_json::from_value(response_value)
        .map_err(|error| format!("VK_NETWORK:invalid_response_shape:{error}"))
}

fn call_vk_api<T: DeserializeOwned>(
    method: &str,
    token: &str,
    params: &[(&str, String)],
) -> Result<T, String> {
    // Community tokens and legacy VK API tokens work reliably with query auth on vk.com.
    // Try every style before failing so a network/auth error on one host does not block the rest.
    let styles = [
        VkApiAuthStyle::QueryVkCom,
        VkApiAuthStyle::QueryVkRu,
        VkApiAuthStyle::BearerVkRu,
    ];
    let mut api_error: Option<String> = None;
    let mut network_error: Option<String> = None;
    let mut last_error = "VK_UNAUTHORIZED".to_string();

    for style in styles {
        match try_call_vk_api(method, token, params, style) {
            Ok(value) => return Ok(value),
            Err(error) if error.starts_with("VK_API:") => api_error = Some(error),
            Err(error) if error.starts_with("VK_NETWORK:") => {
                network_error.get_or_insert(error);
            }
            Err(error) => last_error = error,
        }
    }

    if let Some(error) = api_error {
        return Err(error);
    }
    if let Some(error) = network_error {
        return Err(error);
    }
    Err(last_error)
}

fn parse_vkid_user_id(value: &Value) -> i64 {
    if let Some(id) = value.as_i64() {
        return id;
    }
    value
        .as_str()
        .and_then(|raw| raw.parse::<i64>().ok())
        .unwrap_or(0)
}

fn fetch_vkid_user_info(token: &str, app_id: &str) -> Result<VkUserInfo, String> {
    let response = http_client()
        .post("https://id.vk.ru/oauth2/user_info")
        .header("Authorization", format!("Bearer {token}"))
        .form(&[("client_id", app_id), ("access_token", token)])
        .send()
        .map_err(|error| format!("VK_NETWORK:{error}"))?;

    let body: Value = response
        .json()
        .map_err(|error| format!("VK_NETWORK:invalid_json:{error}"))?;

    if let Some(error) = body.get("error").and_then(|value| value.as_str()) {
        let description = body
            .get("error_description")
            .and_then(|value| value.as_str())
            .unwrap_or(error);
        return Err(format!("VK_OAUTH:{error}:{description}"));
    }

    let user = body
        .get("user")
        .ok_or_else(|| "VK_OAUTH:missing_user".to_string())?;

    Ok(VkUserInfo {
        id: parse_vkid_user_id(user.get("user_id").unwrap_or(&Value::Null)),
        first_name: user
            .get("first_name")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string(),
        last_name: user
            .get("last_name")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string(),
        screen_name: None,
        photo_url: user.get("avatar").and_then(|value| value.as_str()).map(str::to_string),
    })
}

fn read_token(secret_ref: &str) -> Result<String, String> {
    get_secret(secret_ref)
}

#[tauri::command]
pub fn vk_open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|error| format!("VK_OAUTH_BROWSER:{error}"))
}

#[tauri::command]
pub fn vk_fetch_vkid_profile(secret_ref: String, app_id: String) -> Result<VkUserInfo, String> {
    let token = read_token(&secret_ref)?;
    let app_id = app_id.trim();
    if app_id.is_empty() {
        return Err("VK_OAUTH:missing_app_id".to_string());
    }
    fetch_vkid_user_info(&token, app_id)
}

#[tauri::command]
pub fn vk_get_current_user(secret_ref: String) -> Result<VkUserInfo, String> {
    let token = read_token(&secret_ref)?;
    let users: Vec<Value> = call_vk_api("users.get", &token, &[
        ("fields", "photo_100,screen_name".to_string()),
    ])?;
    let user = users.into_iter().next().ok_or_else(|| "VK_API:empty_user".to_string())?;
    Ok(parse_user(&user))
}

#[tauri::command]
pub fn vk_list_manageable_communities(secret_ref: String) -> Result<Vec<VkCommunityInfo>, String> {
    let token = read_token(&secret_ref)?;
    let groups: Vec<Value> = call_vk_api("groups.get", &token, &[
        ("extended", "1".to_string()),
        ("filter", "admin".to_string()),
        ("fields", "can_post,photo_100,screen_name".to_string()),
    ])?;
    Ok(groups.into_iter().filter_map(|g| parse_community(&g)).collect())
}

#[tauri::command]
pub fn vk_resolve_screen_name(secret_ref: String, screen_name: String) -> Result<VkResolvedObject, String> {
    let token = read_token(&secret_ref)?;
    let resolved: Value = call_vk_api("utils.resolveScreenName", &token, &[("screen_name", screen_name)])?;
    let object_type = resolved
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "VK_API:invalid_resolve".to_string())?
        .to_string();
    let object_id = resolved
        .get("object_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "VK_API:invalid_resolve".to_string())?;
    Ok(VkResolvedObject {
        object_type,
        object_id,
        screen_name: resolved.get("screen_name").and_then(|v| v.as_str()).map(str::to_string),
    })
}

#[tauri::command]
pub fn vk_get_user_info(secret_ref: String, user_id: i64) -> Result<VkUserInfo, String> {
    let token = read_token(&secret_ref)?;
    let users: Vec<Value> = call_vk_api("users.get", &token, &[
        ("user_ids", user_id.to_string()),
        ("fields", "photo_100,screen_name".to_string()),
    ])?;
    let user = users.into_iter().next().ok_or_else(|| "VK_API:empty_user".to_string())?;
    Ok(parse_user(&user))
}

#[tauri::command]
pub fn vk_get_community_info(secret_ref: String, community_id: i64) -> Result<VkCommunityInfo, String> {
    let token = read_token(&secret_ref)?;
    let groups: Vec<Value> = call_vk_api("groups.getById", &token, &[
        ("group_ids", community_id.to_string()),
        ("fields", "can_post,photo_100,screen_name".to_string()),
    ])?;
    let group = groups.into_iter().next().ok_or_else(|| "VK_API:empty_group".to_string())?;
    parse_community(&group).ok_or_else(|| "VK_API:invalid_group".to_string())
}

#[tauri::command]
pub fn vk_check_publication_target(
    secret_ref: String,
    target_type: String,
    owner_id: i64,
    community_id: Option<i64>,
    post_as_group: Option<bool>,
) -> Result<VkPublicationCapability, String> {
    let token = read_token(&secret_ref)?;

    if target_type == "community_wall" {
        let gid = community_id.unwrap_or_else(|| owner_id.abs());
        let groups: Vec<Value> = call_vk_api("groups.getById", &token, &[
            ("group_ids", gid.to_string()),
            ("fields", "can_post".to_string()),
        ])?;
        let group = groups.into_iter().next();
        let can_post = group
            .as_ref()
            .and_then(|g| g.get("can_post"))
            .and_then(|v| v.as_i64())
            .map(|v| v == 1)
            .unwrap_or(false);
        if !can_post {
            return Ok(VkPublicationCapability {
                can_post: false,
                can_post_as_group: Some(false),
                reason: Some("Недостаточно прав для публикации в это сообщество.".to_string()),
                can_upload_photos: None,
            });
        }
        return Ok(VkPublicationCapability {
            can_post: true,
            can_post_as_group: Some(post_as_group.unwrap_or(true)),
            reason: None,
            can_upload_photos: None,
        });
    }

    if target_type == "self_wall" {
        return Ok(VkPublicationCapability {
            can_post: true,
            can_post_as_group: None,
            reason: None,
            can_upload_photos: None,
        });
    }

    // user_wall — VK API does not expose a reliable pre-check; attempt is validated at publish time.
    Ok(VkPublicationCapability {
        can_post: true,
        can_post_as_group: None,
        reason: None,
        can_upload_photos: None,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkPublishPhotoInput {
    pub media_id: String,
    pub local_path: String,
}

#[tauri::command]
pub fn vk_publish_wall_post(
    secret_ref: String,
    owner_id: i64,
    message: String,
    from_group: Option<bool>,
    group_id: Option<i64>,
    photos: Option<Vec<VkPublishPhotoInput>>,
    photo_upload_secret_ref: Option<String>,
) -> Result<VkWallPostResult, String> {
    let post_token = read_token(&secret_ref)?;
    let upload_token = match photo_upload_secret_ref {
        Some(ref upload_ref) if !upload_ref.is_empty() && upload_ref != &secret_ref => {
            read_token(upload_ref)?
        }
        _ => post_token.clone(),
    };
    let mut attachments: Vec<String> = Vec::new();

    if let Some(photo_items) = photos {
        for photo in photo_items {
            let attachment = upload_wall_photo(&upload_token, owner_id, group_id, &photo.local_path)?;
            attachments.push(attachment);
        }
    }

    let mut params: Vec<(&str, String)> = vec![
        ("owner_id", owner_id.to_string()),
        ("message", message),
    ];
    if from_group.unwrap_or(false) {
        params.push(("from_group", "1".to_string()));
    }
    if !attachments.is_empty() {
        params.push(("attachments", attachments.join(",")));
    }

    let post_id: i64 = call_vk_api("wall.post", &post_token, &params)?;
    Ok(VkWallPostResult { post_id, owner_id })
}

fn upload_wall_photo(
    token: &str,
    owner_id: i64,
    group_id: Option<i64>,
    local_path: &str,
) -> Result<String, String> {
    let mut upload_params: Vec<(&str, String)> = Vec::new();
    if owner_id < 0 {
        upload_params.push(("group_id", owner_id.abs().to_string()));
    } else if let Some(gid) = group_id {
        upload_params.push(("group_id", gid.to_string()));
    }

    let server: VkUploadServer = call_vk_api("photos.getWallUploadServer", token, &upload_params)?;

    let path = Path::new(local_path);
    if !path.exists() {
        return Err(format!("VK_MEDIA:file_missing:{local_path}"));
    }

    let file = File::open(path).map_err(|e| format!("VK_MEDIA:open:{e}"))?;
    let part = multipart::Part::reader(file).file_name(
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("photo.jpg")
            .to_string(),
    );
    let form = multipart::Form::new().part("photo", part);

    let upload_response = http_client()
        .post(&server.upload_url)
        .multipart(form)
        .send()
        .map_err(|e| format!("VK_NETWORK:upload:{e}"))?
        .text()
        .map_err(|e| format!("VK_NETWORK:upload_body:{e}"))?;

    let upload_json: Value = serde_json::from_str(&upload_response)
        .map_err(|e| format!("VK_MEDIA:upload_json:{e}"))?;

    let server_str = upload_json
        .get("server")
        .map(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(str::to_string)))
        .flatten()
        .ok_or_else(|| "VK_MEDIA:missing_server".to_string())?;
    let photo = upload_json
        .get("photo")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "VK_MEDIA:missing_photo".to_string())?
        .to_string();
    let hash = upload_json
        .get("hash")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "VK_MEDIA:missing_hash".to_string())?
        .to_string();

    let mut save_params = vec![
        ("server", server_str),
        ("photo", photo),
        ("hash", hash),
    ];
    if owner_id < 0 {
        save_params.push(("group_id", owner_id.abs().to_string()));
    }

    let saved: Vec<VkSavedPhoto> = call_vk_api("photos.saveWallPhoto", token, &save_params)?;
    let photo_saved = saved.into_iter().next().ok_or_else(|| "VK_MEDIA:save_empty".to_string())?;
    Ok(format!("photo{}_{}", photo_saved.owner_id, photo_saved.id))
}

#[tauri::command]
pub fn vk_delete_secret(secret_ref: String) -> Result<(), String> {
    delete_secret(&secret_ref)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkCommunityCapabilities {
    pub can_publish_text: bool,
    pub can_upload_photos: bool,
    pub can_publish_photos: bool,
    pub can_publish_as_community: bool,
    pub photo_upload_via: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkCommunityTokenVerification {
    pub community_id: i64,
    pub owner_id: i64,
    pub display_name: String,
    pub screen_name: Option<String>,
    pub photo_url: Option<String>,
    pub permissions: Vec<String>,
    pub token_group_id: Option<i64>,
    pub token_matches_community: bool,
    pub capabilities: VkCommunityCapabilities,
    pub photo_upload_error_code: Option<i64>,
    pub photo_upload_error_message: Option<String>,
}

fn sanitize_community_token(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| !ch.is_control())
        .collect()
}

fn normalize_community_input(value: &str) -> String {
    let mut normalized = value.trim().to_string();
    if normalized.is_empty() {
        return normalized;
    }
    for prefix in ["https://", "http://", "HTTPS://", "HTTP://"] {
        if let Some(rest) = normalized.strip_prefix(prefix) {
            normalized = rest.to_string();
            break;
        }
    }
    normalized = normalized.trim_start_matches("www.").to_string();
    let lower = normalized.to_lowercase();
    for host in ["m.vk.com/", "vk.com/", "m.vk.ru/", "vk.ru/"] {
        if let Some(rest) = lower.strip_prefix(host) {
            normalized = rest.to_string();
            break;
        }
    }
    if let Some(rest) = normalized.strip_prefix('@') {
        normalized = rest.to_string();
    }
    if let Some(query_index) = normalized.find('?') {
        normalized = normalized[..query_index].to_string();
    }
    normalized = normalized.trim_end_matches('/').to_string();
    let lower = normalized.to_lowercase();
    if let Some(rest) = lower.strip_prefix("club") {
        if rest.chars().all(|c| c.is_ascii_digit()) {
            return rest.to_string();
        }
    }
    if let Some(rest) = lower.strip_prefix("public") {
        if rest.chars().all(|c| c.is_ascii_digit()) {
            return rest.to_string();
        }
    }
    normalized
}

fn parse_vk_error_parts(message: &str) -> Option<(i64, String)> {
    if !message.starts_with("VK_API:") {
        return None;
    }
    let parts: Vec<&str> = message.splitn(3, ':').collect();
    if parts.len() < 3 {
        return None;
    }
    let code = parts[1].parse::<i64>().ok()?;
    Some((code, parts[2].to_string()))
}

fn probe_photo_upload(token: &str, community_id: i64) -> (bool, Option<i64>, Option<String>) {
    let params = vec![("group_id", community_id.to_string())];
    match call_vk_community_api_value("photos.getWallUploadServer", token, &params) {
        Ok(_) => (true, None, None),
        Err(error) => {
            let (code, message) = parse_vk_error_parts(&error).unwrap_or((0, error.clone()));
            (false, Some(code), Some(message))
        }
    }
}

fn call_vk_community_api_value(
    method: &str,
    token: &str,
    params: &[(&str, String)],
) -> Result<Value, String> {
    let mut api_error: Option<String> = None;
    let mut network_error: Option<String> = None;

    for style in [VkApiAuthStyle::QueryVkCom, VkApiAuthStyle::QueryVkRu] {
        match try_call_vk_api::<Value>(method, token, params, style) {
            Ok(value) => return Ok(value),
            Err(error) if error.starts_with("VK_API:") => api_error = Some(error),
            Err(error) if error.starts_with("VK_NETWORK:") => {
                network_error.get_or_insert(error);
            }
            Err(error) => {
                network_error.get_or_insert(error);
            }
        }
    }

    if let Some(error) = api_error {
        return Err(error);
    }
    if let Some(error) = network_error {
        return Err(error);
    }
    Err("VK_UNAUTHORIZED".to_string())
}

fn extract_first_group(value: Value) -> Result<Value, String> {
    if let Some(array) = value.as_array() {
        return array
            .first()
            .cloned()
            .ok_or_else(|| "VK_API:113:Community not found".to_string());
    }
    if let Some(groups) = value.get("groups").and_then(|entry| entry.as_array()) {
        return groups
            .first()
            .cloned()
            .ok_or_else(|| "VK_API:113:Community not found".to_string());
    }
    Err("VK_API:113:Community not found".to_string())
}

fn parse_token_permissions(value: Value) -> Vec<String> {
    if let Some(items) = value.get("permissions").and_then(|entry| entry.as_array()) {
        return items
            .iter()
            .filter_map(|item| {
                item.get("name")
                    .and_then(|name| name.as_str())
                    .map(str::to_string)
            })
            .collect();
    }

    if let Some(mask) = value.get("mask").and_then(|entry| entry.as_i64()) {
        let from_mask = permissions_from_community_mask(mask);
        if !from_mask.is_empty() {
            return from_mask;
        }
    }

    match value {
        Value::Array(items) => items
            .iter()
            .filter_map(|item| {
                item.get("name")
                    .and_then(|name| name.as_str())
                    .map(str::to_string)
                    .or_else(|| item.as_str().map(str::to_string))
            })
            .collect(),
        Value::Object(map) => map
            .values()
            .filter_map(|entry| entry.as_str().map(str::to_string))
            .collect(),
        _ => Vec::new(),
    }
}

fn permissions_from_community_mask(mask: i64) -> Vec<String> {
    const BITS: &[(&str, i64)] = &[
        ("stories", 1 << 0),
        ("photos", 1 << 2),
        ("app_widget", 1 << 6),
        ("messages", 1 << 12),
        ("wall", 1 << 13),
        ("docs", 1 << 17),
        ("manage", 1 << 18),
        ("market", 1 << 27),
    ];
    BITS.iter()
        .filter_map(|(name, bit)| {
            if mask & bit != 0 {
                Some((*name).to_string())
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
pub fn vk_verify_community_token(
    community_input: String,
    access_token: String,
) -> Result<VkCommunityTokenVerification, String> {
    let token = sanitize_community_token(&access_token);
    if token.len() < 16 {
        return Err("VK_COMMUNITY_TOKEN:too_short".to_string());
    }

    let normalized = normalize_community_input(&community_input);
    if normalized.is_empty() {
        return Err("VK_COMMUNITY_TOKEN:empty_community".to_string());
    }

    let community_id = if normalized.chars().all(|c| c.is_ascii_digit()) {
        normalized
            .parse::<i64>()
            .map_err(|_| "VK_COMMUNITY_TOKEN:invalid_id".to_string())?
    } else {
        let resolved = call_vk_community_api_value(
            "utils.resolveScreenName",
            &token,
            &[("screen_name", normalized)],
        )?;
        let object_type = resolved
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        if object_type != "group" && object_type != "page" {
            return Err("VK_COMMUNITY_TOKEN:not_a_community".to_string());
        }
        resolved
            .get("object_id")
            .and_then(|value| value.as_i64())
            .ok_or_else(|| "VK_COMMUNITY_TOKEN:invalid_resolve".to_string())?
    };

    if community_id <= 0 {
        return Err("VK_COMMUNITY_TOKEN:invalid_id".to_string());
    }

    let group_payload = call_vk_community_api_value(
        "groups.getById",
        &token,
        &[
            ("group_ids", community_id.to_string()),
            ("fields", "screen_name,photo_100".to_string()),
        ],
    )?;
    let group = extract_first_group(group_payload)?;

    let token_groups = call_vk_community_api_value(
        "groups.get",
        &token,
        &[
            ("filter", "admin".to_string()),
            ("extended", "0".to_string()),
        ],
    )
    .ok()
    .and_then(|value| value.as_array().cloned())
    .unwrap_or_default();
    let token_group_id = token_groups
        .first()
        .and_then(|value| {
            value
                .get("id")
                .and_then(|id| id.as_i64())
                .or_else(|| value.as_i64())
        });
    let token_matches_community = match token_group_id {
        Some(id) => id == community_id,
        None => true,
    };

    let mut permissions = match call_vk_community_api_value("groups.getTokenPermissions", &token, &[]) {
        Ok(value) => parse_token_permissions(value),
        Err(error) if error.starts_with("VK_API:5:") || error.starts_with("VK_API:15:") => {
            return Err(error);
        }
        Err(_) => Vec::new(),
    };

    let mut has_wall = permissions.iter().any(|name| name.eq_ignore_ascii_case("wall"));
    let mut has_photos = permissions.iter().any(|name| name.eq_ignore_ascii_case("photos"));
    let (can_upload_photos, photo_upload_error_code, photo_upload_error_message) =
        probe_photo_upload(&token, community_id);

    if !has_photos && can_upload_photos {
        has_photos = true;
        if !permissions.iter().any(|name| name.eq_ignore_ascii_case("photos")) {
            permissions.push("photos".to_string());
        }
    }
    if !has_wall && token_matches_community {
        has_wall = true;
        if !permissions.iter().any(|name| name.eq_ignore_ascii_case("wall")) {
            permissions.push("wall".to_string());
        }
    }

    let photo_upload_via = if can_upload_photos || has_photos {
        Some("community_token".to_string())
    } else {
        Some("none".to_string())
    };

    Ok(VkCommunityTokenVerification {
        community_id,
        owner_id: -community_id,
        display_name: group
            .get("name")
            .and_then(|value| value.as_str())
            .unwrap_or("Сообщество")
            .to_string(),
        screen_name: group
            .get("screen_name")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        photo_url: group
            .get("photo_100")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        permissions: permissions.clone(),
        token_group_id,
        token_matches_community,
        capabilities: VkCommunityCapabilities {
            can_publish_text: has_wall,
            can_upload_photos: has_photos || can_upload_photos,
            can_publish_photos: has_photos,
            can_publish_as_community: has_wall,
            photo_upload_via,
            permissions,
        },
        photo_upload_error_code,
        photo_upload_error_message,
    })
}

#[tauri::command]
pub fn vk_probe_community_photo_upload(
    access_token: String,
    community_id: i64,
) -> Result<VkPublicationCapability, String> {
    let token = access_token.trim().to_string();
    let (available, _code, message) = probe_photo_upload(&token, community_id);
    Ok(VkPublicationCapability {
        can_post: true,
        can_post_as_group: Some(true),
        reason: if available {
            None
        } else {
            Some(message.clone().unwrap_or_else(|| "Photo upload unavailable".to_string()))
        },
        can_upload_photos: Some(available),
    })
}

#[tauri::command]
pub fn vk_probe_community_photo_upload_by_secret_ref(
    secret_ref: String,
    community_id: i64,
) -> Result<VkPublicationCapability, String> {
    let token = read_token(&secret_ref)?;
    let (available, _code, message) = probe_photo_upload(&token, community_id);
    Ok(VkPublicationCapability {
        can_post: true,
        can_post_as_group: Some(true),
        reason: if available {
            None
        } else {
            Some(message.clone().unwrap_or_else(|| "Photo upload unavailable".to_string()))
        },
        can_upload_photos: Some(available),
    })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkServerProbeStep {
    pub id: String,
    pub label: String,
    pub channel: String,
    pub status: String,
    pub url: Option<String>,
    pub http_status: Option<u16>,
    pub duration_ms: Option<u64>,
    pub detail: Option<String>,
    pub meta: Option<Value>,
}

fn probe_native_url(
    client: &Client,
    id: &str,
    label: &str,
    url: &str,
    parse_json: bool,
) -> VkServerProbeStep {
    use std::time::Instant;
    let started = Instant::now();
    eprintln!("[reizoko:vk-probe-native] GET {url}");
    match client.get(url).send() {
        Ok(response) => {
            let duration_ms = started.elapsed().as_millis() as u64;
            let http_status = response.status().as_u16();
            let mut detail = format!("HTTP {http_status}, {duration_ms} ms");
            let status = if response.status().is_success() {
                "ok"
            } else {
                "fail"
            };
            let mut meta: Option<Value> = None;
            if parse_json && response.status().is_success() {
                if let Ok(body) = response.json::<Value>() {
                    detail.push_str("; JSON ok");
                    if id == "diagnostics" {
                        meta = Some(serde_json::json!({
                            "configured": body.get("configured").cloned().unwrap_or(Value::Null),
                            "serverOk": body.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
                        }));
                    }
                } else {
                    detail.push_str("; ответ не JSON");
                }
            }
            VkServerProbeStep {
                id: id.to_string(),
                label: label.to_string(),
                channel: "native".to_string(),
                status: status.to_string(),
                url: Some(url.to_string()),
                http_status: Some(http_status),
                duration_ms: Some(duration_ms),
                detail: Some(detail),
                meta,
            }
        }
        Err(error) => VkServerProbeStep {
            id: id.to_string(),
            label: label.to_string(),
            channel: "native".to_string(),
            status: "fail".to_string(),
            url: Some(url.to_string()),
            http_status: None,
            duration_ms: Some(started.elapsed().as_millis() as u64),
            detail: Some(error.to_string()),
            meta: None,
        },
    }
}

#[tauri::command]
pub fn vk_probe_reizoko_server(server_base_url: String) -> Result<Vec<VkServerProbeStep>, String> {
    let base = server_base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Пустой адрес сервера Reizoko".to_string());
    }
    let client = http_client();
    Ok(vec![
        probe_native_url(
            client,
            "health",
            "Health endpoint (native HTTP)",
            &format!("{base}/reizoko-health.php"),
            true,
        ),
        probe_native_url(
            client,
            "diagnostics",
            "Diagnostics endpoint (native HTTP)",
            &format!("{base}/vk-diagnostics.php"),
            true,
        ),
        probe_native_url(
            client,
            "callback",
            "OAuth callback (native HTTP)",
            &format!("{base}/vk-callback.php"),
            false,
        ),
    ])
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VkOAuthPollResult {
    pub status: String,
    pub access_token: Option<String>,
    pub user_id: Option<i64>,
    pub expires_in: Option<i64>,
    pub scope: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn vk_poll_oauth_status(server_base_url: String, session_id: String) -> Result<VkOAuthPollResult, String> {
    let base = server_base_url.trim().trim_end_matches('/');
    let session = session_id.trim();
    if base.is_empty() {
        return Err("Пустой адрес сервера Reizoko".to_string());
    }
    if session.is_empty() {
        return Err("Пустой идентификатор OAuth-сессии".to_string());
    }

    let url = format!("{base}/vk-status.php");
    eprintln!("[reizoko:vk-oauth-native] GET {url}?session=<redacted>");

    let response = http_client()
        .get(&url)
        .query(&[("session", session)])
        .send()
        .map_err(|error| format!("VK_OAUTH_POLL:{error}"))?;

    let is_success = response.status().is_success();
    let http_status = response.status().as_u16();
    let body: Value = response
        .json()
        .map_err(|error| format!("VK_OAUTH_POLL:invalid_json:{error}"))?;

    if http_status == 404 {
        return Ok(VkOAuthPollResult {
            status: "expired".to_string(),
            access_token: None,
            user_id: None,
            expires_in: None,
            scope: None,
            error: body
                .get("error")
                .and_then(|value| value.as_str())
                .map(str::to_string),
        });
    }

    if !is_success {
        return Ok(VkOAuthPollResult {
            status: "error".to_string(),
            access_token: None,
            user_id: None,
            expires_in: None,
            scope: None,
            error: body
                .get("error")
                .and_then(|value| value.as_str())
                .map(str::to_string)
                .or_else(|| Some(format!("HTTP {http_status}"))),
        });
    }

    let status = body
        .get("status")
        .and_then(|value| value.as_str())
        .unwrap_or("error");

    if status == "pending" {
        return Ok(VkOAuthPollResult {
            status: "pending".to_string(),
            access_token: None,
            user_id: None,
            expires_in: None,
            scope: None,
            error: None,
        });
    }

    if status == "success" {
        return Ok(VkOAuthPollResult {
            status: "success".to_string(),
            access_token: body
                .get("accessToken")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            user_id: body.get("userId").and_then(|value| value.as_i64()),
            expires_in: body.get("expiresIn").and_then(|value| value.as_i64()),
            scope: body.get("scope").and_then(|value| value.as_str()).map(str::to_string),
            error: None,
        });
    }

    Ok(VkOAuthPollResult {
        status: "error".to_string(),
        access_token: None,
        user_id: None,
        expires_in: None,
        scope: None,
        error: body
            .get("error")
            .and_then(|value| value.as_str())
            .map(str::to_string)
            .or_else(|| Some("OAuth failed".to_string())),
    })
}

fn parse_user(value: &Value) -> VkUserInfo {
    VkUserInfo {
        id: value.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
        first_name: value
            .get("first_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        last_name: value
            .get("last_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        screen_name: value.get("screen_name").and_then(|v| v.as_str()).map(str::to_string),
        photo_url: value.get("photo_100").and_then(|v| v.as_str()).map(str::to_string),
    }
}

fn parse_community(value: &Value) -> Option<VkCommunityInfo> {
    Some(VkCommunityInfo {
        id: value.get("id").and_then(|v| v.as_i64())?,
        name: value.get("name").and_then(|v| v.as_str())?.to_string(),
        screen_name: value.get("screen_name").and_then(|v| v.as_str()).map(str::to_string),
        photo_url: value.get("photo_100").and_then(|v| v.as_str()).map(str::to_string),
        can_post: value
            .get("can_post")
            .and_then(|v| v.as_i64())
            .map(|v| v == 1),
    })
}

#[cfg(test)]
mod tests {
    use super::{parse_token_permissions, permissions_from_community_mask};
    use serde_json::json;

    #[test]
    fn parses_nested_token_permissions_object() {
        let value = json!({
            "mask": 134623237,
            "permissions": [
                {"name": "photos", "setting": 4},
                {"name": "wall", "setting": 8192},
                {"name": "manage", "setting": 262144}
            ]
        });
        let parsed = parse_token_permissions(value);
        assert!(parsed.iter().any(|name| name.eq_ignore_ascii_case("photos")));
        assert!(parsed.iter().any(|name| name.eq_ignore_ascii_case("wall")));
        assert!(parsed.iter().any(|name| name.eq_ignore_ascii_case("manage")));
    }

    #[test]
    fn parses_permissions_from_mask_when_array_missing() {
        let parsed = permissions_from_community_mask(4);
        assert!(parsed.iter().any(|name| name == "photos"));
    }
}
