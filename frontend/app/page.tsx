"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "../components/Sidebar";
import { Header, ActiveTab } from "../components/Header";
import { ChatView } from "../components/ChatView";
import { DocumentViewer } from "../components/DocumentViewer";
import { ComparisonView } from "../components/ComparisonView";
import { ResearchAgentView } from "../components/ResearchAgentView";
import { UploadModal } from "../components/UploadModal";
import {
  DocumentItem,
  DocumentSegment,
  Conversation,
  Message,
  Citation,
  ClauseInfo
} from "../lib/types";
import {
  listDocuments,
  getDocument,
  getDocumentClauses,
  getDocumentSuggestedQuestions,
  createConversation,
  getDocumentConversations,
  getConversation,
  deleteDocument,
  streamChat
} from "../lib/api";

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);

  // Multi-document selection mode
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");

  // Document details
  const [segments, setSegments] = useState<DocumentSegment[]>([]);
  const [clauses, setClauses] = useState<ClauseInfo[]>([]);

  // Dynamic suggested questions for uploaded document
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);

  // Chat & streaming state
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingToken, setStreamingToken] = useState<string>("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Highlighting citation state
  const [highlightCitation, setHighlightCitation] = useState<Citation | null>(null);

  // Modals & UI loading
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [libraryLoading, setLibraryLoading] = useState<boolean>(true);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch documents on initial load
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      setLibraryLoading(true);
      const docs = await listDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedDocId) {
        handleSelectDoc(docs[0].id);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLibraryLoading(false);
    }
  };

  // Selecting a document loads its details, segments, clauses, and conversations
  const handleSelectDoc = async (docId: string) => {
    setSelectedDocId(docId);
    try {
      const fullDoc = await getDocument(docId);
      setActiveDoc(fullDoc);
      setSegments(fullDoc.segments || []);

      const clauseList = await getDocumentClauses(docId);
      setClauses(clauseList);

      // Load or create conversation for this document
      const convs = await getDocumentConversations(docId);
      if (convs.length > 0) {
        const active = await getConversation(convs[0].id);
        setActiveConversation(active);
        setMessages(active.messages || []);
      } else {
        const newConv = await createConversation(`Analysis of ${fullDoc.filename}`, docId);
        setActiveConversation(newConv);
        setMessages([]);
      }

      // Fetch dynamic questions tailored to this document
      setLoadingQuestions(true);
      getDocumentSuggestedQuestions(docId)
        .then((qs) => setSuggestedQuestions(qs))
        .catch(() => setSuggestedQuestions([]))
        .finally(() => setLoadingQuestions(false));
    } catch (err) {
      console.error("Failed to load document details:", err);
    }
  };

  const handleToggleMultiSelect = (docId: string) => {
    setMultiSelectIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocId === docId) {
        const remaining = documents.filter((d) => d.id !== docId);
        if (remaining.length > 0) {
          handleSelectDoc(remaining[0].id);
        } else {
          setSelectedDocId(null);
          setActiveDoc(null);
          setSegments([]);
          setClauses([]);
          setMessages([]);
          setSuggestedQuestions([]);
        }
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleSendMessage = async (query: string) => {
    let conv = activeConversation;
    if (!conv) {
      // Create new conversation
      conv = await createConversation("Contract Query", selectedDocId || undefined);
      setActiveConversation(conv);
    }

    const convId = conv?.id;
    if (!convId) return;

    // Optimistically add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      conversation_id: convId,
      role: "user",
      content: query,
      citations: [],
      is_interrupted: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamingToken("");
    setStreamingCitations([]);
    setStreamingStatus("Starting retrieval...");

    abortControllerRef.current = new AbortController();

    const targetDocIds =
      isMultiSelectMode && multiSelectIds.length > 0
        ? multiSelectIds
        : selectedDocId
        ? [selectedDocId]
        : [];

    let accumulatedText = "";
    let finalCitations: Citation[] = [];

    try {
      await streamChat(
        convId,
        query,
        targetDocIds,
        {
          onStatus: (msg) => {
            setStreamingStatus(msg);
          },
          onToken: (chunk) => {
            accumulatedText += chunk;
            setStreamingToken((prev) => prev + chunk);
          },
          onCitations: (cites) => {
            finalCitations = cites;
            setStreamingCitations(cites);
          },
          onDone: (msgId, isInterrupted) => {
            const assistantMsg: Message = {
              id: msgId || `asst-${Date.now()}`,
              conversation_id: convId,
              role: "assistant",
              content: accumulatedText,
              citations: finalCitations,
              is_interrupted: isInterrupted,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsStreaming(false);
            setStreamingToken("");
            setStreamingStatus(null);
          },
          onError: (errMsg) => {
            console.error("Chat streaming error:", errMsg);
            setIsStreaming(false);
            setStreamingStatus(null);
            setMessages((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                conversation_id: convId,
                role: "assistant",
                content: `⚠️ Error from AI service: ${errMsg}`,
                citations: [],
                is_interrupted: false,
                created_at: new Date().toISOString(),
              },
            ]);
          },
        },
        abortControllerRef.current.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Chat error:", err);
      }
      setIsStreaming(false);
      setStreamingStatus(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingStatus(null);
  };

  // Navigates directly from citation in chat to the document passage
  const handleCitationClick = (citation: Citation) => {
    // If citation is from a different document, switch document first
    if (citation.document_id && citation.document_id !== selectedDocId) {
      handleSelectDoc(citation.document_id);
    }
    setHighlightCitation(citation);
    setActiveTab("viewer");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar Library */}
      <Sidebar
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={handleSelectDoc}
        multiSelectIds={multiSelectIds}
        onToggleMultiSelect={handleToggleMultiSelect}
        isMultiSelectMode={isMultiSelectMode}
        onToggleMultiSelectMode={() => setIsMultiSelectMode(!isMultiSelectMode)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onDeleteDoc={handleDeleteDoc}
        loading={libraryLoading}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50">
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeDoc={activeDoc}
          multiSelectCount={multiSelectIds.length}
        />

        <div className="flex-1 overflow-hidden relative">
          {activeTab === "chat" && (
            <ChatView
              messages={messages}
              streamingToken={streamingToken}
              streamingCitations={streamingCitations}
              streamingStatus={streamingStatus}
              isStreaming={isStreaming}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              onCitationClick={handleCitationClick}
              documentTitle={activeDoc?.filename}
              isMultiDoc={isMultiSelectMode && multiSelectIds.length > 1}
              suggestedQuestions={suggestedQuestions}
              loadingQuestions={loadingQuestions}
            />
          )}

          {activeTab === "viewer" && (
            <DocumentViewer
              document={activeDoc}
              segments={segments}
              clauses={clauses}
              highlightCitation={highlightCitation}
              onClearHighlight={() => setHighlightCitation(null)}
              onAskAboutClause={(text) => {
                setActiveTab("chat");
                handleSendMessage(`Please analyze this clause in detail: "${text}"`);
              }}
            />
          )}

          {activeTab === "compare" && (
            <ComparisonView
              documents={documents}
              onNavigateCitation={handleCitationClick}
              onDocumentAdded={(newDoc) => {
                setDocuments((prev) => [newDoc, ...prev]);
                handleSelectDoc(newDoc.id);
              }}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
            />
          )}

          {activeTab === "research" && (
            <ResearchAgentView
              documents={documents}
              selectedDocIds={
                isMultiSelectMode && multiSelectIds.length > 0
                  ? multiSelectIds
                  : selectedDocId
                  ? [selectedDocId]
                  : []
              }
              onNavigateCitation={handleCitationClick}
            />
          )}
        </div>
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={(newDoc) => {
          setDocuments((prev) => [newDoc, ...prev]);
          handleSelectDoc(newDoc.id);
        }}
      />
    </div>
  );
}
