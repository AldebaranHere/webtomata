//! Thin browser layer over `engine-core`.

use wasm_bindgen::prelude::*;

/// Engine version, for checking that the worker loaded the module.
#[wasm_bindgen]
pub fn version() -> String {
    engine_core::version().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::wasm_bindgen_test;

    #[wasm_bindgen_test]
    fn version_matches_crate_version() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn links_engine_core() {
        assert_eq!(engine_core::version(), env!("CARGO_PKG_VERSION"));
    }
}
