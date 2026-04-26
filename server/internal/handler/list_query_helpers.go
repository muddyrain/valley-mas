package handler

import "gorm.io/gorm"

const resourceListSelectColumns = "" +
	"resources.id, resources.user_id, resources.type, resources.title, resources.url, " +
	"resources.width, resources.height, resources.size, resources.extension, " +
	"resources.download_count, resources.favorite_count, resources.created_at"

const postListSelectColumns = "" +
	"posts.id, posts.title, posts.slug, posts.post_type, posts.visibility, " +
	"posts.template_key, posts.template_data, posts.image_text_data, posts.excerpt, " +
	"posts.cover, posts.cover_storage_key, posts.author_id, posts.group_id, " +
	"posts.category_id, posts.status, posts.view_count, posts.like_count, posts.is_top, " +
	"posts.sort_order, posts.group_sort_order, posts.published_at, posts.created_at"

func applyResourceListQueryShape(query *gorm.DB, includeTags bool) *gorm.DB {
	query = query.
		Select(resourceListSelectColumns).
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		})
	if !includeTags {
		return query
	}
	return query.Preload("Tags", func(db *gorm.DB) *gorm.DB {
		return db.Select("resource_tags.id, resource_tags.name")
	})
}

func applyPostListQueryShape(query *gorm.DB) *gorm.DB {
	return query.
		Select(postListSelectColumns).
		Preload("Group", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, name, slug, group_type, description, author_id, parent_id")
		}).
		Preload("Category", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, name, slug")
		}).
		Preload("Tags", func(db *gorm.DB) *gorm.DB {
			return db.Select("post_tags.id, post_tags.name, post_tags.slug")
		}).
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		})
}
