use std::io::{self, ErrorKind, Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use serialport::{SerialPort, SerialPortType};

pub const PREFIX: &str = "serial:";

const DEFAULT_BAUD: u32 = 115_200;

#[derive(Serialize)]
pub struct Port {
    id: String,
    name: String,
    detail: Option<String>,
}

pub struct Opened {
    pub reader: Box<dyn Read + Send>,
    pub writer: Box<dyn Write + Send>,
    pub guard: Guard,
}

pub struct Guard(Arc<AtomicBool>);

impl Guard {
    pub fn flag(&self) -> Arc<AtomicBool> {
        self.0.clone()
    }
}

// both handles poll this flag, so the port closes whichever way the session goes away
impl Drop for Guard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Relaxed);
    }
}

struct Reader {
    port: Box<dyn SerialPort>,
    open: Arc<AtomicBool>,
    raw: Vec<u8>,
    after_cr: bool,
}

struct Writer {
    port: Box<dyn SerialPort>,
    open: Arc<AtomicBool>,
}

impl Write for Writer {
    fn write(&mut self, data: &[u8]) -> io::Result<usize> {
        loop {
            match self.port.write(data) {
                Err(error)
                    if error.kind() == ErrorKind::TimedOut && self.open.load(Ordering::Relaxed) =>
                {
                    continue
                }
                result => return result,
            }
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        self.port.flush()
    }
}

impl Read for Reader {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        let limit = (out.len() / 2).clamp(1, self.raw.len());

        loop {
            if !self.open.load(Ordering::Relaxed) {
                return Ok(0);
            }

            match self.port.read(&mut self.raw[..limit]) {
                Ok(0) => continue,
                Ok(read) => {
                    let raw = std::mem::take(&mut self.raw);
                    let written = self.expand(&raw[..read], out);

                    self.raw = raw;

                    return Ok(written);
                }
                Err(error) if error.kind() == ErrorKind::TimedOut => continue,
                Err(error) => return Err(error),
            }
        }
    }
}

impl Reader {
    // devices end lines with a bare \n, which a terminal renders as a staircase
    fn expand(&mut self, raw: &[u8], out: &mut [u8]) -> usize {
        let mut written = 0;

        for &byte in raw {
            if byte == b'\n' && !self.after_cr {
                out[written] = b'\r';
                written += 1;
            }

            out[written] = byte;
            written += 1;
            self.after_cr = byte == b'\r';
        }

        written
    }
}

pub fn parse(shell: &str) -> Option<(&str, u32)> {
    let target = shell.strip_prefix(PREFIX)?;

    Some(match target.split_once('@') {
        Some((name, baud)) => (name, baud.parse().unwrap_or(DEFAULT_BAUD)),
        None => (target, DEFAULT_BAUD),
    })
}

pub fn open(name: &str, baud: u32) -> Result<Opened, String> {
    let port = serialport::new(name, baud)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|error| error.to_string())?;
    let writer = port.try_clone().map_err(|error| error.to_string())?;
    let open = Arc::new(AtomicBool::new(true));

    Ok(Opened {
        reader: Box::new(Reader {
            port,
            open: open.clone(),
            raw: vec![0; 32 * 1024],
            after_cr: false,
        }),
        writer: Box::new(Writer {
            port: writer,
            open: open.clone(),
        }),
        guard: Guard(open),
    })
}

#[tauri::command(async)]
pub fn serial_ports() -> Vec<Port> {
    let mut named = bus_names();

    serialport::available_ports()
        .unwrap_or_default()
        .into_iter()
        .map(|port| Port {
            id: format!("{PREFIX}{}", port.port_name),
            detail: named.remove(&port.port_name).or(match port.port_type {
                SerialPortType::UsbPort(usb) => usb.product.map(|product| {
                    product
                        .trim_end_matches(&format!("({})", port.port_name))
                        .trim()
                        .to_string()
                }),
                _ => None,
            }),
            name: port.port_name,
        })
        .collect()
}

// the friendly name is the driver's ("USB Serial Device"); the product the device itself reports is the bus description
#[cfg(windows)]
fn bus_names() -> std::collections::HashMap<String, String> {
    use windows::core::w;
    use windows::Win32::Devices::DeviceAndDriverInstallation::{
        SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
        SetupDiGetDevicePropertyW, SetupDiOpenDevRegKey, DICS_FLAG_GLOBAL, DIGCF_PRESENT,
        DIREG_DEV, GUID_DEVCLASS_PORTS, SP_DEVINFO_DATA,
    };
    use windows::Win32::Devices::Properties::{DEVPKEY_Device_BusReportedDeviceDesc, DEVPROPTYPE};
    use windows::Win32::System::Registry::{RegCloseKey, RegQueryValueExW, KEY_READ};

    let mut names = std::collections::HashMap::new();

    let Ok(set) =
        (unsafe { SetupDiGetClassDevsW(Some(&GUID_DEVCLASS_PORTS), None, None, DIGCF_PRESENT) })
    else {
        return names;
    };

    for index in 0.. {
        let mut info = SP_DEVINFO_DATA {
            cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };

        if unsafe { SetupDiEnumDeviceInfo(set, index, &mut info) }.is_err() {
            break;
        }

        let port = unsafe {
            SetupDiOpenDevRegKey(set, &info, DICS_FLAG_GLOBAL.0, 0, DIREG_DEV, KEY_READ.0)
        }
        .ok()
        .and_then(|key| {
            let mut buffer = [0u16; 64];
            let mut size = (buffer.len() * 2) as u32;
            let read = unsafe {
                RegQueryValueExW(
                    key,
                    w!("PortName"),
                    None,
                    None,
                    Some(buffer.as_mut_ptr().cast()),
                    Some(&mut size),
                )
            };
            let _ = unsafe { RegCloseKey(key) };

            read.is_ok().then(|| wide(&buffer))
        });

        let mut kind = DEVPROPTYPE::default();
        let mut buffer = [0u16; 256];
        let described = unsafe {
            SetupDiGetDevicePropertyW(
                set,
                &info,
                &DEVPKEY_Device_BusReportedDeviceDesc,
                &mut kind,
                Some(std::slice::from_raw_parts_mut(
                    buffer.as_mut_ptr().cast(),
                    buffer.len() * 2,
                )),
                None,
                0,
            )
        };

        if let (Some(port), true) = (port, described.is_ok()) {
            let name = wide(&buffer);

            if !name.is_empty() {
                names.insert(port, name);
            }
        }
    }

    let _ = unsafe { SetupDiDestroyDeviceInfoList(set) };

    names
}

#[cfg(windows)]
fn wide(buffer: &[u16]) -> String {
    let end = buffer
        .iter()
        .position(|&unit| unit == 0)
        .unwrap_or(buffer.len());

    String::from_utf16_lossy(&buffer[..end]).trim().to_string()
}

#[cfg(not(windows))]
fn bus_names() -> std::collections::HashMap<String, String> {
    std::collections::HashMap::new()
}
