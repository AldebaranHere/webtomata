//! Pure Rust finite state machine engine. No browser or OS code.

/// Engine version, taken from the crate version.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_not_empty() {
        assert!(!version().is_empty());
    }
}

#[cfg(test)]
mod red_check {
    #[test]
    fn deliberately_fails() {
        assert_eq!(1 + 1, 3);
    }
}
