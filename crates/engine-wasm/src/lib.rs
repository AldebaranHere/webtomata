//! Thin browser layer over `engine-core`. `wasm-bindgen` arrives in F3.

#[cfg(test)]
mod tests {
    #[test]
    fn links_engine_core() {
        assert_eq!(engine_core::version(), env!("CARGO_PKG_VERSION"));
    }
}
