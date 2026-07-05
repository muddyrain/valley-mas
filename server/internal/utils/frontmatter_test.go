package utils

import (
	"testing"
)

func TestParseFrontMatter_Basic(t *testing.T) {
	input := "---\ntitle: Hello World\nexcerpt: A test post\ntags:\n  - go\n  - test\n---\n\n# Content here\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.FrontMatter.Title != "Hello World" {
		t.Errorf("title = %q, want %q", parsed.FrontMatter.Title, "Hello World")
	}
	if parsed.FrontMatter.Excerpt != "A test post" {
		t.Errorf("excerpt = %q, want %q", parsed.FrontMatter.Excerpt, "A test post")
	}
	if len(parsed.FrontMatter.Tags) != 2 || parsed.FrontMatter.Tags[0] != "go" || parsed.FrontMatter.Tags[1] != "test" {
		t.Errorf("tags = %v, want [go test]", parsed.FrontMatter.Tags)
	}
	if parsed.Content != "\n# Content here\n" {
		t.Errorf("content = %q, want %q", parsed.Content, "\n# Content here\n")
	}
}

func TestParseFrontMatter_NoFrontMatter(t *testing.T) {
	input := "# Just a heading\n\nSome content.\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.FrontMatter.Title != "" {
		t.Errorf("title = %q, want empty", parsed.FrontMatter.Title)
	}
	if parsed.Content != input {
		t.Errorf("content = %q, want %q", parsed.Content, input)
	}
}

func TestParseFrontMatter_BOM(t *testing.T) {
	input := "\uFEFF---\ntitle: BOM Test\n---\n\nContent after BOM\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.FrontMatter.Title != "BOM Test" {
		t.Errorf("title = %q, want %q", parsed.FrontMatter.Title, "BOM Test")
	}
}

func TestParseFrontMatter_Aliases(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		field    string
		expected string
	}{
		{
			name:     "description -> excerpt",
			input:    "---\ntitle: Test\ndescription: From description\n---\n\nContent\n",
			field:    "excerpt",
			expected: "From description",
		},
		{
			name:     "summary -> excerpt",
			input:    "---\ntitle: Test\nsummary: From summary\n---\n\nContent\n",
			field:    "excerpt",
			expected: "From summary",
		},
		{
			name:     "image -> cover",
			input:    "---\ntitle: Test\nimage: https://example.com/img.png\n---\n\nContent\n",
			field:    "cover",
			expected: "https://example.com/img.png",
		},
		{
			name:     "cover_image -> cover",
			input:    "---\ntitle: Test\ncover_image: https://example.com/cover.png\n---\n\nContent\n",
			field:    "cover",
			expected: "https://example.com/cover.png",
		},
		{
			name:     "thumbnail -> cover",
			input:    "---\ntitle: Test\nthumbnail: https://example.com/thumb.png\n---\n\nContent\n",
			field:    "cover",
			expected: "https://example.com/thumb.png",
		},
		{
			name:     "keywords -> tags",
			input:    "---\ntitle: Test\nkeywords:\n  - k1\n  - k2\n---\n\nContent\n",
			field:    "tags",
			expected: "[k1 k2]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := ParseFrontMatter([]byte(tt.input))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			switch tt.field {
			case "excerpt":
				if parsed.FrontMatter.Excerpt != tt.expected {
					t.Errorf("excerpt = %q, want %q", parsed.FrontMatter.Excerpt, tt.expected)
				}
			case "cover":
				if parsed.FrontMatter.Cover != tt.expected {
					t.Errorf("cover = %q, want %q", parsed.FrontMatter.Cover, tt.expected)
				}
			case "tags":
				got := ""
				if len(parsed.FrontMatter.Tags) > 0 {
					got = parsed.FrontMatter.Tags[0] + " " + parsed.FrontMatter.Tags[1]
				}
				if got != tt.expected[1:len(tt.expected)-1] {
					t.Errorf("tags = %v, want %s", parsed.FrontMatter.Tags, tt.expected)
				}
			}
		})
	}
}

func TestParseFrontMatter_ExcerptDoesNotOverride(t *testing.T) {
	input := "---\ntitle: Test\nexcerpt: Primary\ndescription: Alias\n---\n\nContent\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.FrontMatter.Excerpt != "Primary" {
		t.Errorf("excerpt = %q, want %q (should not be overridden by alias)", parsed.FrontMatter.Excerpt, "Primary")
	}
}

func TestParseFrontMatter_CRLF(t *testing.T) {
	input := "---\r\ntitle: CRLF Test\r\n---\r\n\r\nContent here\r\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.FrontMatter.Title != "CRLF Test" {
		t.Errorf("title = %q, want %q", parsed.FrontMatter.Title, "CRLF Test")
	}
}

func TestParseFrontMatter_InvalidYAML(t *testing.T) {
	input := "---\ntitle: [broken yaml\n---\n\nContent here\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should return content without front matter on parse failure
	if parsed.FrontMatter.Title != "" {
		t.Errorf("title = %q, want empty on invalid YAML", parsed.FrontMatter.Title)
	}
}

func TestParseFrontMatter_Categories(t *testing.T) {
	input := "---\ntitle: Test\ncategories:\n  - tech\n  - go\n---\n\nContent\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(parsed.FrontMatter.Categories) != 2 {
		t.Errorf("categories = %v, want 2 items", parsed.FrontMatter.Categories)
	}
}

func TestParseFrontMatter_VisibilityAndStatus(t *testing.T) {
	input := "---\ntitle: Test\nvisibility: public\nstatus: published\n---\n\nContent\n"
	parsed, err := ParseFrontMatter([]byte(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.FrontMatter.Visibility != "public" {
		t.Errorf("visibility = %q, want %q", parsed.FrontMatter.Visibility, "public")
	}
	if parsed.FrontMatter.Status != "published" {
		t.Errorf("status = %q, want %q", parsed.FrontMatter.Status, "published")
	}
}

func TestInferTitleFromHeading(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{"h1 at start", "# My Title\nSome text\n", "My Title"},
		{"h1 with trailing spaces", "# My Title   \n", "My Title"},
		{"no h1", "## Subtitle\n", ""},
		{"h1 after content", "Intro\n# Later Title\n", "Later Title"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := InferTitleFromHeading(tt.content)
			if got != tt.expected {
				t.Errorf("InferTitleFromHeading() = %q, want %q", got, tt.expected)
			}
		})
	}
}
