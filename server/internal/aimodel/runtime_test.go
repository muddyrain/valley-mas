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

func TestVisionModelRequiresSuccessfulVisionVerification(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	items := []model.AIModel{
		{ID: 1, Provider: "siliconflow", ModelID: "unverified-vision", DisplayName: "Unverified", Capabilities: EncodeStrings([]string{"vision"}), Enabled: true},
		{ID: 2, Provider: "siliconflow", ModelID: "verified-vision", DisplayName: "Verified", Capabilities: EncodeStrings([]string{"vision"}), VerifiedCapabilities: EncodeStrings([]string{"vision"}), Enabled: true},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := FindEnabledModel(db, "1", "vision"); err != ErrModelNotAvailable {
		t.Fatalf("unverified vision should be rejected: %v", err)
	}
	selected, err := FindEnabledModel(db, "2", "vision")
	if err != nil || selected.ModelID != "verified-vision" {
		t.Fatalf("verified vision lookup failed: %+v err=%v", selected, err)
	}
	models, err := ListEnabledModels(db, "vision")
	if err != nil || len(models) != 1 || models[0].ID != 2 {
		t.Fatalf("available vision models = %+v err=%v", models, err)
	}
}

func TestDecodeStringsMigratesLegacyImageEditCapability(t *testing.T) {
	values := DecodeStrings(`["image_generation","image_edit"]`)
	if !slices.Equal(values, []string{"image_generation", "reference_image"}) {
		t.Fatalf("values = %+v", values)
	}
}

func TestImageGenerationQualitiesFollowModelRatherThanProvider(t *testing.T) {
	seedream := model.AIModel{Provider: "ark", ModelID: "doubao-seedream-4-0-250828"}
	if values := ImageGenerationQualities(seedream); !slices.Equal(values, []string{"1K", "2K", "3K", "4K"}) {
		t.Fatalf("qualities = %#v", values)
	}
	seedream5 := model.AIModel{Provider: "volcengine", ModelID: "doubao-seedream-5-0-260128"}
	if values := ImageGenerationQualities(seedream5); !slices.Equal(values, []string{"2K", "3K", "4K"}) {
		t.Fatalf("Seedream 5 qualities = %#v", values)
	}
	gptImage := model.AIModel{Provider: "siliconflow", ModelID: "gpt-image-2"}
	if values := ImageGenerationQualities(gptImage); !slices.Equal(values, []string{"1K", "2K", "4K"}) {
		t.Fatalf("qualities = %#v", values)
	}
	legacy := model.AIModel{Provider: "siliconflow", ModelID: "Kwai-Kolors/Kolors"}
	if values := ImageGenerationQualities(legacy); !slices.Equal(values, []string{"1K", "2K"}) {
		t.Fatalf("qualities = %#v", values)
	}
}

func TestImageGenerationProbeSizeUsesSeedream5Minimum(t *testing.T) {
	if size := ImageGenerationProbeSize("doubao-seedream-5-0-260128"); size != "2K" {
		t.Fatalf("Seedream 5 probe size = %q", size)
	}
	if size := ImageGenerationProbeSize("Kwai-Kolors/Kolors"); size != "1024x1024" {
		t.Fatalf("default probe size = %q", size)
	}
}

func TestImageGenerationReferenceQualitiesFollowModel(t *testing.T) {
	amux := model.AIModel{Provider: "amux", ModelID: "gpt-image-2"}
	if values := ImageGenerationReferenceQualities(amux); !slices.Equal(values, []string{"1K", "2K", "4K"}) {
		t.Fatalf("reference qualities = %#v", values)
	}
	otherProvider := model.AIModel{Provider: "ark", ModelID: "gpt-image-2"}
	if values := ImageGenerationReferenceQualities(otherProvider); !slices.Equal(values, []string{"1K", "2K", "4K"}) {
		t.Fatalf("other provider reference qualities = %#v", values)
	}
}

func TestListEnabledModelsPrioritizes4KReferenceImageModel(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	items := []model.AIModel{
		{ID: 1, Provider: "siliconflow", ModelID: "Kwai-Kolors/Kolors", DisplayName: "Kolors", Capabilities: EncodeStrings([]string{"image_generation"}), Enabled: true, SortOrder: 1},
		{ID: 2, Provider: "amux", ModelID: "gpt-image-2", DisplayName: "GPT Image", Capabilities: EncodeStrings([]string{"image_generation", "reference_image"}), Enabled: true, SortOrder: 2},
		{ID: 3, Provider: "ark", ModelID: "doubao-seedream-4-0-250828", DisplayName: "Seedream 4", Capabilities: EncodeStrings([]string{"image_generation", "reference_image"}), Enabled: true, SortOrder: 3},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}
	models, err := ListEnabledModels(db, "image_generation")
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 3 || models[0].ID != 2 || models[1].ID != 3 || models[2].ID != 1 {
		t.Fatalf("unexpected image model order: %+v", models)
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

func TestProviderFromEnvUsesPipixiaCompatibleConfig(t *testing.T) {
	t.Setenv("PIPIXIA_API_KEY", "test-key")
	t.Setenv("PIPIXIA_BASE_URL", "https://pipixia.example/v1/")

	provider, err := ProviderFromEnv("pipixia")
	if err != nil {
		t.Fatal(err)
	}
	if provider.Provider != "pipixia" || provider.APIKey != "test-key" || provider.BaseURL != "https://pipixia.example/v1" {
		t.Fatalf("unexpected pipixia provider config: %+v", provider)
	}
}

func TestProviderFromEnvRequiresPipixiaBaseURL(t *testing.T) {
	t.Setenv("PIPIXIA_API_KEY", "test-key")
	t.Setenv("PIPIXIA_BASE_URL", "")

	if _, err := ProviderFromEnv("pipixia"); err == nil {
		t.Fatal("expected missing PIPIXIA_BASE_URL error")
	}
}

func TestProviderFromEnvUsesVolcengineCompatibleConfig(t *testing.T) {
	t.Setenv("VOLCENGINE_API_KEY", "test-key")
	t.Setenv("VOLCENGINE_BASE_URL", "https://ark.example/api/v3/")

	provider, err := ProviderFromEnv("volcengine")
	if err != nil {
		t.Fatal(err)
	}
	if provider.Provider != "volcengine" || provider.APIKey != "test-key" || provider.BaseURL != "https://ark.example/api/v3" {
		t.Fatalf("unexpected volcengine provider config: %+v", provider)
	}
}

func TestProviderFromEnvUsesOfficialVolcengineBaseURLByDefault(t *testing.T) {
	t.Setenv("VOLCENGINE_API_KEY", "test-key")
	t.Setenv("VOLCENGINE_BASE_URL", "")

	provider, err := ProviderFromEnv("volcengine")
	if err != nil {
		t.Fatal(err)
	}
	if provider.BaseURL != "https://ark.cn-beijing.volces.com/api/v3" {
		t.Fatalf("unexpected default base URL: %s", provider.BaseURL)
	}
}

func TestProviderFromEnvCanonicalizesLegacyARKProvider(t *testing.T) {
	t.Setenv("VOLCENGINE_API_KEY", "test-key")
	t.Setenv("VOLCENGINE_BASE_URL", "https://ark.example/api/v3")

	provider, err := ProviderFromEnv("ark")
	if err != nil {
		t.Fatal(err)
	}
	if provider.Provider != "volcengine" {
		t.Fatalf("legacy provider was not canonicalized: %+v", provider)
	}
}

func TestFindFastTextModelUsesLowestDeclaredContextWindow(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	items := []model.AIModel{
		{ID: 1, Provider: "siliconflow", ModelID: "unknown-window", DisplayName: "Unknown", Capabilities: EncodeStrings([]string{"text"}), Enabled: true, SortOrder: 1},
		{ID: 2, Provider: "siliconflow", ModelID: "large-window", DisplayName: "Large", Capabilities: EncodeStrings([]string{"text"}), Enabled: true, SortOrder: 2, ContextWindowTokens: 128000},
		{ID: 3, Provider: "siliconflow", ModelID: "small-window", DisplayName: "Small", Capabilities: EncodeStrings([]string{"text"}), Enabled: true, SortOrder: 3, ContextWindowTokens: 32768},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}

	selected, err := FindFastTextModel(db)
	if err != nil || selected.ID != 3 {
		t.Fatalf("fast text model = %+v err=%v", selected, err)
	}
}

func TestResolveFastTextInvocationUsesCatalogProvider(t *testing.T) {
	t.Setenv("SILICONFLOW_API_KEY", "test-key")
	t.Setenv("SILICONFLOW_BASE_URL", "https://provider.test/v1")
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	items := []model.AIModel{
		{ID: 1, Provider: "siliconflow", ModelID: "larger", DisplayName: "Larger", Capabilities: EncodeStrings([]string{"text"}), Enabled: true, ContextWindowTokens: 65536},
		{ID: 2, Provider: "siliconflow", ModelID: "smaller", DisplayName: "Smaller", Capabilities: EncodeStrings([]string{"text"}), Enabled: true, ContextWindowTokens: 16384},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}

	invocation, err := ResolveFastTextInvocation(db, 15*time.Second)
	if err != nil || invocation.Model.ID != 2 || invocation.Client.BaseURL != "https://provider.test/v1" {
		t.Fatalf("fast invocation = %+v err=%v", invocation, err)
	}
}
