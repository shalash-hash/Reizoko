use tauri::WebviewWindowBuilder;

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
