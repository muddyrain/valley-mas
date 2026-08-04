package handler

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func UploadWorkflowCollaborationAttachment(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return
	}
	ownerID := model.Int64String(userID)
	workflowKey := model.Int64String(workflowID)
	if err := requireOwnedWorkflow(database.GetDB(), ownerID, workflowKey); err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	session, err := resolveCanonicalWorkflowSession(database.GetDB(), ownerID, workflowKey)
	if err != nil {
		Error(c, http.StatusInternalServerError, "加载工作流协作会话失败")
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
		if isImage {
			Error(c, http.StatusBadRequest, "图片不能超过 5MB")
		} else {
			Error(c, http.StatusBadRequest, "文件不能超过 2MB")
		}
		return
	}
	var pendingCount int64
	if err := database.GetDB().Model(&model.WorkflowCollaborationAttachment{}).
		Where("user_id = ? AND session_id = ? AND message_id IS NULL", ownerID, session.ID).Count(&pendingCount).Error; err != nil || pendingCount >= aiAppAttachmentMaxCount {
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
	if !isImage {
		if extension == ".json" || extension == ".csv" {
			parsedText = strings.TrimSpace(string(content))
		} else {
			parsedText, err = extractAIKnowledgeDocumentText(extension, content)
		}
		if err != nil || strings.TrimSpace(parsedText) == "" {
			Error(c, http.StatusBadRequest, "文件没有可理解的文本内容")
			return
		}
	}
	mimeType := strings.TrimSpace(file.Header.Get("Content-Type"))
	if mimeType == "" {
		mimeType = map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[extension]
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}
	attachment := model.WorkflowCollaborationAttachment{
		UserID: ownerID, WorkflowID: workflowKey, SessionID: session.ID,
		Name: filepath.Base(file.Filename), MimeType: mimeType, SizeBytes: file.Size,
		ParsedText: parsedText, SourceContent: content,
	}
	if err := database.GetDB().Create(&attachment).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存协作文件失败")
		return
	}
	Success(c, gin.H{"attachment": attachment})
}

func DeleteWorkflowCollaborationAttachment(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, workflowErr := parsePathInt64(c, "id")
	attachmentID, attachmentErr := parsePathInt64(c, "attachmentId")
	if workflowErr != nil || attachmentErr != nil {
		Error(c, http.StatusBadRequest, "无效的文件 ID")
		return
	}
	result := database.GetDB().Where(
		"id = ? AND workflow_id = ? AND user_id = ? AND message_id IS NULL",
		attachmentID, workflowID, userID,
	).Delete(&model.WorkflowCollaborationAttachment{})
	if result.Error != nil {
		Error(c, http.StatusInternalServerError, "删除协作文件失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusConflict, "已发送的文件不能移除")
		return
	}
	Success(c, gin.H{"deletedId": fmt.Sprint(attachmentID)})
}

func resolveWorkflowCollaborationAttachments(
	db *gorm.DB,
	userID, workflowID, sessionID model.Int64String,
	rawIDs []string,
) ([]model.WorkflowCollaborationAttachment, error) {
	if len(rawIDs) == 0 {
		return nil, nil
	}
	if len(rawIDs) > aiAppAttachmentMaxCount {
		return nil, fmt.Errorf("每次最多附加 3 个文件")
	}
	ids := make([]model.Int64String, 0, len(rawIDs))
	seen := map[model.Int64String]struct{}{}
	for _, rawID := range rawIDs {
		var parsed int64
		if _, err := fmt.Sscan(strings.TrimSpace(rawID), &parsed); err != nil || parsed <= 0 {
			return nil, fmt.Errorf("包含无效的协作文件")
		}
		id := model.Int64String(parsed)
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	var attachments []model.WorkflowCollaborationAttachment
	if err := db.Where(
		"id IN ? AND user_id = ? AND workflow_id = ? AND session_id = ? AND message_id IS NULL",
		ids, userID, workflowID, sessionID,
	).Order("created_at ASC, id ASC").Find(&attachments).Error; err != nil {
		return nil, err
	}
	if len(attachments) != len(ids) {
		return nil, fmt.Errorf("协作文件不存在、已发送或无权访问")
	}
	return attachments, nil
}
