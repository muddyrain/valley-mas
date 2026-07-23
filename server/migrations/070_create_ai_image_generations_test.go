package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIImageGenerationsMigrationKeepsOwnerAndJobIndexes(t *testing.T) {
	contents, err := os.ReadFile("070_create_ai_image_generations.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS ai_image_generations",
		"idx_ai_image_generations_owner_created",
		"reference_count",
		"resource_id",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
