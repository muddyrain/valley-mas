package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
)

type saveAICanvasDocumentRequest struct {
	ExpectedRevision int             `json:"expectedRevision"`
	Document         json.RawMessage `json:"document"`
}

type aiCanvasDocumentResponse struct {
	ID        model.Int64String `json:"id"`
	Revision  int               `json:"revision"`
	Document  json.RawMessage   `json:"document"`
	UpdatedAt time.Time         `json:"updatedAt"`
}

func GetAICanvasDocument(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	document, found, err := service.NewAICanvasDocumentService(database.GetDB()).Get(c.Request.Context(), userID)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "读取 AI 画布失败", err)
		return
	}
	if !found {
		Success(c, gin.H{"canvasDocument": nil})
		return
	}
	Success(c, gin.H{"canvasDocument": serializeAICanvasDocument(document)})
}

func SaveAICanvasDocument(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 34<<20)
	var payload saveAICanvasDocumentRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "画布保存参数错误")
		return
	}
	document, err := service.NewAICanvasDocumentService(database.GetDB()).Save(
		c.Request.Context(),
		service.AICanvasDocumentInput{
			UserID: userID, ExpectedRevision: payload.ExpectedRevision, Document: payload.Document,
		},
	)
	if errors.Is(err, service.ErrAICanvasDocumentConflict) {
		Error(c, http.StatusConflict, "画布已在其他页面更新，请刷新后继续")
		return
	}
	if errors.Is(err, service.ErrAICanvasDocumentInvalid) {
		Error(c, http.StatusBadRequest, "画布文档内容不合法")
		return
	}
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "画布保存失败", err)
		return
	}
	Success(c, gin.H{"canvasDocument": serializeAICanvasDocument(document)})
}

func serializeAICanvasDocument(document model.AICanvasDocument) aiCanvasDocumentResponse {
	return aiCanvasDocumentResponse{
		ID: document.ID, Revision: document.Revision,
		Document: json.RawMessage(document.DocumentJSON), UpdatedAt: document.UpdatedAt,
	}
}
