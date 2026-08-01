export type Sensitivity = "S0" | "S1" | "S2" | "S3" | "S4";
export type LLMProviderName = "deepseek" | "openai" | "ollama" | "gemini" | "lmstudio" | "mistral";
export type VoiceMode = "push_to_talk" | "hands_free";

export type ClaimResponse = {
  claim_id: string;
  user_id: string;
  subject: string;
  attribute: string | null;
  value: string;
  content: string;
  memory_type: string;
  verification_state: string;
  confidence: number;
  source_ref: string | null;
  source_type: string;
  sensitivity: Sensitivity;
  trust_level: string;
  handling_policy: string;
  user_locked: boolean;
  decay_eligible: boolean;
  lifecycle: string;
  valid_from: string | null;
  valid_to: string | null;
  ingested_at: string | null;
  superseded_at: string | null;
  review_due: boolean;
  last_reviewed: string | null;
  last_accessed: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProposedClaimData = {
  subject: string;
  attribute: string | null;
  value: string;
  content: string;
  memory_type: string;
  verification_state: string;
  confidence: number;
  source_ref: string | null;
  source_type: string;
  sensitivity: Sensitivity;
  trust_level: string;
  handling_policy: string;
  user_locked: boolean;
  decay_eligible: boolean;
  lifecycle: string;
  valid_from: string | null;
  valid_to: string | null;
  [key: string]: unknown;
};

export type ProposalResponse = {
  proposal_id: string;
  user_id: string;
  proposed_claim: ProposedClaimData;
  source_ref: string | null;
  source_type: string;
  status: string;
  conflict_group_id: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
};

export type ClaimVersionResponse = {
  version_id: string;
  claim_id: string;
  version_number: number;
  version_hash: string;
  previous_hash: string | null;
  content_snapshot: Record<string, unknown>;
  change_reason: string | null;
  changed_by: string;
  created_at: string;
};

export type ArchiveRetractResponse = {
  claim_id: string;
  status: "archived" | "retracted";
};

export type AuditEntryResponse = {
  audit_id: string;
  event_type: string;
  user_id: string;
  channel: string;
  payload: Record<string, unknown> | null;
  source_ref: string | null;
  result: string | null;
  sensitivity: Sensitivity;
  created_at: string;
};

export type AuditListResponse = {
  entries: AuditEntryResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type CircuitBreakerStatus = {
  current_count: number;
  is_tripped: boolean;
  max_actions: number;
  window_seconds: number;
  cooldown_seconds: number;
};

export type DashboardStats = {
  claims_total: number;
  claims_by_verification: Record<string, number>;
  claims_by_sensitivity: Record<string, number>;
  proposals_pending: number;
  proposals_total: number;
  circuit_breaker: CircuitBreakerStatus;
  recent_actions: AuditEntryResponse[];
  provider_usage: Record<string, number>;
  projects_active: number;
  projects_tasks_open: number;
  projects_knowledge_files: number;
  projects_next_due_task: string | null;
  contacts_total: number;
};

export type HealthResponse = {
  status: string;
  database: string;
  redis: string;
  rust_bindings: string;
  llm_providers: string[];
  llm_provider_health: LLMProviderHealth[];
  live_web: LiveWebHealth | null;
};

export type LLMProviderInfo = {
  name: string;
  is_local: boolean;
  current_model: string;
};

export type LLMProviderHealth = {
  name: string;
  is_local: boolean;
  configured: boolean;
  status: "ok" | "unavailable" | "configured" | "not_configured";
  model: string | null;
  detail: string | null;
};

export type LiveWebHealth = {
  connector_status: "configured" | "not_configured" | "unavailable";
  connector_detail: string | null;
  native_provider_candidates: string[];
};

export type UserSettingsResponse = {
  mode: "guardian" | "autopilot";
  kill_switch: boolean;
  decay_interval_hours: number;
  decay_confidence_threshold: number;
  cb_max_actions_override: number | null;
  cb_window_seconds_override: number | null;
  cb_cooldown_seconds_override: number | null;
  preferred_provider: LLMProviderName | null;
  preferred_model: string | null;
  preferred_local_provider: "ollama" | "lmstudio" | null;
  preferred_local_model: string | null;
  live_web_enabled: boolean;
  live_web_mode: "provider_native_first" | "connector_only" | "off";
  live_web_s3_confirmed_default: boolean;
  voice_enabled: boolean;
  voice_mode: VoiceMode;
  tts_voice: string;
  tts_model: "tts-1" | "tts-1-hd";
  tts_autoplay: boolean;
  openai_api_key?: string | null;
  deepseek_api_key?: string | null;
  gemini_api_key?: string | null;
  mistral_api_key?: string | null;
  anthropic_api_key?: string | null;
  updated_at: string;
};

export type UpdateSettingsRequest = {
  mode?: "guardian" | "autopilot";
  decay_interval_hours?: number;
  decay_confidence_threshold?: number;
  cb_max_actions_override?: number | null;
  cb_window_seconds_override?: number | null;
  cb_cooldown_seconds_override?: number | null;
  preferred_provider?: LLMProviderName | null;
  preferred_model?: string | null;
  preferred_local_provider?: "ollama" | "lmstudio" | null;
  preferred_local_model?: string | null;
  live_web_enabled?: boolean;
  live_web_mode?: "provider_native_first" | "connector_only" | "off";
  live_web_s3_confirmed_default?: boolean;
  voice_enabled?: boolean;
  voice_mode?: VoiceMode;
  tts_voice?: string;
  tts_model?: "tts-1" | "tts-1-hd";
  tts_autoplay?: boolean;
  openai_api_key?: string | null;
  deepseek_api_key?: string | null;
  gemini_api_key?: string | null;
  mistral_api_key?: string | null;
  anthropic_api_key?: string | null;
};

export type TurnAttachment = {
  filename: string;
  content: string;
};

export type AttachmentExtractResponse = {
  filename: string;
  content: string;
  truncated: boolean;
  char_count: number;
  sensitivity: string;
};

export type TurnRequest = {
  text: string;
  channel?: string;
  claims?: Array<Record<string, unknown>>;
  provider?: LLMProviderName;
  model?: string;
  allow_s3_cloud_fallback?: boolean;
  use_live_web?: boolean;
  allow_s3_live_web?: boolean;
  conversation_id?: string;
  project_id?: string;
  attachments?: TurnAttachment[];
};

export type ClaimProcessResult = {
  claim_ref: string;
  status: "created" | "proposal_created" | "rejected" | "filtered_out";
  reason: string | null;
  claim_id: string | null;
  proposal_id: string | null;
};

export type TurnResult = {
  turn_id: string;
  response_text?: string;
  response?: string;
  reasoning_content?: string | null;
  provider?: string;
  model?: string;
  results?: ClaimProcessResult[];
  conversation_id?: string | null;
};

export type ConversationResponse = {
  conversation_id: string;
  title: string;
  /** Workspace this chat belongs to; null for general chats. */
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationMessageResponse = {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  turn_id: string | null;
  created_at: string;
};

export type VoiceTranscriptionResponse = {
  text: string;
};

export type VoiceVoicesResponse = {
  voices: string[];
};

export type AuthTokenResponse = {
  access_token: string;
  token_type?: string;
};

export type GoogleAuthUrlResponse = {
  url: string;
};

export type GoogleStatusResponse = {
  connected: boolean;
  email: string | null;
  scopes: string[];
};

export type MailSummary = {
  id: string;
  subject: string | null;
  sender: string;
  snippet: string;
  date: string;
  is_read: boolean;
};

export type MailDetail = {
  id: string;
  sender: string;
  to: string[];
  subject: string | null;
  date: string;
  body: string;
  attachments: Array<{ name: string; size: number }>;
};

export type SendMailRequest = {
  to: string;
  subject: string;
  body: string;
};

export type MailSendResponse = {
  id: string;
  thread_id: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
  attendees: string[];
  html_link: string | null;
};

export type CreateEventRequest = {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
};
export type ProjectStatus = "active" | "paused" | "completed" | "cancelled";
export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "open" | "in_progress" | "done";
export type NoteSource = "user" | "chat" | "system";
/** Whether a file's text could be read and used as workspace knowledge. */
export type ExtractStatus = "pending" | "ok" | "unsupported" | "failed";

export type ProjectResponse = {
  project_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  sensitivity: Sensitivity;
  status: ProjectStatus;
  priority: ProjectPriority;
  color: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  task_count: number;
  task_done_count: number;
  knowledge_count: number;
  chat_count: number;
  next_due_task: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDetailResponse = ProjectResponse & {
  tasks: TaskResponse[];
  notes: NoteResponse[];
  files: ProjectFileResponse[];
  links: LinkResponse[];
  chats: ProjectChatResponse[];
};

export type ProjectChatResponse = {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type CreateProjectRequest = {
  name: string;
  description?: string;
  instructions?: string;
  sensitivity?: Sensitivity;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  color?: string;
  start_date?: string;
  target_date?: string;
};

export type UpdateProjectRequest = {
  name?: string;
  description?: string;
  instructions?: string;
  sensitivity?: Sensitivity;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  color?: string;
  start_date?: string;
  target_date?: string;
  completed_date?: string;
};

export type TaskResponse = {
  task_id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: ProjectPriority;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreateTaskRequest = {
  name: string;
  description?: string;
  status?: TaskStatus;
  priority?: ProjectPriority;
  due_date?: string;
  sort_order?: number;
};

export type UpdateTaskRequest = {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: ProjectPriority;
  due_date?: string;
  sort_order?: number;
};

export type NoteResponse = {
  note_id: string;
  project_id: string;
  content: string;
  source: NoteSource;
  created_at: string;
};

export type CreateNoteRequest = {
  content: string;
  source?: NoteSource;
};

export type ProjectFileResponse = {
  file_id: string;
  project_id: string;
  filename: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  extract_status: ExtractStatus;
  text_chars: number;
  created_at: string;
};

export type LinkResponse = {
  link_id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
};

export type CreateLinkRequest = {
  name: string;
  url: string;
};

// --- Contacts ---

export type PhoneEntry = {
  label: string;
  number: string;
};

export type EmailEntry = {
  label: string;
  email: string;
};

export type ContactResponse = {
  contact_id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  role: string | null;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  tags: string[];
  has_avatar: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactLinkedProject = {
  project_id: string;
  name: string;
  status: string;
};

export type ContactDetailResponse = ContactResponse & {
  address: string | null;
  birthday: string | null;
  notes: string | null;
  linked_projects: ContactLinkedProject[];
};

export type CreateContactRequest = {
  first_name: string;
  last_name?: string | null;
  company?: string | null;
  role?: string | null;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  address?: string | null;
  birthday?: string | null;
  notes?: string | null;
  tags?: string[];
};

export type UpdateContactRequest = {
  first_name?: string;
  last_name?: string | null;
  company?: string | null;
  role?: string | null;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  address?: string | null;
  birthday?: string | null;
  notes?: string | null;
  tags?: string[];
};

export type LinkProjectRequest = {
  project_id: string;
};
