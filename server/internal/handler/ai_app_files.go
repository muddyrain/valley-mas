package handler

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"valley-server/internal/aiclient"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	aiAppAttachmentMaxBytes      = 2 * 1024 * 1024
	aiAppImageAttachmentMaxBytes = 5 * 1024 * 1024
	aiAppAttachmentMaxCount      = 3
	aiAppAttachmentContextRunes  = 12000
)

func UploadAIAppConversationAttachment(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, http.StatusNotFound, "私有会话不存在")
		return
	}
	file, err := c.FormFile("file")
	if err != nil || file.Size <= 0 {
		Error(c, http.StatusBadRequest, "文件不能为空")
		return
	}
	extension := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".md": true, ".markdown": true, ".txt": true, ".pdf": true, ".json": true, ".csv": true, ".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowed[extension] {
		Error(c, http.StatusBadRequest, "支持图片、Markdown、TXT、PDF、JSON 或 CSV 文件")
		return
	}
	isImage := extension == ".jpg" || extension == ".jpeg" || extension == ".png" || extension == ".webp"
	maxBytes := int64(aiAppAttachmentMaxBytes)
	if isImage {
		maxBytes = aiAppImageAttachmentMaxBytes
	}
	if file.Size > maxBytes {
		Error(c, http.StatusBadRequest, map[bool]string{true: "图片不能超过 5MB", false: "文件不能超过 2MB"}[isImage])
		return
	}
	var unattachedCount int64
	if err := database.GetDB().Model(&model.AIAppConversationAttachment{}).
		Where("user_id = ? AND conversation_id = ? AND message_id IS NULL", userID, conversation.ID).
		Count(&unattachedCount).Error; err != nil || unattachedCount >= aiAppAttachmentMaxCount {
		Error(c, http.StatusBadRequest, "每次最多附加 3 个文件")
		return
	}
	source, err := file.Open()
	if err != nil {
		Error(c, http.StatusBadRequest, "读取文件失败")
		return
	}
	defer source.Close()
	content, err := io.ReadAll(io.LimitReader(source, maxBytes+1))
	if err != nil || len(content) == 0 || int64(len(content)) > maxBytes {
		Error(c, http.StatusBadRequest, "读取文件失败")
		return
	}
	parsedText := ""
	if isImage {
		parsedText = ""
	} else if extension == ".json" || extension == ".csv" {
		parsedText = strings.TrimSpace(string(content))
	} else {
		parsedText, err = extractAIKnowledgeDocumentText(extension, content)
	}
	if err != nil || (!isImage && strings.TrimSpace(parsedText) == "") {
		Error(c, http.StatusBadRequest, "文件没有可理解的文本内容")
		return
	}
	attachment := model.AIAppConversationAttachment{
		UserID: userID, AppID: app.ID, ConversationID: conversation.ID,
		Name: filepath.Base(file.Filename), MimeType: file.Header.Get("Content-Type"),
		SizeBytes: file.Size, ParsedText: parsedText, SourceContent: content,
	}
	if strings.TrimSpace(attachment.MimeType) == "" {
		if isImage {
			attachment.MimeType = map[string]string{
				".jpg": "image/jpeg", ".jpeg": "image/jpeg",
				".png": "image/png", ".webp": "image/webp",
			}[extension]
		} else {
			attachment.MimeType = "application/octet-stream"
		}
	}
	if err := database.GetDB().Create(&attachment).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存会话文件失败")
		return
	}
	Success(c, gin.H{"attachment": attachment})
}

func DownloadAIAppConversationAttachment(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, conversationErr := parsePathInt64(c, "conversationId")
	attachmentID, attachmentErr := parsePathInt64(c, "attachmentId")
	if conversationErr != nil || attachmentErr != nil {
		Error(c, http.StatusBadRequest, "无效的文件 ID")
		return
	}
	var attachment model.AIAppConversationAttachment
	if err := database.GetDB().Where("id = ? AND user_id = ? AND app_id = ? AND conversation_id = ?", attachmentID, userID, app.ID, conversationID).First(&attachment).Error; err != nil {
		Error(c, http.StatusNotFound, "会话文件不存在")
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(attachment.Name)))
	c.Data(http.StatusOK, attachment.MimeType, attachment.SourceContent)
}

func DeleteAIAppConversationAttachment(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, conversationErr := parsePathInt64(c, "conversationId")
	attachmentID, attachmentErr := parsePathInt64(c, "attachmentId")
	if conversationErr != nil || attachmentErr != nil {
		Error(c, http.StatusBadRequest, "无效的文件 ID")
		return
	}
	result := database.GetDB().Where("id = ? AND user_id = ? AND app_id = ? AND conversation_id = ? AND message_id IS NULL", attachmentID, userID, app.ID, conversationID).Delete(&model.AIAppConversationAttachment{})
	if result.Error != nil {
		Error(c, http.StatusInternalServerError, "删除会话文件失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusConflict, "已发送的文件不能移除")
		return
	}
	Success(c, gin.H{"deletedId": fmt.Sprint(attachmentID)})
}

func resolveAIAppConversationAttachments(db *gorm.DB, userID, appID, conversationID model.Int64String, attachmentIDs []string) ([]model.AIAppConversationAttachment, string, error) {
	if len(attachmentIDs) == 0 {
		return nil, "", nil
	}
	if len(attachmentIDs) > aiAppAttachmentMaxCount {
		return nil, "", fmt.Errorf("每次最多附加 3 个文件")
	}
	ids := make([]model.Int64String, 0, len(attachmentIDs))
	seen := make(map[model.Int64String]struct{}, len(attachmentIDs))
	for _, rawID := range attachmentIDs {
		var parsed int64
		if _, err := fmt.Sscan(strings.TrimSpace(rawID), &parsed); err != nil || parsed <= 0 {
			return nil, "", fmt.Errorf("包含无效的会话文件")
		}
		id := model.Int64String(parsed)
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	var attachments []model.AIAppConversationAttachment
	if err := db.Where("id IN ? AND user_id = ? AND app_id = ? AND conversation_id = ? AND message_id IS NULL", ids, userID, appID, conversationID).Order("created_at ASC").Find(&attachments).Error; err != nil {
		return nil, "", err
	}
	if len(attachments) != len(ids) {
		return nil, "", fmt.Errorf("会话文件不存在、已发送或无权访问")
	}
	var contextBuilder strings.Builder
	for index, attachment := range attachments {
		header := fmt.Sprintf("[用户文件 %d：%s；附件 ID：%s]", index+1, attachment.Name, attachment.ID)
		text := aiclient.TrimRunes(strings.TrimSpace(attachment.ParsedText), 5000)
		entry := header
		if text != "" {
			entry += "\n" + text
		}
		if len([]rune(contextBuilder.String()))+len([]rune(entry)) > aiAppAttachmentContextRunes {
			entry = header
		}
		contextBuilder.WriteString(entry + "\n\n")
	}
	return attachments, strings.TrimSpace(contextBuilder.String()), nil
}
