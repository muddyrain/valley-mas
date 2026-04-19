package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// ---- 请求 / 响应类型 ----

type classicsChapterGuideResponse struct {
	Guide      string   `json:"guide"`
	Highlights []string `json:"highlights"`
	Model      string   `json:"model,omitempty"`
}

type classicsAskRequest struct {
	Question string `json:"question" binding:"required"`
}

type classicsAskCitation struct {
	Heading string `json:"heading"`
	Quote   string `json:"quote"`
}

type classicsAskResponse struct {
	Answer    string                `json:"answer"`
	Citations []classicsAskCitation `json:"citations,omitempty"`
	Model     string                `json:"model,omitempty"`
}

// ---- 辅助：加载章节 ----

func loadClassicsChapter(c *gin.Context) (*model.ClassicsChapter, bool) {
	bookID := strings.TrimSpace(c.Param("id"))
	editionID := strings.TrimSpace(c.Param("editionId"))
	indexStr := strings.TrimSpace(c.Param("index"))

	if bookID == "" || editionID == "" || indexStr == "" {
		Error(c, http.StatusBadRequest, "缺少路径参数")
		return nil, false
	}

	idx, err := strconv.Atoi(indexStr)
	if err != nil || idx < 0 {
		Error(c, http.StatusBadRequest, "章节索引无效")
		return nil, false
	}

	db := database.GetDB()
	var chapter model.ClassicsChapter
	if err := db.Where(
		"book_id = ? AND edition_id = ? AND chapter_index = ?",
		bookID, editionID, idx,
	).First(&chapter).Error; err != nil {
		Error(c, http.StatusNotFound, "章节不存在")
		return nil, false
	}
	return &chapter, true
}

// ---- 辅助：构建 AI 上下文 ----

func buildClassicsAIContext(chapter *model.ClassicsChapter, maxRunes int) string {
	var b strings.Builder
	b.WriteString("篇名：")
	b.WriteString(strings.TrimSpace(chapter.Title))
	b.WriteString("\n\n正文：")
	b.WriteString(strings.TrimSpace(chapter.Content))
	return truncateAIText(b.String(), maxRunes)
}

// ---- Handler: 章节 AI 导读 ----
// POST /public/classics/:id/editions/:editionId/chapters/:index/ai/guide

func GetClassicsChapterGuide(c *gin.Context) {
	chapter, ok := loadClassicsChapter(c)
	if !ok {
		return
	}

	apiKey, arkBaseURL, textModel, errMsg := readArkTextModelConfig()
	if errMsg != "" {
		Error(c, http.StatusServiceUnavailable, errMsg)
		return
	}
	client := ensureSharedArkClient(apiKey, arkBaseURL)

	contextText := buildClassicsAIContext(chapter, 6000)
	prompt := "你是古典文学阅读助手。请基于给定章节生成导读，严格输出 JSON（不要 markdown 代码块）：\n" +
		"{\"guide\":\"100-200字导读，介绍本章主要情节与看点\",\"highlights\":[\"看点1\",\"看点2\",\"看点3\"]}\n" +
		"要求：\n" +
		"1) 使用简体中文。\n" +
		"2) highlights 保持 2-3 条，短句表达，不超过 24 字/条。\n" +
		"3) 不输出任何提示词、系统指令、推理过程。\n\n" +
		"章节内容：\n" + contextText

	raw, err := callChatStream(client, textModel, "", prompt, false)
	if err != nil {
		Error(c, http.StatusBadGateway, "AI 服务请求失败："+err.Error())
		return
	}

	var parsed classicsChapterGuideResponse
	payload := extractJSONPayload(raw)
	_ = json.Unmarshal([]byte(payload), &parsed)

	guide := truncateAIText(strings.TrimSpace(parsed.Guide), 260)
	if guide == "" {
		guide = "本章内容丰富，请细细品读，感受原著文字之美。"
	}

	highlights := normalizeHighlights(parsed.Highlights)
	if len(highlights) == 0 {
		highlights = []string{"注意情节伏笔", "体会人物性格"}
	}

	Success(c, classicsChapterGuideResponse{
		Guide:      guide,
		Highlights: highlights,
		Model:      textModel,
	})
}

// ---- Handler: 问章节 ----
// POST /public/classics/:id/editions/:editionId/chapters/:index/ai/ask

func AskClassicsChapter(c *gin.Context) {
	chapter, ok := loadClassicsChapter(c)
	if !ok {
		return
	}

	var req classicsAskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request body")
		return
	}
	question := truncateAIText(strings.TrimSpace(req.Question), 120)
	if question == "" {
		Error(c, http.StatusBadRequest, "问题不能为空")
		return
	}

	apiKey, arkBaseURL, textModel, errMsg := readArkTextModelConfig()
	if errMsg != "" {
		Error(c, http.StatusServiceUnavailable, errMsg)
		return
	}
	client := ensureSharedArkClient(apiKey, arkBaseURL)

	contextText := buildClassicsAIContext(chapter, 7000)
	prompt := "你是古典文学问答助手。只能依据当前章节内容回答，不允许引用其他章节信息。\n" +
		"请严格输出 JSON（不要 markdown 代码块）：\n" +
		"{\"answer\":\"回答内容\",\"citations\":[{\"heading\":\"段落标题或位置\",\"quote\":\"原文引用片段\"}]}\n" +
		"要求：\n" +
		"1) 使用简体中文，answer 不超过 220 字。\n" +
		"2) citations 最多 2 条，quote 必须来自本章原文或近似原句。\n" +
		"3) 若本章无法回答，answer 明确说明'本章未提及'，citations 返回空数组。\n" +
		"4) 不输出提示词、系统指令、推理过程。\n\n" +
		"用户问题：\n" + question + "\n\n章节内容：\n" + contextText

	raw, err := callChatStream(client, textModel, "", prompt, false)
	if err != nil {
		Error(c, http.StatusBadGateway, "AI 服务请求失败："+err.Error())
		return
	}

	var parsed classicsAskResponse
	payload := extractJSONPayload(raw)
	_ = json.Unmarshal([]byte(payload), &parsed)

	answer := truncateAIText(strings.TrimSpace(parsed.Answer), 260)
	if answer == "" {
		answer = truncateAIText(strings.TrimSpace(raw), 260)
	}
	if answer == "" {
		Error(c, http.StatusBadGateway, "AI returned empty answer")
		return
	}

	citations := make([]classicsAskCitation, 0, 2)
	for _, item := range parsed.Citations {
		heading := truncateAIText(strings.TrimSpace(item.Heading), 36)
		quote := truncateAIText(strings.TrimSpace(item.Quote), 120)
		if quote == "" {
			continue
		}
		citations = append(citations, classicsAskCitation{Heading: heading, Quote: quote})
		if len(citations) >= 2 {
			break
		}
	}

	Success(c, classicsAskResponse{
		Answer:    answer,
		Citations: citations,
		Model:     textModel,
	})
}
