use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, RGN_OR,
};

pub fn physical(rect: [f64; 4], scale: f64) -> [i32; 4] {
    rect.map(|value| (value * scale).round() as i32)
}

pub fn set(hwnd: HWND, rects: Option<&[[i32; 4]]>, redraw: bool) {
    unsafe {
        let Some(rects) = rects else {
            SetWindowRgn(hwnd, None, redraw);

            return;
        };

        let region = CreateRectRgn(0, 0, 0, 0);

        for [left, top, right, bottom] in rects {
            let part = CreateRectRgn(*left, *top, *right, *bottom);

            CombineRgn(Some(region), Some(region), Some(part), RGN_OR);

            let _ = DeleteObject(part.into());
        }

        // the window owns the region only once SetWindowRgn succeeds
        if SetWindowRgn(hwnd, Some(region), redraw) == 0 {
            let _ = DeleteObject(region.into());
        }
    }
}
