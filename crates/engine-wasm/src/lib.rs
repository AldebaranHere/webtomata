//! Thin browser layer over `engine-core`. Every function here calls the function of the same
//! name in `engine_core::api` (see there for the input formats and the answer envelope) and
//! only adds `wasm-bindgen`. One call for each user action.

use engine_core::api;
use wasm_bindgen::prelude::*;

/// Engine version, for checking that the worker loaded the module.
#[wasm_bindgen]
pub fn version() -> String {
    engine_core::version().to_owned()
}

#[wasm_bindgen(js_name = loadMachine)]
pub fn load_machine(json: &str) -> String {
    api::load_machine(json)
}

#[wasm_bindgen]
pub fn validate(machine: &str) -> String {
    api::validate(machine)
}

#[wasm_bindgen(js_name = nondeterministicStates)]
pub fn nondeterministic_states(machine: &str) -> String {
    api::nondeterministic_states(machine)
}

#[wasm_bindgen(js_name = addTrapState)]
pub fn add_trap_state(machine: &str) -> String {
    api::add_trap_state(machine)
}

#[wasm_bindgen]
pub fn simulate(machine: &str, input: &str, budget: Option<String>) -> String {
    api::simulate(machine, input, budget.as_deref())
}

#[wasm_bindgen]
pub fn determinize(machine: &str, budget: Option<String>) -> String {
    api::determinize(machine, budget.as_deref())
}

#[wasm_bindgen]
pub fn minimize(machine: &str, budget: Option<String>) -> String {
    api::minimize(machine, budget.as_deref())
}

#[wasm_bindgen]
pub fn equivalent(candidate: &str, reference: &str, budget: Option<String>) -> String {
    api::equivalent(candidate, reference, budget.as_deref())
}

#[wasm_bindgen(js_name = regexToFsm)]
pub fn regex_to_fsm(text: &str, alphabet: &str, budget: Option<String>) -> String {
    api::regex_to_fsm(text, alphabet, budget.as_deref())
}

#[wasm_bindgen(js_name = fsmToRegex)]
pub fn fsm_to_regex(machine: &str, budget: Option<String>) -> String {
    api::fsm_to_regex(machine, budget.as_deref())
}

#[wasm_bindgen]
pub fn simplify(text: &str, alphabet: &str, budget: Option<String>) -> String {
    api::simplify(text, alphabet, budget.as_deref())
}

#[wasm_bindgen(js_name = simplifyViaMachine)]
pub fn simplify_via_machine(text: &str, alphabet: &str, budget: Option<String>) -> String {
    api::simplify_via_machine(text, alphabet, budget.as_deref())
}

#[wasm_bindgen]
pub fn complement(machine: &str) -> String {
    api::complement(machine)
}

#[wasm_bindgen]
pub fn union(first: &str, second: &str) -> String {
    api::union(first, second)
}

#[wasm_bindgen]
pub fn intersection(first: &str, second: &str, budget: Option<String>) -> String {
    api::intersection(first, second, budget.as_deref())
}

#[wasm_bindgen]
pub fn xor(first: &str, second: &str, budget: Option<String>) -> String {
    api::xor(first, second, budget.as_deref())
}

#[wasm_bindgen(js_name = importJff)]
pub fn import_jff(xml: &str) -> String {
    api::import_jff(xml)
}

#[wasm_bindgen(js_name = exportJff)]
pub fn export_jff(machine: &str, layout: &str) -> String {
    api::export_jff(machine, layout)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::wasm_bindgen_test;

    const EVEN: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":1},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":0},{"from":1,"on":"b","to":0}]}"#;
    const A_STAR: &str = r#"{"schemaVersion":1,"kind":"dfsm","alphabet":["a","b"],"states":[0,1],"start":0,"accepting":[0],"transitions":[{"from":0,"on":"a","to":0},{"from":0,"on":"b","to":1},{"from":1,"on":"a","to":1},{"from":1,"on":"b","to":1}]}"#;

    // These run in WASM (`wasm-pack test --node`) and natively (`cargo test`). The functions
    // are tested in depth in `engine-core`; here we check the layer that is added.

    #[wasm_bindgen_test]
    #[test]
    fn version_matches_crate_version() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
    }

    #[wasm_bindgen_test]
    #[test]
    fn simulate_answers_in_the_envelope() {
        let answer = simulate(EVEN, "ab", None);
        assert!(
            answer.starts_with(r#"{"ok":true,"value":{"input":["a","b"]"#),
            "{answer}"
        );
    }

    #[wasm_bindgen_test]
    #[test]
    fn a_budget_that_is_too_small_stops_the_run() {
        let answer = determinize(EVEN, Some(r#"{"maxSteps": 1}"#.to_owned()));
        assert!(answer.contains(r#""result":"stopped""#), "{answer}");
        assert!(answer.contains(r#""reason":"max_steps""#), "{answer}");
    }

    #[wasm_bindgen_test]
    #[test]
    fn equivalent_names_the_witness() {
        let answer = equivalent(EVEN, A_STAR, None);
        assert!(
            answer.contains(r#""equivalence":{"result":"different""#),
            "{answer}"
        );
        assert!(answer.contains(r#""witness":["a"]"#), "{answer}");
    }

    #[wasm_bindgen_test]
    #[test]
    fn bad_input_is_an_error_and_not_a_trap() {
        assert!(load_machine("{").contains(r#""ok":false"#));
        assert!(regex_to_fsm("a", "not json", None).contains("api.invalid_alphabet"));
        assert!(import_jff("<").contains("jff.xml_invalid"));
        assert!(simulate(EVEN, "ab", Some("[".to_owned())).contains("api.invalid_budget"));
    }
}
