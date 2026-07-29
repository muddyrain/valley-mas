package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const resourceProvenanceLimit = 8

type resourceProvenanceNode struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Label     string `json:"label"`
	Detail    string `json:"detail,omitempty"`
	Direction string `json:"direction"`
	Href      string `json:"href,omitempty"`
}

type resourceProvenanceEdge struct {
	ID       string `json:"id"`
	SourceID string `json:"sourceId"`
	TargetID string `json:"targetId"`
	Label    string `json:"label"`
}

func canViewResourceProvenance(c *gin.Context, resource model.Resource) (bool, bool) {
	rawUserID, userExists := c.Get("userId")
	userID, userIDIsInt64 := rawUserID.(int64)
	rawRole, roleExists := c.Get("userRole")
	role, roleIsString := rawRole.(string)
	isOwner := userExists && userIDIsInt64 && userID == int64(resource.UserID)
	isAdmin := roleExists && roleIsString && role == "admin"
	visibility := strings.TrimSpace(resource.Visibility)
	if visibility == "" {
		visibility = "public"
	}
	return visibility == "public" || isOwner || isAdmin, isOwner || isAdmin
}

// GetResourceProvenance returns only relationships that are stored explicitly
// or can be safely derived from the current persisted fields. Creator-only
// context (AI generations and albums) is limited to the owner or an admin.
func GetResourceProvenance(c *gin.Context) {
	db := database.GetDB()
	var resource model.Resource
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&resource).Error; err != nil {
		Error(c, http.StatusNotFound, "resource not found")
		return
	}

	canView, canViewPrivateContext := canViewResourceProvenance(c, resource)
	if !canView {
		Error(c, http.StatusNotFound, "resource not found or inaccessible")
		return
	}

	resourceNodeID := "resource:" + resource.ID.String()
	nodes := []resourceProvenanceNode{{
		ID:        resourceNodeID,
		Type:      "resource",
		Label:     resource.Title,
		Direction: "current",
		Href:      "/resource/" + resource.ID.String(),
	}}
	edges := make([]resourceProvenanceEdge, 0, resourceProvenanceLimit*2)

	if canViewPrivateContext {
		var generations []model.AIImageGeneration
		if err := db.Where("resource_id = ? AND deleted_at IS NULL", resource.ID).
			Order("created_at DESC").
			Limit(resourceProvenanceLimit).
			Find(&generations).Error; err != nil {
			Error(c, http.StatusInternalServerError, "failed to read resource provenance")
			return
		}
		for _, generation := range generations {
			generationNodeID := "generation:" + generation.ID.String()
			label := "AI image creation"
			if generation.Source == "workflow" {
				label = "Workflow image generation"
			}
			detail := strings.TrimSpace(generation.Model)
			if detail == "" {
				detail = "Saved generation result"
			}
			nodes = append(nodes, resourceProvenanceNode{
				ID:        generationNodeID,
				Type:      "generation",
				Label:     label,
				Detail:    detail,
				Direction: "source",
				Href:      "/workbench/images",
			})
			edges = append(edges, resourceProvenanceEdge{
				ID:       fmt.Sprintf("generated:%s:%s", generation.ID.String(), resource.ID.String()),
				SourceID: generationNodeID,
				TargetID: resourceNodeID,
				Label:    "Saved as resource",
			})
		}

		var albums []model.UserAlbum
		if err := db.Model(&model.UserAlbum{}).
			Joins("JOIN user_album_resources ON user_album_resources.user_album_id = user_albums.id").
			Where("user_album_resources.resource_id = ? AND user_albums.user_id = ? AND user_albums.deleted_at IS NULL", resource.ID, resource.UserID).
			Order("user_albums.updated_at DESC").
			Limit(resourceProvenanceLimit).
			Find(&albums).Error; err != nil {
			Error(c, http.StatusInternalServerError, "failed to read resource provenance")
			return
		}
		for _, album := range albums {
			albumNodeID := "album:" + album.ID.String()
			nodes = append(nodes, resourceProvenanceNode{
				ID:        albumNodeID,
				Type:      "album",
				Label:     album.Name,
				Detail:    "Included in resource album",
				Direction: "derived",
				Href:      "/my-space/resources?albumId=" + album.ID.String(),
			})
			edges = append(edges, resourceProvenanceEdge{
				ID:       fmt.Sprintf("collected:%s:%s", resource.ID.String(), album.ID.String()),
				SourceID: resourceNodeID,
				TargetID: albumNodeID,
				Label:    "Included in album",
			})
		}
	}

	postQuery := db.Model(&model.Post{}).Where("cover = ? AND deleted_at IS NULL", resource.URL)
	if canViewPrivateContext {
		postQuery = postQuery.Where("author_id = ? OR (visibility = ? AND status = ?)", resource.UserID, "public", "published")
	} else {
		postQuery = postQuery.Where("visibility = ? AND status = ?", "public", "published")
	}
	var posts []model.Post
	if err := postQuery.Order("updated_at DESC").Limit(resourceProvenanceLimit).Find(&posts).Error; err != nil {
		Error(c, http.StatusInternalServerError, "failed to read resource provenance")
		return
	}
	for _, post := range posts {
		postNodeID := "post:" + post.ID.String()
		nodes = append(nodes, resourceProvenanceNode{
			ID:        postNodeID,
			Type:      "post",
			Label:     post.Title,
			Detail:    "Cover URL match",
			Direction: "derived",
			Href:      "/blog/" + strconv.FormatInt(int64(post.ID), 10),
		})
		edges = append(edges, resourceProvenanceEdge{
			ID:       fmt.Sprintf("cover:%s:%s", resource.ID.String(), post.ID.String()),
			SourceID: resourceNodeID,
			TargetID: postNodeID,
			Label:    "Used as cover",
		})
	}

	Success(c, gin.H{"nodes": nodes, "edges": edges})
}
