package aiclient

import (
	"strings"
	"testing"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

func TestTrimRunes(t *testing.T) {
	cases := []struct {
		name string
		in   string
		max  int
		want string
	}{
		{"empty", "", 5, ""},
		{"ascii under limit", "hello", 10, "hello"},
		{"ascii cut", "abcdefghij", 4, "abcd"},
		{"cjk under limit", "你好世界", 10, "你好世界"},
		{"cjk cut", "你好世界你好", 3, "你好世"},
		{"max zero only trims", "  hello  ", 0, "hello"},
		{"max negative only trims", "  hello  ", -1, "hello"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := TrimRunes(c.in, c.max)
			if got != c.want {
				t.Fatalf("TrimRunes(%q,%d)=%q want %q", c.in, c.max, got, c.want)
			}
		})
	}
}

func TestNormalizeOutput(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"  hello   world  ", "hello world"},
		{"Summary: A nice day", "A nice day"},
		{"summary:   a   b\nc", "a b c"},
		{"\"quoted text'", "quoted text"},
		{"Cover prompt: red sunset", "red sunset"},
	}
	for _, c := range cases {
		got := NormalizeOutput(c.in)
		if got != c.want {
			t.Fatalf("NormalizeOutput(%q)=%q want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeImageInput(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"https://example.com/a.jpg", "https://example.com/a.jpg"},
		{"http://example.com/a.jpg", "http://example.com/a.jpg"},
		{"data:image/png;base64,abcd", "data:image/png;base64,abcd"},
		{"abcdEFGH==", "data:image/jpeg;base64,abcdEFGH=="},
		{"  abcdEFGH==  ", "data:image/jpeg;base64,abcdEFGH=="},
	}
	for _, c := range cases {
		got := NormalizeImageInput(c.in)
		if got != c.want {
			t.Fatalf("NormalizeImageInput(%q)=%q want %q", c.in, got, c.want)
		}
	}
}

func TestExtractARKMessageText(t *testing.T) {
	t.Run("nil message returns empty", func(t *testing.T) {
		if ExtractARKMessageText(nil) != "" {
			t.Fatal("expected empty for nil message")
		}
	})

	t.Run("string value", func(t *testing.T) {
		s := "  hello  "
		msg := &arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{StringValue: &s}}
		if got := ExtractARKMessageText(msg); got != "hello" {
			t.Fatalf("got %q want hello", got)
		}
	})

	t.Run("list value joins non-empty", func(t *testing.T) {
		msg := &arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{
			ListValue: []*arkmodel.ChatCompletionMessageContentPart{
				{Text: "  alpha  "},
				{Text: "   "},
				nil,
				{Text: "beta"},
			},
		}}
		got := ExtractARKMessageText(msg)
		if !strings.Contains(got, "alpha") || !strings.Contains(got, "beta") {
			t.Fatalf("expected to contain alpha and beta, got %q", got)
		}
	})

	t.Run("empty list value", func(t *testing.T) {
		msg := &arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{}}
		if ExtractARKMessageText(msg) != "" {
			t.Fatal("expected empty")
		}
	})
}

func TestExtractARKContent(t *testing.T) {
	t.Run("no choices error", func(t *testing.T) {
		_, err := ExtractARKContent(arkmodel.ChatCompletionResponse{})
		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("string value happy path", func(t *testing.T) {
		s := "  hello  "
		resp := arkmodel.ChatCompletionResponse{
			Choices: []*arkmodel.ChatCompletionChoice{
				{Message: arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{StringValue: &s}}},
			},
		}
		got, err := ExtractARKContent(resp)
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if got != "hello" {
			t.Fatalf("got %q want hello", got)
		}
	})

	t.Run("string value all whitespace -> error", func(t *testing.T) {
		s := "   "
		resp := arkmodel.ChatCompletionResponse{
			Choices: []*arkmodel.ChatCompletionChoice{
				{Message: arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{StringValue: &s}}},
			},
		}
		if _, err := ExtractARKContent(resp); err == nil {
			t.Fatal("expected error for empty content")
		}
	})

	t.Run("list value happy path", func(t *testing.T) {
		resp := arkmodel.ChatCompletionResponse{
			Choices: []*arkmodel.ChatCompletionChoice{
				{Message: arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{
					ListValue: []*arkmodel.ChatCompletionMessageContentPart{
						{Text: "alpha"},
						{Text: "beta"},
					},
				}}},
			},
		}
		got, err := ExtractARKContent(resp)
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if !strings.Contains(got, "alpha") || !strings.Contains(got, "beta") {
			t.Fatalf("got %q", got)
		}
	})

	t.Run("list value all empty -> error", func(t *testing.T) {
		resp := arkmodel.ChatCompletionResponse{
			Choices: []*arkmodel.ChatCompletionChoice{
				{Message: arkmodel.ChatCompletionMessage{Content: &arkmodel.ChatCompletionMessageContent{
					ListValue: []*arkmodel.ChatCompletionMessageContentPart{
						{Text: "  "},
						nil,
					},
				}}},
			},
		}
		if _, err := ExtractARKContent(resp); err == nil {
			t.Fatal("expected error for empty list content")
		}
	})
}
