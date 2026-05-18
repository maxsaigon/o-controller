use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

mod service_manager;

fn show_main(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    window.unminimize().map_err(|err| err.to_string())?;
    window.show().map_err(|err| err.to_string())?;
    window.set_focus().map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    show_main(&app)
}

#[tauri::command]
fn toggle_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    if window.is_visible().map_err(|err| err.to_string())? {
        window.hide().map_err(|err| err.to_string())?;
    } else {
        show_main(&app)?;
    }

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(service_manager::ServiceManagerState::new())
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            toggle_main_window,
            service_manager::get_service_status,
            service_manager::get_service_config,
            service_manager::update_service_config,
            service_manager::discover_onkyo_devices,
            service_manager::test_receiver_connection
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let show = MenuItemBuilder::with_id("show", "Show O-Control").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit O-Control").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

            TrayIconBuilder::with_id("main")
                .tooltip("O-Control")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_main(app);
            }
            "quit" => {
                let state = app.state::<service_manager::ServiceManagerState>();
                service_manager::stop_local_service(&state);
                app.exit(0);
            }
            _ => {}
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri app")
        .run(|app, event| {
            if let tauri::RunEvent::Ready = event {
                // Check and start local service if needed
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let state = handle.state::<service_manager::ServiceManagerState>();
                    let config = service_manager::get_config(&handle);
                    if config.service_mode == "local" {
                        let _ = service_manager::start_local_service(handle.clone(), &state).await;
                    }
                });
            } else if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app.state::<service_manager::ServiceManagerState>();
                service_manager::stop_local_service(&state);
            }
        });
}
