package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIModelTokenLimitsMigrationKeepsOptionalDefaults(t *testing.T) {
	contents, err := os.ReadFile("074_add_ai_model_token_limits.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"context_window_tokens INTEGER NOT NULL DEFAULT 0",
		"max_output_tokens INTEGER NOT NULL DEFAULT 0",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
