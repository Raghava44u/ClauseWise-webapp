export interface DocumentSegment {
  id: string;
  document_id: string;
  page_number?: number;
  section_title?: string;
  paragraph_index?: number;
  text: string;
  start_offset: number;
  end_offset: number;
  bbox_json?: string;
  is_ocr: boolean;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: "pdf" | "docx";
  file_size: number;
  created_at: string;
  status: "uploading" | "processing" | "ready" | "failed";
  error_message?: string;
  page_count?: number;
  is_scanned: boolean;
  ocr_applied: boolean;
  summary?: string;
  raw_text?: string;
  segments?: DocumentSegment[];
}

export interface Citation {
  id?: string;
  document_id: string;
  document_title: string;
  page_number?: number | string;
  quote: string;
  verified: boolean;
  start_offset?: number;
  end_offset?: number;
  confidence: number;
  verification_note?: string;
  bbox?: number[];
  reason?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  is_interrupted: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  document_id?: string;
  document_ids: string[];
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface ClauseInfo {
  title: string;
  page_number?: number;
  start_offset: number;
  end_offset: number;
  text_preview: string;
}

export interface ComparisonItem {
  id: string;
  clause_name: string;
  change_type: "added" | "removed" | "modified" | "unchanged";
  original_text?: string;
  revised_text?: string;
  explanation: string;
  significance: "critical" | "high" | "medium" | "low";
  is_numeric_change: boolean;
  base_page?: string;
  target_page?: string;
  base_citation?: Citation;
  target_citation?: Citation;
}

export interface ComparisonResponse {
  id: string;
  base_document_id: string;
  target_document_id: string;
  base_document_title?: string;
  target_document_title?: string;
  summary?: string;
  status: "processing" | "ready" | "failed";
  error_message?: string;
  created_at: string;
  items: ComparisonItem[];
}

export interface ToolCallInfo {
  id?: string;
  round_number: number;
  tool_name: string;
  arguments: Record<string, any>;
  result_summary?: string;
  raw_result?: any;
  created_at?: string;
}

export interface AgentRunState {
  id?: string;
  query: string;
  status: "idle" | "running" | "completed" | "failed" | "stopped";
  statusMessage?: string;
  currentRound: number;
  toolCalls: ToolCallInfo[];
  citations: Citation[];
  finalAnswer: string;
}
