package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIAppAvatarMigrationAddsIdentityColumns(t *testing.T) {
	contents, err := os.ReadFile("056_add_ai_app_avatars.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	statement := string(contents)
	for _, column := range []string{"avatar_url", "avatar_source", "avatar_storage_key"} {
		if !strings.Contains(statement, "ADD COLUMN IF NOT EXISTS "+column) {
			t.Fatalf("migration must add %s", column)
		}
	}
}
