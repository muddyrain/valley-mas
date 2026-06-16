package garden

import (
	"encoding/json"
	"math/rand"
	"os"
	"sort"
)

type AssetEntry struct {
	Key         string            `json:"key"`
	NameZH      string            `json:"name_zh"`
	Rarity      string            `json:"rarity"`
	Tags        []string          `json:"concept_tags"`
	Stages      map[string]string `json:"stages"`
	PaletteHint string            `json:"palette_hint,omitempty"`
}

type Manifest struct{ entries []AssetEntry }

func NewManifest(entries []AssetEntry) *Manifest { return &Manifest{entries: entries} }

func LoadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var entries []AssetEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, err
	}
	return NewManifest(entries), nil
}

// Match 按 (rarity 过滤) → (tag 重合度排序) → (top3 随机) 选一张图
func (m *Manifest) Match(tags []string, rarity string, rng *rand.Rand) *AssetEntry {
	cands := []AssetEntry{}
	for _, e := range m.entries {
		if e.Rarity == rarity {
			cands = append(cands, e)
		}
	}
	if len(cands) == 0 {
		return nil
	}
	score := func(e AssetEntry) int {
		n := 0
		for _, t := range tags {
			for _, et := range e.Tags {
				if t == et {
					n++
				}
			}
		}
		return n
	}
	sort.SliceStable(cands, func(i, j int) bool { return score(cands[i]) > score(cands[j]) })
	// top3 随机：在 score 与首位并列的候选中随机选一个，cap 到 3
	maxScore := score(cands[0])
	top := 1
	for top < len(cands) && top < 3 && score(cands[top]) == maxScore {
		top++
	}
	pick := cands[rng.Intn(top)]
	return &pick
}

func (m *Manifest) Get(key string) *AssetEntry {
	for _, e := range m.entries {
		if e.Key == key {
			return &e
		}
	}
	return nil
}
