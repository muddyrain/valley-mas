package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestWorkflowTriggerExtensionMigrationKeepsSecretsHashedAndJobsIdempotent(t *testing.T) {
	contents, err := os.ReadFile("075_extend_workflow_triggers.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"event_key VARCHAR(100)",
		"secret_hash VARCHAR(64)",
		"trigger_type VARCHAR(20)",
		"inputs JSON",
		"uidx_workflow_runs_run_job_id",
		"CREATE TABLE IF NOT EXISTS workflow_approvals",
		"uidx_workflow_approval_run_node",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
	if strings.Contains(statement, "webhook_secret") {
		t.Fatal("migration must not persist plaintext webhook secrets")
	}
}
