package garden_test

import (
	"context"
	"testing"
	"time"

	"valley-server/internal/garden"
	"valley-server/internal/model"
)

// helper：构造一棵处于 growing 状态的植物并写入 store
func seedGrowingPlant(store *memStore, rarity string, stage, stageMax int, nextStage time.Time) *model.Plant {
	p := &model.Plant{
		UserID:      7,
		SlotIndex:   0,
		Name:        "测试植物",
		Mood:        "好奇",
		WaterStyle:  "water",
		Rarity:      rarity,
		Stage:       stage,
		StageMax:    stageMax,
		NextStageAt: nextStage,
		Status:      garden.StatusGrowing,
	}
	if err := store.CreatePlant(context.Background(), p); err != nil {
		panic(err)
	}
	return p
}

func TestAdvancePlantSingleStep(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: "我又长高了一点。"}
	manifest := garden.NewManifest(nil)
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	past := now.Add(-time.Minute)
	p := seedGrowingPlant(store, garden.RarityR, 1, 3, past)

	if err := svc.AdvancePlantAt(context.Background(), p, now); err != nil {
		t.Fatalf("AdvancePlantAt err: %v", err)
	}
	if p.Stage != 2 {
		t.Fatalf("expected stage 2, got %d", p.Stage)
	}
	if p.Status != garden.StatusGrowing {
		t.Fatalf("expected status growing, got %s", p.Status)
	}
	if !p.NextStageAt.After(now) {
		t.Fatalf("expected NextStageAt > now, got %v vs %v", p.NextStageAt, now)
	}
	logs, _ := store.ListGrowthLogs(context.Background(), p.ID)
	if len(logs) != 1 || logs[0].Type != garden.LogTypeGrow || logs[0].Stage != 2 {
		t.Fatalf("expected 1 grow log at stage 2, got %+v", logs)
	}
}

func TestAdvancePlantToMature(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: "成熟啦。"}
	manifest := garden.NewManifest(nil)
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	p := seedGrowingPlant(store, garden.RarityN, 2, 3, past) // 1 步可成熟

	if err := svc.AdvancePlantAt(context.Background(), p, now); err != nil {
		t.Fatalf("AdvancePlantAt err: %v", err)
	}
	if p.Status != garden.StatusMature {
		t.Fatalf("expected mature, got %s", p.Status)
	}
	if p.Stage != p.StageMax {
		t.Fatalf("expected stage == stageMax(%d), got %d", p.StageMax, p.Stage)
	}
}

func TestAdvancePlantMultiStep(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: "..."}
	manifest := garden.NewManifest(nil)
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	// 远早于 now，期望一次性推进到 mature
	veryPast := now.Add(-24 * time.Hour)
	p := seedGrowingPlant(store, garden.RarityN, 1, 3, veryPast)

	if err := svc.AdvancePlantAt(context.Background(), p, now); err != nil {
		t.Fatalf("AdvancePlantAt err: %v", err)
	}
	if p.Status != garden.StatusMature {
		t.Fatalf("expected mature after multi-step, got %s", p.Status)
	}
	logs, _ := store.ListGrowthLogs(context.Background(), p.ID)
	if len(logs) != 2 {
		// stage 1 → 2 → 3，共写 2 条 grow 日志
		t.Fatalf("expected 2 grow logs, got %d", len(logs))
	}
}

func TestAdvancePlantNotDueNoChange(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: "x"}
	manifest := garden.NewManifest(nil)
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	future := now.Add(time.Hour)
	p := seedGrowingPlant(store, garden.RarityR, 1, 3, future)

	if err := svc.AdvancePlantAt(context.Background(), p, now); err != nil {
		t.Fatalf("AdvancePlantAt err: %v", err)
	}
	if p.Stage != 1 {
		t.Fatalf("expected stage unchanged (1), got %d", p.Stage)
	}
	if p.Status != garden.StatusGrowing {
		t.Fatalf("expected status growing, got %s", p.Status)
	}
	logs, _ := store.ListGrowthLogs(context.Background(), p.ID)
	if len(logs) != 0 {
		t.Fatalf("expected no logs, got %d", len(logs))
	}
}

func TestGetPlantDetailLazyAdvance(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: "lazy log"}
	manifest := garden.NewManifest(nil)
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	past := time.Now().Add(-time.Hour)
	p := seedGrowingPlant(store, garden.RarityR, 1, 3, past)

	view, err := svc.GetPlantDetail(context.Background(), 7, p.ID)
	if err != nil {
		t.Fatalf("GetPlantDetail err: %v", err)
	}
	if view.Plant.Stage < 2 {
		t.Fatalf("expected lazy advance to stage>=2, got %d", view.Plant.Stage)
	}
	if len(view.Logs) == 0 {
		t.Fatalf("expected logs after advance")
	}
}

func TestGetPlantDetailForbidden(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: "x"}
	manifest := garden.NewManifest(nil)
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	now := time.Now()
	p := seedGrowingPlant(store, garden.RarityN, 1, 3, now.Add(time.Hour))

	if _, err := svc.GetPlantDetail(context.Background(), 999, p.ID); err != garden.ErrPlantNotOwned {
		t.Fatalf("expected ErrPlantNotOwned, got %v", err)
	}
}
