package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/service/articlepackage"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type articlePackageHandlerStore struct {
	downloadURL string
	signGetErr  error
}

func (s *articlePackageHandlerStore) SignPut(context.Context, string, time.Duration) (articlepackage.UploadTicket, error) {
	return articlepackage.UploadTicket{}, errors.New("not implemented")
}
func (s *articlePackageHandlerStore) Head(context.Context, string) (articlepackage.ObjectInfo, error) {
	return articlepackage.ObjectInfo{}, errors.New("not implemented")
}
func (s *articlePackageHandlerStore) ReadRange(context.Context, string, string, int64, int64) ([]byte, error) {
	return nil, errors.New("not implemented")
}
func (s *articlePackageHandlerStore) Copy(context.Context, string, string, string) (string, error) {
	return "copied-etag", nil
}
func (s *articlePackageHandlerStore) Delete(context.Context, string) error { return nil }
func (s *articlePackageHandlerStore) SignGet(context.Context, string, time.Duration, string) (string, error) {
	return s.downloadURL, s.signGetErr
}

func setupArticlePackageHandlerTest(t *testing.T) (*gin.Engine, *gorm.DB, *articlePackageHandlerStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("DISABLE_FILE_LOG", "1")
	logger.InitLogger()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Post{}, &model.ArticlePackage{}); err != nil {
		t.Fatal(err)
	}
	previousDB := database.DB
	database.DB = db
	store := &articlePackageHandlerStore{downloadURL: "https://download.invalid/signed"}
	previousFactory := articlePackageServiceFactory
	articlePackageServiceFactory = func() *articlepackage.Service { return articlepackage.NewService(db, store) }
	t.Cleanup(func() {
		database.DB = previousDB
		articlePackageServiceFactory = previousFactory
	})
	router := gin.New()
	router.GET("/posts/:id/package", GetPublicArticlePackage)
	router.POST("/posts/:id/package/download", DownloadPublicArticlePackage)
	owner := router.Group("/admin")
	owner.Use(func(c *gin.Context) {
		c.Set("userId", int64(42))
		c.Set("userRole", "user")
	})
	owner.PUT("/posts/:id/package", AdminUpdatePostArticlePackage)
	owner.PUT("/posts/:id", AdminUpdatePost)
	return router, db, store
}

func seedArticlePackagePost(t *testing.T, db *gorm.DB, status, visibility string) model.Post {
	t.Helper()
	manifestJSON, err := articlepackage.EncodeManifest(articlepackage.Manifest{
		EntryCount: 1, ExpandedSize: 2, DefaultPath: "README.md",
		Entries: []articlepackage.ManifestEntry{{Path: "README.md", PreviewKind: articlepackage.PreviewMarkdown, UncompressedSize: 2}},
	})
	if err != nil {
		t.Fatal(err)
	}
	packageRow := model.ArticlePackage{
		ID: 501, OwnerID: 42, PostID: pointerToID(601), Status: articlepackage.StatusBound,
		StorageKey: "article-packages/posts/601/501.zip", OriginalName: "源码.zip", Size: 100,
		EntryCount: 1, ExpandedSize: 2, ManifestJSON: manifestJSON,
	}
	if err := db.Create(&packageRow).Error; err != nil {
		t.Fatal(err)
	}
	packageID := packageRow.ID
	post := model.Post{
		ID: 601, Title: "测试文章", Slug: "601", Content: "正文", AuthorID: 42,
		Status: status, Visibility: visibility, ArticlePackageID: &packageID,
	}
	if err := db.Create(&post).Error; err != nil {
		t.Fatal(err)
	}
	return post
}

func pointerToID(value model.Int64String) *model.Int64String { return &value }

func articlePackageResponseCode(t *testing.T, response *httptest.ResponseRecorder) int {
	t.Helper()
	var payload struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v body=%s", err, response.Body.String())
	}
	return payload.Code
}

func TestPublicArticlePackageInheritsPublishedArticleAccess(t *testing.T) {
	router, db, _ := setupArticlePackageHandlerTest(t)
	seedArticlePackagePost(t, db, "published", visibilityPublic)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/posts/601/package", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("public package status = %d body=%s", response.Code, response.Body.String())
	}
	var payload struct {
		Data struct {
			OriginalName string `json:"originalName"`
		} `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.Data.OriginalName != "源码.zip" {
		t.Fatalf("payload = %+v, %v", payload, err)
	}
}

func TestPublicArticlePackageHidesDraftAndPrivateArticles(t *testing.T) {
	for _, test := range []struct {
		status     string
		visibility string
	}{
		{status: "draft", visibility: visibilityPublic},
		{status: "published", visibility: visibilityPrivate},
	} {
		router, db, _ := setupArticlePackageHandlerTest(t)
		seedArticlePackagePost(t, db, test.status, test.visibility)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/posts/601/package", nil))
		if code := articlePackageResponseCode(t, response); code != http.StatusNotFound {
			t.Fatalf("status=%s visibility=%s got code=%d", test.status, test.visibility, code)
		}
	}
}

func TestDownloadCountChangesOnlyAfterSignedURLIssuance(t *testing.T) {
	router, db, store := setupArticlePackageHandlerTest(t)
	seedArticlePackagePost(t, db, "published", visibilityPublic)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/posts/601/package/download", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("download status = %d body=%s", response.Code, response.Body.String())
	}
	var post model.Post
	if err := db.First(&post, 601).Error; err != nil || post.PackageDownloadCount != 1 {
		t.Fatalf("download count = %d err=%v", post.PackageDownloadCount, err)
	}

	store.signGetErr = errors.New("sign failed")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/posts/601/package/download", nil))
	if code := articlePackageResponseCode(t, response); code != http.StatusNotFound {
		t.Fatalf("failed download code = %d", code)
	}
	if err := db.First(&post, 601).Error; err != nil || post.PackageDownloadCount != 1 {
		t.Fatalf("failed signing changed count to %d err=%v", post.PackageDownloadCount, err)
	}
}

func TestPublishedPackageReplacementSwitchesOnlyOnRepublish(t *testing.T) {
	router, db, _ := setupArticlePackageHandlerTest(t)
	post := seedArticlePackagePost(t, db, "published", visibilityPublic)
	manifestJSON, err := articlepackage.EncodeManifest(articlepackage.Manifest{})
	if err != nil {
		t.Fatal(err)
	}
	expiresAt := time.Now().Add(time.Hour)
	newPackage := model.ArticlePackage{
		ID: 502, OwnerID: post.AuthorID, Status: articlepackage.StatusReady,
		StorageKey: "article-packages/temp/42/502.zip", OriginalName: "新版.zip", Size: 100,
		ETag: "new-etag", ManifestJSON: manifestJSON, ExpiresAt: &expiresAt,
	}
	if err := db.Create(&newPackage).Error; err != nil {
		t.Fatal(err)
	}

	replace := httptest.NewRecorder()
	replaceRequest := httptest.NewRequest(
		http.MethodPut, "/admin/posts/601/package",
		bytes.NewBufferString(`{"action":"replace","packageId":"502"}`),
	)
	replaceRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(replace, replaceRequest)
	if code := articlePackageResponseCode(t, replace); code != 0 {
		t.Fatalf("replace code=%d body=%s", code, replace.Body.String())
	}
	var saved model.Post
	if err := db.First(&saved, post.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.ArticlePackageID == nil || *saved.ArticlePackageID != 501 {
		t.Fatalf("draft replacement changed public pointer: %v", saved.ArticlePackageID)
	}
	draft := parsePostDraftPayload(saved.DraftData)
	if draft == nil || draft.ArticlePackageAction != "replace" || draft.ArticlePackageID == nil || *draft.ArticlePackageID != 502 {
		t.Fatalf("draft package intent = %+v", draft)
	}

	publish := httptest.NewRecorder()
	publishRequest := httptest.NewRequest(http.MethodPut, "/admin/posts/601", bytes.NewBufferString(`{"status":"published"}`))
	publishRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(publish, publishRequest)
	if code := articlePackageResponseCode(t, publish); code != 0 {
		t.Fatalf("publish code=%d body=%s", code, publish.Body.String())
	}
	if err := db.First(&saved, post.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.ArticlePackageID == nil || *saved.ArticlePackageID != 502 || saved.DraftData != "" {
		t.Fatalf("published package pointer = %v draft=%q", saved.ArticlePackageID, saved.DraftData)
	}
	var oldPackage model.ArticlePackage
	if err := db.First(&oldPackage, 501).Error; err != nil || oldPackage.Status != articlepackage.StatusDeleted || oldPackage.DeleteAfter == nil {
		t.Fatalf("old package cleanup state = %+v err=%v", oldPackage, err)
	}
}

func TestDraftPackageReplacementSchedulesPreviousPackageCleanup(t *testing.T) {
	router, db, _ := setupArticlePackageHandlerTest(t)
	post := seedArticlePackagePost(t, db, "draft", visibilityPrivate)
	manifestJSON, err := articlepackage.EncodeManifest(articlepackage.Manifest{})
	if err != nil {
		t.Fatal(err)
	}
	expiresAt := time.Now().Add(time.Hour)
	newPackage := model.ArticlePackage{
		ID: 502, OwnerID: post.AuthorID, Status: articlepackage.StatusReady,
		StorageKey: "article-packages/temp/42/502.zip", OriginalName: "新版.zip", Size: 100,
		ETag: "new-etag", ManifestJSON: manifestJSON, ExpiresAt: &expiresAt,
	}
	if err := db.Create(&newPackage).Error; err != nil {
		t.Fatal(err)
	}

	replace := httptest.NewRecorder()
	replaceRequest := httptest.NewRequest(
		http.MethodPut, "/admin/posts/601/package",
		bytes.NewBufferString(`{"action":"replace","packageId":"502"}`),
	)
	replaceRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(replace, replaceRequest)
	if code := articlePackageResponseCode(t, replace); code != 0 {
		t.Fatalf("replace code=%d body=%s", code, replace.Body.String())
	}

	var saved model.Post
	if err := db.First(&saved, post.ID).Error; err != nil || saved.ArticlePackageID == nil || *saved.ArticlePackageID != 502 {
		t.Fatalf("draft package pointer = %v err=%v", saved.ArticlePackageID, err)
	}
	var oldPackage model.ArticlePackage
	if err := db.First(&oldPackage, 501).Error; err != nil || oldPackage.Status != articlepackage.StatusDeleted || oldPackage.DeleteAfter == nil {
		t.Fatalf("old draft package cleanup state = %+v err=%v", oldPackage, err)
	}
}
