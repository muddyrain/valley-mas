package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIAppVersionPublicationMigrationPreservesLegacyWorkflowReferences(t *testing.T) {
	contents, err := os.ReadFile("063_add_ai_app_version_published_at.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"ADD COLUMN IF NOT EXISTS published_at",
		"version.number <= current_published.number",
		"idx_ai_app_versions_published_at",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
