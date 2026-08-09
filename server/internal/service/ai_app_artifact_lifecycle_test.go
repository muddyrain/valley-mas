package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestCleanupExpiredAIAppArtifactsDeletesOnlyTemporaryExpiredOutputs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Resource{}, &model.AIAppArtifact{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)
	expiredAt := now.Add(-time.Minute)
	futureAt := now.Add(72 * time.Hour)
	persistedAt := now.Add(-time.Hour)

	expired := createArtifactFixture(t, db, "expired.md", "expired-key", &expiredAt, nil)
	future := createArtifactFixture(t, db, "future.md", "future-key", &futureAt, nil)
	persisted := createArtifactFixture(t, db, "saved.md", "saved-key", &expiredAt, &persistedAt)

	var deletedKeys []string
	count, err := CleanupExpiredAIAppArtifacts(context.Background(), db, now, 20, func(_ context.Context, key string) error {
		deletedKeys = append(deletedKeys, key)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 || len(deletedKeys) != 1 || deletedKeys[0] != "expired-key" {
		t.Fatalf("unexpected cleanup: count=%d keys=%v", count, deletedKeys)
	}
	assertArtifactDeleted(t, db, expired.ID)
	assertArtifactPresent(t, db, future.ID)
	assertArtifactPresent(t, db, persisted.ID)
}

func TestCleanupExpiredAIAppArtifactsKeepsRecordWhenObjectDeleteFails(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Resource{}, &model.AIAppArtifact{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)
	expiredAt := now.Add(-time.Minute)
	artifact := createArtifactFixture(t, db, "failed.md", "failed-key", &expiredAt, nil)
	deleteFailure := errors.New("storage unavailable")

	count, err := CleanupExpiredAIAppArtifacts(context.Background(), db, now, 20, func(context.Context, string) error {
		return deleteFailure
	})
	if !errors.Is(err, deleteFailure) || count != 0 {
		t.Fatalf("count=%d err=%v", count, err)
	}
	assertArtifactPresent(t, db, artifact.ID)
}

func createArtifactFixture(t *testing.T, db *gorm.DB, name, key string, expiresAt, persistedAt *time.Time) model.AIAppArtifact {
	t.Helper()
	resource := model.Resource{UserID: 101, Type: "agent_file", Visibility: "private", Title: name, URL: "https://example.invalid/" + name, StorageKey: key}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	artifact := model.AIAppArtifact{
		UserID: 101, AppID: 201, ConversationID: 301, RunID: 401, ResourceID: resource.ID,
		FileName: name, ContentType: "text/markdown", SizeBytes: 10, URL: resource.URL,
		StorageKey: key, ExpiresAt: expiresAt, PersistedAt: persistedAt,
	}
	if err := db.Create(&artifact).Error; err != nil {
		t.Fatal(err)
	}
	return artifact
}

func assertArtifactDeleted(t *testing.T, db *gorm.DB, id model.Int64String) {
	t.Helper()
	var count int64
	if err := db.Model(&model.AIAppArtifact{}).Where("id = ?", id).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("artifact %s should be deleted: count=%d err=%v", id.String(), count, err)
	}
}

func assertArtifactPresent(t *testing.T, db *gorm.DB, id model.Int64String) {
	t.Helper()
	var count int64
	if err := db.Model(&model.AIAppArtifact{}).Where("id = ?", id).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("artifact %s should remain: count=%d err=%v", id.String(), count, err)
	}
}
