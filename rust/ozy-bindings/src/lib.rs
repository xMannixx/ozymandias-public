//! PyO3 wrappers for ozy-core functions.

use ozy_contracts::{
    ApprovalRequest, AuditEntry, CircuitBreakerConfig, CircuitBreakerStatus, ClaimData, OzyError,
    PayloadSensitivityInput, ProposalData, SensitivityFilterInput, TaintActionCheck, TaintContext,
    TokenBudgetRequest, WriteGateInput,
};
use ozy_core::{
    allocate_token_budget as core_allocate_token_budget,
    check_circuit_breaker as core_check_circuit_breaker,
    check_payload_sensitivity as core_check_payload_sensitivity,
    check_provenance as core_check_provenance, check_tainted_action as core_check_tainted_action,
    compute_taint as core_compute_taint, detect_conflicts as core_detect_conflicts,
    evaluate_decay as core_evaluate_decay, filter_claims as core_filter_claims,
    resolve_approval as core_resolve_approval, validate_audit_entry as core_validate_audit_entry,
    validate_schema as core_validate_schema,
};
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

#[derive(Debug)]
pub enum BindingError {
    Json(serde_json::Error),
    Ozy(OzyError),
}

impl From<serde_json::Error> for BindingError {
    fn from(err: serde_json::Error) -> Self {
        Self::Json(err)
    }
}

impl From<OzyError> for BindingError {
    fn from(err: OzyError) -> Self {
        Self::Ozy(err)
    }
}

fn binding_err_to_pyerr(err: BindingError) -> PyErr {
    match err {
        BindingError::Json(json_err) => PyValueError::new_err(json_err.to_string()),
        BindingError::Ozy(ozy_err) => {
            let json = serde_json::to_string(&ozy_err).unwrap_or_else(|_| format!("{ozy_err:?}"));
            PyValueError::new_err(json)
        }
    }
}

pub fn filter_claims_json(json_input: &str) -> Result<String, BindingError> {
    let input: SensitivityFilterInput = serde_json::from_str(json_input)?;
    let result = core_filter_claims(&input)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn check_payload_sensitivity_json(json_input: &str) -> Result<String, BindingError> {
    let input: PayloadSensitivityInput = serde_json::from_str(json_input)?;
    let result = core_check_payload_sensitivity(&input)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn validate_schema_json(json_input: &str) -> Result<String, BindingError> {
    let input: WriteGateInput = serde_json::from_str(json_input)?;
    let result = core_validate_schema(&input)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn check_provenance_json(json_input: &str) -> Result<String, BindingError> {
    let proposal: ProposalData = serde_json::from_str(json_input)?;
    let result = core_check_provenance(&proposal)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn detect_conflicts_json(
    proposal_json: &str,
    existing_claims_json: &str,
) -> Result<String, BindingError> {
    let proposal: ProposalData = serde_json::from_str(proposal_json)?;
    let existing_claims: Vec<ClaimData> = serde_json::from_str(existing_claims_json)?;
    let result = core_detect_conflicts(&proposal, &existing_claims)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn resolve_approval_json(json_input: &str) -> Result<String, BindingError> {
    let request: ApprovalRequest = serde_json::from_str(json_input)?;
    let result = core_resolve_approval(&request)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn compute_taint_json(json_input: &str) -> Result<String, BindingError> {
    let context: TaintContext = serde_json::from_str(json_input)?;
    let result = core_compute_taint(&context)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn check_tainted_action_json(json_input: &str) -> Result<String, BindingError> {
    let check: TaintActionCheck = serde_json::from_str(json_input)?;
    let result = core_check_tainted_action(&check)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn validate_audit_entry_json(json_input: &str) -> Result<String, BindingError> {
    let entry: AuditEntry = serde_json::from_str(json_input)?;
    let result = core_validate_audit_entry(&entry)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn evaluate_decay_json(claims_json: &str, now: &str) -> Result<String, BindingError> {
    let claims: Vec<ClaimData> = serde_json::from_str(claims_json)?;
    let result = core_evaluate_decay(&claims, now)?;
    Ok(serde_json::to_string(&result)?)
}

pub fn check_circuit_breaker_json(
    config_json: &str,
    current_count: u32,
    status_json: &str,
    seconds_since_last_trip: Option<u64>,
) -> Result<String, BindingError> {
    let config: CircuitBreakerConfig = serde_json::from_str(config_json)?;
    let current_status: CircuitBreakerStatus = serde_json::from_str(status_json)?;
    let result = core_check_circuit_breaker(
        &config,
        current_count,
        &current_status,
        seconds_since_last_trip,
    )?;
    Ok(serde_json::to_string(&result)?)
}

pub fn allocate_token_budget_json(json_input: &str) -> Result<String, BindingError> {
    let request: TokenBudgetRequest = serde_json::from_str(json_input)?;
    let result = core_allocate_token_budget(&request)?;
    Ok(serde_json::to_string(&result)?)
}

#[pyfunction(name = "filter_claims")]
pub fn py_filter_claims(json_input: &str) -> PyResult<String> {
    filter_claims_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "check_payload_sensitivity")]
pub fn py_check_payload_sensitivity(json_input: &str) -> PyResult<String> {
    check_payload_sensitivity_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "validate_schema")]
pub fn py_validate_schema(json_input: &str) -> PyResult<String> {
    validate_schema_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "check_provenance")]
pub fn py_check_provenance(json_input: &str) -> PyResult<String> {
    check_provenance_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "detect_conflicts")]
pub fn py_detect_conflicts(proposal_json: &str, existing_claims_json: &str) -> PyResult<String> {
    detect_conflicts_json(proposal_json, existing_claims_json).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "resolve_approval")]
pub fn py_resolve_approval(json_input: &str) -> PyResult<String> {
    resolve_approval_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "compute_taint")]
pub fn py_compute_taint(json_input: &str) -> PyResult<String> {
    compute_taint_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "check_tainted_action")]
pub fn py_check_tainted_action(json_input: &str) -> PyResult<String> {
    check_tainted_action_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "validate_audit_entry")]
pub fn py_validate_audit_entry(json_input: &str) -> PyResult<String> {
    validate_audit_entry_json(json_input).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "evaluate_decay")]
pub fn py_evaluate_decay(claims_json: &str, now: &str) -> PyResult<String> {
    evaluate_decay_json(claims_json, now).map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "check_circuit_breaker")]
pub fn py_check_circuit_breaker(
    config_json: &str,
    current_count: u32,
    status_json: &str,
    seconds_since_last_trip: Option<u64>,
) -> PyResult<String> {
    check_circuit_breaker_json(
        config_json,
        current_count,
        status_json,
        seconds_since_last_trip,
    )
    .map_err(binding_err_to_pyerr)
}

#[pyfunction(name = "allocate_token_budget")]
pub fn py_allocate_token_budget(json_input: &str) -> PyResult<String> {
    allocate_token_budget_json(json_input).map_err(binding_err_to_pyerr)
}

#[pymodule]
pub fn ozy_bindings(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(py_filter_claims, m)?)?;
    m.add_function(wrap_pyfunction!(py_check_payload_sensitivity, m)?)?;
    m.add_function(wrap_pyfunction!(py_validate_schema, m)?)?;
    m.add_function(wrap_pyfunction!(py_check_provenance, m)?)?;
    m.add_function(wrap_pyfunction!(py_detect_conflicts, m)?)?;
    m.add_function(wrap_pyfunction!(py_resolve_approval, m)?)?;
    m.add_function(wrap_pyfunction!(py_compute_taint, m)?)?;
    m.add_function(wrap_pyfunction!(py_check_tainted_action, m)?)?;
    m.add_function(wrap_pyfunction!(py_validate_audit_entry, m)?)?;
    m.add_function(wrap_pyfunction!(py_evaluate_decay, m)?)?;
    m.add_function(wrap_pyfunction!(py_check_circuit_breaker, m)?)?;
    m.add_function(wrap_pyfunction!(py_allocate_token_budget, m)?)?;
    Ok(())
}
