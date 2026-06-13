"""Ozymandias v2 memory core.

Pure, side-effect-free building blocks for the structured memory subsystem
(authority lanes, source-write policy, query-aware retrieval scoring, rebound
protection, behavioral-rule conflict detection and provenance reconstruction).

These modules deliberately avoid any I/O so the deterministic governance logic
stays testable in isolation and can be ported to the Rust core later without
behavioral drift.
"""
