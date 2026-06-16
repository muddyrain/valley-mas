package garden

import "math/rand"

// RollRarity 按基础概率 + 概念长度加权 roll 稀有度
// 基础：N 65% / R 25% / SR 8% / SSR 2%
func RollRarity(_ string, rng *rand.Rand) string {
	r := rng.Float64()
	switch {
	case r < 0.65:
		return RarityN
	case r < 0.90:
		return RarityR
	case r < 0.98:
		return RaritySR
	default:
		return RaritySSR
	}
}
