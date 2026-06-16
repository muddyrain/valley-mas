package garden

import (
	"context"

	"valley-server/internal/model"
)

type Store interface {
	GetGarden(ctx context.Context, userID uint64) (*model.Garden, error)
	EnsureGarden(ctx context.Context, userID uint64) (*model.Garden, error)

	CreatePlant(ctx context.Context, p *model.Plant) error
	GetPlant(ctx context.Context, id uint64) (*model.Plant, error)
	UpdatePlant(ctx context.Context, p *model.Plant) error
	ListActivePlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error)
	ListHarvestedPlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error)

	AppendGrowthLog(ctx context.Context, log *model.GrowthLog) error
	ListGrowthLogs(ctx context.Context, plantID uint64) ([]model.GrowthLog, error)

	AppendInteractionLog(ctx context.Context, log *model.InteractionLog) error
	CountTodayInteractions(ctx context.Context, plantID uint64, action string) (int, error)

	CreateHarvest(ctx context.Context, h *model.Harvest) error
	GetHarvest(ctx context.Context, plantID uint64) (*model.Harvest, error)
}
