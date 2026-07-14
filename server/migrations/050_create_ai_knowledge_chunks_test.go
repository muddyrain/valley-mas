package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIKnowledgeChunksMigrationQuotesReferencesColumn(t *testing.T) {
	contents, err := os.ReadFile("050_create_ai_knowledge_chunks.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	if !strings.Contains(string(contents), `ADD COLUMN IF NOT EXISTS "references" TEXT`) {
		t.Fatal("migration must quote the PostgreSQL reserved references column")
	}
}

func TestAIKnowledgeDocumentProgressMigrationBackfillsReadyDocuments(t *testing.T) {
	contents, err := os.ReadFile("051_add_ai_knowledge_document_progress.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	statement := string(contents)
	if !strings.Contains(statement, "ADD COLUMN IF NOT EXISTS index_progress") || !strings.Contains(statement, "status = 'ready'") {
		t.Fatal("migration must add progress and backfill indexed documents")
	}
}
