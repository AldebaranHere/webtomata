#![no_main]

use libfuzzer_sys::fuzz_target;

// The PDA parser must never panic, and whatever it reads must survive a write and a read.
fuzz_target!(|data: &[u8]| {
    let Ok(text) = std::str::from_utf8(data) else {
        return;
    };
    if let Ok(jff) = engine_core::parse_pda_jff(text) {
        let written = engine_core::to_pda_jff(&jff.pda, &jff.states)
            .expect("an imported PDA can be exported");
        let again = engine_core::parse_pda_jff(&written).expect("an exported file can be imported");
        assert_eq!(again.pda, jff.pda);
    }
});
