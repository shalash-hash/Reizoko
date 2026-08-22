use keyring::Entry;
use std::thread;
use std::time::Duration;

/// Windows Credential Manager service name.
/// Same for dev (`tauri dev`) and release builds — keyed by service + storage key, not exe path.
pub const CREDENTIAL_SERVICE: &str = "reizoko";

/// Logical `secretRef` values use slashes (`connection/{id}/bot_token`).
/// Windows keyring is more reliable with dot-separated storage keys.
pub fn storage_key(secret_ref: &str) -> String {
    secret_ref.replace('/', ".")
}

fn resolve_keys(secret_ref: &str) -> Vec<String> {
    let dotted = storage_key(secret_ref);
    if dotted == secret_ref {
        vec![dotted]
    } else {
        vec![dotted, secret_ref.to_string()]
    }
}

fn credential_entry(storage_key: &str) -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, storage_key).map_err(|error| error.to_string())
}

fn log_diag(event: &str, fields: &[(&str, String)]) {
    let suffix = fields
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join(" ");
    if suffix.is_empty() {
        eprintln!("{event}");
    } else {
        eprintln!("{event} {suffix}");
    }
}

pub fn sanitize_keyring_error(error: keyring::Error) -> String {
    match error {
        keyring::Error::NoEntry => "SECRET_MISSING".to_string(),
        _ => "CREDENTIAL_STORE_ERROR".to_string(),
    }
}

pub fn keyring_error_category(error: &keyring::Error) -> &'static str {
    match error {
        keyring::Error::NoEntry => "NoEntry",
        keyring::Error::TooLong(_, _) => "TooLong",
        keyring::Error::Invalid(_, _) => "Invalid",
        keyring::Error::NoStorageAccess(_) => "NoStorageAccess",
        keyring::Error::BadEncoding(_) => "BadEncoding",
        keyring::Error::PlatformFailure(_) => "PlatformFailure",
        keyring::Error::Ambiguous(_) => "Ambiguous",
        _ => "Unknown",
    }
}

fn verify_secret_readable(secret_ref: &str, primary_key: &str) -> Result<(), String> {
    log_diag(
        "SECRET_STORE_VERIFY_BEGIN",
        &[
            ("service", CREDENTIAL_SERVICE.to_string()),
            ("secretRef", secret_ref.to_string()),
            ("storageKey", primary_key.to_string()),
        ],
    );

    const MAX_ATTEMPTS: u32 = 5;
    for attempt in 1..=MAX_ATTEMPTS {
        if has_secret(secret_ref) {
            log_diag(
                "SECRET_STORE_VERIFY_OK",
                &[
                    ("secretRef", secret_ref.to_string()),
                    ("attempt", attempt.to_string()),
                ],
            );
            return Ok(());
        }
        if attempt < MAX_ATTEMPTS {
            thread::sleep(Duration::from_millis(50 * u64::from(attempt)));
        }
    }

    log_diag(
        "SECRET_STORE_VERIFY_FAILED",
        &[
            ("secretRef", secret_ref.to_string()),
            ("storageKey", primary_key.to_string()),
            ("keyring_error", "NoEntry".to_string()),
        ],
    );
    Err("SECRET_STORE_VERIFY_FAILED".to_string())
}

pub fn has_secret(secret_ref: &str) -> bool {
    get_secret(secret_ref).is_ok()
}

pub fn set_secret(secret_ref: &str, value: &str) -> Result<(), String> {
    let primary_key = storage_key(secret_ref);
    log_diag(
        "SECRET_STORE_SET_BEGIN",
        &[
            ("service", CREDENTIAL_SERVICE.to_string()),
            ("secretRef", secret_ref.to_string()),
            ("storageKey", primary_key.to_string()),
        ],
    );

    let entry = credential_entry(&primary_key)?;
    entry
        .set_password(value)
        .map_err(|error| {
            log_diag(
                "SECRET_STORE_SET_FAILED",
                &[
                    ("secretRef", secret_ref.to_string()),
                    ("keyring_error", keyring_error_category(&error).to_string()),
                ],
            );
            sanitize_keyring_error(error)
        })?;

    match entry.get_password() {
        Ok(_) => log_diag("SECRET_STORE_SET_OK", &[("secretRef", secret_ref.to_string())]),
        Err(error) => {
            log_diag(
                "SECRET_STORE_VERIFY_FAILED",
                &[
                    ("secretRef", secret_ref.to_string()),
                    ("phase", "same_entry_read".to_string()),
                    ("keyring_error", keyring_error_category(&error).to_string()),
                ],
            );
            return Err("SECRET_STORE_VERIFY_FAILED".to_string());
        }
    }

    verify_secret_readable(secret_ref, &primary_key)?;

    // Remove legacy slash-key entry if it differs from the canonical dotted key.
    if primary_key != secret_ref {
        if let Ok(legacy_entry) = credential_entry(secret_ref) {
            let _ = legacy_entry.delete_credential();
        }
    }

    Ok(())
}

pub fn get_secret(secret_ref: &str) -> Result<String, String> {
    let mut last_error = "SECRET_MISSING".to_string();
    for key in resolve_keys(secret_ref) {
        match credential_entry(&key)?.get_password() {
            Ok(value) => {
                log_diag(
                    "SECRET_STORE_GET_OK",
                    &[
                        ("secretRef", secret_ref.to_string()),
                        ("storageKey", key),
                        ("result", "present".to_string()),
                    ],
                );
                return Ok(value);
            }
            Err(keyring::Error::NoEntry) => {
                last_error = "SECRET_MISSING".to_string();
            }
            Err(error) => {
                log_diag(
                    "SECRET_STORE_GET_FAILED",
                    &[
                        ("secretRef", secret_ref.to_string()),
                        ("storageKey", key),
                        ("keyring_error", keyring_error_category(&error).to_string()),
                    ],
                );
                return Err(sanitize_keyring_error(error));
            }
        }
    }
    log_diag(
        "SECRET_STORE_GET_FAILED",
        &[
            ("secretRef", secret_ref.to_string()),
            ("result", "missing".to_string()),
        ],
    );
    Err(last_error)
}

pub fn delete_secret(secret_ref: &str) -> Result<(), String> {
    for key in resolve_keys(secret_ref) {
        if let Ok(entry) = credential_entry(&key) {
            let _ = entry.delete_credential().or_else(|error| match error {
                keyring::Error::NoEntry => Ok(()),
                other => Err(other),
            });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{delete_secret, get_secret, has_secret, set_secret, storage_key, CREDENTIAL_SERVICE};

    #[test]
    fn storage_key_replaces_slashes_with_dots() {
        assert_eq!(
            storage_key("connection/abc-123/bot_token"),
            "connection.abc-123.bot_token"
        );
    }

    #[test]
    fn write_and_read_use_same_derived_key() {
        let secret_ref = format!(
            "connection/{}-write-read/bot_token",
            uuid_simple()
        );
        let primary_key = storage_key(&secret_ref);
        assert_eq!(primary_key, secret_ref.replace('/', "."));

        set_secret(&secret_ref, "round-trip-value").expect("set_secret should succeed");
        assert!(has_secret(&secret_ref));
        assert_eq!(get_secret(&secret_ref).expect("get_secret"), "round-trip-value");

        delete_secret(&secret_ref).expect("delete_secret");
        assert!(!has_secret(&secret_ref));
    }

    #[test]
    fn verify_failure_cleans_up_on_delete() {
        let secret_ref = format!("connection/{}-cleanup/bot_token", uuid_simple());
        set_secret(&secret_ref, "cleanup-value").expect("set_secret");
        delete_secret(&secret_ref).expect("delete_secret");
        assert!(!has_secret(&secret_ref));
    }

    #[test]
    fn credential_service_is_stable() {
        assert_eq!(CREDENTIAL_SERVICE, "reizoko");
    }

    fn uuid_simple() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
            .to_string()
    }
}
