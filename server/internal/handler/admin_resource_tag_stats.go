package handler

import (
	"encoding/json"
	"sort"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// ResourceTagStatItem 表示一条资源标签统计
type ResourceTagStatItem struct {
	Name          string `json:"name"`
	ResourceCount int64  `json:"resourceCount"`
}

// AdminGetResourceTagStats 统计当前 resources.tags 字段中的标签使用次数
// GET /admin/resource-tags/stats?keyword=&limit=
// 由于标签存在 resources.tags (JSON string) 中，跨库统一在 Go 侧解码聚合。
func AdminGetResourceTagStats(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	limit := GetIntQuery(c, "limit", 200)
	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	db := database.GetDB()
	var rows []struct {
		Tags string `gorm:"column:tags"`
	}
	if err := db.
		Model(&model.Resource{}).
		Select("tags").
		Where("deleted_at IS NULL").
		Where("tags IS NOT NULL AND tags <> '' AND tags <> '[]'").
		Scan(&rows).Error; err != nil {
		logrus.WithField("error", err).Error("AdminGetResourceTagStats scan resources failed")
		Error(c, 500, "统计失败："+err.Error())
		return
	}

	counter := make(map[string]int64, len(rows))
	for _, row := range rows {
		if row.Tags == "" {
			continue
		}
		var names []string
		if err := json.Unmarshal([]byte(row.Tags), &names); err != nil {
			continue
		}
		for _, name := range names {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			counter[name]++
		}
	}

	items := make([]ResourceTagStatItem, 0, len(counter))
	for name, count := range counter {
		if keyword != "" && !strings.Contains(strings.ToLower(name), strings.ToLower(keyword)) {
			continue
		}
		items = append(items, ResourceTagStatItem{Name: name, ResourceCount: count})
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].ResourceCount != items[j].ResourceCount {
			return items[i].ResourceCount > items[j].ResourceCount
		}
		return items[i].Name < items[j].Name
	})
	total := int64(len(items))
	if len(items) > limit {
		items = items[:limit]
	}

	Success(c, gin.H{
		"list":  items,
		"total": total,
	})
}
