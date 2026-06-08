package handler

import (
	"errors"
	"net/http"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/mindarena"

	"github.com/gin-gonic/gin"
)

func AdminListMindArenaDebates(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	store := mindarena.NewGormStore(database.GetDB())
	list, total, err := store.List(
		page.Page,
		page.PageSize,
		strings.TrimSpace(c.Query("keyword")),
		strings.TrimSpace(c.Query("status")),
		strings.TrimSpace(c.Query("mode")),
	)
	if err != nil {
		Error(c, http.StatusInternalServerError, "查询脑内会议失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminGetMindArenaDebate(c *gin.Context) {
	store := mindarena.NewGormStore(database.GetDB())
	session, err := store.Get(c.Param("id"))
	if err != nil {
		if errors.Is(err, mindarena.ErrDebateNotFound) {
			Error(c, http.StatusNotFound, "脑内会议不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "查询脑内会议详情失败")
		return
	}
	Success(c, session)
}
