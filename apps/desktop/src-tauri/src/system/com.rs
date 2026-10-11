use std::marker::PhantomData;
use std::rc::Rc;

use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

/// Balances this scope's initialization without owning an existing apartment.
/// Keep this guard on its creating thread and declare it before COM interfaces.
pub(crate) struct Apartment {
    owned: bool,
    _thread: PhantomData<Rc<()>>,
}

impl Apartment {
    pub(crate) fn enter() -> windows::core::Result<Self> {
        let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        let owned = if result == RPC_E_CHANGED_MODE {
            false
        } else {
            // Both S_OK and S_FALSE acquire a reference requiring uninitialization.
            result.ok()?;
            true
        };
        Ok(Self {
            owned,
            _thread: PhantomData,
        })
    }
}

impl Drop for Apartment {
    fn drop(&mut self) {
        if self.owned {
            unsafe { CoUninitialize() };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::System::Com::COINIT_MULTITHREADED;

    #[test]
    fn nested_sta_scopes_balance_both_success_results() {
        std::thread::spawn(|| {
            {
                let _first = Apartment::enter().unwrap();
                let _nested = Apartment::enter().unwrap();
            }
            // MTA succeeds only if both STA references were released.
            let result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            result.ok().unwrap();
            unsafe { CoUninitialize() };
        })
        .join()
        .unwrap();
    }

    #[test]
    fn existing_mta_is_borrowed_not_uninitialized() {
        std::thread::spawn(|| {
            unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }
                .ok()
                .unwrap();
            {
                let _borrowed = Apartment::enter().unwrap();
            }
            let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
            assert_eq!(result, RPC_E_CHANGED_MODE);
            unsafe { CoUninitialize() };
        })
        .join()
        .unwrap();
    }
}
