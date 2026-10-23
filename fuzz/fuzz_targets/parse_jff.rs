#![no_main]

use libfuzzer_sys::fuzz_target;

// The parser must never panic, and whatever it reads must survive a write and a read.
fuzz_target!(|data: &[u8]| {
    let Ok(text) = std::str::from_utf8(data) else {
        return;
    };
    if let Ok(jff) = engine_core::parse_jff(text) {
        let written = engine_core::to_jff(&jff.fsm, &jff.states)
            .expect("an imported machine can be exported");
        let again = engine_core::parse_jff(&written).expect("an exported file can be imported");
        assert_eq!(again.fsm, jff.fsm);
    }
});
