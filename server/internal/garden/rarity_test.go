package garden

import (
	"math/rand"
	"testing"
)

func TestRollRarityDistribution(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	counts := map[string]int{}
	for i := 0; i < 10000; i++ {
		counts[RollRarity("中性概念", rng)]++
	}
	if counts["N"] < 5000 {
		t.Fatalf("N 比例过低：%v", counts)
	}
	if counts["SSR"] > 1000 {
		t.Fatalf("SSR 比例过高：%v", counts)
	}
	for _, r := range []string{RarityN, RarityR, RaritySR, RaritySSR} {
		if counts[r] == 0 {
			t.Fatalf("rarity %s 未出现：%v", r, counts)
		}
	}
}
