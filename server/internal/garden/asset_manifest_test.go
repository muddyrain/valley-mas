package garden

import (
	"math/rand"
	"testing"
)

func TestMatchAssetByTagsAndRarity(t *testing.T) {
	entries := []AssetEntry{
		{Key: "monday_morning", Rarity: "N", Tags: []string{"sleepy", "monday", "coffee"}, Stages: map[string]string{"1": "x.png"}},
		{Key: "unread_msg", Rarity: "R", Tags: []string{"anxious", "phone", "pink"}, Stages: map[string]string{"1": "y.png"}},
		{Key: "kpi", Rarity: "R", Tags: []string{"work", "anxious", "thorny"}, Stages: map[string]string{"1": "z.png"}},
	}
	m := NewManifest(entries)
	rng := rand.New(rand.NewSource(1))

	got := m.Match([]string{"anxious", "phone"}, "R", rng)
	if got == nil || got.Key != "unread_msg" {
		t.Fatalf("expected unread_msg, got %+v", got)
	}

	if m.Match(nil, "SSR", rng) != nil {
		t.Fatalf("expected nil for non-existent rarity")
	}
}

func TestFallbackPicksRandomWithinRarity(t *testing.T) {
	entries := []AssetEntry{
		{Key: "a", Rarity: "N", Tags: []string{"x"}},
		{Key: "b", Rarity: "N", Tags: []string{"y"}},
	}
	m := NewManifest(entries)
	rng := rand.New(rand.NewSource(1))
	got := m.Match([]string{"unrelated"}, "N", rng)
	if got == nil {
		t.Fatalf("expected fallback")
	}
}
