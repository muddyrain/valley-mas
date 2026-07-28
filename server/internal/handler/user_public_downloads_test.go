package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestGetMyDownloadsIncludesResourceCreator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Resource{}, &model.DownloadRecord{}); err != nil {
		t.Fatal(err)
	}
	downloader := model.User{ID: 101, Username: "downloader", Role: "user", IsActive: true}
	creator := model.User{ID: 202, Username: "creator", Nickname: "创作者", Avatar: "https://example.com/avatar.png", Role: "user", IsActive: true}
	resource := model.Resource{ID: 301, UserID: creator.ID, Title: "资源", URL: "https://example.com/resource.png", Type: "wallpaper", Visibility: "public"}
	record := model.DownloadRecord{ID: 401, UserID: downloader.ID, ResourceID: resource.ID}
	if err := db.Create(&[]model.User{downloader, creator}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&record).Error; err != nil {
		t.Fatal(err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	router := gin.New()
	router.GET("/user/downloads", func(c *gin.Context) {
		c.Set("userId", int64(downloader.ID))
		GetMyDownloads(c)
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/user/downloads", nil))

	var response struct {
		Code int `json:"code"`
		Data struct {
			List []struct {
				Resource struct {
					User struct {
						Nickname string `json:"nickname"`
						Avatar   string `json:"avatar"`
					} `json:"user"`
				} `json:"resource"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Code != 0 || len(response.Data.List) != 1 {
		t.Fatalf("unexpected response: %s", recorder.Body.String())
	}
	creatorPayload := response.Data.List[0].Resource.User
	if creatorPayload.Nickname != creator.Nickname || creatorPayload.Avatar != creator.Avatar {
		t.Fatalf("creator payload=%+v", creatorPayload)
	}
}
