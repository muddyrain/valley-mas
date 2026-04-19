//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"

	postgresDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Args[1]
	db, err := gorm.Open(postgresDriver.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	sqls := []string{
		`CREATE TABLE IF NOT EXISTS classics_authors (
			id BIGSERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			dynasty VARCHAR(50),
			brief TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS classics_books (
			id BIGSERIAL PRIMARY KEY,
			title VARCHAR(200) NOT NULL,
			cover_url VARCHAR(500),
			category VARCHAR(50) NOT NULL DEFAULT '',
			dynasty VARCHAR(50),
			brief TEXT,
			word_count INTEGER DEFAULT 0,
			chapter_count INTEGER DEFAULT 0,
			is_published BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS classics_book_authors (
			book_id BIGINT NOT NULL REFERENCES classics_books(id),
			author_id BIGINT NOT NULL REFERENCES classics_authors(id),
			sort_order INTEGER DEFAULT 0,
			PRIMARY KEY (book_id, author_id)
		)`,
		`CREATE TABLE IF NOT EXISTS classics_editions (
			id BIGSERIAL PRIMARY KEY,
			book_id BIGINT NOT NULL REFERENCES classics_books(id),
			label VARCHAR(200) NOT NULL,
			translator VARCHAR(100),
			publish_year INTEGER,
			is_default BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS classics_chapters (
			id BIGSERIAL PRIMARY KEY,
			edition_id BIGINT NOT NULL REFERENCES classics_editions(id),
			book_id BIGINT NOT NULL REFERENCES classics_books(id),
			chapter_index INTEGER NOT NULL,
			title VARCHAR(300) NOT NULL,
			content TEXT,
			word_count INTEGER DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(edition_id, chapter_index)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_classics_books_category ON classics_books(category) WHERE deleted_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_classics_books_published ON classics_books(is_published) WHERE deleted_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_classics_chapters_edition ON classics_chapters(edition_id, chapter_index)`,
	}

	for i, s := range sqls {
		if err := db.Exec(s).Error; err != nil {
			log.Fatalf("step %d failed: %v", i+1, err)
		}
		fmt.Printf("✅ step %d ok\n", i+1)
	}
	fmt.Println("🎉 classics tables created")
}
