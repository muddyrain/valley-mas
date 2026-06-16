package garden

import "errors"

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
	store Store
}

// NewService 构造 Service。store 允许为 nil（仅在 health/test 场景），
// 业务方法被调用时由实现自行处理 nil store 的报错。
func NewService(store Store) *Service {
	return &Service{store: store}
}
