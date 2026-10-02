use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};

use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_store::StoreExt;

use crate::monitors;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarLayout {
    pub edge: String,
    pub height: f64,
    pub width: f64,
    pub floating: bool,
    pub auto_hide: bool,
    pub hide_system_taskbar: bool,
    #[serde(default)]
    pub monitor: Option<String>,
    #[serde(default)]
    pub desktop: bool,
}

impl Default for TaskbarLayout {
    fn default() -> Self {
        Self {
            edge: "bottom".into(),
            height: 48.0,
            width: 720.0,
            floating: false,
            auto_hide: false,
            hide_system_taskbar: true,
            monitor: None,
            desktop: false,
        }
    }
}

static TOP: AtomicBool = AtomicBool::new(false);
static DESKTOP: AtomicBool = AtomicBool::new(false);
static REVEAL: AtomicBool = AtomicBool::new(false);
static SUSPENDED: AtomicBool = AtomicBool::new(false);
static LAST: LazyLock<Mutex<HashMap<String, (TaskbarLayout, bool)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static PARKED: LazyLock<Mutex<HashMap<String, (TaskbarLayout, bool)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static SCREEN: Mutex<Option<[i32; 4]>> = Mutex::new(None);

pub fn edge_is_top() -> bool {
    TOP.load(Ordering::Relaxed)
}

pub fn desktop_pinned() -> bool {
    DESKTOP.load(Ordering::Relaxed)
}

pub fn desktop_reveals() -> bool {
    REVEAL.load(Ordering::Relaxed)
}

pub fn dock_screen() -> Option<[i32; 4]> {
    *SCREEN.lock().unwrap()
}

pub fn dock_frame() -> Option<[i32; 4]> {
    win::base_frame("taskbar")
}

pub fn bar_frame(label: &str) -> Option<[i32; 4]> {
    win::base_frame(label)
}

pub fn stored_layout(app: &AppHandle) -> TaskbarLayout {
    let device = app
        .store("settings.json")
        .ok()
        .and_then(|store| store.get("device"));
    let field = |key: &str| device.as_ref().and_then(|device| device.get(key).cloned());
    let base = TaskbarLayout::default();

    TaskbarLayout {
        edge: field("dockEdge")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or(base.edge),
        height: field("dockHeight")
            .and_then(|v| v.as_f64())
            .unwrap_or(base.height),
        width: field("dockWidth")
            .and_then(|v| v.as_f64())
            .unwrap_or(base.width),
        floating: field("dockStyle").is_some_and(|v| v.as_str() == Some("mac")),
        auto_hide: field("dockAutoHide")
            .and_then(|v| v.as_bool())
            .unwrap_or(base.auto_hide),
        hide_system_taskbar: field("onboarded").is_some_and(|v| v.as_bool() == Some(true))
            && field("hideSystemTaskbar")
                .and_then(|v| v.as_bool())
                .unwrap_or(base.hide_system_taskbar),
        monitor: field("dockMonitor").and_then(|v| v.as_str().map(String::from)),
        desktop: field("dockStyle").is_some_and(|v| v.as_str() == Some("mac"))
            && field("dockDesktop")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
    }
}

#[tauri::command]
pub fn extend_taskbar(app: AppHandle, px: f64, rect: Option<[f64; 4]>) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar")
        .ok_or("taskbar window is missing")?;

    win::extend(&window, px, rect).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_taskbar(app: AppHandle, layout: TaskbarLayout) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar")
        .ok_or("taskbar window is missing")?;

    apply(&window, &layout).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_topbar(app: AppHandle, layout: TaskbarLayout) -> Result<(), String> {
    let window = app
        .get_webview_window("topbar")
        .ok_or("topbar window is missing")?;

    apply_as(&window, &layout, false, false).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn extend_topbar(app: AppHandle, px: f64, rect: Option<[f64; 4]>) -> Result<(), String> {
    let window = app
        .get_webview_window("topbar")
        .ok_or("topbar window is missing")?;

    win::extend(&window, px, rect).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn release_topbar(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("topbar")
        .ok_or("topbar window is missing")?;

    release(&window);
    crate::windowing::hide(&app, "topbar");

    Ok(())
}

pub fn apply(window: &WebviewWindow, layout: &TaskbarLayout) -> tauri::Result<()> {
    apply_as(window, layout, true, false)
}

fn apply_as(
    window: &WebviewWindow,
    layout: &TaskbarLayout,
    primary: bool,
    force: bool,
) -> tauri::Result<()> {
    if SUSPENDED.load(Ordering::Relaxed) {
        PARKED
            .lock()
            .unwrap()
            .insert(window.label().to_string(), (layout.clone(), primary));

        return Ok(());
    }

    if primary {
        TOP.store(layout.edge == "top", Ordering::Relaxed);
        DESKTOP.store(layout.desktop, Ordering::Relaxed);
        REVEAL.store(layout.desktop && layout.auto_hide, Ordering::Relaxed);
    }

    LAST.lock()
        .unwrap()
        .insert(window.label().to_string(), (layout.clone(), primary));

    let Some(screen) = monitors::resolve(window, layout.monitor.as_deref())? else {
        return Ok(());
    };

    if primary {
        *SCREEN.lock().unwrap() = Some(monitors::bounds(&screen));
    }

    win::watch_shell(window);

    if primary {
        win::keep_system_taskbar_hidden(layout.hide_system_taskbar);
    }

    win::place(window, layout, &screen, force)?;
    win::raise(window);

    Ok(())
}

pub fn reapply(window: &WebviewWindow) {
    let entry = LAST.lock().unwrap().get(window.label()).cloned();

    if let Some((layout, primary)) = entry {
        let _ = apply_as(window, &layout, primary, true);
    }
}

pub fn release(window: &WebviewWindow) {
    LAST.lock().unwrap().remove(window.label());

    if window.label() == "taskbar" {
        *SCREEN.lock().unwrap() = None;
        TOP.store(false, Ordering::Relaxed);
        DESKTOP.store(false, Ordering::Relaxed);
        REVEAL.store(false, Ordering::Relaxed);
    }

    win::release(window);
}

pub fn release_all(app: &AppHandle) {
    SUSPENDED.store(true, Ordering::Relaxed);

    let applied = std::mem::take(&mut *LAST.lock().unwrap());

    PARKED.lock().unwrap().extend(applied);

    for label in ["taskbar", "topbar"] {
        if let Some(bar) = app.get_webview_window(label) {
            release(&bar);
        }
    }
}

pub fn restore_all(app: &AppHandle) {
    SUSPENDED.store(false, Ordering::Relaxed);

    let parked = std::mem::take(&mut *PARKED.lock().unwrap());

    for (label, (layout, primary)) in parked {
        if let Some(bar) = app.get_webview_window(&label) {
            let _ = apply_as(&bar, &layout, primary, true);
        }
    }
}

pub fn topbar_on(app: &AppHandle) -> bool {
    let device = app
        .store("settings.json")
        .ok()
        .and_then(|store| store.get("device"));

    device.is_some_and(|device| {
        device
            .get("features")
            .and_then(|features| features.get("dock"))
            .and_then(|dock| dock.as_bool())
            .unwrap_or(true)
            && device.get("topBar").and_then(|top| top.as_bool()) == Some(true)
    })
}

pub fn lift(hwnd: windows::Win32::Foundation::HWND, up: bool) {
    win::lift(hwnd, up);
}

pub fn shell_tray() -> Option<isize> {
    win::tray_window().map(|hwnd| hwnd.0 as isize)
}

mod win {
    use std::collections::{HashMap, HashSet};
    use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
    use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
    use std::sync::{LazyLock, Mutex, OnceLock};
    use std::thread::JoinHandle;
    use std::time::Duration;

    use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};
    use tauri_plugin_store::StoreExt;
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::Shell::{
        DefSubclassProc, SHAppBarMessage, SetWindowSubclass, ABE_BOTTOM, ABE_TOP, ABM_GETSTATE,
        ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETAUTOHIDEBAR, ABM_SETPOS, ABM_SETSTATE,
        ABN_POSCHANGED, ABS_AUTOHIDE, APPBARDATA,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, GetWindowThreadProcessId, PostMessageW, RegisterWindowMessageW,
        SetWindowPos, ShowWindow, HWND_BOTTOM, HWND_TOPMOST, MA_NOACTIVATE, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SW_HIDE, SW_SHOW, WM_DISPLAYCHANGE, WM_DPICHANGED,
        WM_MOUSEACTIVATE,
    };

    use super::TaskbarLayout;

    const CALLBACK_MESSAGE: u32 = 0x8000 + 1;
    const REAPPLY_MESSAGE: u32 = CALLBACK_MESSAGE + 1;
    const MENU_SPACE: f64 = 520.0;
    const HOLE_PAD: i32 = 4;
    const HIDE_POLL: Duration = Duration::from_millis(500);
    const SETTLE_POLL: Duration = Duration::from_millis(50);
    const SETTLE_TRIES: u32 = 40;
    const SHELL_STATE_KEY: &str = "shellTaskbarState";

    static HOOKED: LazyLock<Mutex<HashSet<isize>>> = LazyLock::new(|| Mutex::new(HashSet::new()));
    static REAPPLY_PENDING: AtomicBool = AtomicBool::new(false);
    static RESTARTED: AtomicBool = AtomicBool::new(false);
    static SHELL: AtomicIsize = AtomicIsize::new(0);
    static APP: OnceLock<AppHandle> = OnceLock::new();
    static HIDER: Mutex<Option<(Sender<()>, JoinHandle<()>)>> = Mutex::new(None);
    static WANT_HIDDEN: AtomicBool = AtomicBool::new(false);
    static SHELL_STALE: AtomicBool = AtomicBool::new(false);
    static DIRTY: AtomicBool = AtomicBool::new(false);
    static SYNCING: AtomicBool = AtomicBool::new(false);
    static BARS: LazyLock<Mutex<HashMap<String, BarState>>> =
        LazyLock::new(|| Mutex::new(HashMap::new()));

    #[derive(Clone, Copy)]
    struct Frame {
        left: i32,
        top: i32,
        width: i32,
        height: i32,
        scale: f64,
        top_edge: bool,
    }

    #[derive(Clone, Copy, Default)]
    struct BarState {
        frame: Option<Frame>,
        reach: i32,
        hole: Option<[i32; 4]>,
        registered: bool,
        request: Option<(RECT, bool, bool)>,
        granted: Option<RECT>,
    }

    fn payload(hwnd: HWND, edge: u32) -> APPBARDATA {
        APPBARDATA {
            cbSize: std::mem::size_of::<APPBARDATA>() as u32,
            hWnd: hwnd,
            uCallbackMessage: CALLBACK_MESSAGE,
            uEdge: edge,
            ..Default::default()
        }
    }

    pub fn span(band: &RECT, floating: bool, width: i32) -> (i32, i32) {
        if floating {
            (band.left + (band.right - band.left - width) / 2, width)
        } else {
            (band.left, band.right - band.left)
        }
    }

    pub fn offset(band: &RECT, top: bool, margin: i32, height: i32) -> i32 {
        if top {
            band.top + margin
        } else {
            band.bottom - margin - height
        }
    }

    fn fit_band(data: &mut APPBARDATA, band: i32) {
        if data.uEdge == ABE_TOP {
            data.rc.bottom = data.rc.top + band;
        } else {
            data.rc.top = data.rc.bottom - band;
        }
    }

    pub fn place(
        window: &WebviewWindow,
        layout: &TaskbarLayout,
        monitor: &Monitor,
        force: bool,
    ) -> tauri::Result<()> {
        let scale = monitor.scale_factor();
        let origin = monitor.position();
        let screen = monitor.size();
        let height = (layout.height * scale).round() as i32;
        let width = (layout.width * scale).round() as i32;
        let margin = if layout.floating {
            (12.0 * scale).round() as i32
        } else {
            0
        };
        let band = height + margin * 2;
        let edge = if layout.edge == "top" {
            ABE_TOP
        } else {
            ABE_BOTTOM
        };
        let hwnd = window.hwnd()?;
        let mut data = payload(hwnd, edge);

        data.rc = RECT {
            left: origin.x,
            top: origin.y,
            right: origin.x + screen.width as i32,
            bottom: origin.y + screen.height as i32,
        };
        fit_band(&mut data, band);

        let label = window.label().to_string();
        let request = (data.rc, layout.auto_hide, layout.desktop);
        let (was_registered, granted) =
            BARS.lock()
                .unwrap()
                .get(&label)
                .map_or((false, None), |bar| {
                    let unchanged = !force && bar.request == Some(request);

                    (bar.registered, bar.granted.filter(|_| unchanged))
                });

        // the shell calls back into this thread while it waits here, so no lock may be held across these
        let registered = match granted {
            Some(granted) => {
                data.rc = granted;

                None
            }
            None => crate::notify::beside_host(|| unsafe {
                if layout.desktop {
                    if was_registered {
                        SHAppBarMessage(ABM_REMOVE, &mut data);
                    }

                    Some(false)
                } else if layout.auto_hide {
                    SHAppBarMessage(ABM_REMOVE, &mut data);

                    let joined = SHAppBarMessage(ABM_NEW, &mut data) != 0;

                    data.lParam = LPARAM(1);
                    SHAppBarMessage(ABM_SETAUTOHIDEBAR, &mut data);

                    Some(joined)
                } else {
                    let joined = !was_registered && SHAppBarMessage(ABM_NEW, &mut data) != 0;

                    data.lParam = LPARAM(0);
                    SHAppBarMessage(ABM_SETAUTOHIDEBAR, &mut data);
                    SHAppBarMessage(ABM_QUERYPOS, &mut data);
                    fit_band(&mut data, band);
                    SHAppBarMessage(ABM_SETPOS, &mut data);

                    joined.then_some(true)
                }
            }),
        };

        let (left, width) = span(&data.rc, layout.floating, width);
        let top = offset(&data.rc, edge == ABE_TOP, margin, height);

        let frame = Frame {
            left,
            top,
            width,
            height,
            scale,
            top_edge: edge == ABE_TOP,
        };

        let (reach, hole) = {
            let mut bars = BARS.lock().unwrap();
            let bar = bars.entry(label).or_default();

            if let Some(registered) = registered {
                bar.registered = registered;
            }

            bar.frame = Some(frame);
            bar.request = Some(request);
            bar.granted = Some(data.rc);

            (bar.reach, bar.hole)
        };

        // menus live inside this window, so it keeps room above the band and clips the rest away
        let room = (MENU_SPACE * scale).round() as i32;
        let frame_top = if frame.top_edge { top } else { top - room };

        window.set_position(PhysicalPosition::new(left, frame_top))?;
        window.set_size(PhysicalSize::new(width as u32, (height + room) as u32))?;

        shape(hwnd, &frame, reach, hole);

        Ok(())
    }

    pub fn base_frame(label: &str) -> Option<[i32; 4]> {
        BARS.lock()
            .unwrap()
            .get(label)
            .and_then(|bar| bar.frame)
            .map(|frame| [frame.left, frame.top, frame.width, frame.height])
    }

    pub fn extend(window: &WebviewWindow, px: f64, rect: Option<[f64; 4]>) -> tauri::Result<()> {
        let (frame, reach, hole, had_hole, menus_open) = {
            let mut bars = BARS.lock().unwrap();
            let Some(bar) = bars.get_mut(window.label()) else {
                return Ok(());
            };
            let Some(frame) = bar.frame else {
                return Ok(());
            };

            let had_hole = bar.hole.is_some();

            bar.reach = (px.max(0.0) * frame.scale).round() as i32;
            bar.hole = rect.map(|rect| crate::windowing::region::physical(rect, frame.scale));

            let (reach, hole) = (bar.reach, bar.hole);
            let menus_open = bars.values().any(|bar| bar.hole.is_some());

            (frame, reach, hole, had_hole, menus_open)
        };

        let hwnd = window.hwnd()?;

        shape(hwnd, &frame, reach, hole);
        crate::outside::watch(window.app_handle(), menus_open);

        // restacking on every reshape buries a tray app's context menu opened over the dock
        if hole.is_some() == had_hole {
            return Ok(());
        }

        // a desktop-pinned dock sits at the bottom and later topmost windows cover it, so lift while a menu is open
        if hole.is_some() {
            lift(hwnd, true);
        } else if !super::desktop_reveals() {
            raise(window);
        }

        Ok(())
    }

    // the window stays tall for menus, so its region is what the desktop sees and what takes the mouse
    fn shape(hwnd: HWND, frame: &Frame, reach: i32, hole: Option<[i32; 4]>) {
        let room = (MENU_SPACE * frame.scale).round() as i32;
        let reach = reach.min(room);

        let (top, bottom) = if frame.top_edge {
            (0, frame.height + reach)
        } else {
            (room - reach, room + frame.height)
        };

        let mut rects = vec![[0, top, frame.width, bottom]];

        if let Some([left, top, right, bottom]) = hole {
            // stretch the menu box to the band so the pointer can cross the gap
            let (menu_top, menu_bottom) = if frame.top_edge {
                (top.min(frame.height), bottom)
            } else {
                (top, bottom.max(room))
            };

            rects.push([
                left - HOLE_PAD,
                menu_top - HOLE_PAD,
                right + HOLE_PAD,
                menu_bottom + HOLE_PAD,
            ]);
        }

        crate::windowing::region::set(hwnd, Some(&rects), false);
    }

    pub fn raise(window: &WebviewWindow) {
        if let Ok(hwnd) = window.hwnd() {
            lift(
                hwnd,
                window.label() != "taskbar" || !super::desktop_pinned(),
            );
        }
    }

    pub fn lift(hwnd: HWND, up: bool) {
        unsafe {
            let _ = SetWindowPos(
                hwnd,
                Some(if up { HWND_TOPMOST } else { HWND_BOTTOM }),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    }

    pub fn watch_shell(window: &WebviewWindow) {
        let _ = APP.set(window.app_handle().clone());
        let _ = SHELL.compare_exchange(0, shell_id(), Ordering::Relaxed, Ordering::Relaxed);

        let target = window.clone();

        // comctl32 only subclasses a window from the thread that created it
        let _ = window.run_on_main_thread(move || {
            let Ok(hwnd) = target.hwnd() else {
                return;
            };

            let mut hooked = HOOKED.lock().unwrap();

            if !hooked.contains(&(hwnd.0 as isize))
                && unsafe { SetWindowSubclass(hwnd, Some(on_message), 1, 0) }.as_bool()
            {
                hooked.insert(hwnd.0 as isize);
            }
        });
    }

    fn taskbar_created() -> u32 {
        static MESSAGE: OnceLock<u32> = OnceLock::new();

        *MESSAGE.get_or_init(|| unsafe { RegisterWindowMessageW(w!("TaskbarCreated")) })
    }

    fn shell_id() -> isize {
        tray_window().map_or(0, |hwnd| hwnd.0 as isize)
    }

    // the tray host re-broadcasts TaskbarCreated itself, so only a new explorer tray window means a restart
    fn shell_moved() -> bool {
        let current = shell_id();

        SHELL.swap(current, Ordering::Relaxed) != current
    }

    // the shell sends these while this thread waits inside SHAppBarMessage, so act on them from the queue
    fn schedule(hwnd: HWND) {
        if REAPPLY_PENDING.swap(true, Ordering::Relaxed) {
            return;
        }

        if unsafe { PostMessageW(Some(hwnd), REAPPLY_MESSAGE, WPARAM(0), LPARAM(0)) }.is_err() {
            REAPPLY_PENDING.store(false, Ordering::Relaxed);
        }
    }

    fn reapply_bars(hwnd: HWND) {
        if RESTARTED.swap(false, Ordering::Relaxed) {
            for bar in BARS.lock().unwrap().values_mut() {
                bar.registered = false;
            }

            reapply_shell_state();
        }

        if let Some(app) = APP.get() {
            let labels: Vec<String> = super::LAST.lock().unwrap().keys().cloned().collect();

            for label in labels {
                if let Some(bar) = app.get_webview_window(&label) {
                    super::reapply(&bar);
                }
            }
        }

        REAPPLY_PENDING.store(false, Ordering::Relaxed);

        if RESTARTED.load(Ordering::Relaxed) {
            schedule(hwnd);
        }
    }

    unsafe extern "system" fn on_message(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        if message == WM_MOUSEACTIVATE {
            return LRESULT(MA_NOACTIVATE as isize);
        }

        if message == REAPPLY_MESSAGE {
            reapply_bars(hwnd);

            return LRESULT(0);
        }

        let restarted = message != 0 && message == taskbar_created() && shell_moved();

        if restarted {
            RESTARTED.store(true, Ordering::Relaxed);
        }

        let layout_changed = restarted
            || match message {
                CALLBACK_MESSAGE => wparam.0 as u32 == ABN_POSCHANGED,
                WM_DISPLAYCHANGE | WM_DPICHANGED => true,
                _ => false,
            };

        if layout_changed {
            schedule(hwnd);
        }

        unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
    }

    pub fn release(window: &WebviewWindow) {
        if let Ok(hwnd) = window.hwnd() {
            let mut data = payload(hwnd, ABE_BOTTOM);

            crate::notify::beside_host(|| unsafe {
                SHAppBarMessage(ABM_REMOVE, &mut data);
            });
        }

        BARS.lock().unwrap().remove(window.label());

        if window.label() == "taskbar" {
            keep_system_taskbar_hidden(false);
        }
    }

    fn ours(hwnd: HWND) -> bool {
        let mut owner = 0;

        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut owner)) };

        owner == unsafe { GetCurrentProcessId() }
    }

    fn tray_windows() -> Vec<HWND> {
        let mut found = Vec::new();

        for class in [w!("Shell_TrayWnd"), w!("Shell_SecondaryTrayWnd")] {
            let mut previous = None;

            while let Ok(hwnd) = unsafe { FindWindowExW(None, previous, class, None) } {
                previous = Some(hwnd);

                if !ours(hwnd) {
                    found.push(hwnd);
                }
            }
        }

        found
    }

    fn set_system_taskbar_visible(visible: bool) {
        let command = if visible { SW_SHOW } else { SW_HIDE };

        for hwnd in tray_windows() {
            unsafe {
                let _ = ShowWindow(hwnd, command);
            }
        }
    }

    pub fn tray_window() -> Option<HWND> {
        tray_windows().into_iter().next()
    }

    fn set_shell_state(state: usize) -> bool {
        let Some(tray) = tray_window() else {
            return false;
        };

        let mut data = payload(tray, ABE_BOTTOM);

        data.lParam = LPARAM(state as isize);

        crate::notify::beside_host(|| unsafe {
            SHAppBarMessage(ABM_SETSTATE, &mut data);
        });

        true
    }

    fn current_shell_state() -> usize {
        let mut data = payload(HWND::default(), ABE_BOTTOM);

        crate::notify::beside_host(|| unsafe { SHAppBarMessage(ABM_GETSTATE, &mut data) })
    }

    fn saved_shell_state() -> Option<usize> {
        APP.get()?
            .store("settings.json")
            .ok()?
            .get(SHELL_STATE_KEY)?
            .as_u64()
            .map(|state| state as usize)
    }

    fn save_shell_state(state: Option<usize>) {
        let Some(store) = APP.get().and_then(|app| app.store("settings.json").ok()) else {
            return;
        };

        match state {
            Some(state) => store.set(SHELL_STATE_KEY, state as u64),
            None => {
                store.delete(SHELL_STATE_KEY);
            }
        }

        let _ = store.save();
    }

    // ponytail: explorer keeps its work-area strip while merely hidden, so park it in auto-hide first
    fn shell_taskbar_autohide(enabled: bool) {
        if enabled {
            if tray_window().is_none() {
                return;
            }

            let previous = saved_shell_state().unwrap_or_else(current_shell_state);

            save_shell_state(Some(previous));
            set_shell_state(previous | ABS_AUTOHIDE as usize);
        } else if let Some(previous) = saved_shell_state() {
            if set_shell_state(previous) {
                save_shell_state(None);
            }
        }
    }

    fn reapply_shell_state() {
        SHELL_STALE.store(true, Ordering::SeqCst);
        request_sync();
    }

    pub fn keep_system_taskbar_hidden(hidden: bool) {
        WANT_HIDDEN.store(hidden, Ordering::SeqCst);
        request_sync();

        if hidden {
            return;
        }

        for _ in 0..SETTLE_TRIES {
            if !SYNCING.load(Ordering::SeqCst) && !DIRTY.load(Ordering::SeqCst) {
                break;
            }

            std::thread::sleep(SETTLE_POLL);
        }
    }

    fn request_sync() {
        DIRTY.store(true, Ordering::SeqCst);

        while !SYNCING.swap(true, Ordering::SeqCst) {
            while DIRTY.swap(false, Ordering::SeqCst) {
                sync_system_taskbar(WANT_HIDDEN.load(Ordering::SeqCst));
            }

            SYNCING.store(false, Ordering::SeqCst);

            if !DIRTY.load(Ordering::SeqCst) {
                break;
            }
        }
    }

    // ponytail: explorer re-shows the tray on its own events, so poll instead of hiding once
    fn sync_system_taskbar(hidden: bool) {
        let stale = SHELL_STALE.swap(false, Ordering::SeqCst);

        if !hidden {
            let hider = HIDER.lock().unwrap().take();

            if let Some((stop, worker)) = hider {
                drop(stop);
                let _ = worker.join();
            }

            shell_taskbar_autohide(false);
            set_system_taskbar_visible(true);

            return;
        }

        if HIDER.lock().unwrap().is_some() {
            if stale {
                shell_taskbar_autohide(true);
            }

            return;
        }

        shell_taskbar_autohide(true);

        let (stop, stopped) = channel::<()>();
        let worker = std::thread::spawn(move || loop {
            set_system_taskbar_visible(false);

            if stopped.recv_timeout(HIDE_POLL) != Err(RecvTimeoutError::Timeout) {
                break;
            }
        });

        *HIDER.lock().unwrap() = Some((stop, worker));
    }
}

#[cfg(test)]
mod tests {
    use windows::Win32::Foundation::RECT;

    use super::win::{offset, span};
    use super::TaskbarLayout;

    const SECONDARY: RECT = RECT {
        left: 1920,
        top: -120,
        right: 4480,
        bottom: 1320,
    };

    #[test]
    fn a_full_width_dock_spans_the_chosen_monitor() {
        assert_eq!(span(&SECONDARY, false, 720), (1920, 2560));
    }

    #[test]
    fn a_floating_dock_centers_on_the_chosen_monitor() {
        assert_eq!(span(&SECONDARY, true, 720), (2840, 720));
    }

    #[test]
    fn the_band_hugs_the_chosen_edge() {
        assert_eq!(offset(&SECONDARY, true, 12, 48), -108);
        assert_eq!(offset(&SECONDARY, false, 12, 48), 1260);
    }

    #[test]
    fn a_payload_without_a_monitor_still_deserializes() {
        let layout: TaskbarLayout = serde_json::from_str(
            r#"{"edge":"top","height":48,"width":720,"floating":false,"autoHide":false,"hideSystemTaskbar":true}"#,
        )
        .unwrap();

        assert!(layout.monitor.is_none());
    }
}
