import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from backend.app.services.grok_service import GrokService
from backend.app.services.retrieval_service import RetrievalService
from backend.app.services.citation_service import CitationService
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

RESEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_document",
            "description": "Search the indexed contract for relevant clauses, keywords, or legal provisions and return ranked excerpts with page references.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search keywords or question (e.g. 'limitation of liability cap', 'termination for convenience')"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Optional specific document ID to restrict the search to"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_section",
            "description": "Retrieve the complete text and page numbers of a specific contract section or clause by heading or topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "section_identifier": {
                        "type": "string",
                        "description": "The clause heading or section name to retrieve (e.g. 'Indemnification', 'Governing Law', 'Article 5')"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Optional specific document ID"
                    }
                },
                "required": ["section_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_clauses",
            "description": "List all detected clause titles, section headings, and page locations across the contract.",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "Optional specific document ID"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_document_overview",
            "description": "Retrieve high-level contract metadata including filename, total page count, OCR status, and outline.",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "Optional specific document ID"
                    }
                }
            }
        }
    }
]

class AgentService:
    @staticmethod
    def execute_tool(
        tool_name: str,
        args: Dict[str, Any],
        documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Safely executes an agent tool against document indices with strict parameter validation.
        """
        # Map documents by id
        doc_map = {d.get("id"): d for d in documents}
        target_doc_id = args.get("document_id")

        if tool_name == "get_document_overview":
            overviews = []
            docs_to_check = [doc_map[target_doc_id]] if (target_doc_id and target_doc_id in doc_map) else documents
            for d in docs_to_check:
                overviews.append({
                    "document_id": d.get("id"),
                    "filename": d.get("filename"),
                    "page_count": d.get("page_count"),
                    "file_type": d.get("file_type"),
                    "is_scanned": d.get("is_scanned", False),
                    "ocr_applied": d.get("ocr_applied", False),
                    "total_segments": len(d.get("segments", [])),
                    "summary": d.get("summary") or "Contract processed and indexed."
                })
            return {
                "summary": f"Retrieved overview for {len(overviews)} document(s).",
                "data": overviews
            }

        elif tool_name == "list_clauses":
            clause_lists = []
            docs_to_check = [doc_map[target_doc_id]] if (target_doc_id and target_doc_id in doc_map) else documents
            for d in docs_to_check:
                seen_headings = set()
                clauses = []
                for s in d.get("segments", []):
                    title = s.get("section_title")
                    if title and title not in seen_headings:
                        seen_headings.add(title)
                        clauses.append({
                            "title": title,
                            "page": s.get("page_number") or 1
                        })
                clause_lists.append({
                    "document_id": d.get("id"),
                    "filename": d.get("filename"),
                    "clauses": clauses[:40]  # Cap to prevent token bloat
                })
            return {
                "summary": f"Found clause list with total {sum(len(c['clauses']) for c in clause_lists)} headings.",
                "data": clause_lists
            }

        elif tool_name == "get_section":
            section_id = (args.get("section_identifier") or "").strip().lower()
            if not section_id:
                return {"summary": "Missing section_identifier argument", "data": None}

            matched_segments = []
            docs_to_check = [doc_map[target_doc_id]] if (target_doc_id and target_doc_id in doc_map) else documents
            for d in docs_to_check:
                for s in d.get("segments", []):
                    stitle = (s.get("section_title") or "").lower()
                    stext = s.get("text", "").lower()
                    if section_id in stitle or (len(section_id) > 5 and section_id in stext[:100]):
                        matched_segments.append({
                            "document_id": d.get("id"),
                            "document_title": d.get("filename"),
                            "section_title": s.get("section_title"),
                            "page": s.get("page_number"),
                            "text": s.get("text")
                        })
                        if len(matched_segments) >= 5:
                            break

            if not matched_segments:
                # Fallback to BM25 search for the section name
                return AgentService.execute_tool("search_document", {"query": section_id, "document_id": target_doc_id}, documents)

            return {
                "summary": f"Retrieved section matching '{args.get('section_identifier')}' across {len(matched_segments)} passage(s).",
                "data": matched_segments
            }

        elif tool_name == "search_document":
            query = (args.get("query") or "").strip()
            if not query:
                return {"summary": "Missing search query parameter", "data": []}

            docs_to_search = [doc_map[target_doc_id]] if (target_doc_id and target_doc_id in doc_map) else documents
            res = RetrievalService.search_multiple_documents(query=query, documents_data=docs_to_search, top_k_per_doc=4)

            compact_results = []
            for seg in res.get("segments", [])[:6]:
                compact_results.append({
                    "document_id": seg.get("origin_document_id"),
                    "document_title": seg.get("origin_document_title"),
                    "page": seg.get("page_number"),
                    "section": seg.get("section_title"),
                    "excerpt": seg.get("text")
                })

            if not compact_results:
                # Direct keyword fallback across segments
                q_words = [w for w in query.lower().split() if len(w) > 2]
                for d in docs_to_search:
                    for s in d.get("segments", []):
                        s_text = (s.get("text") or "").lower()
                        s_title = (s.get("section_title") or "").lower()
                        if any(w in s_text or w in s_title for w in q_words):
                            compact_results.append({
                                "document_id": d.get("id"),
                                "document_title": d.get("filename"),
                                "page": s.get("page_number"),
                                "section": s.get("section_title"),
                                "excerpt": s.get("text")
                            })
                            if len(compact_results) >= 6:
                                break

            return {
                "summary": f"Search for '{query}' returned {len(compact_results)} relevant passage(s).",
                "data": compact_results
            }

        else:
            return {
                "summary": f"Unknown tool name '{tool_name}'. Available tools: search_document, get_section, list_clauses, get_document_overview.",
                "data": None
            }

    @classmethod
    async def run_agent_loop(
        cls,
        query: str,
        documents: List[Dict[str, Any]],
        max_rounds: int = 6
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes autonomous agent research loop with multi-round tool calling.
        Yields real-time SSE progress events.
        """
        max_rounds = min(max_rounds, settings.MAX_AGENT_ROUNDS)

        yield {
            "type": "status",
            "message": f"Starting autonomous research for question: '{query}' across {len(documents)} document(s)...",
            "round": 0
        }

        system_prompt = (
            "You are an expert autonomous legal research assistant called ClauseWise. "
            "You have access to contract inspection tools: search_document, get_section, list_clauses, get_document_overview. "
            "Follow these strict principles:\n"
            "1. ALWAYS consult tools to investigate the actual legal text before forming an answer.\n"
            "2. When answering, quote the exact verbatim text in quotes (\"...\") and cite the page number.\n"
            "3. If evidence is insufficient or absent after thorough search, state clearly that the provision was not found.\n"
            "4. NEVER invent or fabricate contract terms, numbers, or quotations.\n"
            "5. After obtaining sufficient evidence, provide a thorough, structured legal conclusion."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Research question: {query}"}
        ]

        round_num = 1
        final_answer = ""
        all_tool_calls = []

        while round_num <= max_rounds:
            yield {
                "type": "status",
                "message": f"Round {round_num}/{max_rounds}: Consulting Grok agentic model for next action...",
                "round": round_num
            }

            try:
                response = await GrokService.chat_completion(
                    messages=messages,
                    tools=RESEARCH_TOOLS,
                    tool_choice="auto",
                    temperature=0.1
                )
            except Exception as e:
                yield {
                    "type": "error",
                    "message": f"Grok API call failed during round {round_num}: {str(e)}",
                    "round": round_num
                }
                return

            choice = response.get("choices", [{}])[0]
            message = choice.get("message", {})
            tool_calls = message.get("tool_calls", [])
            content = message.get("content", "")

            # If model requested tool calls
            if tool_calls:
                messages.append(message)
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    fn_name = fn.get("name")
                    fn_args_raw = fn.get("arguments", "{}")
                    
                    try:
                        fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else fn_args_raw
                    except Exception:
                        fn_args = {}

                    yield {
                        "type": "tool_call",
                        "round": round_num,
                        "tool_name": fn_name,
                        "arguments": fn_args,
                        "message": f"Agent invoking {fn_name}({json.dumps(fn_args)})"
                    }

                    # Execute tool
                    tool_execution = cls.execute_tool(fn_name, fn_args, documents)
                    
                    all_tool_calls.append({
                        "round_number": round_num,
                        "tool_name": fn_name,
                        "arguments": fn_args,
                        "result_summary": tool_execution["summary"],
                        "raw_result": tool_execution["data"]
                    })

                    yield {
                        "type": "tool_result",
                        "round": round_num,
                        "tool_name": fn_name,
                        "summary": tool_execution["summary"],
                        "data": tool_execution["data"]
                    }

                    # Append tool result back to model history
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "name": fn_name,
                        "content": json.dumps(tool_execution)
                    })

                round_num += 1

            elif content:
                # Model provided answer without invoking further tools
                final_answer = content
                break
            else:
                break

        if not final_answer:
            final_answer = "Autonomous research concluded without a definitive textual finding."

        yield {
            "type": "status",
            "message": "Research complete. Verifying citations against source documents...",
            "round": round_num
        }

        # Deterministically verify all quotations in the final answer
        all_citations = []
        for doc in documents:
            cites = CitationService.extract_and_verify_citations(
                text_with_citations=final_answer,
                document_text=doc.get("raw_text", ""),
                document_id=doc.get("id"),
                document_title=doc.get("filename"),
                segments=doc.get("segments", [])
            )
            all_citations.extend(cites)

        yield {
            "type": "citations",
            "citations": all_citations
        }

        yield {
            "type": "done",
            "final_answer": final_answer,
            "citations": all_citations,
            "tool_calls": all_tool_calls,
            "rounds_completed": min(round_num, max_rounds)
        }
