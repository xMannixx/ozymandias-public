//! `ozy-contracts` contains only shared data contracts.
//! It defines enums, structs, and `OzyError` without behavior or I/O.

pub mod enums;
pub mod error;
pub mod structs;

pub use enums::*;
pub use error::*;
pub use structs::*;
