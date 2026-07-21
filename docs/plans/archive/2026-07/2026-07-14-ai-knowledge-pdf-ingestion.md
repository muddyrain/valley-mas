# AI Knowledge PDF Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **状态：已完成（历史计划）。该功能已早期交付并并入 AI Knowledge RAG 的持续计划体系，本文件保留为历史记录，不再作为当前活跃待办。**

**Goal:** Allow private AI knowledge bases to ingest text-based PDF files through the existing chunking and embedding pipeline.

**Architecture:** The upload handler extracts text from a PDF before it creates chunks. Valid text follows the existing document lifecycle unchanged; unreadable, encrypted, scanned, or empty PDFs are persisted as `DOCUMENT_PARSE_FAILED` so the UI reports the real cause without attempting an embedding retry.

**Tech Stack:** Go, Gin, GORM, `github.com/ledongthuc/pdf`, React 19, Tailwind 4.

---

### Task 1: Prove PDF upload behavior

**Files:**
- Modify: `server/internal/handler/ai_platform_test.go`

- [x] **Step 1: Add a text-PDF upload integration test**

Build a minimal text PDF in the test, post it to the existing multipart endpoint, and assert that the persisted document is `pending_embedding`, has extracted text, and has chunks.

- [x] **Step 2: Run the focused test before implementation**

Run: `cd server && go test ./internal/handler -run TestExtractAIKnowledgeDocumentTextFromPDF -count=1`

Expected: PASS（历史阶段记录；该前置失败期望不再适用，功能上线后已完成对应覆盖）。

### Task 2: Extract and persist PDF text

**Files:**
- Modify: `server/go.mod`
- Modify: `server/go.sum`
- Modify: `server/internal/handler/ai_platform.go`

- [x] **Step 1: Add the approved PDF parser dependency**

Run: `cd server && go get github.com/ledongthuc/pdf@v0.0.0-20250511090121-5959a4027728`

- [x] **Step 2: Add PDF text extraction before chunk creation**

Use `pdf.NewReader(bytes.NewReader(content), int64(len(content)))`, call `GetPlainText`, and trim the resulting text. Keep Markdown/TXT behavior unchanged.

- [x] **Step 3: Persist parse failures as terminal document state**

For a PDF that cannot yield text, create an `AIKnowledgeDocument` with `status=failed` and `error_code=DOCUMENT_PARSE_FAILED`; do not create chunks or enqueue embedding.

### Task 3: Expose the behavior in Web and plans

**Files:**
- Modify: `apps/web/src/pages/KnowledgeBases/index.tsx`
- Modify: `docs/plans/2026-07-14-ai-knowledge-rag.md`
- Modify: `docs/plans/2026-07-14-ai-workbench-platform.md`

- [x] **Step 1: Allow `.pdf` in the browser picker and client validation**

Keep the 2MB limit and existing upload flow; only extend supported type feedback to PDF.

- [x] **Step 2: Show the terminal parse failure clearly**

Map `DOCUMENT_PARSE_FAILED` to a concise error message and suppress the embedding retry action for that error code.

- [x] **Step 3: Mark P2 complete**

Record PDF ingestion and the previously completed PostgreSQL/ARK verification as complete, leaving P3 as the next planned stage.

### Task 4: Verify

**Files:**
- Verify: `server/internal/handler/ai_platform_test.go`
- Verify: `apps/web/src/pages/KnowledgeBases/index.tsx`

- [x] **Step 1: Run focused and service tests**

Run: `cd server && go test ./internal/handler -run TestUploadAIKnowledgeDocument -count=1 && go test ./...`

Expected: PASS.

- [x] **Step 2: Run Web and harness checks**

Run: `pnpm --filter @valley/web exec tsc --noEmit && pnpm --filter @valley/web check && pnpm check:harness`

Expected: PASS.

- [x] **Step 3: Perform manual browser acceptance**

Upload a text-based PDF at `/workbench/knowledge`; verify it progresses to indexed and is available as an agent citation. Upload a scanned or invalid PDF; verify it remains visibly failed with no embedding retry control.
