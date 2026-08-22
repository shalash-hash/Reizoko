use crate::credentials::{delete_secret, get_secret, has_secret, set_secret};
use reqwest::blocking::{multipart, Client};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::fs::File;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Duration;

fn read_token(secret_ref: &str) -> Result<String, String> {
    get_secret(secret_ref)
}

fn store_token(secret_ref: &str, token: &str) -> Result<(), String> {
    set_secret(secret_ref, token)
}

fn remove_token(secret_ref: &str) -> Result<(), String> {
    delete_secret(secret_ref)
}

fn bot_secret_ref(connection_id: &str) -> String {
    format!("connection/{connection_id}/bot_token")
}

fn api_url(token: &str, method: &str) -> String {
    format!("https://api.telegram.org/bot{token}/{method}")
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramBotInfo {
    pub id: i64,
    pub is_bot: bool,
    pub first_name: String,
    pub username: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramChatInfo {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub title: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TelegramApiChat {
    id: i64,
    #[serde(rename = "type")]
    chat_type: String,
    title: Option<String>,
    username: Option<String>,
}

impl From<TelegramApiChat> for TelegramChatInfo {
    fn from(chat: TelegramApiChat) -> Self {
        Self {
            id: chat.id,
            chat_type: chat.chat_type,
            title: chat.title,
            username: chat.username,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramChatValidation {
    pub chat: TelegramChatInfo,
    pub can_publish: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TelegramApiResponse<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
    error_code: Option<i64>,
    parameters: Option<TelegramErrorParameters>,
}

#[derive(Debug, Deserialize)]
struct TelegramErrorParameters {
    retry_after: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct TelegramMessage {
    message_id: i64,
}

#[derive(Debug, Deserialize)]
struct TelegramUser {
    id: i64,
    is_bot: bool,
    first_name: String,
    username: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TelegramChatMember {
    status: String,
    can_post_messages: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramConnectionDiagnostics {
    pub credential_exists: bool,
    pub get_me_success: bool,
    pub normalized_chat_id: Option<String>,
    pub get_chat_transport: Option<String>,
    pub get_chat_http_status: Option<u16>,
    pub telegram_error_code: Option<i64>,
    pub telegram_description_sanitized: Option<String>,
}

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("telegram http client")
    })
}

fn sanitize_telegram_description(description: &str) -> String {
    description
        .split_whitespace()
        .map(|part| {
            if part.contains(':') && part.chars().next().is_some_and(|c| c.is_ascii_digit()) {
                "<redacted-token-like>"
            } else {
                part
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn map_transport_error(error: reqwest::Error) -> String {
    let category = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_request() {
        "request"
    } else if error.is_body() {
        "body"
    } else {
        "transport"
    };
    eprintln!(
        "TELEGRAM_TRANSPORT_RESULT category={category} is_timeout={} is_connect={} is_request={} is_body={} httpStatus={:?}",
        error.is_timeout(),
        error.is_connect(),
        error.is_request(),
        error.is_body(),
        error.status().map(|status| status.as_u16()),
    );
    format!("TELEGRAM_NETWORK:{category}")
}

fn log_telegram_request(method: &str, chat_id: Option<&str>) {
    match chat_id {
        Some(chat_id) => eprintln!("TELEGRAM_REQUEST method={method} chatId={chat_id}"),
        None => eprintln!("TELEGRAM_REQUEST method={method}"),
    }
}

fn log_telegram_api_result(
    ok: bool,
    http_status: u16,
    telegram_error_code: Option<i64>,
    description: Option<&str>,
) {
    if ok {
        eprintln!("TELEGRAM_API_RESULT ok=true httpStatus={http_status}");
        return;
    }
    let description = description
        .map(sanitize_telegram_description)
        .unwrap_or_else(|| "unknown".to_string());
    eprintln!(
        "TELEGRAM_API_RESULT ok=false httpStatus={http_status} telegramErrorCode={} description={description}",
        telegram_error_code
            .map(|code| code.to_string())
            .unwrap_or_else(|| "none".to_string())
    );
}

fn parse_telegram_response<T: DeserializeOwned>(body: &str) -> Result<TelegramApiResponse<T>, String> {
    serde_json::from_str(body).map_err(|error| {
        eprintln!("TELEGRAM_API_RESULT parse_error=invalid_json detail={error}");
        "TELEGRAM_API:parse:invalid telegram json".to_string()
    })
}

fn map_api_error(description: Option<String>, error_code: Option<i64>, parameters: Option<TelegramErrorParameters>) -> String {
    let message = description.unwrap_or_else(|| "Telegram API error".to_string());
    if error_code == Some(401) {
        return "TELEGRAM_UNAUTHORIZED".to_string();
    }
    if error_code == Some(403) {
        return "TELEGRAM_FORBIDDEN".to_string();
    }
    if error_code == Some(400) && message.to_lowercase().contains("chat not found") {
        return "TELEGRAM_CHAT_NOT_FOUND".to_string();
    }
    if let Some(retry_after) = parameters.and_then(|p| p.retry_after) {
        return format!("RATE_LIMIT:{retry_after}:{message}");
    }
    if let Some(code) = error_code {
        return format!("TELEGRAM_API:{code}:{message}");
    }
    format!("TELEGRAM_API:unknown:{message}")
}

fn call_telegram_api<T: DeserializeOwned>(
    token: &str,
    method: &str,
    params: &[(&str, &str)],
) -> Result<T, String> {
    let chat_id = params
        .iter()
        .find_map(|(key, value)| (*key == "chat_id").then_some(*value));
    log_telegram_request(method, chat_id);

    let response = http_client()
        .post(api_url(token, method))
        .form(params)
        .send()
        .map_err(map_transport_error)?;

    let http_status = response.status().as_u16();
    let body = response.text().map_err(map_transport_error)?;
    eprintln!(
        "TELEGRAM_TRANSPORT_RESULT httpStatus={http_status} bodyBytes={}",
        body.len()
    );

    let parsed: TelegramApiResponse<T> = parse_telegram_response(&body)?;
    if !parsed.ok {
        log_telegram_api_result(
            false,
            http_status,
            parsed.error_code,
            parsed.description.as_deref(),
        );
        return Err(map_api_error(
            parsed.description,
            parsed.error_code,
            parsed.parameters,
        ));
    }

    log_telegram_api_result(true, http_status, None, None);
    parsed
        .result
        .ok_or_else(|| "TELEGRAM_API:empty:Telegram API returned empty result".to_string())
}

fn post_json<T: DeserializeOwned>(
    token: &str,
    method: &str,
    payload: Value,
) -> Result<T, String> {
    let mut params: Vec<(&str, String)> = Vec::new();
    if let Some(chat_id) = payload.get("chat_id").and_then(|value| {
        value
            .as_str()
            .map(str::to_string)
            .or_else(|| value.as_i64().map(|id| id.to_string()))
    }) {
        params.push(("chat_id", chat_id));
    }
    if let Some(user_id) = payload.get("user_id").and_then(|value| value.as_i64()) {
        params.push(("user_id", user_id.to_string()));
    }
    if let Some(text) = payload.get("text").and_then(|value| value.as_str()) {
        params.push(("text", text.to_string()));
    }
    if let Some(parse_mode) = payload.get("parse_mode").and_then(|value| value.as_str()) {
        params.push(("parse_mode", parse_mode.to_string()));
    }

    let borrowed: Vec<(&str, &str)> = params
        .iter()
        .map(|(key, value)| (*key, value.as_str()))
        .collect();
    call_telegram_api(token, method, &borrowed)
}

fn should_remove_stored_token_on_connect_error(error: &str) -> bool {
    error == "TELEGRAM_UNAUTHORIZED"
        || error.contains("Token не принадлежит боту")
        || error == "SECRET_STORE_VERIFY_FAILED"
        || error == "SECRET_MISSING"
        || error.starts_with("CREDENTIAL_STORE_ERROR")
}

#[tauri::command]
pub fn telegram_connect_bot(connection_id: String, token: String) -> Result<TelegramBotInfo, String> {
    let secret_ref = bot_secret_ref(&connection_id);
    if let Err(error) = store_token(&secret_ref, &token) {
        if should_remove_stored_token_on_connect_error(&error) {
            let _ = remove_token(&secret_ref);
        }
        return Err(error);
    }

    let stored_token = match read_token(&secret_ref) {
        Ok(value) => value,
        Err(error) => {
            if should_remove_stored_token_on_connect_error(&error) {
                let _ = remove_token(&secret_ref);
            }
            return Err(error);
        }
    };

    let user: TelegramUser = match post_json(&stored_token, "getMe", serde_json::json!({})) {
        Ok(user) => user,
        Err(error) => {
            if should_remove_stored_token_on_connect_error(&error) {
                let _ = remove_token(&secret_ref);
            }
            return Err(error);
        }
    };

    if !user.is_bot {
        let _ = remove_token(&secret_ref);
        return Err("Token не принадлежит боту".to_string());
    }

    Ok(TelegramBotInfo {
        id: user.id,
        is_bot: user.is_bot,
        first_name: user.first_name,
        username: user.username,
    })
}

#[tauri::command]
pub fn telegram_validate_chat(
    secret_ref: String,
    chat_ref: String,
    bot_user_id: i64,
) -> Result<TelegramChatValidation, String> {
    let token = read_token(&secret_ref)?;
    eprintln!(
        "TELEGRAM_VALIDATE_CHAT secretRef={secret_ref} chatRef={chat_ref} botUserId={bot_user_id}"
    );
    let api_chat: TelegramApiChat =
        call_telegram_api(&token, "getChat", &[("chat_id", chat_ref.as_str())])?;
    let chat: TelegramChatInfo = api_chat.into();
    let chat_id = chat.id.to_string();
    let bot_id = bot_user_id.to_string();
    let member: TelegramChatMember = call_telegram_api(
        &token,
        "getChatMember",
        &[("chat_id", chat_id.as_str()), ("user_id", bot_id.as_str())],
    )?;
    let can_publish = matches!(member.status.as_str(), "administrator" | "creator")
        && member.can_post_messages.unwrap_or(true);
    let reason = if can_publish {
        None
    } else {
        Some("TELEGRAM_PERMISSION_DENIED".to_string())
    };
    Ok(TelegramChatValidation {
        chat,
        can_publish,
        reason,
    })
}

#[tauri::command]
pub fn telegram_send_message(
    secret_ref: String,
    chat_id: String,
    text: String,
    parse_mode: Option<String>,
) -> Result<i64, String> {
    let token = read_token(&secret_ref)?;
    let mut payload = serde_json::json!({ "chat_id": chat_id, "text": text });
    if let Some(mode) = parse_mode {
        payload["parse_mode"] = Value::String(mode);
    }
    let message: TelegramMessage = post_json(&token, "sendMessage", payload)?;
    Ok(message.message_id)
}

#[tauri::command]
pub fn telegram_send_photo(
    secret_ref: String,
    chat_id: String,
    photo_path: String,
    caption: Option<String>,
    parse_mode: Option<String>,
) -> Result<i64, String> {
    let token = read_token(&secret_ref)?;
    let path = Path::new(&photo_path);
    if !path.exists() {
        return Err("Не найден локальный медиафайл.".to_string());
    }
    let file = File::open(path).map_err(|error| error.to_string())?;
    let part = multipart::Part::reader(file).file_name(
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("photo.jpg")
            .to_string(),
    );
    let mut form = multipart::Form::new()
        .text("chat_id", chat_id)
        .part("photo", part);
    if let Some(value) = caption {
        if !value.is_empty() {
            form = form.text("caption", value);
        }
    }
    if let Some(mode) = parse_mode {
        form = form.text("parse_mode", mode);
    }
    let client = http_client();
    let response = client
        .post(api_url(&token, "sendPhoto"))
        .multipart(form)
        .send()
        .map_err(map_transport_error)?;
    let http_status = response.status().as_u16();
    let body_text = response.text().map_err(map_transport_error)?;
    let body: TelegramApiResponse<TelegramMessage> = parse_telegram_response(&body_text)?;
    if !body.ok {
        log_telegram_api_result(
            false,
            http_status,
            body.error_code,
            body.description.as_deref(),
        );
        return Err(map_api_error(body.description, body.error_code, body.parameters));
    }
    Ok(body.result.ok_or_else(|| "Telegram API returned empty result".to_string())?.message_id)
}

#[tauri::command]
pub fn telegram_send_media_group(
    secret_ref: String,
    chat_id: String,
    photo_paths: Vec<String>,
    caption: Option<String>,
    parse_mode: Option<String>,
) -> Result<Vec<i64>, String> {
    let token = read_token(&secret_ref)?;
    let mut media: Vec<Value> = Vec::new();
    for (index, photo_path) in photo_paths.iter().enumerate() {
        let path = Path::new(photo_path);
        if !path.exists() {
            return Err("Не найден локальный медиафайл.".to_string());
        }
        let attach_name = format!("photo{index}");
        let mut item = serde_json::json!({
            "type": "photo",
            "media": format!("attach://{attach_name}")
        });
        if index == 0 {
            if let Some(value) = &caption {
                if !value.is_empty() {
                    item["caption"] = Value::String(value.clone());
                }
            }
            if let Some(mode) = &parse_mode {
                item["parse_mode"] = Value::String(mode.clone());
            }
        }
        media.push(item);
    }

    let mut form = multipart::Form::new()
        .text("chat_id", chat_id.clone())
        .text("media", serde_json::to_string(&media).map_err(|error| error.to_string())?);
    for (index, photo_path) in photo_paths.iter().enumerate() {
        let path = Path::new(photo_path);
        let file = File::open(path).map_err(|error| error.to_string())?;
        let part = multipart::Part::reader(file).file_name(
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("photo.jpg")
                .to_string(),
        );
        form = form.part(format!("photo{index}"), part);
    }

    let client = http_client();
    let response = client
        .post(api_url(&token, "sendMediaGroup"))
        .multipart(form)
        .send()
        .map_err(map_transport_error)?;
    let http_status = response.status().as_u16();
    let body_text = response.text().map_err(map_transport_error)?;
    let body: TelegramApiResponse<Vec<TelegramMessage>> = parse_telegram_response(&body_text)?;
    if !body.ok {
        log_telegram_api_result(
            false,
            http_status,
            body.error_code,
            body.description.as_deref(),
        );
        return Err(map_api_error(body.description, body.error_code, body.parameters));
    }
    Ok(body
        .result
        .unwrap_or_default()
        .into_iter()
        .map(|message| message.message_id)
        .collect())
}

#[tauri::command]
pub fn telegram_delete_secret(secret_ref: String) -> Result<(), String> {
    remove_token(&secret_ref)
}

#[tauri::command]
pub fn telegram_diagnose_connection(
    secret_ref: String,
    chat_input: String,
) -> Result<TelegramConnectionDiagnostics, String> {
    let credential_exists = has_secret(&secret_ref);
    let mut diagnostics = TelegramConnectionDiagnostics {
        credential_exists,
        get_me_success: false,
        normalized_chat_id: Some(chat_input.trim().to_string()),
        get_chat_transport: None,
        get_chat_http_status: None,
        telegram_error_code: None,
        telegram_description_sanitized: None,
    };

    if !credential_exists {
        return Ok(diagnostics);
    }

    let token = read_token(&secret_ref)?;
    match call_telegram_api::<TelegramUser>(&token, "getMe", &[]) {
        Ok(_) => diagnostics.get_me_success = true,
        Err(error) => {
            diagnostics.get_chat_transport = Some(error);
            return Ok(diagnostics);
        }
    }

    let chat_ref = chat_input.trim();
    if chat_ref.is_empty() {
        return Ok(diagnostics);
    }

    log_telegram_request("getChat", Some(chat_ref));
    let response = http_client()
        .post(api_url(&token, "getChat"))
        .form(&[("chat_id", chat_ref)])
        .send();

    let response = match response {
        Ok(value) => value,
        Err(error) => {
            diagnostics.get_chat_transport = Some(map_transport_error(error));
            return Ok(diagnostics);
        }
    };

    diagnostics.get_chat_http_status = Some(response.status().as_u16());
    let body = match response.text() {
        Ok(value) => value,
        Err(error) => {
            diagnostics.get_chat_transport = Some(map_transport_error(error));
            return Ok(diagnostics);
        }
    };

    let parsed: TelegramApiResponse<TelegramApiChat> = match parse_telegram_response(&body) {
        Ok(value) => value,
        Err(error) => {
            diagnostics.get_chat_transport = Some(error);
            return Ok(diagnostics);
        }
    };

    diagnostics.telegram_error_code = parsed.error_code;
    diagnostics.telegram_description_sanitized = parsed
        .description
        .as_deref()
        .map(sanitize_telegram_description);

    if parsed.ok {
        diagnostics.get_chat_transport = Some("ok".to_string());
    } else {
        diagnostics.get_chat_transport = Some(map_api_error(
            parsed.description,
            parsed.error_code,
            parsed.parameters,
        ));
    }

    Ok(diagnostics)
}

#[cfg(test)]
mod tests {
    use super::{
        map_api_error, parse_telegram_response, sanitize_telegram_description,
        should_remove_stored_token_on_connect_error, TelegramApiChat, TelegramApiResponse,
    };

    #[test]
    fn deserializes_telegram_channel_get_chat_response() {
        let body = r#"{
            "ok": true,
            "result": {
                "id": -1002672056359,
                "title": "Test",
                "username": "reizoko_test",
                "type": "channel",
                "can_send_gift": true,
                "has_visible_history": true
            }
        }"#;
        let parsed: TelegramApiResponse<TelegramApiChat> =
            parse_telegram_response(body).expect("telegram channel response should parse");
        assert!(parsed.ok);
        let chat = parsed.result.expect("chat result");
        assert_eq!(chat.username.as_deref(), Some("reizoko_test"));
        assert_eq!(chat.chat_type, "channel");
    }

    #[test]
    fn parses_telegram_api_error_without_network_classification() {
        let body = r#"{
            "ok": false,
            "error_code": 400,
            "description": "Bad Request: chat not found"
        }"#;
        let parsed: TelegramApiResponse<TelegramApiChat> =
            parse_telegram_response(body).expect("telegram api error json should parse");
        assert!(!parsed.ok);
        let mapped = map_api_error(parsed.description, parsed.error_code, None);
        assert_eq!(mapped, "TELEGRAM_CHAT_NOT_FOUND");
        assert!(!mapped.starts_with("TELEGRAM_NETWORK"));
    }

    #[test]
    fn sanitize_telegram_description_redacts_token_like_values() {
        let sanitized = sanitize_telegram_description("Bad Request from 123456:ABCDEF");
        assert!(!sanitized.contains("ABCDEF"));
        assert!(sanitized.contains("redacted-token-like"));
    }

    #[test]
    fn maps_chat_not_found_to_structured_code() {
        let message = map_api_error(
            Some("Bad Request: chat not found".to_string()),
            Some(400),
            None,
        );
        assert_eq!(message, "TELEGRAM_CHAT_NOT_FOUND");
    }

    #[test]
    fn maps_forbidden_to_structured_code() {
        let message = map_api_error(Some("Forbidden".to_string()), Some(403), None);
        assert_eq!(message, "TELEGRAM_FORBIDDEN");
    }

    #[test]
    fn keeps_stored_token_on_transient_connect_errors() {
        assert!(!should_remove_stored_token_on_connect_error("TELEGRAM_NETWORK:connect"));
        assert!(!should_remove_stored_token_on_connect_error("TELEGRAM_CHAT_NOT_FOUND"));
        assert!(!should_remove_stored_token_on_connect_error("RATE_LIMIT:30:Too many requests"));
        assert!(should_remove_stored_token_on_connect_error("TELEGRAM_UNAUTHORIZED"));
        assert!(should_remove_stored_token_on_connect_error("SECRET_STORE_VERIFY_FAILED"));
    }
}
