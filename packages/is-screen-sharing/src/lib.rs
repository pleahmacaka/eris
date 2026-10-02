use napi_derive::napi;

#[napi]
pub fn is_screen_sharing() -> bool {
    is_screen_sharing::is_screen_sharing()
}
