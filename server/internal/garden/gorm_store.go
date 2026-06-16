package garden

import (
	"context"
	"errors"
	"time"

	"valley-server/internal/model"

	"gorm.io/gorm"
)

type gormStore struct{ db *gorm.DB }

func NewGormStore(db *gorm.DB) Store { return &gormStore{db: db} }

func (s *gormStore) GetGarden(ctx context.Context, userID uint64) (*model.Garden, error) {
	var g model.Garden
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *gormStore) EnsureGarden(ctx context.Context, userID uint64) (*model.Garden, error) {
	var g model.Garden
	err := s.db.WithContext(ctx).Where(model.Garden{UserID: userID}).
		Attrs(model.Garden{SlotCount: 3}).FirstOrCreate(&g).Error
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *gormStore) CreatePlant(ctx context.Context, p *model.Plant) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *gormStore) GetPlant(ctx context.Context, id uint64) (*model.Plant, error) {
	var p model.Plant
	if err := s.db.WithContext(ctx).First(&p, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPlantNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (s *gormStore) UpdatePlant(ctx context.Context, p *model.Plant) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *gormStore) ListActivePlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error) {
	var ps []model.Plant
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status <> ?", userID, StatusHarvested).
		Order("slot_index ASC").Find(&ps).Error
	return ps, err
}

func (s *gormStore) ListHarvestedPlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error) {
	var ps []model.Plant
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, StatusHarvested).
		Order("harvested_at DESC").Find(&ps).Error
	return ps, err
}

func (s *gormStore) AppendGrowthLog(ctx context.Context, log *model.GrowthLog) error {
	return s.db.WithContext(ctx).Create(log).Error
}

func (s *gormStore) ListGrowthLogs(ctx context.Context, plantID uint64) ([]model.GrowthLog, error) {
	var logs []model.GrowthLog
	err := s.db.WithContext(ctx).Where("plant_id = ?", plantID).
		Order("created_at ASC").Find(&logs).Error
	return logs, err
}

func (s *gormStore) AppendInteractionLog(ctx context.Context, log *model.InteractionLog) error {
	return s.db.WithContext(ctx).Create(log).Error
}

func (s *gormStore) CountTodayInteractions(ctx context.Context, plantID uint64, action string) (int, error) {
	var n int64
	today := time.Now().Truncate(24 * time.Hour)
	err := s.db.WithContext(ctx).Model(&model.InteractionLog{}).
		Where("plant_id = ? AND action = ? AND created_at >= ?", plantID, action, today).
		Count(&n).Error
	return int(n), err
}

func (s *gormStore) CreateHarvest(ctx context.Context, h *model.Harvest) error {
	return s.db.WithContext(ctx).Create(h).Error
}

func (s *gormStore) GetHarvest(ctx context.Context, plantID uint64) (*model.Harvest, error) {
	var h model.Harvest
	if err := s.db.WithContext(ctx).Where("plant_id = ?", plantID).First(&h).Error; err != nil {
		return nil, err
	}
	return &h, nil
}
