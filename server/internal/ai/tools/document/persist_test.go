package document

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestSaveToolPersistsOnlyOwnedArtifact(t *testing.T) {
	db := openDocumentToolDB(t)
	owned := createDocumentArtifact(t, db, 101, "draft.md")
	foreign := createDocumentArtifact(t, db, 202, "foreign.md")
	tool := NewSaveTool(db)
	contract := tools.ContractFor(tool)
	if contract.Confirmation != tools.ConfirmationBeforeWrite {
		t.Fatalf("contract = %#v", contract)
	}
	ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{UserID: 101, AppID: 11, ConversationID: 12, RunID: 13})
	if _, err := tool.Run(ctx, json.RawMessage(`{"artifactId":"`+owned.ID.String()+`"}`)); err != nil {
		t.Fatal(err)
	}
	var persisted model.AIAppArtifact
	if err := db.First(&persisted, owned.ID).Error; err != nil || persisted.PersistedAt == nil || persisted.ExpiresAt != nil {
		t.Fatalf("owned = %#v err=%v", persisted, err)
	}
	if _, err := tool.Run(ctx, json.RawMessage(`{"artifactId":"`+foreign.ID.String()+`"}`)); err == nil {
		t.Fatal("expected foreign artifact rejection")
	}
}

func TestOverwriteToolRepointsOwnedDocumentAndRejectsForeignTarget(t *testing.T) {
	db := openDocumentToolDB(t)
	source := createDocumentArtifact(t, db, 101, "replacement.md")
	target := model.Resource{UserID: 101, Type: "document", Visibility: "private", Title: "old", URL: "old-url", StorageKey: "old-key", Size: 3, Extension: "md"}
	foreign := model.Resource{UserID: 202, Type: "document", Visibility: "private", Title: "foreign", URL: "foreign-url", StorageKey: "foreign-key", Size: 3, Extension: "md"}
	_ = db.Create(&target).Error
	_ = db.Create(&foreign).Error
	ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{UserID: 101, AppID: 11, ConversationID: 12, RunID: 13})
	tool := newOverwriteTool(db, func(string) error { return nil })
	if _, err := tool.Run(ctx, json.RawMessage(`{"artifactId":"`+source.ID.String()+`","targetResourceId":"`+target.ID.String()+`"}`)); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&target, target.ID).Error; err != nil || target.URL != "url-replacement.md" || target.StorageKey != "key-replacement.md" {
		t.Fatalf("target = %#v err=%v", target, err)
	}
	if _, err := tool.Run(ctx, json.RawMessage(`{"artifactId":"`+source.ID.String()+`","targetResourceId":"`+foreign.ID.String()+`"}`)); err == nil {
		t.Fatal("expected foreign target rejection")
	}
}

func openDocumentToolDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Resource{}, &model.AIAppArtifact{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func createDocumentArtifact(t *testing.T, db *gorm.DB, userID model.Int64String, name string) model.AIAppArtifact {
	t.Helper()
	resource := model.Resource{UserID: userID, Type: "agent_file", Visibility: "private", Title: name, URL: "url-" + name, StorageKey: "key-" + name, Size: 12, Extension: "md"}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	expires := time.Now().Add(time.Hour)
	item := model.AIAppArtifact{UserID: userID, AppID: 11, ConversationID: 12, RunID: 13, ResourceID: resource.ID, FileName: name, ContentType: "text/markdown", SizeBytes: 12, URL: resource.URL, StorageKey: resource.StorageKey, ExpiresAt: &expires}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	return item
}
