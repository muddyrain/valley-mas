package mindarena

import (
	"testing"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupGormStoreTest(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.MindArenaDebateSession{},
		&model.MindArenaDebateMessage{},
		&model.MindArenaDebateScore{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestGormStorePersistsSessionMessagesAndScores(t *testing.T) {
	db := setupGormStoreTest(t)
	store := NewGormStore(db)
	session := testSession("deb_persisted", testPersonas())
	session.Topic = "要不要迁移到数据库"

	if err := store.Create(session); err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := store.AppendMessages(session.ID, []DebateMessage{
		{ID: "msg_1", Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先看风险"},
	}); err != nil {
		t.Fatalf("append messages: %v", err)
	}
	if _, err := store.Complete(session.ID, &DebateResult{
		Winner:      "理性派",
		FinalAdvice: "分阶段迁移",
		Quote:       "先看风险",
		Scores: []DebateScore{
			{Persona: "理性派", PersonaID: "p1", Score: 88},
			{Persona: "毒舌派", PersonaID: "p2", Score: 72},
		},
	}); err != nil {
		t.Fatalf("complete session: %v", err)
	}

	reloadedStore := NewGormStore(db)
	reloaded, err := reloadedStore.Get(session.ID)
	if err != nil {
		t.Fatalf("get reloaded session: %v", err)
	}
	if reloaded.Topic != "要不要迁移到数据库" || len(reloaded.Messages) != 1 {
		t.Fatalf("unexpected reloaded session: %+v", reloaded)
	}
	if reloaded.Result == nil || len(reloaded.Result.Scores) != 2 || reloaded.Result.Winner != "理性派" {
		t.Fatalf("unexpected persisted result: %+v", reloaded.Result)
	}
}
