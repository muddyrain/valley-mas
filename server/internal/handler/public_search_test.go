package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type publicSearchResponse struct {
	Code int `json:"code"`
	Data struct {
		List []struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		} `json:"list"`
		Total int64 `json:"total"`
	} `json:"data"`
}

func setupPublicSearchRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dsn := fmt.Sprintf("file:public-search-%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Post{}, &model.Resource{}); err != nil {
		t.Fatalf("migrate public search models: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	invalidatePublicResourceListCache()
	t.Cleanup(func() {
		invalidatePublicResourceListCache()
		database.DB = previousDB
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	router := gin.New()
	router.GET("/posts", GetPosts)
	router.GET("/resources", GetAllResources)
	return router, db
}

func requestPublicSearch(t *testing.T, router *gin.Engine, path string) publicSearchResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", recorder.Code, recorder.Body.String())
	}
	var response publicSearchResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v\n%s", err, recorder.Body.String())
	}
	if response.Code != 0 {
		t.Fatalf("unexpected response code %d: %s", response.Code, recorder.Body.String())
	}
	return response
}

func seedPublicSearchUser(t *testing.T, db *gorm.DB) model.User {
	t.Helper()
	user := model.User{ID: 901, Username: "search-owner", Nickname: "搜索作者", Role: "user", IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func TestGetPostsKeywordSearchesPublicTitleExcerptAndContentOnly(t *testing.T) {
	router, db := setupPublicSearchRouter(t)
	user := seedPublicSearchUser(t, db)
	now := time.Now()
	posts := []model.Post{
		{ID: 1001, Title: "正文命中", Slug: "content-hit", Content: "正文包含星河工作流", Excerpt: "", AuthorID: user.ID, Status: "published", Visibility: "public", PostType: "blog", PublishedAt: &now},
		{ID: 1002, Title: "星河标题", Slug: "title-hit", Content: "其他正文", Excerpt: "", AuthorID: user.ID, Status: "published", Visibility: "public", PostType: "blog", PublishedAt: &now},
		{ID: 1003, Title: "摘要命中", Slug: "excerpt-hit", Content: "其他正文", Excerpt: "星河摘要", AuthorID: user.ID, Status: "published", Visibility: "public", PostType: "image_text", PublishedAt: &now},
		{ID: 1004, Title: "草稿", Slug: "draft-hidden", Content: "星河工作流", AuthorID: user.ID, Status: "draft", Visibility: "public", PostType: "blog"},
		{ID: 1005, Title: "私密", Slug: "private-hidden", Content: "星河工作流", AuthorID: user.ID, Status: "published", Visibility: "private", PostType: "blog", PublishedAt: &now},
		{ID: 1006, Title: "口令", Slug: "shared-hidden", Content: "星河工作流", AuthorID: user.ID, Status: "published", Visibility: "shared", PostType: "blog", PublishedAt: &now},
		{ID: 1007, Title: "已删除", Slug: "deleted-hidden", Content: "星河工作流", AuthorID: user.ID, Status: "published", Visibility: "public", PostType: "blog", PublishedAt: &now, DeletedAt: gorm.DeletedAt{Time: now, Valid: true}},
	}
	if err := db.Create(&posts).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}

	response := requestPublicSearch(t, router, "/posts?keyword=%E6%98%9F%E6%B2%B3&pageSize=20")
	if response.Data.Total != 3 {
		t.Fatalf("expected 3 safe matches, got %d (%+v)", response.Data.Total, response.Data.List)
	}

	typed := requestPublicSearch(t, router, "/posts?keyword=%E6%98%9F%E6%B2%B3&postType=image_text&pageSize=20")
	if typed.Data.Total != 1 {
		t.Fatalf("expected post type filter to remain active, got %d", typed.Data.Total)
	}
}

func TestGetAllResourcesKeywordSearchesPublicTitleDescriptionAndTagsOnly(t *testing.T) {
	router, db := setupPublicSearchRouter(t)
	user := seedPublicSearchUser(t, db)
	now := time.Now()
	resources := []model.Resource{
		{ID: 2001, UserID: user.ID, Title: "星河壁纸", Description: "", Type: "wallpaper", Visibility: "public", URL: "/title.png"},
		{ID: 2002, UserID: user.ID, Title: "描述命中", Description: "星河资源描述", Type: "avatar", Visibility: "public", URL: "/description.png"},
		{ID: 2003, UserID: user.ID, Title: "标签命中", Description: "", Tags: model.StringList{"星河", "蓝色"}, Type: "wallpaper", Visibility: "public", URL: "/tags.png"},
		{ID: 2004, UserID: user.ID, Title: "私密", Description: "星河", Type: "wallpaper", Visibility: "private", URL: "/private.png"},
		{ID: 2005, UserID: user.ID, Title: "口令", Description: "星河", Type: "wallpaper", Visibility: "shared", URL: "/shared.png"},
		{ID: 2006, UserID: user.ID, Title: "已删除", Description: "星河", Type: "wallpaper", Visibility: "public", URL: "/deleted.png", DeletedAt: gorm.DeletedAt{Time: now, Valid: true}},
	}
	if err := db.Create(&resources).Error; err != nil {
		t.Fatalf("seed resources: %v", err)
	}

	response := requestPublicSearch(t, router, "/resources?keyword=%E6%98%9F%E6%B2%B3&pageSize=20")
	if response.Data.Total != 3 {
		t.Fatalf("expected 3 safe matches, got %d (%+v)", response.Data.Total, response.Data.List)
	}

	typed := requestPublicSearch(t, router, "/resources?keyword=%E6%98%9F%E6%B2%B3&type=avatar&pageSize=20")
	if typed.Data.Total != 1 {
		t.Fatalf("expected type filter to remain active, got %d", typed.Data.Total)
	}
}
