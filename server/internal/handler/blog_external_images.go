package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type externalCoverAttribution struct {
	Name       string `json:"name"`
	ProfileURL string `json:"profileUrl,omitempty"`
	Provider   string `json:"provider"`
}

type externalCoverImage struct {
	ID               string                   `json:"id"`
	ThumbnailURL     string                   `json:"thumbnailUrl"`
	PreviewURL       string                   `json:"previewUrl"`
	FullURL          string                   `json:"fullUrl"`
	DownloadLocation string                   `json:"downloadLocation,omitempty"`
	Width            int                      `json:"width"`
	Height           int                      `json:"height"`
	Attribution      externalCoverAttribution `json:"attribution"`
}

type externalImagesSearchResponse struct {
	List     []externalCoverImage `json:"list"`
	Total    int                  `json:"total"`
	Page     int                  `json:"page"`
	PerPage  int                  `json:"perPage"`
	Provider string               `json:"provider"`
}

// AdminSearchExternalCoverImages 代理外部图源搜索（Unsplash / Pexels）。
// GET /admin/blog/external-images/search?provider=unsplash&query=&page=&perPage=
func AdminSearchExternalCoverImages(c *gin.Context) {
	_, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	provider := strings.ToLower(strings.TrimSpace(c.Query("provider")))
	query := strings.TrimSpace(c.Query("query"))
	if query == "" {
		Error(c, http.StatusBadRequest, "query cannot be empty")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.DefaultQuery("perPage", "20"))
	if perPage < 1 || perPage > 30 {
		perPage = 20
	}

	timeoutSeconds := externalImagesTimeoutSeconds()
	httpClient := &http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second}

	switch provider {
	case "unsplash":
		resp, status, err := searchUnsplash(httpClient, query, page, perPage)
		writeExternalSearchResult(c, resp, status, err)
	case "pexels":
		resp, status, err := searchPexels(httpClient, query, page, perPage)
		writeExternalSearchResult(c, resp, status, err)
	default:
		Error(c, http.StatusBadRequest, "unsupported provider: "+provider)
	}
}

func writeExternalSearchResult(c *gin.Context, resp *externalImagesSearchResponse, status int, err error) {
	if err != nil {
		Error(c, status, err.Error())
		return
	}
	Success(c, resp)
}

// ---------------- Unsplash ----------------

type unsplashSearchResponse struct {
	Total      int              `json:"total"`
	TotalPages int              `json:"total_pages"`
	Results    []unsplashResult `json:"results"`
	Errors     []string         `json:"errors,omitempty"`
}

type unsplashResult struct {
	ID    string             `json:"id"`
	Width int                `json:"width"`
	Height int               `json:"height"`
	URLs  unsplashResultURLs `json:"urls"`
	Links unsplashResultLinks `json:"links"`
	User  unsplashResultUser `json:"user"`
}

type unsplashResultURLs struct {
	Raw     string `json:"raw"`
	Full    string `json:"full"`
	Regular string `json:"regular"`
	Small   string `json:"small"`
	Thumb   string `json:"thumb"`
}

type unsplashResultLinks struct {
	Download         string `json:"download"`
	DownloadLocation string `json:"download_location"`
}

type unsplashResultUser struct {
	Name  string             `json:"name"`
	Links unsplashUserLinks  `json:"links"`
}

type unsplashUserLinks struct {
	HTML string `json:"html"`
}

func searchUnsplash(httpClient *http.Client, query string, page, perPage int) (*externalImagesSearchResponse, int, error) {
	accessKey := strings.TrimSpace(os.Getenv("UNSPLASH_ACCESS_KEY"))
	if accessKey == "" {
		return nil, http.StatusServiceUnavailable, fmt.Errorf("unsplash is not configured")
	}
	u, _ := url.Parse("https://api.unsplash.com/search/photos")
	q := u.Query()
	q.Set("query", query)
	q.Set("page", strconv.Itoa(page))
	q.Set("per_page", strconv.Itoa(perPage))
	q.Set("orientation", "landscape")
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest(http.MethodGet, u.String(), nil)
	req.Header.Set("Authorization", "Client-ID "+accessKey)
	req.Header.Set("Accept-Version", "v1")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("unsplash request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, http.StatusBadGateway, fmt.Errorf("unsplash upstream %d", resp.StatusCode)
	}

	var parsed unsplashSearchResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("unsplash response invalid: %w", err)
	}

	list := make([]externalCoverImage, 0, len(parsed.Results))
	for _, item := range parsed.Results {
		full := item.URLs.Full
		if full == "" {
			full = item.URLs.Regular
		}
		if full == "" {
			continue
		}
		list = append(list, externalCoverImage{
			ID:               item.ID,
			ThumbnailURL:     item.URLs.Thumb,
			PreviewURL:       item.URLs.Small,
			FullURL:          full,
			DownloadLocation: item.Links.DownloadLocation,
			Width:            item.Width,
			Height:           item.Height,
			Attribution: externalCoverAttribution{
				Name:       item.User.Name,
				ProfileURL: item.User.Links.HTML,
				Provider:   "unsplash",
			},
		})
	}
	return &externalImagesSearchResponse{
		List:     list,
		Total:    parsed.Total,
		Page:     page,
		PerPage:  perPage,
		Provider: "unsplash",
	}, http.StatusOK, nil
}

// ---------------- Pexels ----------------

type pexelsSearchResponse struct {
	TotalResults int           `json:"total_results"`
	Page         int           `json:"page"`
	PerPage      int           `json:"per_page"`
	Photos       []pexelsPhoto `json:"photos"`
}

type pexelsPhoto struct {
	ID              int64      `json:"id"`
	Width           int        `json:"width"`
	Height          int        `json:"height"`
	URL             string     `json:"url"`
	Photographer    string     `json:"photographer"`
	PhotographerURL string     `json:"photographer_url"`
	Src             pexelsSrc  `json:"src"`
}

type pexelsSrc struct {
	Original  string `json:"original"`
	Large2x   string `json:"large2x"`
	Large     string `json:"large"`
	Medium    string `json:"medium"`
	Small     string `json:"small"`
	Portrait  string `json:"portrait"`
	Landscape string `json:"landscape"`
	Tiny      string `json:"tiny"`
}

func searchPexels(httpClient *http.Client, query string, page, perPage int) (*externalImagesSearchResponse, int, error) {
	apiKey := strings.TrimSpace(os.Getenv("PEXELS_API_KEY"))
	if apiKey == "" {
		return nil, http.StatusServiceUnavailable, fmt.Errorf("pexels is not configured")
	}
	u, _ := url.Parse("https://api.pexels.com/v1/search")
	q := u.Query()
	q.Set("query", query)
	q.Set("page", strconv.Itoa(page))
	q.Set("per_page", strconv.Itoa(perPage))
	q.Set("orientation", "landscape")
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest(http.MethodGet, u.String(), nil)
	req.Header.Set("Authorization", apiKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("pexels request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, http.StatusBadGateway, fmt.Errorf("pexels upstream %d", resp.StatusCode)
	}

	var parsed pexelsSearchResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("pexels response invalid: %w", err)
	}

	list := make([]externalCoverImage, 0, len(parsed.Photos))
	for _, item := range parsed.Photos {
		full := item.Src.Large2x
		if full == "" {
			full = item.Src.Large
		}
		if full == "" {
			full = item.Src.Original
		}
		if full == "" {
			continue
		}
		list = append(list, externalCoverImage{
			ID:           strconv.FormatInt(item.ID, 10),
			ThumbnailURL: item.Src.Tiny,
			PreviewURL:   item.Src.Medium,
			FullURL:      full,
			Width:        item.Width,
			Height:       item.Height,
			Attribution: externalCoverAttribution{
				Name:       item.Photographer,
				ProfileURL: item.PhotographerURL,
				Provider:   "pexels",
			},
		})
	}
	return &externalImagesSearchResponse{
		List:     list,
		Total:    parsed.TotalResults,
		Page:     page,
		PerPage:  perPage,
		Provider: "pexels",
	}, http.StatusOK, nil
}

// ---------------- Unsplash trigger-download ----------------

type unsplashTriggerDownloadRequest struct {
	DownloadLocation string `json:"downloadLocation" binding:"required"`
}

// AdminTriggerUnsplashDownload 满足 Unsplash TOS 的 download tracking 要求。
// POST /admin/blog/external-images/unsplash/trigger-download
func AdminTriggerUnsplashDownload(c *gin.Context) {
	_, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req unsplashTriggerDownloadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	loc := strings.TrimSpace(req.DownloadLocation)
	parsed, err := url.Parse(loc)
	if err != nil || parsed == nil || parsed.Scheme != "https" || !strings.HasSuffix(strings.ToLower(parsed.Host), "unsplash.com") {
		Error(c, http.StatusBadRequest, "invalid unsplash download location")
		return
	}

	accessKey := strings.TrimSpace(os.Getenv("UNSPLASH_ACCESS_KEY"))
	if accessKey == "" {
		Error(c, http.StatusServiceUnavailable, "unsplash is not configured")
		return
	}

	timeoutSeconds := externalImagesTimeoutSeconds()
	httpClient := &http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second}
	httpReq, _ := http.NewRequest(http.MethodGet, parsed.String(), nil)
	httpReq.Header.Set("Authorization", "Client-ID "+accessKey)
	httpReq.Header.Set("Accept-Version", "v1")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		Error(c, http.StatusBadGateway, "unsplash trigger download failed: "+err.Error())
		return
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		Error(c, http.StatusBadGateway, fmt.Sprintf("unsplash upstream %d", resp.StatusCode))
		return
	}

	Success(c, gin.H{"ok": true})
}

func externalImagesTimeoutSeconds() int {
	raw := strings.TrimSpace(os.Getenv("EXTERNAL_IMAGES_TIMEOUT_SECONDS"))
	if raw == "" {
		return 8
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return 8
	}
	return v
}
