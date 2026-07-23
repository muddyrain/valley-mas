package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIModelVerificationMigrationKeepsCompatibility(t *testing.T) {
	contents, err := os.ReadFile("071_add_ai_model_verification.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"image_protocol",
		"verified_capabilities",
		"verification_status",
		"last_verified_at",
		`REPLACE(capabilities, '"image_edit"', '"reference_image"')`,
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
