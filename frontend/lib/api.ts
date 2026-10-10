import {
  DocumentItem,
  DocumentSegment,
  Conversation,
  Message,
  ClauseInfo,
  ComparisonResponse,
  Citation,
  ToolCallInfo
} from "./types";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

export function getDocumentContentUrl(id: string): string {
  return `${BACKEND_URL}/api/v1/documents/${id}/content`;
}

export async function checkBackendHealth(): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/v1/health`);
  if (!res.ok) throw new Error("Backend service unreachable");
  return res.json();
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/documents`);
  if (!res.ok) throw new Error("Failed to load document library");
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentItem> {
  const res = await fetch(`${BACKEND_URL}/api/v1/documents/${id}`);
  if (!res.ok) throw new Error("Failed to load document details");
  return res.json();
}

export async function getDocumentClauses(id: string): Promise<ClauseInfo[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/documents/${id}/clauses`);
  if (!res.ok) throw new Error("Failed to load document clauses");
  return res.json();
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_URL}/api/v1/documents`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(errorData.detail || "Failed to upload document");
  }

  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function createConversation(
  title: string,
  documentId?: string,
  documentIds?: string[]
): Promise<Conversation> {
  const res = await fetch(`${BACKEND_URL}/api/v1/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      document_id: documentId,
      document_ids: documentIds,
    }),
  });
  if (!res.ok) throw new Error("Failed to initialize conversation");
  return res.json();
}

export async function getDocumentConversations(documentId: string): Promise<Conversation[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/documents/${documentId}/conversations`);
  if (!res.ok) return [];
  return res.json();
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  const res = await fetch(`${BACKEND_URL}/api/v1/conversations/${conversationId}`);
  if (!res.ok) throw new Error("Failed to load conversation");
  return res.json();
}

export async function compareDocuments(
  baseDocumentId: string,
  targetDocumentId: string
): Promise<ComparisonResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/documents/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_document_id: baseDocumentId,
      target_document_id: targetDocumentId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Comparison failed" }));
    throw new Error(err.detail || "Comparison failed");
  }
  return res.json();
}

export interface StreamChatCallbacks {
  onStatus?: (message: string) => void;
  onToken?: (token: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: (messageId: string, isInterrupted: boolean) => void;
  onError?: (error: string) => void;
}

export async function streamChat(
  conversationId: string,
  query: string,
  documentIds: string[],
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: conversationId,
      query,
      document_ids: documentIds,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Unable to open response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      if (!rawEvent.trim()) continue;
      const lines = rawEvent.split("\n");
      let eventType = "message";
      let eventData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          eventData = line.slice(6).trim();
        }
      }

      if (!eventData) continue;
      try {
        const parsed = JSON.parse(eventData);
        if (eventType === "status" && callbacks.onStatus) {
          callbacks.onStatus(parsed.message);
        } else if (eventType === "token" && callbacks.onToken) {
          callbacks.onToken(parsed.content);
        } else if (eventType === "citation" && callbacks.onCitations) {
          callbacks.onCitations(parsed.citations || []);
        } else if (eventType === "done" && callbacks.onDone) {
          callbacks.onDone(parsed.message_id, parsed.is_interrupted);
        } else if (eventType === "error" && callbacks.onError) {
          callbacks.onError(parsed.message);
        }
      } catch (e) {
        console.error("Error parsing SSE event data:", e, eventData);
      }
    }
  }
}

export interface StreamResearchCallbacks {
  onStatus?: (message: string, round: number) => void;
  onToolCall?: (toolCall: ToolCallInfo) => void;
  onToolResult?: (toolName: string, summary: string, data: any) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: (finalAnswer: string, citations: Citation[], toolCalls: ToolCallInfo[]) => void;
  onError?: (error: string) => void;
}

export async function streamResearch(
  query: string,
  documentIds: string[],
  maxRounds = 6,
  callbacks: StreamResearchCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/v1/research/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      document_ids: documentIds,
      max_rounds: maxRounds,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Research request failed: ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Unable to read research stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      if (!rawEvent.trim()) continue;
      const lines = rawEvent.split("\n");
      let eventType = "message";
      let eventData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          eventData = line.slice(6).trim();
        }
      }

      if (!eventData) continue;
      try {
        const parsed = JSON.parse(eventData);
        if (eventType === "status" && callbacks.onStatus) {
          callbacks.onStatus(parsed.message, parsed.round || 0);
        } else if (eventType === "tool_call" && callbacks.onToolCall) {
          callbacks.onToolCall({
            round_number: parsed.round,
            tool_name: parsed.tool_name,
            arguments: parsed.arguments,
          });
        } else if (eventType === "tool_result" && callbacks.onToolResult) {
          callbacks.onToolResult(parsed.tool_name, parsed.summary, parsed.data);
        } else if (eventType === "citations" && callbacks.onCitations) {
          callbacks.onCitations(parsed.citations || []);
        } else if (eventType === "done" && callbacks.onDone) {
          callbacks.onDone(parsed.final_answer, parsed.citations, parsed.tool_calls);
        } else if (eventType === "error" && callbacks.onError) {
          callbacks.onError(parsed.message);
        }
      } catch (e) {
        console.error("Error parsing research SSE event:", e);
      }
    }
  }
}
