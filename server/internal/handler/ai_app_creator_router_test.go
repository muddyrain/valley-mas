package handler

import (
	"encoding/json"
	"testing"
)

func TestBuildDeterministicCreatorToolCallRoutesExplicitExport(t *testing.T) {
	call, reply, ok := buildDeterministicCreatorToolCall(
		"把以下内容导出为 Markdown 文件，文件名叫阶段四验收：标题：创作闭环；正文：文档导出已经开始验收。",
		[]string{"document.export"},
	)
	if !ok || call.Name != "document.export" || reply == "" {
		t.Fatalf("call=%#v reply=%q ok=%v", call, reply, ok)
	}
	var args map[string]any
	_ = json.Unmarshal(call.Args, &args)
	if args["format"] != "markdown" || args["fileName"] != "阶段四验收" || args["content"] != "文档导出已经开始验收。" {
		t.Fatalf("args = %#v", args)
	}
}

func TestBuildDeterministicCreatorToolCallRoutesExplicitBlogPublish(t *testing.T) {
	call, _, ok := buildDeterministicCreatorToolCall(
		"发布博客，标题：阶段四公开文章；正文：这是发布确认验收。；可见范围：公开",
		[]string{"blog.publish"},
	)
	if !ok || call.Name != "blog.publish" {
		t.Fatalf("call=%#v ok=%v", call, ok)
	}
	var args map[string]any
	_ = json.Unmarshal(call.Args, &args)
	if args["title"] != "阶段四公开文章" || args["content"] != "这是发布确认验收。" || args["visibility"] != "public" {
		t.Fatalf("args = %#v", args)
	}
}

func TestBuildDeterministicCreatorToolCallDoesNotGuessMissingContent(t *testing.T) {
	for _, message := range []string{"帮我导出一下", "发布一篇博客", "把内容保存下来"} {
		if call, _, ok := buildDeterministicCreatorToolCall(message, []string{"document.export", "blog.publish"}); ok {
			t.Fatalf("unexpected route for %q: %#v", message, call)
		}
	}
}
