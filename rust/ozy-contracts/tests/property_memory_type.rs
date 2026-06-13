use ozy_contracts::MemoryType;
use proptest::prelude::*;
use serde_json::{from_str, to_string};

fn is_known_memory_type(value: &str) -> bool {
    matches!(
        value,
        "profile"
            | "health"
            | "preference"
            | "relationship"
            | "event"
            | "location"
            | "work"
            | "finance"
            | "security"
            | "intimate"
    )
}

proptest! {
    #[test]
    fn memory_type_other_roundtrips_for_unknown_strings(input in ".{1,40}") {
        prop_assume!(!is_known_memory_type(&input));
        let value = MemoryType::Other(input.clone());
        let json = to_string(&value).expect("serialize");
        let back: MemoryType = from_str(&json).expect("deserialize");
        prop_assert_eq!(back, MemoryType::Other(input));
    }

    #[test]
    fn memory_type_deserialize_serialize_is_stable(input in ".{1,40}") {
        let json = serde_json::to_string(&input).expect("string to json");
        let parsed: MemoryType = from_str(&json).expect("deserialize memory type");
        let encoded = to_string(&parsed).expect("serialize memory type");

        if is_known_memory_type(&input) {
            prop_assert_eq!(encoded, json);
        } else {
            prop_assert_eq!(parsed, MemoryType::Other(input));
            prop_assert_eq!(encoded, json);
        }
    }
}
