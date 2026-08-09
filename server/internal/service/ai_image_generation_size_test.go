package service

import (
	"testing"
	"valley-server/internal/model"
)

func TestResolveAIImageRequestedSizeRaisesSeedream5TwoKToValidPixelCount(t *testing.T) {
	seedream5 := model.AIModel{Provider: "volcengine", ModelID: "doubao-seedream-5-0-260128"}
	tests := map[string]string{
		"1:1":  "2048x2048",
		"4:3":  "2304x1728",
		"3:4":  "1728x2304",
		"16:9": "2560x1440",
		"9:16": "1440x2560",
	}
	for aspectRatio, expected := range tests {
		if size := resolveAIImageRequestedSize(seedream5, aspectRatio, "2K"); size != expected {
			t.Fatalf("aspect ratio %s: size = %q, want %q", aspectRatio, size, expected)
		}
	}
}

func TestResolveAIImageRequestedSizeKeepsGenericMapping(t *testing.T) {
	item := model.AIModel{Provider: "siliconflow", ModelID: "Kwai-Kolors/Kolors"}
	if size := resolveAIImageRequestedSize(item, "16:9", "2K"); size != "2048x1152" {
		t.Fatalf("generic size = %q", size)
	}
}
