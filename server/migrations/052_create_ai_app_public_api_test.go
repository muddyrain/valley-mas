package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestCreateAIAppPublicAPIMigrationKeepsPublicPayloadOutOfLogs(t *testing.T) {
	contents, err := os.ReadFile("052_create_ai_app_public_api.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	statement := string(contents)

	for _, table := range []string{"ai_api_key_app_bindings", "ai_api_key_daily_usages", "ai_app_public_invocations"} {
		if !strings.Contains(statement, table) {
			t.Fatalf("migration must create %s", table)
		}
	}
	if strings.Contains(strings.ToLower(statement), "request_body") || strings.Contains(strings.ToLower(statement), "response_body") {
		t.Fatal("public invocation logs must not persist request or response bodies")
	}
}
