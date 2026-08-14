package handler

import "testing"

func TestParseSuggestedResourceMetadata(t *testing.T) {
	metadata, err := parseSuggestedResourceMetadata("```json\n{\"title\":\"樱色远行\",\"tags\":[\"春日\",\"旅行\",\"春日\"]}\n```")
	if err != nil {
		t.Fatalf("parse metadata: %v", err)
	}
	if metadata.Title != "樱色远行" {
		t.Fatalf("title = %q", metadata.Title)
	}
	if len(metadata.Tags) != 2 || metadata.Tags[0] != "春日" || metadata.Tags[1] != "旅行" {
		t.Fatalf("tags = %#v", metadata.Tags)
	}
}

func TestParseSuggestedResourceMetadataRejectsIncompleteJSON(t *testing.T) {
	if _, err := parseSuggestedResourceMetadata(`{"title":"只有标题","tags":[]}`); err == nil {
		t.Fatal("expected incomplete metadata error")
	}
}
