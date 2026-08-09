package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func TestAIMotionStickerOptionsDefaultToImageAndExcludeUnsupportedProviders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:motion-sticker-options?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIModel{}); err != nil {
		t.Fatal(err)
	}
	videoCapabilities := aimodel.EncodeStrings([]string{"video_generation", "reference_image"})
	imageCapabilities := aimodel.EncodeStrings([]string{"image_generation", "reference_image"})
	items := []model.AIModel{
		{ID: 401, Provider: "amux", ModelID: "doubao-seedance-2.0-fast", DisplayName: "Seedance Amux", Capabilities: videoCapabilities, VideoProtocol: "amux_video", Enabled: true},
		{ID: 402, Provider: "siliconflow", ModelID: "doubao-seedance-2.0-fast", DisplayName: "Seedance Wrong", Capabilities: videoCapabilities, VideoProtocol: "auto", Enabled: true},
		{ID: 403, Provider: "volcengine", ModelID: "doubao-seedream-5-0-260128", DisplayName: "Seedream 5", Capabilities: imageCapabilities, ImageProtocol: "auto", Enabled: true},
		{ID: 404, Provider: "siliconflow", ModelID: "wrong-image", DisplayName: "Unsupported Image", Capabilities: imageCapabilities, ImageProtocol: "auto", Enabled: true},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previous })

	router := gin.New()
	router.GET("/ai/motion-sticker-options", ListAIMotionStickerOptions)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/ai/motion-sticker-options", nil))
	var response struct {
		Code int `json:"code"`
		Data struct {
			DefaultMode string `json:"defaultMode"`
			ImageModels []struct {
				ID            string `json:"id"`
				Provider      string `json:"provider"`
				ImageProtocol string `json:"imageProtocol"`
			} `json:"imageModels"`
			VideoModels []struct {
				ID            string `json:"id"`
				Provider      string `json:"provider"`
				VideoProtocol string `json:"videoProtocol"`
			} `json:"videoModels"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Code != 0 || response.Data.DefaultMode != "image" || len(response.Data.ImageModels) != 1 || len(response.Data.VideoModels) != 1 {
		t.Fatalf("unexpected motion sticker options: %s", recorder.Body.String())
	}
	if item := response.Data.ImageModels[0]; item.ID != "403" || item.Provider != "volcengine" || item.ImageProtocol != "ark_images" {
		t.Fatalf("unexpected runnable image model: %+v", item)
	}
	item := response.Data.VideoModels[0]
	if item.ID != "401" || item.Provider != "amux" || item.VideoProtocol != "amux_video" {
		t.Fatalf("unexpected runnable video model: %+v", item)
	}
}

func TestAIMotionStickerHistoryIsOwnerScoped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	if logger.Log == nil {
		logger.Log = logrus.New()
	}
	db, err := gorm.Open(sqlite.Open("file:motion-sticker-handler?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previous })
	owned := model.AIMotionStickerGeneration{ID: 501, UserID: 11, ModelCatalogID: 21, Provider: "amux", Model: "seedance", Action: "跳", Prompt: "p", ReferenceURL: "owned", ReferenceStorageKey: "owned-key"}
	foreign := model.AIMotionStickerGeneration{ID: 502, UserID: 12, ModelCatalogID: 21, Provider: "amux", Model: "seedance", Action: "挥手", Prompt: "p", ReferenceURL: "foreign", ReferenceStorageKey: "foreign-key"}
	if err := db.Create(&[]model.AIMotionStickerGeneration{owned, foreign}).Error; err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("userId", int64(11)); c.Next() })
	router.GET("/ai/motion-stickers", ListAIMotionStickerGenerations)
	router.GET("/ai/motion-stickers/:generationId", GetAIMotionStickerGeneration)

	listRecorder := httptest.NewRecorder()
	router.ServeHTTP(listRecorder, httptest.NewRequest(http.MethodGet, "/ai/motion-stickers", nil))
	var listResponse struct {
		Code int `json:"code"`
		Data struct {
			Items []model.AIMotionStickerGeneration `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listResponse); err != nil {
		t.Fatal(err)
	}
	if listResponse.Code != 0 || len(listResponse.Data.Items) != 1 || listResponse.Data.Items[0].ID != owned.ID {
		t.Fatalf("owner list leaked data: %s", listRecorder.Body.String())
	}

	foreignRecorder := httptest.NewRecorder()
	router.ServeHTTP(foreignRecorder, httptest.NewRequest(http.MethodGet, "/ai/motion-stickers/502", nil))
	var foreignResponse Response
	if err := json.Unmarshal(foreignRecorder.Body.Bytes(), &foreignResponse); err != nil {
		t.Fatal(err)
	}
	if foreignResponse.Code != http.StatusNotFound {
		t.Fatalf("foreign generation should be hidden: %s", foreignRecorder.Body.String())
	}
}
