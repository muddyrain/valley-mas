package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestCopilotRunEventsMigrationKeepsReplayOrderAndSafePayloadBoundary(t *testing.T) {
	contents, err := os.ReadFile("064_create_ai_workbench_copilot_run_events.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"ai_workbench_copilot_run_events",
		"sequence BIGINT NOT NULL",
		"uidx_workbench_copilot_run_event_sequence",
		"message VARCHAR(500)",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
