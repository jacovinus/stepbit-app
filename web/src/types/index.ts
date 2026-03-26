export interface Session {
  id: string; // UUID
  title?: string;
  name?: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface Message {
  id: number;
  session_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  model: string | null;
  token_count: number | null;
  created_at: string;
  metadata: Record<string, any>;
}

export interface TurnCapabilityTool {
  name: string;
  provider_id: string;
  enabled: boolean;
  read_only: boolean;
  open_world: boolean;
  tags: string[];
}

export interface TurnCapabilityContext {
  search_enabled: boolean;
  reason_enabled: boolean;
  requested_tools: string[];
  available_tools: TurnCapabilityTool[];
  used_tools: string[];
}

export interface CreateSessionRequest {
  title?: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSessionRequest {
  title?: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface CreateMessageRequest {
  role: string;
  content: string;
  model?: string;
  token_count?: number;
  metadata?: Record<string, any>;
}

export interface WsServerMessage {
  type: 'chunk' | 'done' | 'error' | 'status' | 'trace' | 'context';
  content: string;
  metadata?: Record<string, any>;
}

export interface WsClientMessage {
  type: 'message' | 'cancel';
  content: string;
  stream?: boolean;
  search?: boolean;
  reason?: boolean;
  skill_ids?: number[];
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}
export interface MemoryUsageEntry {
  tag: string;
  usage_bytes: number;
}

export interface SystemStats {
  total_sessions: number;
  total_messages: number;
  total_tokens: number;
  db_size_bytes: number;
  memory_usage: MemoryUsageEntry[];
}

export interface ProviderInfo {
  id: string;
  active: boolean;
  supported_models: string[];
  status: 'online' | 'offline' | 'unverified';
}

export interface Pipeline {
  id: number;
  name: string;
  definition: {
    stages: Array<{
      stage_type: string;
      config: Record<string, any>;
    }>;
  };
  created_at: string;
  updated_at: string;
}

export interface PipelineExecuteResult {
  final_answer: string;
  trace: string[];
  tool_calls: any[];
  intermediate_results: any[];
  stage_summaries?: Array<{
    index: number;
    stage_type: string;
    title: string;
    status: string;
    trace_excerpt?: string;
    tool?: string;
  }>;
  runtime?: {
    trace_steps: number;
    tool_call_count: number;
    intermediate_result_count: number;
    stage_count: number;
    completed_stage_count: number;
  };
  error?: string;
}

export interface StepbitCoreStatus {
  online: boolean;
  ready: boolean;
  message: string;
  active_model: string;
  supported_models: string[];
  metrics: {
    requests_total: number;
    tokens_generated_total: number;
    active_sessions: number;
    token_latency_avg_ms: number;
  };
  warnings?: string[];
  capabilities?: {
    planner_http: boolean;
    replan_http: boolean;
    distributed_http: boolean;
    metrics_http: boolean;
    mcp_registry_http: boolean;
  };
}

export interface McpProviderStatus {
  id?: string;
  name: string;
  provider_type: 'native' | 'external' | string;
  scope?: string;
  enabled: boolean;
  status: 'installed' | 'disabled' | 'failed' | string;
  reason?: string | null;
  capabilities: string[];
  tool_count?: number;
  installed_tools: string[];
  planned_tools?: string[];
}

export interface CoreCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface CoreHealthReport {
  status: string;
  ok: boolean;
  checks: CoreCheck[];
}

export interface CoreReadinessContext {
  state_dir: string;
  cron_db_path: string;
  events_db_path: string;
  models_on_disk: number;
  loaded_models: number;
  mcp_enabled: number;
  mcp_installed: number;
  cron_scheduler_running: boolean;
}

export interface CoreReadinessReport {
  status: string;
  ready: boolean;
  reasons: string[];
  checks: CoreCheck[];
  context: CoreReadinessContext;
}

export interface CoreTempRuntime {
  registered_resources: number;
  total_size_bytes: number;
  pressure_level: string;
  global_usage_bytes: number;
  global_usage_files: number;
  global_max_bytes: number;
  global_max_files: number;
  per_owner_max_bytes: number;
  per_owner_max_files: number;
}

export interface CoreSystemRuntime {
  state_dir: string;
  cron_db_path: string;
  events_db_path: string;
  models_on_disk: number;
  loaded_models: number;
  mcp_providers: number;
  installed_mcp_providers: number;
  trigger_count: number;
  scheduler_active: boolean;
  temp: CoreTempRuntime;
}

export interface CoreCronStatus {
  scheduler_running: boolean;
  total_jobs: number;
  failing_jobs: number;
  retrying_jobs: number;
}

export interface CoreRecentEvent {
  id: string;
  event_type: string;
  payload: any;
  timestamp: string;
  source_node?: string | null;
}
