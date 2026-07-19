package migrations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateWorkflowTestCasesMigrationHasVersionAndResultBoundaries(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("065_create_workflow_test_cases.sql"))
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS workflow_test_cases",
		"version_id BIGINT NOT NULL",
		"CREATE TABLE IF NOT EXISTS workflow_test_results",
		"workflow_run_id BIGINT NULL",
		"idx_workflow_test_results_case_started",
	} {
		if !strings.Contains(string(raw), fragment) {
			t.Fatalf("migration is missing %q", fragment)
		}
	}
}
