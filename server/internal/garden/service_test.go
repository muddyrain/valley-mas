package garden_test

import (
	"context"
	"testing"
	"time"

	"valley-server/internal/garden"
	"valley-server/internal/model"
)

type memStore struct {
	g      *model.Garden
	plants []model.Plant
	logs   []model.GrowthLog
	nextID uint64
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
func (m *memStore) AppendInteractionLog(_ context.Context, _ *model.InteractionLog) error {
	return nil
}
func (m *memStore) CountTodayInteractions(_ context.Context, _ uint64, _ string) (int, error) {
	return 0, nil
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
