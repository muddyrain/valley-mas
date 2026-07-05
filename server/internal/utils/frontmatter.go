package utils

import (
	"bytes"
	"regexp"
	"strings"

	yaml "go.yaml.in/yaml/v3"
)

// FrontMatter represents parsed YAML front matter from a Markdown file.
type FrontMatter struct {
	Title       string   `yaml:"title"`
	Date        string   `yaml:"date"`
	Excerpt     string   `yaml:"excerpt"`
	Cover       string   `yaml:"cover"`
	Tags        []string `yaml:"tags"`
	Categories  []string `yaml:"categories"`
	Visibility  string   `yaml:"visibility"`
	Status      string   `yaml:"status"`

	// Aliases populated by normalizeFrontMatterAliases
	description string
	summary     string
	image       string
	coverImage  string
	keywords    []string
}

// ParsedMarkdown holds the result of parsing a Markdown file with optional front matter.
type ParsedMarkdown struct {
	FrontMatter FrontMatter
	Content     string
}

var frontMatterDelim = regexp.MustCompile(`^---\s*\n`)

// ParseFrontMatter parses a Markdown file's YAML front matter and returns the
// front matter fields and the body content (with front matter stripped).
func ParseFrontMatter(raw []byte) (*ParsedMarkdown, error) {
	raw = bytes.TrimPrefix(raw, []byte("\uFEFF")) // strip BOM
	raw = bytes.ReplaceAll(raw, []byte("\r\n"), []byte("\n"))
	raw = bytes.ReplaceAll(raw, []byte("\r"), []byte("\n"))

	rawStr := string(raw)

	if !frontMatterDelim.MatchString(rawStr) {
		return &ParsedMarkdown{
			FrontMatter: FrontMatter{},
			Content:     rawStr,
		}, nil
	}

	afterFirstDelim := frontMatterDelim.FindStringIndex(rawStr)
	if afterFirstDelim == nil {
		return &ParsedMarkdown{
			FrontMatter: FrontMatter{},
			Content:     rawStr,
		}, nil
	}

	rest := rawStr[afterFirstDelim[1]:]
	closingIdx := strings.Index(rest, "\n---")
	if closingIdx < 0 {
		return &ParsedMarkdown{
			FrontMatter: FrontMatter{},
			Content:     rawStr,
		}, nil
	}

	yamlStr := rest[:closingIdx]
	bodyStart := closingIdx + 4 // skip \n---
	body := strings.TrimPrefix(rest[bodyStart:], "\n")

	var fm FrontMatter
	if err := yaml.Unmarshal([]byte(yamlStr), &fm); err != nil {
		// If YAML parsing fails, return raw content without front matter
		return &ParsedMarkdown{
			FrontMatter: FrontMatter{},
			Content:     body,
		}, nil
	}

	normalizeFrontMatterAliases(&fm, yamlStr)

	return &ParsedMarkdown{
		FrontMatter: fm,
		Content:     body,
	}, nil
}

// normalizeFrontMatterAliases maps alternative YAML keys to canonical fields.
// yaml.v3 doesn't support multiple yaml tags, so we do a second pass with a
// raw map to pick up aliases.
func normalizeFrontMatterAliases(fm *FrontMatter, yamlStr string) {
	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlStr), &raw); err != nil {
		return
	}

	if fm.Excerpt == "" {
		if v, ok := rawStringVal(raw, "description"); ok {
			fm.Excerpt = v
		} else if v, ok := rawStringVal(raw, "summary"); ok {
			fm.Excerpt = v
		}
	}

	if fm.Cover == "" {
		if v, ok := rawStringVal(raw, "image"); ok {
			fm.Cover = v
		} else if v, ok := rawStringVal(raw, "cover_image"); ok {
			fm.Cover = v
		} else if v, ok := rawStringVal(raw, "thumbnail"); ok {
			fm.Cover = v
		}
	}

	if len(fm.Tags) == 0 {
		if v, ok := rawStringSliceVal(raw, "keywords"); ok {
			fm.Tags = v
		}
	}
}

func rawStringVal(raw map[string]interface{}, key string) (string, bool) {
	v, ok := raw[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

func rawStringSliceVal(raw map[string]interface{}, key string) ([]string, bool) {
	v, ok := raw[key]
	if !ok {
		return nil, false
	}
	switch val := v.(type) {
	case []string:
		return val, true
	case []interface{}:
		var result []string
		for _, item := range val {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result, len(result) > 0
	default:
		return nil, false
	}
}

// InferTitleFromHeading extracts the first H1 heading from markdown content.
func InferTitleFromHeading(content string) string {
	re := regexp.MustCompile(`(?m)^#\s+(.+?)\s*$`)
	m := re.FindStringSubmatch(content)
	if len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	return ""
}
