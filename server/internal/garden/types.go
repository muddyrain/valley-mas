package garden

const (
	StatusGrowing   = "growing"
	StatusMature    = "mature"
	StatusHarvested = "harvested"

	RarityN   = "N"
	RarityR   = "R"
	RaritySR  = "SR"
	RaritySSR = "SSR"

	WaterPlain  = "water"
	WaterCoffee = "coffee"
	WaterWine   = "wine"
	WaterPotion = "potion"

	LogTypeBirth   = "birth"
	LogTypeGrow    = "grow"
	LogTypeEvent   = "event"
	LogTypeHarvest = "harvest"

	ActionWater = "water"
	ActionChat  = "chat"
)

// PlantSeedReq 种下种子的请求
type PlantSeedReq struct {
	Concept    string `json:"concept"     binding:"required,max=80"`
	WaterStyle string `json:"water_style" binding:"required,oneof=water coffee wine potion"`
}

// WaterReq 浇水请求（M1 占位，后续填充字段）
type WaterReq struct{}

// ChatReq 聊天请求
type ChatReq struct {
	Message string `json:"message" binding:"required,max=200"`
}
