package aimodel

import (
	"testing"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestFindEnabledModelChecksCapability(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	item := model.AIModel{ID: 1, Provider: "siliconflow", ModelID: "deepseek-ai/DeepSeek-V4-Flash", DisplayName: "DeepSeek", Capabilities: EncodeStrings([]string{"text"}), Enabled: true}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := FindEnabledModel(db, "1", "vision"); err != ErrModelNotAvailable {
		t.Fatalf("vision should be rejected: %v", err)
	}
	selected, err := FindEnabledModel(db, "1", "text")
	if err != nil || selected.ModelID != item.ModelID {
		t.Fatalf("text model lookup failed: %+v err=%v", selected, err)
	}
}
