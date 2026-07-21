package handler

import (
	"reflect"
	"testing"
)

func TestParseAIGeneratedTitles(t *testing.T) {
	got := parseAIGeneratedTitles("1. 「星空小屋」\n2、星空小屋\n- 海边晚霞\n这是一条超过二十个字符的无效标题应该被忽略")
	want := []string{"星空小屋", "海边晚霞"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("titles = %#v, want %#v", got, want)
	}
}

func TestParseAIGeneratedTagNames(t *testing.T) {
	got := parseAIGeneratedTagNames("1. 国风\n2、国风\n- 水墨（传统风格）\n3. 清新\n这是一条明显超过十个字的无效标签", 8)
	want := []string{"国风", "水墨", "清新"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("tags = %#v, want %#v", got, want)
	}
}
