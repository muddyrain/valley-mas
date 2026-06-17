package garden_test

import (
	"context"
	"testing"
	"time"

	"valley-server/internal/garden"
	"valley-server/internal/model"
)

type memStore struct {
	g               *model.Garden
	plants          []model.Plant
	logs            []model.GrowthLog
	interactionLogs []model.InteractionLog
	nextID          uint64
}

func newMemStore() *memStore { return &memStore{nextID: 1} }

func (m *memStore) GetGarden(_ context.Context, userID uint64) (*model.Garden, error) {
	return m.g, nil
}
func (m *memStore) EnsureGarden(_ context.Context, userID uint64) (*model.Garden, error) {
	if m.g == nil {
		m.g = &model.Garden{ID: 1, UserID: userID, SlotCount: 3}
	}
	return m.g, nil
}
func (m *memStore) CreatePlant(_ context.Context, p *model.Plant) error {
	p.ID = m.nextID
	m.nextID++
	p.CreatedAt = time.Now()
	m.plants = append(m.plants, *p)
	return nil
}
func (m *memStore) GetPlant(_ context.Context, id uint64) (*model.Plant, error) {
	for i := range m.plants {
		if m.plants[i].ID == id {
			return &m.plants[i], nil
		}
	}
	return nil, garden.ErrPlantNotFound
}
func (m *memStore) UpdatePlant(_ context.Context, p *model.Plant) error {
	for i := range m.plants {
		if m.plants[i].ID == p.ID {
			m.plants[i] = *p
			return nil
		}
	}
	return garden.ErrPlantNotFound
}
func (m *memStore) ListActivePlantsByUser(_ context.Context, userID uint64) ([]model.Plant, error) {
	var out []model.Plant
	for _, p := range m.plants {
		if p.UserID == userID && p.Status != garden.StatusHarvested {
			out = append(out, p)
		}
	}
	return out, nil
}
func (m *memStore) ListHarvestedPlantsByUser(_ context.Context, userID uint64) ([]model.Plant, error) {
	var out []model.Plant
	for _, p := range m.plants {
		if p.UserID == userID && p.Status == garden.StatusHarvested {
			out = append(out, p)
		}
	}
	return out, nil
}
func (m *memStore) AppendGrowthLog(_ context.Context, log *model.GrowthLog) error {
	log.ID = m.nextID
	m.nextID++
	log.CreatedAt = time.Now()
	m.logs = append(m.logs, *log)
	return nil
}
func (m *memStore) ListGrowthLogs(_ context.Context, plantID uint64) ([]model.GrowthLog, error) {
	var out []model.GrowthLog
	for _, l := range m.logs {
		if l.PlantID == plantID {
			out = append(out, l)
		}
	}
	return out, nil
}
func (m *memStore) AppendInteractionLog(_ context.Context, log *model.InteractionLog) error {
	log.ID = m.nextID
	m.nextID++
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	m.interactionLogs = append(m.interactionLogs, *log)
	return nil
}
func (m *memStore) CountTodayInteractions(_ context.Context, plantID uint64, action string) (int, error) {
	today := time.Now().Truncate(24 * time.Hour)
	count := 0
	for _, l := range m.interactionLogs {
		if l.PlantID == plantID && l.Action == action && !l.CreatedAt.Before(today) {
			count++
		}
	}
	return count, nil
}
func (m *memStore) CreateHarvest(_ context.Context, _ *model.Harvest) error            { return nil }
func (m *memStore) GetHarvest(_ context.Context, _ uint64) (*model.Harvest, error)     { return nil, nil }

type fakeAI struct{ reply string }

func (f *fakeAI) GenerateText(_ context.Context, _ string) (string, error) { return f.reply, nil }

func TestPlantSeedHappyPath(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: `{"name_zh":"未读消息","concept_en":"unread","tags":["anxious","phone"],"rarity":"R","mood":"焦虑","description":"那个没回的人","first_log":"我发芽了"}`}
	manifest := garden.NewManifest([]garden.AssetEntry{{Key: "unread_msg", Rarity: "R", Tags: []string{"anxious", "phone"}, Stages: map[string]string{"1": "unread_msg_1.png"}}})
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

	plant, err := svc.PlantSeed(context.Background(), 7, garden.PlantSeedReq{Concept: "未读消息", WaterStyle: "water"})
	if err != nil {
		t.Fatalf("PlantSeed err: %v", err)
	}
	if plant.Name != "未读消息" || plant.Rarity != "R" || plant.Status != garden.StatusGrowing {
		t.Fatalf("unexpected plant: %+v", plant)
	}
	if plant.SlotIndex < 0 || plant.SlotIndex >= 3 {
		t.Fatalf("slot index out of range: %d", plant.SlotIndex)
	}
	if plant.AssetKey != "unread_msg" {
		t.Fatalf("expected asset matched to unread_msg, got %s", plant.AssetKey)
	}
	logs, _ := store.ListGrowthLogs(context.Background(), plant.ID)
	if len(logs) != 1 || logs[0].Type != garden.LogTypeBirth {
		t.Fatalf("expected birth log, got %+v", logs)
	}
}

func TestPlantSeedSlotsFull(t *testing.T) {
	store := newMemStore()
	store.EnsureGarden(context.Background(), 7)
	ai := &fakeAI{reply: `{"name_zh":"x","concept_en":"x","tags":["x"],"rarity":"N","mood":"困","description":"d","first_log":"l"}`}
	manifest := garden.NewManifest([]garden.AssetEntry{{Key: "k", Rarity: "N", Tags: []string{"x"}}})
	svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))
	for i := 0; i < 3; i++ {
		if _, err := svc.PlantSeed(context.Background(), 7, garden.PlantSeedReq{Concept: "x", WaterStyle: "water"}); err != nil {
			t.Fatalf("seed %d err: %v", i, err)
		}
	}
	if _, err := svc.PlantSeed(context.Background(), 7, garden.PlantSeedReq{Concept: "x", WaterStyle: "water"}); err != garden.ErrSlotsFull {
		t.Fatalf("expected ErrSlotsFull, got %v", err)
	}
}

func newWaterTestPlant(t *testing.T, store *memStore, userID uint64) *model.Plant {
	t.Helper()
	store.EnsureGarden(context.Background(), userID)
	p := &model.Plant{
		UserID:      userID,
		SlotIndex:   0,
		Name:        "未读消息",
		Mood:        "焦虑",
		WaterStyle:  garden.WaterPlain,
		Rarity:      garden.RarityR,
		Stage:       1,
		StageMax:    3,
		AssetKey:    "unread_msg",
		NextStageAt: time.Now().Add(10 * time.Minute),
		Status:      garden.StatusGrowing,
	}
	if err := store.CreatePlant(context.Background(), p); err != nil {
		t.Fatalf("create plant: %v", err)
	}
	return p
}

func TestWaterHappyPath(t *testing.T) {
	store := newMemStore()
	p := newWaterTestPlant(t, store, 7)
	before := p.NextStageAt
	ai := &fakeAI{reply: "咕嘟咕嘟，谢谢你今天还记得我。"}
	svc := garden.NewServiceWithDeps(store, ai, garden.NewManifest(nil), garden.FixedRandSource(1))

	reply, err := svc.Water(context.Background(), 7, p.ID)
	if err != nil {
		t.Fatalf("Water err: %v", err)
	}
	if reply == "" {
		t.Fatalf("expected non-empty reply")
	}

	updated, _ := store.GetPlant(context.Background(), p.ID)
	delta := before.Sub(updated.NextStageAt)
	if delta < 29*time.Second || delta > 31*time.Second {
		t.Fatalf("expected next_stage_at advanced ~30s, got delta=%s", delta)
	}

	if got := len(store.interactionLogs); got != 1 {
		t.Fatalf("expected 1 interaction log, got %d", got)
	}
	if store.interactionLogs[0].Action != garden.ActionWater || store.interactionLogs[0].AIReply == "" {
		t.Fatalf("unexpected interaction log: %+v", store.interactionLogs[0])
	}
}

func TestWaterDailyLimit(t *testing.T) {
	store := newMemStore()
	p := newWaterTestPlant(t, store, 7)
	ai := &fakeAI{reply: "咕嘟"}
	svc := garden.NewServiceWithDeps(store, ai, garden.NewManifest(nil), garden.FixedRandSource(1))

	for i := 0; i < 5; i++ {
		if _, err := svc.Water(context.Background(), 7, p.ID); err != nil {
			t.Fatalf("water %d err: %v", i, err)
		}
	}
	if _, err := svc.Water(context.Background(), 7, p.ID); err != garden.ErrInteractionLimited {
		t.Fatalf("expected ErrInteractionLimited, got %v", err)
	}
}

func TestWaterPlantNotOwned(t *testing.T) {
	store := newMemStore()
	p := newWaterTestPlant(t, store, 7)
	ai := &fakeAI{reply: "咕嘟"}
	svc := garden.NewServiceWithDeps(store, ai, garden.NewManifest(nil), garden.FixedRandSource(1))

	if _, err := svc.Water(context.Background(), 999, p.ID); err != garden.ErrPlantNotOwned {
		t.Fatalf("expected ErrPlantNotOwned, got %v", err)
	}
}

func newMatureTestPlant(t *testing.T, store *memStore, userID uint64) *model.Plant {
	t.Helper()
	store.EnsureGarden(context.Background(), userID)
	p := &model.Plant{
		UserID:      userID,
		SlotIndex:   0,
		Name:        "未读消息",
		Mood:        "释然",
		WaterStyle:  garden.WaterPlain,
		Rarity:      garden.RarityR,
		Stage:       3,
		StageMax:    3,
		AssetKey:    "unread_msg",
		NextStageAt: time.Now(),
		Status:      garden.StatusMature,
	}
	if err := store.CreatePlant(context.Background(), p); err != nil {
		t.Fatalf("create plant: %v", err)
	}
	return p
}

func TestChatOnMature(t *testing.T) {
	store := newMemStore()
	p := newMatureTestPlant(t, store, 7)
	ai := &fakeAI{reply: "你来啦，我就知道你今天会来。"}
	svc := garden.NewServiceWithDeps(store, ai, garden.NewManifest(nil), garden.FixedRandSource(1))

	reply, err := svc.Chat(context.Background(), 7, p.ID, "今天怎么样？")
	if err != nil {
		t.Fatalf("Chat err: %v", err)
	}
	if reply == "" {
		t.Fatalf("expected non-empty reply")
	}
	if got := len(store.interactionLogs); got != 1 {
		t.Fatalf("expected 1 interaction log, got %d", got)
	}
	log := store.interactionLogs[0]
	if log.Action != garden.ActionChat {
		t.Fatalf("expected action chat, got %s", log.Action)
	}
	if log.UserInput != "今天怎么样？" {
		t.Fatalf("unexpected user_input: %q", log.UserInput)
	}
	if log.AIReply == "" {
		t.Fatalf("expected ai_reply not empty")
	}
}

func TestChatOnGrowingForbidden(t *testing.T) {
	store := newMemStore()
	p := newWaterTestPlant(t, store, 7)
	ai := &fakeAI{reply: "..."}
	svc := garden.NewServiceWithDeps(store, ai, garden.NewManifest(nil), garden.FixedRandSource(1))

	if _, err := svc.Chat(context.Background(), 7, p.ID, "嗨"); err != garden.ErrNotMature {
		t.Fatalf("expected ErrNotMature, got %v", err)
	}
	if got := len(store.interactionLogs); got != 0 {
		t.Fatalf("expected 0 interaction logs, got %d", got)
	}
}

func TestChatDailyLimit(t *testing.T) {
	store := newMemStore()
	p := newMatureTestPlant(t, store, 7)
	ai := &fakeAI{reply: "嗯。"}
	svc := garden.NewServiceWithDeps(store, ai, garden.NewManifest(nil), garden.FixedRandSource(1))

	for i := 0; i < 3; i++ {
		if _, err := svc.Chat(context.Background(), 7, p.ID, "再聊一次"); err != nil {
			t.Fatalf("chat %d err: %v", i, err)
		}
	}
	if _, err := svc.Chat(context.Background(), 7, p.ID, "第四次"); err != garden.ErrInteractionLimited {
		t.Fatalf("expected ErrInteractionLimited, got %v", err)
	}
}
