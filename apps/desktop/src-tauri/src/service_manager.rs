use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_shell::{ShellExt, process::CommandChild};
use tauri_plugin_store::StoreExt;
use std::time::Duration;
use tokio::net::{UdpSocket, TcpStream};
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use tokio::time::timeout;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalConfig {
    pub host: Option<String>,
    pub port: Option<u16>,
    #[serde(rename = "mockMode")]
    pub mock_mode: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReceiverDevice {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub model: Option<String>,
    #[serde(rename = "macAddress")]
    pub mac_address: Option<String>,
    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: Option<String>,
    #[serde(rename = "lastTestAt")]
    pub last_test_at: Option<String>,
    #[serde(rename = "lastTestStatus")]
    pub last_test_status: Option<String>, // 'unknown', 'online', 'offline'
    pub source: String, // 'manual' or 'discovered'
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceConfig {
    #[serde(rename = "serviceMode")]
    pub service_mode: String, // "local" or "external"
    #[serde(rename = "activeDeviceId")]
    pub active_device_id: Option<String>,
    pub devices: Option<Vec<ReceiverDevice>>,
    #[serde(rename = "localConfig")]
    pub local_config: Option<LocalConfig>,
    #[serde(rename = "externalUrl")]
    pub external_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConnectionResult {
    pub ok: bool,
    pub message: String,
    #[serde(rename = "latencyMs")]
    pub latency_ms: Option<u64>,
    pub model: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct ServiceStatus {
    pub mode: String,
    pub url: String,
    pub healthy: bool,
    pub error: Option<String>,
}

pub struct ServiceManagerState {
    pub child: Mutex<Option<CommandChild>>,
    pub port: Mutex<u16>,
}

impl ServiceManagerState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(8787),
        }
    }
}

#[derive(Debug, Deserialize)]
struct HealthResponse {
    #[serde(rename = "mockMode")]
    mock_mode: Option<bool>,
    #[serde(rename = "receiverHost")]
    receiver_host: Option<String>,
    #[serde(rename = "receiverPort")]
    receiver_port: Option<u16>,
}

pub fn get_config(app: &AppHandle) -> ServiceConfig {
    let store = app.store("settings.json").expect("Failed to get store");
    let mode = store.get("serviceMode")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "local".to_string());
        
    let local_config: Option<LocalConfig> = store.get("localConfig")
        .and_then(|v| serde_json::from_value(v).ok());
        
    let external_url = store.get("externalUrl")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "http://127.0.0.1:8787".to_string());

    let mut devices: Option<Vec<ReceiverDevice>> = store.get("devices")
        .and_then(|v| serde_json::from_value(v).ok());

    let mut active_device_id: Option<String> = store.get("activeDeviceId")
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    if devices.is_none() || devices.as_ref().map(|d| d.is_empty()).unwrap_or(true) {
        if let Some(lc) = &local_config {
            if let Some(host) = &lc.host {
                if !host.is_empty() {
                    let port = lc.port.unwrap_or(60128);
                    let migrated_device = ReceiverDevice {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: "CR-N775".to_string(),
                        host: host.clone(),
                        port,
                        model: None,
                        mac_address: None,
                        last_seen_at: None,
                        last_test_at: None,
                        last_test_status: None,
                        source: "manual".to_string(),
                    };
                    active_device_id = Some(migrated_device.id.clone());
                    devices = Some(vec![migrated_device]);
                    let _ = store.set("devices", serde_json::to_value(&devices).unwrap());
                    let _ = store.set("activeDeviceId", serde_json::json!(&active_device_id));
                    let _ = store.save();
                }
            }
        }
    }

    ServiceConfig {
        service_mode: mode,
        active_device_id,
        devices,
        local_config,
        external_url: Some(external_url),
    }
}

#[tauri::command]
pub fn get_service_config(app: AppHandle) -> Result<ServiceConfig, String> {
    Ok(get_config(&app))
}

pub async fn check_health(url: &str) -> Result<bool, String> {
    Ok(check_health_detail(url).await?.is_some())
}

async fn check_health_detail(url: &str) -> Result<Option<HealthResponse>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    let health_url = format!("{}/health", url.trim_end_matches('/'));
    
    match client.get(&health_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let health = resp.json::<HealthResponse>().await.unwrap_or(HealthResponse {
                mock_mode: None,
                receiver_host: None,
                receiver_port: None,
            });
            Ok(Some(health))
        }
        Ok(_) | Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn get_service_status(
    app: AppHandle,
    state: State<'_, ServiceManagerState>,
) -> Result<ServiceStatus, String> {
    let config = get_config(&app);
    
    if config.service_mode == "external" {
        let url = config.external_url.unwrap_or_else(|| "http://127.0.0.1:8787".to_string());
        let healthy = check_health(&url).await.unwrap_or(false);
        return Ok(ServiceStatus {
            mode: "external".to_string(),
            url,
            healthy,
            error: if healthy { None } else { Some("Unreachable".to_string()) },
        });
    }

    // Local mode
    let port = *state.port.lock().unwrap();
    let url = format!("http://127.0.0.1:{}", port);
    let healthy = check_health(&url).await.unwrap_or(false);
    
    let is_running = state.child.lock().unwrap().is_some();

    let error = if healthy {
        None
    } else if is_running {
        Some("Service is starting...".to_string())
    } else {
        Some("Service is stopped or failed".to_string())
    };

    Ok(ServiceStatus {
        mode: "local".to_string(),
        url,
        healthy,
        error,
    })
}

#[tauri::command]
pub async fn update_service_config(
    app: AppHandle,
    state: State<'_, ServiceManagerState>,
    config: ServiceConfig,
) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    
    store.set("serviceMode", serde_json::json!(config.service_mode));
    if let Some(local) = &config.local_config {
        store.set("localConfig", serde_json::to_value(local).map_err(|e| e.to_string())?);
    }
    if let Some(url) = &config.external_url {
        store.set("externalUrl", serde_json::json!(url));
    }
    if let Some(devices) = &config.devices {
        store.set("devices", serde_json::to_value(devices).map_err(|e| e.to_string())?);
    }
    if let Some(active_device_id) = &config.active_device_id {
        store.set("activeDeviceId", serde_json::json!(active_device_id));
    }
    
    store.save().map_err(|e| e.to_string())?;

    // Restart logic
    stop_local_service(&state);
    
    if config.service_mode == "local" {
        start_local_service(app, state.inner()).await?;
    }

    Ok(())
}

pub fn stop_local_service(state: &ServiceManagerState) {
    let mut child_guard = state.child.lock().unwrap();
    if let Some(child) = child_guard.take() {
        let _ = child.kill();
    }
}

pub async fn start_local_service(
    app: AppHandle,
    state: &ServiceManagerState,
) -> Result<(), String> {
    let config = get_config(&app);
    let mut envs = std::collections::HashMap::new();

    let mut active_host = None;
    let mut active_port = None;

    if let Some(devices) = &config.devices {
        if let Some(active_id) = &config.active_device_id {
            if let Some(device) = devices.iter().find(|d| &d.id == active_id) {
                active_host = Some(device.host.clone());
                active_port = Some(device.port.to_string());
            }
        }
    }

    if let Some(host) = active_host {
        if !host.is_empty() {
            envs.insert("ONKYO_HOST".to_string(), host);
        }
    } else if let Some(local) = &config.local_config {
        if let Some(host) = &local.host {
            if !host.is_empty() {
                envs.insert("ONKYO_HOST".to_string(), host.clone());
            }
        }
    }

    if let Some(port) = active_port {
        envs.insert("ONKYO_PORT".to_string(), port);
    } else if let Some(local) = &config.local_config {
        if let Some(port) = local.port {
            envs.insert("ONKYO_PORT".to_string(), port.to_string());
        }
    }

    if let Some(local) = config.local_config {
        if local.mock_mode.unwrap_or(false) {
            envs.insert("MOCK_MODE".to_string(), "true".to_string());
        }
    }

    let expected_host = envs.get("ONKYO_HOST").cloned();
    let expected_port = envs
        .get("ONKYO_PORT")
        .and_then(|port| port.parse::<u16>().ok())
        .unwrap_or(60128);
    let expected_mock = envs.get("MOCK_MODE").map(|v| v == "true").unwrap_or(false);

    for candidate_port in 8787..=8797 {
        let url = format!("http://127.0.0.1:{}", candidate_port);
        if let Some(health) = check_health_detail(&url).await.unwrap_or(None) {
            let owned_by_this_app = state.child.lock().unwrap().is_some()
                && *state.port.lock().unwrap() == candidate_port;
            let host_matches = match (&expected_host, &health.receiver_host) {
                (Some(expected), Some(actual)) => expected == actual,
                (None, _) => true,
                _ => false,
            };
            let port_matches = health.receiver_port.map(|port| port == expected_port).unwrap_or(false);
            let mock_matches = health.mock_mode.map(|mock| mock == expected_mock).unwrap_or(false);

            if owned_by_this_app && host_matches && port_matches && mock_matches {
                println!("Local service is already healthy at {}", url);
                return Ok(());
            }

            println!("Port {} is occupied by an incompatible O-Control service; trying next port", candidate_port);
            continue;
        }

        stop_local_service(state);
        *state.port.lock().unwrap() = candidate_port;
        envs.insert("O_CONTROL_PORT".to_string(), candidate_port.to_string());
        break;
    }

    if !envs.contains_key("O_CONTROL_PORT") {
        return Err("No available local service port between 8787 and 8797".to_string());
    }

    println!("Spawning local service sidecar...");
    
    let sidecar_command = app.shell().sidecar("o-control-service")
        .map_err(|e| e.to_string())?
        .envs(envs);

    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;
    
    *state.child.lock().unwrap() = Some(child);

    // Spawn a task to drain the logs
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    if let Ok(text) = String::from_utf8(line) {
                        println!("[sidecar] {}", text.trim());
                    }
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    if let Ok(text) = String::from_utf8(line) {
                        eprintln!("[sidecar] {}", text.trim());
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn discover_onkyo_devices() -> Result<Vec<ReceiverDevice>, String> {
    let mut devices = std::collections::HashMap::new();
    
    let socket = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    
    let payload_str = "!xECNQSTN\r\n";
    let mut packet = Vec::new();
    packet.extend_from_slice(b"ISCP");
    packet.extend_from_slice(&16u32.to_be_bytes());
    packet.extend_from_slice(&(payload_str.len() as u32).to_be_bytes());
    packet.push(1);
    packet.extend_from_slice(&[0, 0, 0]);
    packet.extend_from_slice(payload_str.as_bytes());

    socket.send_to(&packet, "255.255.255.255:60128").await.map_err(|e| e.to_string())?;
    
    let mut buf = [0u8; 1024];
    let end_time = std::time::Instant::now() + std::time::Duration::from_secs(3);
    
    while std::time::Instant::now() < end_time {
        let time_left = end_time.duration_since(std::time::Instant::now());
        if time_left.is_zero() {
            break;
        }
        match timeout(time_left, socket.recv_from(&mut buf)).await {
            Ok(Ok((len, addr))) => {
                let data = &buf[..len];
                if data.len() > 16 && &data[0..4] == b"ISCP" {
                    let header_size = u32::from_be_bytes([data[4], data[5], data[6], data[7]]) as usize;
                    if header_size == 16 && data.len() > header_size {
                        let payload_bytes = &data[header_size..];
                        if let Ok(payload) = std::str::from_utf8(payload_bytes) {
                            if payload.starts_with("!1ECN") {
                                let content = payload[5..].trim_end();
                                let parts: Vec<&str> = content.split('/').collect();
                                
                                let host = addr.ip().to_string();
                                let mut port = 60128;
                                let mut model = "Unknown Onkyo".to_string();
                                let mut mac = None;
                                
                                if parts.len() > 0 {
                                    model = parts[0].to_string();
                                }
                                if parts.len() > 1 {
                                    if let Ok(p) = parts[1].parse::<u16>() {
                                        port = p;
                                    }
                                }
                                for part in &parts {
                                    if part.len() == 12 && part.chars().all(|c| c.is_ascii_hexdigit()) {
                                        mac = Some(part.to_string());
                                    }
                                }
                                
                                let key = mac.clone().unwrap_or_else(|| format!("{}:{}", host, port));
                                
                                if !devices.contains_key(&key) {
                                    devices.insert(key, ReceiverDevice {
                                        id: uuid::Uuid::new_v4().to_string(),
                                        name: model.clone(),
                                        host,
                                        port,
                                        model: Some(model.clone()),
                                        mac_address: mac,
                                        last_seen_at: Some(chrono::Utc::now().to_rfc3339()),
                                        last_test_at: None,
                                        last_test_status: None,
                                        source: "discovered".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            },
            _ => { break; }
        }
    }
    
    Ok(devices.into_values().collect())
}

#[tauri::command]
pub async fn test_receiver_connection(host: String, port: u16) -> Result<TestConnectionResult, String> {
    let addr = format!("{}:{}", host, port);
    let start = std::time::Instant::now();
    
    match timeout(std::time::Duration::from_secs(3), TcpStream::connect(&addr)).await {
        Ok(Ok(mut stream)) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            
            let payload_str = "!1PWRQSTN\r\n";
            let mut packet = Vec::new();
            packet.extend_from_slice(b"ISCP");
            packet.extend_from_slice(&16u32.to_be_bytes());
            packet.extend_from_slice(&(payload_str.len() as u32).to_be_bytes());
            packet.push(1);
            packet.extend_from_slice(&[0, 0, 0]);
            packet.extend_from_slice(payload_str.as_bytes());
            
            let mut msg = "Connected successfully".to_string();

            if let Ok(_) = stream.write_all(&packet).await {
                let mut buf = [0u8; 1024];
                if let Ok(Ok(len)) = timeout(std::time::Duration::from_secs(1), stream.read(&mut buf)).await {
                    if len > 16 && &buf[0..4] == b"ISCP" {
                        msg = "eISCP response received".to_string();
                    }
                }
            }

            Ok(TestConnectionResult {
                ok: true,
                message: msg,
                latency_ms: Some(latency_ms),
                model: None,
            })
        },
        Ok(Err(e)) => {
            Ok(TestConnectionResult {
                ok: false,
                message: format!("Connection failed: {}", e),
                latency_ms: None,
                model: None,
            })
        },
        Err(_) => {
            Ok(TestConnectionResult {
                ok: false,
                message: "Connection timed out".to_string(),
                latency_ms: None,
                model: None,
            })
        }
    }
}
