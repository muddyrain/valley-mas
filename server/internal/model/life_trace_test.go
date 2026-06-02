package model

import (
	"reflect"
	"strings"
	"testing"
)

func TestLifeTracePantryThumbnailURLUsesTextColumn(t *testing.T) {
	field, ok := reflect.TypeOf(LifeTracePantryItem{}).FieldByName("ThumbnailURL")
	if !ok {
		t.Fatal("expected ThumbnailURL field to exist")
	}

	gormTag := field.Tag.Get("gorm")
	if !strings.Contains(gormTag, "type:text") {
		t.Fatalf("expected ThumbnailURL to use text column, got gorm tag %q", gormTag)
	}
	if strings.Contains(gormTag, "size:800") {
		t.Fatalf("expected ThumbnailURL to stop using size:800, got gorm tag %q", gormTag)
	}
}
