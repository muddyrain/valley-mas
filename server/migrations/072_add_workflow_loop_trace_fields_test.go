package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestWorkflowLoopTraceMigrationKeepsCompatibility(t *testing.T) {
	contents, err := os.ReadFile("072_add_workflow_loop_trace_fields.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(contents)
	for _, fragment := range []string{"loop_iteration", "loop_depth", "body_node_id", "IF NOT EXISTS"} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
