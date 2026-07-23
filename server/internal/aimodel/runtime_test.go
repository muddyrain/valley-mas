package aimodel

import (
	"slices"
	"testing"
	"time"
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

func TestDecodeStringsMigratesLegacyImageEditCapability(t *testing.T) {
	values := DecodeStrings(`["image_generation","image_edit"]`)
	if !slices.Equal(values, []string{"image_generation", "reference_image"}) {
		t.Fatalf("values = %+v", values)
	}
}

func TestResolveInvocationUsesCatalogProvider(t *testing.T) {
	t.Setenv("SILICONFLOW_API_KEY", "test-key")
	t.Setenv("SILICONFLOW_BASE_URL", "https://provider.test/v1")
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	item := model.AIModel{
		ID: 7, Provider: "siliconflow", ModelID: "text-model", DisplayName: "Text",
		Capabilities: EncodeStrings([]string{"text"}), ImageProtocol: "openai_images", Enabled: true,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	invocation, err := ResolveInvocation(db, "7", "text", 15*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if invocation.Model.ID != item.ID ||
		invocation.Provider.Provider != "siliconflow" ||
		invocation.Client.Provider != "siliconflow" ||
		invocation.Client.ImageProtocol != "openai_images" ||
		invocation.Client.BaseURL != "https://provider.test/v1" {
		t.Fatalf("unexpected invocation: %+v", invocation)
	}
}
