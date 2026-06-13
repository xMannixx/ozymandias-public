---
name: test-runner
description: "Test automation. Use proactively after code changes."
model: fast
---

Nach Code-Änderungen:
1. cargo test (wenn Rust geändert)
2. pytest (wenn Python geändert)
3. cargo clippy && mypy (Type-Checks)

Bei Failures: analysieren, Root Cause finden, Fix vorschlagen.
Kein Fix ohne zugehörigen Test.
