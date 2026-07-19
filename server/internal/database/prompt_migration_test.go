package database

import (
	"testing"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type legacyPromptForMigrationTest struct {
	ID          model.Int64String `gorm:"primaryKey"`
	UserID      model.Int64String
	Name        string
	Description string
	Draft       string `gorm:"type:text;not null"`
}

func (legacyPromptForMigrationTest) TableName() string { return "ai_prompts" }

func TestBackfillLegacyPromptLibraryContent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&legacyPromptForMigrationTest{}); err != nil {
		t.Fatal(err)
	}
	legacy := legacyPromptForMigrationTest{
		ID:     1,
		UserID: 101,
		Name:   "旧提示词",
		Draft:  `{"systemPrompt":"你是编辑。","prompt":"概括文章。"}`,
	}
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIPrompt{}); err != nil {
		t.Fatal(err)
	}
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })
	if err := backfillLegacyPromptLibraryContent(); err != nil {
		t.Fatal(err)
	}
	var prompt model.AIPrompt
	if err := db.First(&prompt, "id = ?", legacy.ID).Error; err != nil {
		t.Fatal(err)
	}
	if prompt.Content != "你是编辑。\n\n概括文章。" {
		t.Fatalf("content = %q", prompt.Content)
	}
}
