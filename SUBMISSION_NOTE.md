# ClauseWise Submission Note

### 1. How Deterministic Quote Verification Works & Where It Could Fail

Quote verification in ClauseWise is completely independent of the AI model. When Grok produces an answer containing candidate quotations, the server-side `CitationService` verifies each quote against the true stored text of the contract:

1. **Character Index Mapping:**
   Text extraction inevitably introduces formatting divergences: soft hyphens, line wraps across columns, multiple spaces, non-breaking spaces (`\xa0`), and typographic punctuation (smart quotes `“”` vs standard quotes `""`, em-dashes `—` vs hyphens `-`). 
   Our normalizer cleans both the contract text and candidate quotations while maintaining a continuous 1-to-1 index array `norm_to_orig: List[int]` mapping each normalized character back to its raw document byte and character offset.
2. **Substring Verification & Offset Reconstruction:**
   The algorithm searches for the exact normalized quotation substring within the document. If matched, it translates normalized start and end positions back into original document offsets `[orig_start, orig_end]` and slices the verbatim source text.
3. **Disambiguation & Rejection:**
   If the quotation appears multiple times in the agreement, surrounding page hints and segment coordinates are used to disambiguate the occurrence. If the quotation was paraphrased, altered, or hallucinated by the model, it is rejected and marked `verified = False`.

**Where it could fail:**
- **Severe OCR Degradation:** If a scanned contract is heavily smudged or distorted, OCR might recognize "liability" as "liabi1ity". Because our algorithm enforces high textual fidelity to prevent hallucination, minor character-level OCR errors in scanned documents could lead to quote rejection.
- **Micro-Quotations / Single Words:** Single common words (e.g., "reasonable", "shall") appear hundreds of times across a contract and cannot be verified to a unique claim without sufficient context length (which we mitigate by enforcing a minimum quote length).
- **Extreme Cross-Page Header Splits:** If a page break contains a multi-line running header or footer interspersed in the middle of a sentence, the native text extractor may insert header text midway through the quote.

---

### 2. How Large Documents (~150 Pages) Are Handled

1. **Clause- and Paragraph-Aware Chunking:**
   Contracts are not arbitrarily split into character blocks. Instead, `pdf_service.py` and `docx_service.py` segment documents at natural paragraph, heading, and table boundaries, preserving section hierarchies (e.g. `ARTICLE 8. LIMITATION OF LIABILITY`).
2. **BM25Plus Lexical Retrieval:**
   We index all segments using `BM25Plus`, which overcomes the classic negative IDF flaw found in standard BM25Okapi for small or uneven corpora. When a user asks a question, the retriever searches the entire indexed contract (all 150 pages) rather than relying on top-of-document bias.
3. **Context Budgeting:**
   Retrieved segments are ranked and fitted within a strict context budget (3,500 tokens / ~14,000 characters) before submission to Grok.
4. **Absence vs. Unretrieved Evidence Distinction:**
   If a query returns no matches, the system states `no_relevant_evidence` rather than claiming a clause is absent from the agreement. A search must be exhaustive across all sections before concluding absence.

---

### 3. Part C Option 2: Autonomous Agentic Document Research

**Why Option 2 was selected:**
Option 2 transforms ClauseWise from a passive retrieval system into an active, autonomous legal research associate. Complex legal questions rarely reside in a single paragraph—they require an investigator to first overview the agreement, scan the clause index, look up specific cross-referenced sections, and verify indemnity carve-outs against liability caps.

**How far we got:**
Full implementation was completed with:
- Model tool suite: `search_document`, `get_section`, `list_clauses`, and `get_document_overview`.
- Multi-round execution loop powered by Grok via the official xAI API.
- Real-time Server-Sent Events (SSE) streaming every tool invocation, search query, and tool output to an interactive UI terminal.
- Strict safety guardrails: a hard cap of 6 execution rounds, argument validation, and loop protection.
- Server-side quotation verification applied to the final synthesized legal answer.

**The hardest part of the implementation:**
The hardest engineering challenge was handling model-generated tool calls robustly across multiple rounds while streaming live events to the client. Real models occasionally format tool arguments in unexpected JSON shapes or repeat similar queries when investigating cross-references. Engineering error recovery that returns clean diagnostic payloads back into the model's message history without crashing the SSE stream required careful asynchronous design.

---

### 4. What We Would Build Next With More Time

1. **Tracked-Change DOCX Redlining (Option 1):**
   Combine Part C Option 1 with Option 2, allowing the research agent to generate direct XML `w:ins` and `w:del` tracked revisions in downloadable Word contracts.
2. **Full Hybrid Dense-Sparse Retrieval:**
   Combine `BM25Plus` with dense legal embeddings (e.g., `sentence-transformers` trained on contract law) for cross-lingual and semantic conceptual retrieval.
3. **Automated Red Flag & Risk Scoring Matrix:**
   A visual clause audit heatmap comparing contract provisions against customary market standards (e.g., standard DIFC / English law indemnities, uncapped liabilities, and automatic renewal traps).
