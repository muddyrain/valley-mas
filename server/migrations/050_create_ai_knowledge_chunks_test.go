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
