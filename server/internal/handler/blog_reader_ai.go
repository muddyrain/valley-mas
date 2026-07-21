package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type blogReaderGuideResponse struct {
	Guide      string   `json:"guide"`
	Highlights []string `json:"highlights"`
	Path       string   `json:"path"`
	Model      string   `json:"model,omitempty"`
}

type blogAskRequest struct {
	Question string `json:"question" binding:"required"`
	Stream   bool   `json:"stream"`
	ModelID  string `json:"modelId" binding:"required"`
}

type blogAskCitation struct {
	Heading string `json:"heading"`
	Quote   string `json:"quote"`
}

type blogAskResponse struct {
	Answer    string            `json:"answer"`
	Citations []blogAskCitation `json:"citations,omitempty"`
	Model     string            `json:"model,omitempty"`
}

type blogAskStreamChunk struct {
	Chunk string `json:"chunk,omitempty"`
	Done  bool   `json:"done,omitempty"`
	Model string `json:"model,omitempty"`
	Error string `json:"error,omitempty"`
}

type blogRecommendRequest struct {
	Prompt  string `json:"prompt" binding:"required"`
	GroupID string `json:"groupId"`
	Keyword string `json:"keyword"`
	Sort    string `json:"sort"`
	ModelID string `json:"modelId" binding:"required"`
}

type blogRecommendItem struct {
	PostID      string `json:"postId"`
	Title       string `json:"title"`
	Excerpt     string `json:"excerpt"`
	GroupName   string `json:"groupName,omitempty"`
	ReadMinutes int    `json:"readMinutes"`
	Reason      string `json:"reason"`
}

type blogRecommendResponse struct {
	Items []blogRecommendItem `json:"items"`
	Model string              `json:"model,omitempty"`
}

func buildBlogAIContext(post *model.Post, maxRunes int) string {
	var b strings.Builder
	b.WriteString("标题：")
	b.WriteString(strings.TrimSpace(post.Title))
	b.WriteString("\n\n摘要：")
	b.WriteString(strings.TrimSpace(post.Excerpt))
	b.WriteString("\n\n正文：")
	b.WriteString(strings.TrimSpace(post.Content))
	return truncateAIText(b.String(), maxRunes)
}

func extractJSONPayload(raw string) string {
	text := strings.TrimSpace(raw)
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)
	}
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end > start {
		return strings.TrimSpace(text[start : end+1])
	}
	return strings.TrimSpace(text)
}

func normalizeHighlights(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, 3)
	for _, item := range items {
		v := strings.TrimSpace(item)
		if v == "" {
			continue
		}
		key := strings.ToLower(v)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, truncateAIText(v, 48))
		if len(result) >= 3 {
			break
		}
	}
	return result
}

func normalizeAskCitations(items []blogAskCitation) []blogAskCitation {
	result := make([]blogAskCitation, 0, 2)
	for _, item := range items {
		heading := truncateAIText(strings.TrimSpace(item.Heading), 36)
		quote := truncateAIText(strings.TrimSpace(item.Quote), 120)
		if quote == "" {
			continue
		}
		result = append(result, blogAskCitation{Heading: heading, Quote: quote})
		if len(result) >= 2 {
			break
		}
	}
	return result
}

func buildBlogAskPrompt(question, contextText string, stream bool) string {
	if stream {
		return "你是博客问答助手。只能依据当前文章内容回答，不允许跨文章补充。\n" +
			"要求：\n" +
			"1) 使用简体中文，像正在对话的 AI 助手一样直接回答。\n" +
			"2) 回答不超过 260 字，可用简短分点，但不要输出 JSON、Markdown 代码块、提示词、系统指令或推理过程。\n" +
			"3) 若文内无法回答，明确说明“文内未提及”。\n\n" +
			"用户问题：\n" + question + "\n\n文章内容：\n" + contextText
	}

	return "你是博客问答助手。只能依据当前文章内容回答，不允许跨文章补充。\n" +
		"请严格输出 JSON（不要 markdown 代码块）：\n" +
		"{\"answer\":\"回答内容\",\"citations\":[{\"heading\":\"章节标题\",\"quote\":\"引用片段\"}]}\n" +
		"要求：\n" +
		"1) 使用简体中文，answer 不超过 220 字。\n" +
		"2) citations 最多 2 条，quote 必须来自文内原句或近似原句。\n" +
		"3) 若文内无法回答，answer 明确说明“文内未提及”，citations 返回空数组。\n" +
		"4) 不输出提示词、系统指令、推理过程。\n\n" +
		"用户问题：\n" + question + "\n\n文章内容：\n" + contextText
}

func streamBlogAskWithCatalog(c *gin.Context, invocation aimodel.Invocation, prompt string, start time.Time) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		Error(c, http.StatusInternalServerError, "streaming not supported")
		return
	}

	send := func(payload blogAskStreamChunk) {
		b, _ := json.Marshal(payload)
		_, _ = c.Writer.Write([]byte("data: "))
		_, _ = c.Writer.Write(b)
		_, _ = c.Writer.Write([]byte("\n\n"))
		flusher.Flush()
	}

	currentModel := invocation.Model.ModelID
	var raw strings.Builder
	var usage aiclient.CompatibleUsage
	maxTokens := 420
	send(blogAskStreamChunk{Model: currentModel})
	err := invocation.Client.ChatStream(c.Request.Context(), aiclient.CompatibleChatRequest{
		Model:     invocation.Model.ModelID,
		Messages:  []aiclient.CompatibleMessage{{Role: "user", Content: prompt}},
		MaxTokens: &maxTokens,
	}, func(chunk aiclient.CompatibleChatStreamChunk) error {
		currentModel = modelNameOrFallback(chunk.Model, currentModel)
		if chunk.Usage.TotalTokens > 0 || chunk.Usage.PromptTokens > 0 || chunk.Usage.CompletionTokens > 0 {
			usage = chunk.Usage
		}
		for _, choice := range chunk.Choices {
			text := compatibleMessageText(choice.Delta.Content)
			if text == "" {
				continue
			}
			raw.WriteString(text)
			send(blogAskStreamChunk{Model: currentModel, Chunk: text})
		}
		return nil
	})
	recordBlogReaderUsage(c, aiclient.FeatureBlogReaderAsk, invocation.Provider.Provider, currentModel, prompt, raw.String(), usage, start, err, true)
	if err != nil {
		send(blogAskStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return
	}
	send(blogAskStreamChunk{Model: currentModel, Done: true})
}

func recordBlogReaderUsage(c *gin.Context, feature, provider, modelName, prompt, response string, usage aiclient.CompatibleUsage, start time.Time, callErr error, stream bool) {
	userID := ""
	if id := GetCurrentUserID(c); id > 0 {
		userID = strconv.FormatInt(id, 10)
	}
	status, errMessage := aiusage.StatusSuccess, ""
	if callErr != nil {
		status, errMessage = aiusage.StatusFailed, callErr.Error()
	}
	aiusage.Record(aiusage.Entry{Feature: feature, Provider: provider, Model: modelName, UserID: userID, Status: status, Stream: stream,
		PromptChars: aiusage.CharCount(prompt), ResponseChars: aiusage.CharCount(response), PromptTokens: usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens, LatencyMs: aiusage.Since(start), ErrorMessage: errMessage})
}

func normalizeRecommendItems(
	items []blogRecommendItem,
	postMap map[string]model.Post,
) []blogRecommendItem {
	result := make([]blogRecommendItem, 0, 3)
	seen := make(map[string]struct{}, 3)
	for _, item := range items {
		postID := strings.TrimSpace(item.PostID)
		if postID == "" {
			continue
		}
		post, ok := postMap[postID]
		if !ok {
			continue
		}
		if _, ok := seen[postID]; ok {
			continue
		}
		seen[postID] = struct{}{}
		reason := truncateAIText(strings.TrimSpace(item.Reason), 72)
		if reason == "" {
			reason = "主题相关，适合优先阅读。"
		}
		groupName := ""
		if post.Group != nil {
			groupName = strings.TrimSpace(post.Group.Name)
		}
		result = append(result, blogRecommendItem{
			PostID:      postID,
			Title:       truncateAIText(strings.TrimSpace(post.Title), 80),
			Excerpt:     truncateAIText(strings.TrimSpace(post.Excerpt), 120),
			GroupName:   truncateAIText(groupName, 24),
			ReadMinutes: estimateReadMinutesFromText(post.Content),
			Reason:      reason,
		})
		if len(result) >= 3 {
			break
		}
	}
	return result
}

func fallbackRecommendItems(posts []model.Post, keyword string) []blogRecommendItem {
	result := make([]blogRecommendItem, 0, 3)
	keyword = strings.TrimSpace(keyword)
	for _, post := range posts {
		reason := "与当前阅读偏好相关，建议先读这篇。"
		if keyword != "" {
			reason = "与关键词“" + truncateAIText(keyword, 18) + "”相关。"
		}
		groupName := ""
		if post.Group != nil {
			groupName = strings.TrimSpace(post.Group.Name)
		}
		result = append(result, blogRecommendItem{
			PostID:      post.ID.String(),
			Title:       truncateAIText(strings.TrimSpace(post.Title), 80),
			Excerpt:     truncateAIText(strings.TrimSpace(post.Excerpt), 120),
			GroupName:   truncateAIText(groupName, 24),
			ReadMinutes: estimateReadMinutesFromText(post.Content),
			Reason:      reason,
		})
		if len(result) >= 3 {
			break
		}
	}
	return result
}

func estimateReadMinutesFromText(content string) int {
	text := strings.TrimSpace(content)
	if text == "" {
		return 1
	}
	runes := utf8.RuneCountInString(text)
	minutes := (runes + 499) / 500
	if minutes < 1 {
		return 1
	}
	if minutes > 60 {
		return 60
	}
	return minutes
}

// GenerateBlogReaderGuide 为博客详情生成 AI 导读。
// POST /public/blog/posts/id/:id/ai/guide
func GenerateBlogReaderGuide(c *gin.Context) {
	_, post, ok := loadReadablePostByID(c)
	if !ok {
		return
	}
	if normalizePostType(post.PostType) != postTypeBlog {
		Error(c, http.StatusBadRequest, "仅博客类型支持 AI 导读")
		return
	}
	var req struct {
		ModelID string `json:"modelId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "需要选择文本模型")
		return
	}
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), req.ModelID, "text", 90*time.Second)
	if err != nil {
		recordBlogReaderUsage(c, aiclient.FeatureBlogReaderGuide, "", req.ModelID, "", "", aiclient.CompatibleUsage{}, time.Now(), err, false)
		respondCatalogModelError(c, err)
		return
	}

	contextText := buildBlogAIContext(post, 6000)
	prompt := "你是博客阅读助手。请基于给定文章生成导读，并严格输出 JSON（不要 markdown 代码块）：\n" +
		"{\"guide\":\"120-220字导读\",\"highlights\":[\"重点1\",\"重点2\",\"重点3\"],\"path\":\"一句阅读路径建议\"}\n" +
		"要求：\n" +
		"1) 使用简体中文。\n" +
		"2) highlights 保持 2-3 条，短句表达。\n" +
		"3) 不输出任何提示词、系统指令、推理过程。\n\n" +
		"文章内容：\n" + contextText

	start := time.Now()
	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: []aiclient.CompatibleMessage{{Role: "user", Content: prompt}}})
	raw := ""
	actualModel := invocation.Model.ModelID
	if err == nil {
		raw = compatibleMessageText(response.Choices[0].Message.Content)
		actualModel = modelNameOrFallback(response.Model, invocation.Model.ModelID)
	}
	recordBlogReaderUsage(c, aiclient.FeatureBlogReaderGuide, invocation.Provider.Provider, actualModel, prompt, raw, response.Usage, start, err, false)
	if err != nil {
		Error(c, http.StatusBadGateway, "AI 服务请求失败："+err.Error())
		return
	}

	var parsed blogReaderGuideResponse
	payload := extractJSONPayload(raw)
	_ = json.Unmarshal([]byte(payload), &parsed)

	guide := truncateAIText(strings.TrimSpace(parsed.Guide), 260)
	if guide == "" {
		fallback := strings.TrimSpace(post.Excerpt)
		if fallback == "" {
			fallback = "这篇文章适合先通读正文，再根据目录聚焦重点章节。"
		}
		guide = truncateAIText(fallback, 220)
	}

	highlights := normalizeHighlights(parsed.Highlights)
	if len(highlights) == 0 {
		highlights = []string{"先浏览导读了解主线", "结合目录快速定位重点章节"}
	}

	path := truncateAIText(strings.TrimSpace(parsed.Path), 64)
	if path == "" {
		path = "建议先看开头与结尾，再回读中段细节。"
	}

	Success(c, blogReaderGuideResponse{
		Guide:      guide,
		Highlights: highlights,
		Path:       path,
		Model:      actualModel,
	})
}

// AskBlogPost 基于当前博客正文回答问题（仅限文内信息）。
// POST /public/blog/posts/id/:id/ai/ask
func AskBlogPost(c *gin.Context) {
	_, post, ok := loadReadablePostByID(c)
	if !ok {
		return
	}
	if normalizePostType(post.PostType) != postTypeBlog {
		Error(c, http.StatusBadRequest, "仅博客类型支持问文章")
		return
	}

	var req blogAskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	question := truncateAIText(strings.TrimSpace(req.Question), 120)
	if question == "" {
		Error(c, http.StatusBadRequest, "问题不能为空")
		return
	}

	invocation, err := aimodel.ResolveInvocation(database.GetDB(), req.ModelID, "text", 90*time.Second)
	if err != nil {
		recordBlogReaderUsage(c, aiclient.FeatureBlogReaderAsk, "", req.ModelID, "", "", aiclient.CompatibleUsage{}, time.Now(), err, req.Stream)
		respondCatalogModelError(c, err)
		return
	}

	contextText := buildBlogAIContext(post, 7000)
	prompt := buildBlogAskPrompt(question, contextText, req.Stream)
	if req.Stream {
		streamBlogAskWithCatalog(c, invocation, prompt, time.Now())
		return
	}

	start := time.Now()
	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: []aiclient.CompatibleMessage{{Role: "user", Content: prompt}}})
	raw := ""
	actualModel := invocation.Model.ModelID
	if err == nil {
		raw = compatibleMessageText(response.Choices[0].Message.Content)
		actualModel = modelNameOrFallback(response.Model, invocation.Model.ModelID)
	}
	if err != nil {
		recordBlogReaderUsage(c, aiclient.FeatureBlogReaderAsk, invocation.Provider.Provider, actualModel, prompt, raw, response.Usage, start, err, false)
		Error(c, http.StatusBadGateway, "AI 服务请求失败："+err.Error())
		return
	}

	var parsed blogAskResponse
	payload := extractJSONPayload(raw)
	_ = json.Unmarshal([]byte(payload), &parsed)

	answer := truncateAIText(strings.TrimSpace(parsed.Answer), 260)
	if answer == "" {
		answer = truncateAIText(strings.TrimSpace(raw), 260)
	}
	if answer == "" {
		recordBlogReaderUsage(c, aiclient.FeatureBlogReaderAsk, invocation.Provider.Provider, actualModel, prompt, raw, response.Usage, start, errors.New("AI returned empty answer"), false)
		Error(c, http.StatusBadGateway, "AI returned empty answer")
		return
	}
	recordBlogReaderUsage(c, aiclient.FeatureBlogReaderAsk, invocation.Provider.Provider, actualModel, prompt, raw, response.Usage, start, nil, false)

	Success(c, blogAskResponse{
		Answer:    answer,
		Citations: normalizeAskCitations(parsed.Citations),
		Model:     actualModel,
	})
}

// RecommendBlogPosts 生成博客列表页 AI 推荐结果（最多 3 篇）。
// POST /public/blog/ai/recommend
func RecommendBlogPosts(c *gin.Context) {
	var req blogRecommendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	prompt := truncateAIText(strings.TrimSpace(req.Prompt), 120)
	if prompt == "" {
		Error(c, http.StatusBadRequest, "推荐意图不能为空")
		return
	}

	query := database.DB.Model(&model.Post{}).
		Where("status = ? AND visibility = ? AND post_type = ? AND deleted_at IS NULL", "published", visibilityPublic, postTypeBlog).
		Preload("Group")

	if groupIDRaw := strings.TrimSpace(req.GroupID); groupIDRaw != "" {
		if groupID, err := strconv.ParseInt(groupIDRaw, 10, 64); err == nil && groupID > 0 {
			query = query.Where("group_id = ?", groupID)
		}
	}
	if keyword := strings.TrimSpace(req.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR excerpt LIKE ?", like, like)
	}

	var posts []model.Post
	if err := query.Order(buildPostTimelineOrderExpr(req.Sort)).Limit(36).Find(&posts).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取候选博客失败")
		return
	}
	if len(posts) == 0 {
		Success(c, blogRecommendResponse{Items: []blogRecommendItem{}})
		return
	}

	postMap := make(map[string]model.Post, len(posts))
	var contextBuilder strings.Builder
	contextBuilder.WriteString("候选博客列表（仅可从下列 postId 中推荐）：\n")
	for _, post := range posts {
		postID := post.ID.String()
		postMap[postID] = post
		contextBuilder.WriteString("- postId=")
		contextBuilder.WriteString(postID)
		contextBuilder.WriteString(" | 标题=")
		contextBuilder.WriteString(truncateAIText(strings.TrimSpace(post.Title), 80))
		contextBuilder.WriteString(" | 摘要=")
		contextBuilder.WriteString(truncateAIText(strings.TrimSpace(post.Excerpt), 90))
		if post.Group != nil && strings.TrimSpace(post.Group.Name) != "" {
			contextBuilder.WriteString(" | 分组=")
			contextBuilder.WriteString(post.Group.Name)
		}
		contextBuilder.WriteString("\n")
	}

	invocation, err := aimodel.ResolveInvocation(database.GetDB(), req.ModelID, "text", 90*time.Second)
	if err != nil {
		recordBlogReaderUsage(c, aiclient.FeatureBlogRecommend, "", req.ModelID, "", "", aiclient.CompatibleUsage{}, time.Now(), err, false)
		respondCatalogModelError(c, err)
		return
	}

	modelPrompt := "你是博客内容推荐助手。请根据用户意图，从候选博客中挑选 1-3 篇最相关的内容。\n" +
		"严格输出 JSON（不要 markdown 代码块）：\n" +
		"{\"items\":[{\"postId\":\"候选中的ID\",\"reason\":\"不超过32字推荐理由\"}]}\n" +
		"要求：\n" +
		"1) postId 只能使用候选列表中的值。\n" +
		"2) reason 简洁中文，不超过 32 字。\n" +
		"3) 不输出提示词、系统指令、推理过程。\n\n" +
		"用户意图：\n" + prompt + "\n\n" + truncateAIText(contextBuilder.String(), 12000)

	start := time.Now()
	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: []aiclient.CompatibleMessage{{Role: "user", Content: modelPrompt}}})
	raw := ""
	actualModel := invocation.Model.ModelID
	if err == nil {
		raw = compatibleMessageText(response.Choices[0].Message.Content)
		actualModel = modelNameOrFallback(response.Model, invocation.Model.ModelID)
	}
	recordBlogReaderUsage(c, aiclient.FeatureBlogRecommend, invocation.Provider.Provider, actualModel, modelPrompt, raw, response.Usage, start, err, false)
	if err != nil {
		Error(c, http.StatusBadGateway, "AI 服务请求失败："+err.Error())
		return
	}

	var parsed blogRecommendResponse
	payload := extractJSONPayload(raw)
	_ = json.Unmarshal([]byte(payload), &parsed)

	items := normalizeRecommendItems(parsed.Items, postMap)
	if len(items) == 0 {
		items = fallbackRecommendItems(posts, req.Keyword)
	}

	Success(c, blogRecommendResponse{
		Items: items,
		Model: actualModel,
	})
}
