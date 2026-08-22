#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // THIS IS THE BACKEND DATABASE CONNECTION:
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}