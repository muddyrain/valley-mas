package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestCopilotHistoryMigrationSupportsMultipleSessionsAndSafeRevert(t *testing.T) {
	contents, err := os.ReadFile("058_expand_ai_workbench_copilot_history.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"DROP CONSTRAINT IF EXISTS uidx_workbench_copilot_target",
		"ADD COLUMN IF NOT EXISTS base_draft",
		"ADD COLUMN IF NOT EXISTS candidate_hash",
		"'reverted'",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
