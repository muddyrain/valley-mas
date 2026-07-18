package database

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestDropLegacyCopilotTargetUniquenessAllowsMultipleSessions(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	if err := db.Exec(`
		CREATE TABLE ai_workbench_copilot_sessions (
			id INTEGER PRIMARY KEY,
			user_id INTEGER NOT NULL,
			scope TEXT NOT NULL,
			target_id TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL DEFAULT 'AI 协作',
			created_at DATETIME,
			updated_at DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("create legacy sessions table: %v", err)
	}
	if err := db.Exec(`CREATE UNIQUE INDEX uidx_workbench_copilot_target ON ai_workbench_copilot_sessions(user_id, scope, target_id)`).Error; err != nil {
		t.Fatalf("create legacy unique index: %v", err)
	}
	if err := db.Exec(`INSERT INTO ai_workbench_copilot_sessions(id, user_id, scope, target_id) VALUES (1, 101, 'workflow', 'workflow-1')`).Error; err != nil {
		t.Fatalf("insert first session: %v", err)
	}
	if err := db.Exec(`INSERT INTO ai_workbench_copilot_sessions(id, user_id, scope, target_id) VALUES (2, 101, 'workflow', 'workflow-1')`).Error; err == nil {
		t.Fatal("legacy unique index should reject the second session")
	}

	if err := dropLegacyCopilotTargetUniqueness(); err != nil {
		t.Fatalf("drop legacy uniqueness: %v", err)
	}
	if db.Migrator().HasIndex("ai_workbench_copilot_sessions", legacyCopilotTargetIndex) {
		t.Fatal("legacy unique index should be removed")
	}
	if err := db.Exec(`INSERT INTO ai_workbench_copilot_sessions(id, user_id, scope, target_id) VALUES (2, 101, 'workflow', 'workflow-1')`).Error; err != nil {
		t.Fatalf("insert second session after migration: %v", err)
	}
}
