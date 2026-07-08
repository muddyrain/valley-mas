package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/lifetrace/ai"
	"valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	workflowStepParse   = "parse"
	workflowStepExcerpt = "excerpt"
	workflowStepCover   = "cover"
	workflowStepTags    = "tags"
	workflowStepCreate  = "create"
)

type workflowSSEEvent struct {
	Step    string          `json:"step"`
	Status  string          `json:"status"`
	Message string          `json:"message,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
	PostID  string          `json:"postId,omitempty"`
}

type workflowParseData struct {
	Title   string   `json:"title"`
	Excerpt string   `json:"excerpt,omitempty"`
	Cover   string   `json:"cover,omitempty"`
	Tags    []string `json:"tags,omitempty"`
	Content string   `json:"content"`
}

type workflowExcerptData struct {
	Excerpt string `json:"excerpt"`
	Model   string `json:"model,omitempty"`
}

type workflowCoverData struct {
	CoverURL        string `json:"coverUrl,omitempty"`
	CoverStorageKey string `json:"coverStorageKey,omitempty"`
	CoverSource     string `json:"coverSource"`
	Model           string `json:"model,omitempty"`
}

type workflowTagsData struct {
	TagNames []string `json:"tagNames"`
	TagIDs   []string `json:"tagIds"`
	Model    string   `json:"model,omitempty"`
}

type workflowCreateData struct {
	PostID string `json:"postId"`
}

func sendWorkflowEvent(c *gin.Context, evt workflowSSEEvent) {
	b, _ := json.Marshal(evt)
	_, _ = c.Writer.Write([]byte("data: "))
	_, _ = c.Writer.Write(b)
	_, _ = c.Writer.Write([]byte("\n\n"))
	c.Writer.(http.Flusher).Flush()
}

func sendWorkflowEventf(c *gin.Context, step, status, message string) {
	sendWorkflowEvent(c, workflowSSEEvent{Step: step, Status: status, Message: message})
}

func sendWorkflowEventData(c *gin.Context, step, status, message string, data interface{}) {
	raw, _ := json.Marshal(data)
	sendWorkflowEvent(c, workflowSSEEvent{Step: step, Status: status, Message: message, Data: raw})
}

func sendWorkflowError(c *gin.Context, step, message string) {
	sendWorkflowEvent(c, workflowSSEEvent{Step: step, Status: "error", Message: message})
}

// AdminBlogWorkflowImport runs the blog publishing pipeline on an uploaded MD file.
// POST /admin/blog/workflow/import
func AdminBlogWorkflowImport(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "user" {
		Error(c, http.StatusForbidden, "登录后即可操作")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		Error(c, http.StatusBadRequest, "please upload a markdown file")
		return
	}

	ext := strings.ToLower(file.Filename)
	if !strings.HasSuffix(ext, ".md") && !strings.HasSuffix(ext, ".markdown") {
		Error(c, http.StatusBadRequest, "only .md and .markdown files are supported")
		return
	}

	if file.Size > 5*1024*1024 {
		Error(c, http.StatusBadRequest, "file too large, max 5MB")
		return
	}

	fileBytes, err := file.Open()
	if err != nil {
		Error(c, http.StatusInternalServerError, "failed to read file")
		return
	}
	defer fileBytes.Close()

	buf := make([]byte, file.Size)
	if _, err := fileBytes.Read(buf); err != nil {
		Error(c, http.StatusInternalServerError, "failed to read file content")
		return
	}

	groupIDStr := c.PostForm("groupId")
	var groupID model.Int64String
	if groupIDStr != "" {
		var gid int64
		fmt.Sscanf(groupIDStr, "%d", &gid)
		groupID = model.Int64String(gid)
	}

	visibility := c.PostForm("visibility")
	if visibility == "" {
		visibility = "private"
	}

	excludedCoverIDsStr := c.PostForm("excludedCoverIds")
	var excludedCoverIDs []string
	if excludedCoverIDsStr != "" {
		excludedCoverIDs = strings.Split(excludedCoverIDsStr, ",")
	}

	// Set SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	runBlogWorkflow(c, userID, role, file.Filename, buf, groupID, visibility, excludedCoverIDs)
}

// AdminBlogWorkflowPublish publishes a draft blog post created by the workflow.
// POST /admin/blog/workflow/:id/publish
func AdminBlogWorkflowPublish(c *gin.Context) {
	_, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "user" {
		Error(c, http.StatusForbidden, "登录后即可操作")
		return
	}

	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "invalid post id")
		return
	}

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	if post.Status != "draft" {
		Error(c, http.StatusBadRequest, "only draft posts can be published via workflow")
		return
	}

	if !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusForbidden, "no permission")
		return
	}

	now := time.Now()
	post.Status = "published"
	post.PublishedAt = &now

	if err := database.DB.Save(&post).Error; err != nil {
		Error(c, http.StatusInternalServerError, "publish failed")
		return
	}

	Success(c, gin.H{
		"postId": post.ID,
		"status": post.Status,
	})
}

func runBlogWorkflow(
	c *gin.Context,
	userID int64,
	role string,
	fileName string,
	fileContent []byte,
	groupID model.Int64String,
	visibility string,
	excludedCoverIDs []string,
) {
	// Step 1: Parse MD
	sendWorkflowEventf(c, workflowStepParse, "running", "解析 Markdown...")
	parsed, err := utils.ParseFrontMatter(fileContent)
	if err != nil {
		sendWorkflowError(c, workflowStepParse, "Markdown 解析失败: "+err.Error())
		sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
		return
	}

	title := parsed.FrontMatter.Title
	if title == "" {
		title = utils.InferTitleFromHeading(parsed.Content)
	}
	if title == "" {
		title = strings.TrimSuffix(fileName, ".md")
		title = strings.TrimSuffix(title, ".markdown")
	}

	content := strings.TrimSpace(parsed.Content)
	if content == "" {
		sendWorkflowError(c, workflowStepParse, "Markdown 内容为空")
		sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
		return
	}

	contentPreview := content
	if len(contentPreview) > 500 {
		contentPreview = contentPreview[:500] + "..."
	}
	sendWorkflowEventData(c, workflowStepParse, "success", "解析完成", workflowParseData{
		Title:   title,
		Excerpt: parsed.FrontMatter.Excerpt,
		Cover:   parsed.FrontMatter.Cover,
		Tags:    parsed.FrontMatter.Tags,
		Content: contentPreview,
	})

	// Step 2: AI Generate Excerpt
	excerpt := parsed.FrontMatter.Excerpt
	if excerpt == "" {
		sendWorkflowEventf(c, workflowStepExcerpt, "running", "AI 生成摘要...")
		generatedExcerpt, excerptModel, excerptErr := generateBlogExcerptInternal(title, content)
		if excerptErr != nil {
			sendWorkflowError(c, workflowStepExcerpt, "AI 摘要生成失败: "+excerptErr.Error())
		} else {
			excerpt = generatedExcerpt
			sendWorkflowEventData(c, workflowStepExcerpt, "success", "摘要生成完成", workflowExcerptData{
				Excerpt: excerpt,
				Model:   excerptModel,
			})
		}
	} else {
		sendWorkflowEventf(c, workflowStepExcerpt, "skipped", "Front matter 已有摘要")
	}

	// Step 3: AI Cover
	var coverURL string
	var coverStorageKey string
	coverSource := "none"

	if parsed.FrontMatter.Cover != "" {
		coverURL = parsed.FrontMatter.Cover
		coverSource = "front_matter"
		sendWorkflowEventData(c, workflowStepCover, "skipped", "Front matter 已有封面", workflowCoverData{
			CoverURL:    coverURL,
			CoverSource: coverSource,
		})
	} else {
		sendWorkflowEventf(c, workflowStepCover, "running", "AI 匹配封面...")

		// 3a: Try pick from resources
		keywords, _ := extractBlogCoverKeywords(blogAIPickCoverRequest{
			Title:   title,
			Excerpt: excerpt,
			Content: content,
		})
		resource, pickErr := pickBlogCoverResource(database.DB, keywords, excludedCoverIDs, blogCoverPickModeKeywords)

		if pickErr == nil && resource != nil {
			coverURL = resource.URL
			coverSource = "resource_pick"
			sendWorkflowEventData(c, workflowStepCover, "success", "从资源池匹配到封面", workflowCoverData{
				CoverURL:    coverURL,
				CoverSource: coverSource,
			})
		} else {
			// 3b: Try AI generate
			sendWorkflowEventf(c, workflowStepCover, "running", "AI 生成封面...")
			generatedURL, generatedKey, genModel, genErr := generateBlogCoverInternal(title, excerpt, content, userID)
			if genErr != nil {
				sendWorkflowError(c, workflowStepCover, "封面生成失败: "+genErr.Error())
			} else {
				coverURL = generatedURL
				coverStorageKey = generatedKey
				coverSource = "ai_generate"
				sendWorkflowEventData(c, workflowStepCover, "success", "封面生成完成", workflowCoverData{
					CoverURL:        coverURL,
					CoverStorageKey: coverStorageKey,
					CoverSource:     coverSource,
					Model:           genModel,
				})
			}
		}
	}

	// Step 4: AI Tags
	var tagIDs []model.Int64String
	var tagNames []string
	var tagModel string

	sendWorkflowEventf(c, workflowStepTags, "running", "AI 推荐标签...")

	cfg, cfgErrMsg := ai.ReadTextConfig(30 * time.Second)
	if cfgErrMsg == "" {
		client := ai.NewClient()
		input := prompts.BlogTagSuggestInput{
			Title:   title,
			Excerpt: excerpt,
			Content: truncateAIText(content, 2000),
		}
		output, _, suggestErr := prompts.BlogTagSuggestContract.Generate(c.Request.Context(), client, cfg, input)
		if suggestErr == nil && len(output.Tags) > 0 {
			tagNames = output.Tags
			tagModel = cfg.Model
		}
	}

	if len(tagNames) > 0 {
		tagIDs = matchOrCreateTagIDs(database.DB, tagNames)
	}

	if len(tagIDs) > 0 {
		var idStrs []string
		for _, id := range tagIDs {
			idStrs = append(idStrs, id.String())
		}
		sendWorkflowEventData(c, workflowStepTags, "success", "标签推荐完成", workflowTagsData{
			TagNames: tagNames,
			TagIDs:   idStrs,
			Model:    tagModel,
		})
	} else {
		sendWorkflowEventf(c, workflowStepTags, "success", "未推荐标签")
	}

	// Step 5: Create Draft Post
	sendWorkflowEventf(c, workflowStepCreate, "running", "创建草稿文章...")

	categoryID, catErr := getOrCreateFallbackCategoryID()
	if catErr != nil {
		sendWorkflowError(c, workflowStepCreate, "分类获取失败: "+catErr.Error())
		sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
		return
	}

	postID := model.Int64String(utils.GenerateID())
	postType := postTypeBlog

	post := model.Post{
		ID:              postID,
		Title:           title,
		Slug:            postID.String(),
		PostType:        postType,
		Visibility:      normalizeVisibility(visibility),
		Content:         content,
		HTMLContent:     renderMarkdown(content),
		Excerpt:         excerpt,
		Cover:           coverURL,
		CoverStorageKey: strings.TrimSpace(coverStorageKey),
		AuthorID:        model.Int64String(userID),
		GroupID:         groupID,
		CategoryID:      categoryID,
		Status:          "draft",
		ImageTextData:   "{}",
		TemplateData:    "{}",
	}

	if groupID != 0 {
		if _, err := loadWritableGroupForPostType(c, groupID, postType, userID, role); err != nil {
			sendWorkflowError(c, workflowStepCreate, "分组不存在或无权限")
			sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
			return
		}
	}

	nextSortOrder, sortErr := getNextPostSortOrder(postType)
	if sortErr != nil {
		sendWorkflowError(c, workflowStepCreate, "排序获取失败")
		sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
		return
	}
	post.SortOrder = nextSortOrder

	if groupID != 0 {
		nextGroupSortOrder, gSortErr := getNextPostGroupSortOrder(postType, groupID)
		if gSortErr != nil {
			sendWorkflowError(c, workflowStepCreate, "分组排序获取失败")
			sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
			return
		}
		post.GroupSortOrder = nextGroupSortOrder
	}

	if err := database.DB.Create(&post).Error; err != nil {
		if coverStorageKey != "" {
			_ = service.NewUploadService().DeleteByKey(coverStorageKey)
		}
		sendWorkflowError(c, workflowStepCreate, "文章创建失败: "+err.Error())
		sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done"})
		return
	}

	// Create tag relations
	if len(tagIDs) > 0 {
		for _, tagID := range tagIDs {
			relation := model.PostTagRelation{PostID: post.ID, TagID: tagID}
			database.DB.Create(&relation)
		}
		database.DB.Model(&model.PostTag{}).
			Where("id IN ?", tagIDs).
			UpdateColumn("post_count", gorm.Expr("post_count + 1"))
	}

	// Update group post count
	if groupID != 0 {
		database.DB.Model(&model.PostGroup{}).
			Where("id = ?", int64(groupID)).
			UpdateColumn("post_count", gorm.Expr("post_count + 1"))
	}

	sendWorkflowEventData(c, workflowStepCreate, "success", "草稿创建完成", workflowCreateData{
		PostID: post.ID.String(),
	})

	// Done
	sendWorkflowEvent(c, workflowSSEEvent{Step: "", Status: "done", PostID: post.ID.String()})
}

func matchOrCreateTagIDs(db *gorm.DB, tagNames []string) []model.Int64String {
	var tagIDs []model.Int64String
	for _, name := range tagNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var tag model.PostTag
		err := db.Where("name = ? AND deleted_at IS NULL", name).First(&tag).Error
		if err != nil {
			// Create new tag
			tag = model.PostTag{
				Name: name,
				Slug: fmt.Sprintf("%d", utils.GenerateID()),
			}
			if err := db.Create(&tag).Error; err != nil {
				logrus.WithField("tag", name).WithError(err).Warn("failed to create tag")
				continue
			}
		}
		tagIDs = append(tagIDs, tag.ID)
	}
	return tagIDs
}

func parsePathInt64(c *gin.Context, param string) (int64, error) {
	s := c.Param(param)
	var id int64
	_, err := fmt.Sscanf(s, "%d", &id)
	return id, err
}
