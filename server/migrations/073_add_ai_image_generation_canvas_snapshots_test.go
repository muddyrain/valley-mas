package migrations

import (
	"os"
	"strings"
	"testing"
)

func TestAIImageGenerationCanvasSnapshotMigrationKeepsHistoryReplayFields(t *testing.T) {
	contents, err := os.ReadFile("073_add_ai_image_generation_canvas_snapshots.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(contents)
	for _, fragment := range []string{
		"preset_name",
		"preset_prompt",
		"canvas_snapshot_url",
		"canvas_snapshot_storage_key",
		"canvas_snapshot_width",
		"canvas_snapshot_height",
	} {
		if !strings.Contains(statement, fragment) {
			t.Fatalf("migration must contain %q", fragment)
		}
	}
}
