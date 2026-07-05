"""Pydantic models for API request and response payloads."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas import Channel, ClaimData, ProposalData, Sensitivity, TaintSummary

ProviderLiteral = Literal[
    "deepseek",
    "openai",
    "ollama",
    "gemini",
    "lmstudio",
    "mistral",
    "anthropic",
]
LocalProviderLiteral = Literal["ollama", "lmstudio"]


class TurnRequest(BaseModel):
    """Incoming request for turn processing."""

    text: str = Field(min_length=1)
    channel: Channel = Channel.web
    claims: list[ClaimData] | None = None
    provider: ProviderLiteral | None = None
    model: str | None = Field(default=None, min_length=1, max_length=120)
    allow_s3_cloud_fallback: bool = False
    use_live_web: bool | None = None
    allow_s3_live_web: bool = False
    conversation_id: str | None = None


class GoogleAuthUrlResponse(BaseModel):
    """Response payload containing Google OAuth URL."""

    url: str


class GoogleStatusResponse(BaseModel):
    """Connection status for Google OAuth tokens."""

    connected: bool
    email: str | None
    scopes: list[str]


class TokenLoginRequest(BaseModel):
    """Payload for dev token login."""

    token: str


class TokenLoginResponse(BaseModel):
    """Access token response payload."""

    access_token: str


class VoiceTranscriptionResponse(BaseModel):
    """Response payload for voice transcription endpoint."""

    text: str


class VoiceVoicesResponse(BaseModel):
    """Available voices for TTS selection."""

    voices: list[str]


class VoiceTTSRequest(BaseModel):
    """Payload for text-to-speech conversion."""

    text: str = Field(min_length=1, max_length=4096)
    voice: str | None = None
    model: Literal["tts-1", "tts-1-hd"] | None = None


class ClaimProcessResult(BaseModel):
    """Per-claim processing result within one turn."""

    claim_ref: str
    status: Literal["created", "proposal_created", "rejected", "filtered_out"]
    reason: str | None = None
    claim_id: str | None = None
    proposal_id: str | None = None


class TurnResult(BaseModel):
    """Result payload returned by the turn pipeline."""

    turn_id: str
    response_text: str | None = None
    reasoning_content: str | None = None
    provider: str
    model: str
    claims_processed: int = Field(ge=0)
    filtered_count: int = Field(ge=0)
    results: list[ClaimProcessResult]
    taint_summary: TaintSummary | None = None
    conversation_id: str | None = None


class ConversationResponse(BaseModel):
    """Serialized conversation list item."""

    conversation_id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationMessageResponse(BaseModel):
    """Serialized chat message for history restore."""

    message_id: str
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    provider: str | None
    model: str | None
    turn_id: str | None
    created_at: datetime


class UpdateConversationRequest(BaseModel):
    """Rename payload for one conversation."""

    title: str = Field(min_length=1, max_length=200)


class CreateClaimRequest(BaseModel):
    """Request to create one claim directly."""

    claim: ClaimData


class ClaimResponse(BaseModel):
    """Serialized claim for API responses."""

    claim_id: str
    user_id: str
    subject: str
    attribute: str | None
    value: str
    content: str
    memory_type: str
    verification_state: str
    confidence: float
    source_ref: str | None
    source_type: str
    sensitivity: str
    trust_level: str
    handling_policy: str
    user_locked: bool
    decay_eligible: bool
    lifecycle: str
    valid_from: datetime | None
    valid_to: datetime | None
    ingested_at: datetime | None
    superseded_at: datetime | None
    review_due: bool
    last_reviewed: datetime | None
    last_accessed: datetime | None
    created_at: datetime | None
    updated_at: datetime | None


class ArchiveClaimResponse(BaseModel):
    """Response for archive operation."""

    claim_id: str
    status: Literal["archived", "retracted"]


class ClaimVersionResponse(BaseModel):
    """Serialized claim version for API responses."""

    version_id: str
    claim_id: str
    version_number: int
    version_hash: str
    previous_hash: str | None
    content_snapshot: dict[str, object]
    change_reason: str | None
    changed_by: str
    created_at: datetime


class UpdateSensitivityRequest(BaseModel):
    """Request payload for sensitivity updates."""

    sensitivity: Sensitivity


class CreateProposalRequest(BaseModel):
    """Request to create one memory proposal."""

    proposal: ProposalData
    conflict_group_id: str | None = None


class ProposalDecisionRequest(BaseModel):
    """Request payload for approving or rejecting a proposal."""

    reason: str | None = None


class ProposalResponse(BaseModel):
    """Serialized proposal for API responses."""

    proposal_id: str
    user_id: str
    proposed_claim: dict[str, object]
    source_ref: str | None
    source_type: str
    status: str
    conflict_group_id: str | None
    rejection_reason: str | None
    created_at: datetime | None
    decided_at: datetime | None
    decided_by: str | None


class AuditEntryResponse(BaseModel):
    """Serialized audit entry for feed and dashboard."""

    audit_id: str
    event_type: str
    user_id: str
    channel: str
    payload: dict[str, object] | None
    source_ref: str | None
    result: str | None
    sensitivity: str
    created_at: datetime


class AuditListResponse(BaseModel):
    """Paginated audit feed response."""

    entries: list[AuditEntryResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class CircuitBreakerStatusResponse(BaseModel):
    """Dashboard snapshot of circuit breaker status."""

    current_count: int = Field(ge=0)
    is_tripped: bool
    max_actions: int = Field(ge=1)
    window_seconds: int = Field(ge=1)
    cooldown_seconds: int = Field(ge=1)


class DashboardStats(BaseModel):
    """Aggregated dashboard metrics."""

    claims_total: int = Field(ge=0)
    claims_by_verification: dict[str, int]
    claims_by_sensitivity: dict[str, int]
    proposals_pending: int = Field(ge=0)
    proposals_total: int = Field(ge=0)
    circuit_breaker: CircuitBreakerStatusResponse
    recent_actions: list[AuditEntryResponse]
    provider_usage: dict[str, int]
    projects_active: int = Field(ge=0)
    projects_tasks_open: int = Field(ge=0)
    projects_risks_critical: int = Field(ge=0)
    projects_next_milestone: str | None = None
    contacts_total: int = Field(ge=0)


class UserSettingsResponse(BaseModel):
    """Serialized per-user runtime settings."""

    mode: str
    kill_switch: bool
    decay_interval_hours: int
    decay_confidence_threshold: float
    cb_max_actions_override: int | None
    cb_window_seconds_override: int | None
    cb_cooldown_seconds_override: int | None
    preferred_provider: ProviderLiteral | None
    preferred_model: str | None
    preferred_local_provider: LocalProviderLiteral | None
    preferred_local_model: str | None
    live_web_enabled: bool
    live_web_mode: Literal["provider_native_first", "connector_only", "off"]
    live_web_s3_confirmed_default: bool
    voice_enabled: bool
    voice_mode: Literal["push_to_talk", "hands_free"]
    tts_voice: str
    tts_model: Literal["tts-1", "tts-1-hd"]
    tts_autoplay: bool
    openai_api_key: str | None = None
    deepseek_api_key: str | None = None
    gemini_api_key: str | None = None
    mistral_api_key: str | None = None
    anthropic_api_key: str | None = None
    updated_at: datetime


class UpdateSettingsRequest(BaseModel):
    """Partial settings update payload."""

    mode: Literal["guardian", "autopilot"] | None = None
    decay_interval_hours: int | None = Field(default=None, ge=1, le=720)
    decay_confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    cb_max_actions_override: int | None = Field(default=None, ge=1, le=1000)
    cb_window_seconds_override: int | None = Field(default=None, ge=10, le=3600)
    cb_cooldown_seconds_override: int | None = Field(default=None, ge=10, le=7200)
    preferred_provider: ProviderLiteral | None = None
    preferred_model: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_local_provider: LocalProviderLiteral | None = None
    preferred_local_model: str | None = Field(default=None, min_length=1, max_length=120)
    live_web_enabled: bool | None = None
    live_web_mode: Literal["provider_native_first", "connector_only", "off"] | None = None
    live_web_s3_confirmed_default: bool | None = None
    voice_enabled: bool | None = None
    voice_mode: Literal["push_to_talk", "hands_free"] | None = None
    tts_voice: str | None = Field(default=None, min_length=1, max_length=50)
    tts_model: Literal["tts-1", "tts-1-hd"] | None = None
    tts_autoplay: bool | None = None
    openai_api_key: str | None = None
    deepseek_api_key: str | None = None
    gemini_api_key: str | None = None
    mistral_api_key: str | None = None
    anthropic_api_key: str | None = None


class KillSwitchRequest(BaseModel):
    """Explicit kill-switch toggle request."""

    active: bool


class LLMProviderInfo(BaseModel):
    """Provider status and default model metadata."""

    name: str
    is_local: bool
    current_model: str


class LLMProviderTokenUsage(BaseModel):
    """Daily token usage for one cloud provider."""

    used: int = Field(ge=0)
    limit: int = Field(ge=0, description="0 means no limit configured")
    pct: float | None = Field(default=None, description="Usage percentage; null when no limit set")
    budget_status: Literal["ok", "warning", "limit_reached"] = "ok"


class LLMProviderHealth(BaseModel):
    """Detailed per-provider health summary for dashboard status."""

    name: str
    is_local: bool
    configured: bool
    status: Literal["ok", "unavailable", "configured", "not_configured", "warning", "limit_reached"]
    model: str | None = None
    detail: str | None = None
    token_usage: LLMProviderTokenUsage | None = None


class LiveWebHealth(BaseModel):
    """Live web subsystem status summary."""

    connector_status: Literal["configured", "not_configured", "unavailable"]
    connector_detail: str | None = None
    native_provider_candidates: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Extended health endpoint response payload."""

    status: str
    database: str
    redis: str
    rust_bindings: str
    llm_providers: list[str]
    llm_provider_health: list[LLMProviderHealth] = Field(default_factory=list)
    live_web: LiveWebHealth | None = None


class MailSummary(BaseModel):
    """Compact Gmail message payload."""

    id: str
    subject: str | None
    sender: str
    snippet: str
    date: datetime
    is_read: bool


class MailDetail(BaseModel):
    """Detailed Gmail message payload."""

    id: str
    sender: str
    to: list[str]
    subject: str | None
    date: datetime
    body: str
    attachments: list[dict[str, str | int]]


class SendMailRequest(BaseModel):
    """Outgoing mail request payload."""

    to: str = Field(min_length=3)
    subject: str = Field(min_length=1)
    body: str = Field(min_length=1)


class MailSendResponse(BaseModel):
    """Result payload after sending one Gmail message."""

    id: str
    thread_id: str


class CalendarEventResponse(BaseModel):
    """Calendar event payload for read and write operations."""

    id: str
    summary: str
    start: datetime
    end: datetime
    location: str | None
    description: str | None
    attendees: list[str]
    html_link: str | None


class CreateEventRequest(BaseModel):
    """Calendar event creation request payload."""

    summary: str = Field(min_length=1)
    start: datetime
    end: datetime
    description: str | None = None
    location: str | None = None


class ProjectResponse(BaseModel):
    """Serialized project with aggregate counters."""

    project_id: str
    name: str
    description: str | None
    status: str
    priority: str
    color: str | None
    start_date: date | None
    target_date: date | None
    completed_date: date | None
    task_count: int = Field(ge=0)
    task_done_count: int = Field(ge=0)
    risk_open_count: int = Field(ge=0)
    next_milestone: str | None = None
    created_at: datetime
    updated_at: datetime


class ProjectDetailResponse(ProjectResponse):
    """Project payload with fully expanded related entities."""

    milestones: list[MilestoneResponse]
    tasks: list[TaskResponse]
    risks: list[RiskResponse]
    notes: list[NoteResponse]
    files: list[FileResponse]
    links: list[LinkResponse]


class CreateProjectRequest(BaseModel):
    """Create one project."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: Literal["active", "paused", "completed", "cancelled"] = "active"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    color: str | None = None
    start_date: date | None = None
    target_date: date | None = None


class UpdateProjectRequest(BaseModel):
    """Partial project update."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: Literal["active", "paused", "completed", "cancelled"] | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    color: str | None = None
    start_date: date | None = None
    target_date: date | None = None
    completed_date: date | None = None


class MilestoneResponse(BaseModel):
    """Milestone payload."""

    milestone_id: str
    project_id: str
    name: str
    due_date: date | None
    completed: bool
    completed_at: datetime | None
    sort_order: int
    created_at: datetime


class CreateMilestoneRequest(BaseModel):
    """Create milestone payload."""

    name: str = Field(min_length=1, max_length=200)
    due_date: date | None = None
    sort_order: int = 0


class UpdateMilestoneRequest(BaseModel):
    """Partial milestone update."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    due_date: date | None = None
    completed: bool | None = None
    sort_order: int | None = None


class TaskResponse(BaseModel):
    """Task payload."""

    task_id: str
    project_id: str
    name: str
    description: str | None
    status: str
    priority: str
    due_date: date | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CreateTaskRequest(BaseModel):
    """Create task payload."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: Literal["open", "in_progress", "done"] = "open"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    due_date: date | None = None
    sort_order: int = 0


class UpdateTaskRequest(BaseModel):
    """Partial task update."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: Literal["open", "in_progress", "done"] | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    due_date: date | None = None
    sort_order: int | None = None


class RiskResponse(BaseModel):
    """Risk payload."""

    risk_id: str
    project_id: str
    name: str
    description: str | None
    severity: str
    status: str
    created_at: datetime
    updated_at: datetime


class CreateRiskRequest(BaseModel):
    """Create risk payload."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    status: Literal["open", "watching", "occurred", "resolved"] = "open"


class UpdateRiskRequest(BaseModel):
    """Partial risk update."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    status: Literal["open", "watching", "occurred", "resolved"] | None = None


class NoteResponse(BaseModel):
    """Project note payload."""

    note_id: str
    project_id: str
    content: str
    source: str
    created_at: datetime


class CreateNoteRequest(BaseModel):
    """Create note payload."""

    content: str = Field(min_length=1)
    source: Literal["user", "chat", "system"] = "user"


class FileResponse(BaseModel):
    """Project file metadata payload."""

    file_id: str
    project_id: str
    filename: str
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime


class LinkResponse(BaseModel):
    """Project link payload."""

    link_id: str
    project_id: str
    name: str
    url: str
    created_at: datetime


class CreateLinkRequest(BaseModel):
    """Create link payload."""

    name: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=3, max_length=2048)


# --- Contacts ---


class PhoneEntry(BaseModel):
    """Single phone number with label."""

    label: str = Field(min_length=1, max_length=120)
    number: str = Field(min_length=1, max_length=80)


class EmailEntry(BaseModel):
    """Single email with label."""

    label: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)


class ContactResponse(BaseModel):
    """Contact list item."""

    contact_id: str
    first_name: str
    last_name: str | None
    company: str | None
    role: str | None
    phones: list[PhoneEntry]
    emails: list[EmailEntry]
    tags: list[str]
    has_avatar: bool
    created_at: datetime
    updated_at: datetime


class ContactLinkedProject(BaseModel):
    """Minimal project info for contact detail."""

    project_id: str
    name: str
    status: str


class ContactDetailResponse(ContactResponse):
    """Full contact with all fields and linked projects."""

    address: str | None
    birthday: date | None
    notes: str | None
    linked_projects: list[ContactLinkedProject]


class CreateContactRequest(BaseModel):
    """Create one contact."""

    first_name: str = Field(min_length=1, max_length=200)
    last_name: str | None = None
    company: str | None = None
    role: str | None = None
    phones: list[PhoneEntry] = Field(default_factory=list)
    emails: list[EmailEntry] = Field(default_factory=list)
    address: str | None = None
    birthday: date | None = None
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)


class UpdateContactRequest(BaseModel):
    """Partial contact update."""

    first_name: str | None = Field(default=None, min_length=1, max_length=200)
    last_name: str | None = None
    company: str | None = None
    role: str | None = None
    phones: list[PhoneEntry] | None = None
    emails: list[EmailEntry] | None = None
    address: str | None = None
    birthday: date | None = None
    notes: str | None = None
    tags: list[str] | None = None


class LinkProjectRequest(BaseModel):
    """Link a project to a contact."""

    project_id: str = Field(min_length=1)
