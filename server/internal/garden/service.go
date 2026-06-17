package garden

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"valley-server/internal/model"
)

var (
	ErrPlantNotFound      = errors.New("plant not found")
	ErrPlantNotOwned      = errors.New("plant not owned by user")
	ErrSlotsFull          = errors.New("all slots are full")
	ErrAlreadyMature      = errors.New("plant already mature")
	ErrNotMature          = errors.New("plant not yet mature")
	ErrInteractionLimited = errors.New("daily interaction limit reached")
)

// Service 是 handler 调用的业务接口；具体方法在后续任务逐步填充。
type Service struct {
	store    Store
	ai       TextAI
	manifest *Manifest
	rng      *rand.Rand
	now      func() time.Time
}

// NewService 构造 Service。store 允许为 nil（仅在 health/test 场景），
// 业务方法被调用时由实现自行处理 nil store 的报错。
func NewService(store Store) *Service {
	return &Service{
		store: store,
		now:   time.Now,
		rng:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// NewServiceWithDeps 用于测试和后续真实接线，注入 AI、资产清单和确定性随机源。
func NewServiceWithDeps(store Store, ai TextAI, manifest *Manifest, seed int64) *Service {
	return &Service{
		store:    store,
		ai:       ai,
		manifest: manifest,
		rng:      rand.New(rand.NewSource(seed)),
		now:      time.Now,
	}
}

// FixedRandSource 仅为测试可读性而存在。
func FixedRandSource(seed int64) int64 { return seed }

// PlantSeed 种下一颗种子：分配花盆 → 调 AI 生成 seed JSON → 匹配资产 → 写入 plant 与首条日志。
func (s *Service) PlantSeed(ctx context.Context, userID uint64, req PlantSeedReq) (*model.Plant, error) {
	g, err := s.store.EnsureGarden(ctx, userID)
	if err != nil {
		return nil, err
	}
	active, err := s.store.ListActivePlantsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	used := map[int]bool{}
	for _, p := range active {
		if p.SlotIndex >= 0 {
			used[p.SlotIndex] = true
		}
	}
	slot := -1
	for i := 0; i < g.SlotCount; i++ {
		if !used[i] {
			slot = i
			break
		}
	}
	if slot < 0 {
		return nil, ErrSlotsFull
	}

	raw, err := s.ai.GenerateText(ctx, PromptSeedBirth(req.Concept, req.WaterStyle))
	if err != nil {
		return nil, err
	}
	seed, err := ParseSeedJSON(raw)
	if err != nil {
		return nil, err
	}

	rarity := seed.Rarity
	if !validRarity(rarity) {
		rarity = RollRarity(req.Concept, s.rng)
	}
	asset := s.manifest.Match(seed.Tags, rarity, s.rng)
	if asset == nil {
		// 兜底 fallback：找任意稀有度
		asset = s.manifest.Match(seed.Tags, RarityN, s.rng)
	}
	var assetKey string
	if asset != nil {
		assetKey = asset.Key
	}

	stageMax := stageMaxForRarity(rarity)
	interval := stageInterval(rarity)
	plant := &model.Plant{
		UserID:       userID,
		SlotIndex:    slot,
		ConceptInput: req.Concept,
		ConceptEN:    seed.ConceptEN,
		Name:         seed.NameZH,
		Description:  seed.Description,
		WaterStyle:   req.WaterStyle,
		Rarity:       rarity,
		Stage:        1,
		StageMax:     stageMax,
		AssetKey:     assetKey,
		NextStageAt:  s.now().Add(interval),
		Mood:         seed.Mood,
		Status:       StatusGrowing,
	}
	if err := s.store.CreatePlant(ctx, plant); err != nil {
		return nil, err
	}
	_ = s.store.AppendGrowthLog(ctx, &model.GrowthLog{
		PlantID: plant.ID,
		Stage:   1,
		Type:    LogTypeBirth,
		Content: seed.FirstLog,
	})
	return plant, nil
}

func validRarity(r string) bool {
	return r == RarityN || r == RarityR || r == RaritySR || r == RaritySSR
}

func stageMaxForRarity(r string) int {
	switch r {
	case RaritySSR:
		return 5
	case RaritySR:
		return 4
	default:
		return 3
	}
}

// stageInterval 决定下一阶段的等待时间（MVP：5-15 分钟）
func stageInterval(r string) time.Duration {
	switch r {
	case RaritySSR:
		return 15 * time.Minute
	case RaritySR:
		return 12 * time.Minute
	case RarityR:
		return 8 * time.Minute
	default:
		return 5 * time.Minute
	}
}

// GardenView 是 GET /garden 的聚合返回结构。
type GardenView struct {
	Garden *model.Garden `json:"garden"`
	Plants []model.Plant `json:"plants"`
}

// GetGardenView 返回当前用户的花园元数据与活跃植物列表。
func (s *Service) GetGardenView(ctx context.Context, userID uint64) (*GardenView, error) {
	g, err := s.store.EnsureGarden(ctx, userID)
	if err != nil {
		return nil, err
	}
	plants, err := s.store.ListActivePlantsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &GardenView{Garden: g, Plants: plants}, nil
}

// PlantDetailView 是 GET /garden/plant/:id 的聚合返回。
type PlantDetailView struct {
	Plant *model.Plant      `json:"plant"`
	Logs  []model.GrowthLog `json:"logs"`
}

// GetPlantDetail 返回植物详情；查询前 lazy advance，确保前端始终看到最新阶段。
func (s *Service) GetPlantDetail(ctx context.Context, userID, plantID uint64) (*PlantDetailView, error) {
	p, err := s.store.GetPlant(ctx, plantID)
	if err != nil {
		return nil, err
	}
	if p.UserID != userID {
		return nil, ErrPlantNotOwned
	}
	if err := s.AdvancePlant(ctx, p); err != nil {
		return nil, err
	}
	logs, err := s.store.ListGrowthLogs(ctx, plantID)
	if err != nil {
		return nil, err
	}
	return &PlantDetailView{Plant: p, Logs: logs}, nil
}
