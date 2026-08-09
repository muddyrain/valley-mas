package aimodel

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupEmbeddingCatalogTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestFindVerifiedEmbeddingModelMatchesStoredDimension(t *testing.T) {
	db := setupEmbeddingCatalogTestDB(t)
	items := []model.AIModel{
		{ID: 1, Provider: "siliconflow", ModelID: "declared-only", DisplayName: "Declared", Capabilities: EncodeStrings([]string{"embedding"}), EmbeddingDimension: 1024, Enabled: true, SortOrder: 0},
		{ID: 2, Provider: "siliconflow", ModelID: "verified-4096", DisplayName: "Large", Capabilities: EncodeStrings([]string{"embedding"}), VerifiedCapabilities: EncodeStrings([]string{"embedding"}), EmbeddingDimension: 4096, Enabled: true, SortOrder: 1},
		{ID: 3, Provider: "siliconflow", ModelID: "verified-1024", DisplayName: "Compatible", Capabilities: EncodeStrings([]string{"embedding"}), VerifiedCapabilities: EncodeStrings([]string{"embedding"}), EmbeddingDimension: 1024, Enabled: true, SortOrder: 2},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}

	selected, err := FindVerifiedEmbeddingModel(db, 1024)
	if err != nil || selected.ID != 3 {
		t.Fatalf("1024-dimensional model = %+v err=%v", selected, err)
	}
	selected, err = FindVerifiedEmbeddingModel(db, 0)
	if err != nil || selected.ID != 2 {
		t.Fatalf("default embedding model = %+v err=%v", selected, err)
	}
	if _, err := FindVerifiedEmbeddingModel(db, 2048); !errors.Is(err, ErrEmbeddingDimensionUnavailable) {
		t.Fatalf("missing dimension error = %v", err)
	}
}

func TestResolveDefaultEmbeddingInvocationUsesVerifiedCatalogProvider(t *testing.T) {
	t.Setenv("SILICONFLOW_API_KEY", "test-key")
	t.Setenv("SILICONFLOW_BASE_URL", "https://embedding.example/v1")
	db := setupEmbeddingCatalogTestDB(t)
	item := model.AIModel{
		ID: 11, Provider: "siliconflow", ModelID: "embedding-model", DisplayName: "Embedding",
		Capabilities: EncodeStrings([]string{"embedding"}), VerifiedCapabilities: EncodeStrings([]string{"embedding"}),
		EmbeddingDimension: 1024, Enabled: true,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}

	invocation, err := ResolveDefaultEmbeddingInvocation(db, 15*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if invocation.Model.ID != item.ID || invocation.Client.BaseURL != "https://embedding.example/v1" {
		t.Fatalf("unexpected invocation: %+v", invocation)
	}
}

func TestResolveStoredEmbeddingInvocationUsesExactCatalogModel(t *testing.T) {
	t.Setenv("SILICONFLOW_API_KEY", "test-key")
	db := setupEmbeddingCatalogTestDB(t)
	items := []model.AIModel{
		{ID: 21, Provider: "siliconflow", ModelID: "same-dimension-wrong-model", DisplayName: "Wrong", Capabilities: EncodeStrings([]string{"embedding"}), VerifiedCapabilities: EncodeStrings([]string{"embedding"}), EmbeddingDimension: 1024, Enabled: true, SortOrder: 0},
		{ID: 22, Provider: "siliconflow", ModelID: "stored-model", DisplayName: "Stored", Capabilities: EncodeStrings([]string{"embedding"}), VerifiedCapabilities: EncodeStrings([]string{"embedding"}), EmbeddingDimension: 1024, Enabled: true, SortOrder: 1},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}

	invocation, err := ResolveStoredEmbeddingInvocation(db, 22, 1024, 15*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if invocation.Model.ID != 22 {
		t.Fatalf("stored invocation selected model %s", invocation.Model.ID)
	}
	if _, err := ResolveStoredEmbeddingInvocation(db, 21, 4096, 15*time.Second); !errors.Is(err, ErrEmbeddingDimensionUnavailable) {
		t.Fatalf("stored dimension mismatch error = %v", err)
	}
}

func TestCreateEmbeddingsWithProgressPreservesInputOrder(t *testing.T) {
	values := map[string]float32{"one": 1, "two": 2, "three": 3}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Input []string `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || len(payload.Input) != 1 {
			http.Error(w, "invalid input", http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"index": 0, "embedding": []float32{values[payload.Input[0]]}}},
		})
	}))
	defer server.Close()

	invocation := Invocation{
		Model:  model.AIModel{ModelID: "embedding-model", EmbeddingDimension: 1},
		Client: aiclient.NewProviderCompatibleClient("siliconflow", server.URL, "test-key", 5*time.Second),
	}
	var progressMu sync.Mutex
	progress := make([]int, 0, 3)
	vectors, err := CreateEmbeddingsWithProgress(context.Background(), invocation, []string{"one", "two", "three"}, func(completed, _ int) {
		progressMu.Lock()
		progress = append(progress, completed)
		progressMu.Unlock()
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(vectors) != 3 || vectors[0][0] != 1 || vectors[1][0] != 2 || vectors[2][0] != 3 {
		t.Fatalf("vectors lost input order: %#v", vectors)
	}
	progressMu.Lock()
	slices.Sort(progress)
	if !slices.Equal(progress, []int{1, 2, 3}) {
		t.Fatalf("progress = %#v", progress)
	}
	progressMu.Unlock()
}
