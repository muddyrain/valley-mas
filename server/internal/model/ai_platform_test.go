package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAIKnowledgeChunkEmbeddingIsOwnedBySQLMigration(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AIKnowledgeChunk{}); err != nil {
		t.Fatalf("auto migrate chunk: %v", err)
	}
	if db.Migrator().HasColumn(&AIKnowledgeChunk{}, "embedding") {
		t.Fatal("embedding must be created by the pgvector SQL migration, not GORM AutoMigrate")
	}
}
