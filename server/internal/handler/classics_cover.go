package handler

import (
	"fmt"
	"hash/fnv"
	"html"
	"net/url"
	"strings"
)

var classicsCoverPalette = []struct {
	Start string
	End   string
}{
	{Start: "#F59E0B", End: "#FB7185"},
	{Start: "#EF4444", End: "#F59E0B"},
	{Start: "#8B5CF6", End: "#EC4899"},
	{Start: "#0EA5E9", End: "#6366F1"},
	{Start: "#10B981", End: "#14B8A6"},
	{Start: "#F97316", End: "#F43F5E"},
}

func resolveClassicsCoverURL(rawCoverURL, title, category, dynasty string) string {
	cover := strings.TrimSpace(rawCoverURL)
	if cover != "" {
		return cover
	}
	return buildClassicsInlineCover(title, category, dynasty)
}

func buildClassicsInlineCover(title, category, dynasty string) string {
	mainTitle := trimRuneCount(strings.TrimSpace(title), 10)
	if mainTitle == "" {
		mainTitle = "白话经典"
	}

	subtitle := strings.TrimSpace(category)
	if subtitle == "" {
		subtitle = strings.TrimSpace(dynasty)
	}
	subtitle = trimRuneCount(subtitle, 12)

	palette := pickClassicsCoverPalette(mainTitle)
	svg := fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%%" stop-color="%s"/><stop offset="100%%" stop-color="%s"/></linearGradient></defs><rect width="320" height="480" rx="20" fill="url(#g)"/><rect x="22" y="24" width="276" height="432" rx="16" fill="rgba(255,255,255,0.14)"/><text x="50%%" y="44%%" text-anchor="middle" font-size="40" font-weight="700" fill="#fff" font-family="PingFang SC, Microsoft YaHei, Arial">%s</text><text x="50%%" y="55%%" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.95)" font-family="PingFang SC, Microsoft YaHei, Arial">%s</text><text x="50%%" y="92%%" text-anchor="middle" font-size="14" fill="rgba(255,255,255,0.78)" font-family="PingFang SC, Microsoft YaHei, Arial">Valley Classics</text></svg>`,
		palette.Start,
		palette.End,
		html.EscapeString(mainTitle),
		html.EscapeString(subtitle),
	)

	return "data:image/svg+xml;utf8," + url.PathEscape(svg)
}

func pickClassicsCoverPalette(seed string) struct {
	Start string
	End   string
} {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(seed))
	return classicsCoverPalette[int(hasher.Sum32())%len(classicsCoverPalette)]
}

func trimRuneCount(s string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}
