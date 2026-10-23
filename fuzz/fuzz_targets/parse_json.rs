#![no_main]

use libfuzzer_sys::fuzz_target;

// The loader must never panic, and whatever it reads must survive a write and a read.
fuzz_target!(|data: &[u8]| {
    let Ok(text) = std::str::from_utf8(data) else {
        return;
    };
    if let Ok(fsm) = engine_core::Fsm::from_json(text) {
        let again = engine_core::Fsm::from_json(&fsm.to_json()).expect("saved JSON can be loaded");
        assert_eq!(again, fsm);
    }
});
