use tauri::WebviewWindowBuilder;

mod credentials;
use credentials::{
    delete_secret as delete_credential, get_secret as read_credential, has_secret,
    set_secret as write_credential,
};

mod platforms;
use platforms::telegram::{
    telegram_connect_bot, telegram_delete_secret, telegram_diagnose_connection,
    telegram_send_media_group, telegram_send_message, telegram_send_photo, telegram_validate_chat,
};

#[tauri::command]
fn set_secret(key: String, value: String) -> Result<(), String> {
    write_credential(&key, &value)
}

#[tauri::command]
fn get_secret(key: String) -> Result<Option<String>, String> {
    match read_credential(&key) {
        Ok(value) => Ok(Some(value)),
        Err(message) if message == "SECRET_MISSING" => Ok(None),
        Err(message) => Err(message),
    }
}

#[tauri::command]
fn delete_secret(key: String) -> Result<(), String> {
    delete_credential(&key)
}

#[tauri::command]
fn has_secret_command(key: String) -> Result<bool, String> {
    Ok(has_secret(&key))
}

const SMOKE_INIT_SCRIPT: &str = r#"
window.__REIZOKO_SMOKE_TEST__ = true;
window.__REIZOKO_AUTOMATED_TEST_CONFIG__ = { backgroundLaunch: true };
"#;

const SMOKE_BROWSER_ARGS: &str = "\
--remote-debugging-port=9222 \
--remote-allow-origins=* \
--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,CalculateNativeWinOcclusion \
--disable-background-timer-throttling \
--disable-renderer-backgrounding \
--disable-backgrounding-occluded-windows";

fn is_automated_test_launch() -> bool {
    std::env::var("REIZOKO_SMOKE_TEST").is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window_config = app
                .config()
                .app
                .windows
                .first()
                .expect("main window config missing")
                .clone();

            let automated_test = is_automated_test_launch();
            let mut builder = WebviewWindowBuilder::from_config(app.handle(), &window_config)?;

            if automated_test {
                builder = builder
                    .initialization_script(SMOKE_INIT_SCRIPT)
                    .additional_browser_args(SMOKE_BROWSER_ARGS)
                    .devtools(true)
                    // Background launch: never flash foreground or steal focus.
                    .visible(false)
                    .focused(false)
                    .focusable(false)
                    .skip_taskbar(true);
            }

            let _window = builder.build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_secret,
            get_secret,
            delete_secret,
            has_secret_command,
            telegram_connect_bot,
            telegram_validate_chat,
            telegram_send_message,
            telegram_send_photo,
            telegram_send_media_group,
            telegram_delete_secret,
            telegram_diagnose_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_automated_test_launch;

    #[test]
    fn automated_test_mode_requires_smoke_env_var() {
        std::env::remove_var("REIZOKO_SMOKE_TEST");
        assert!(!is_automated_test_launch());

        std::env::set_var("REIZOKO_SMOKE_TEST", "1");
        assert!(is_automated_test_launch());
        std::env::remove_var("REIZOKO_SMOKE_TEST");
    }
}
