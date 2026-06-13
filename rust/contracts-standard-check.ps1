$ErrorActionPreference = "Stop"

Write-Host "Running standard contracts quality gate..."

cargo fmt -- --check
cargo test
cargo clippy --all-targets -- -D warnings

Write-Host "All standard checks passed."
