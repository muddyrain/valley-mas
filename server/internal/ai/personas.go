package ai

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
	"valley-server/internal/mindarena"
)

const (
	maxPersonaStanceRunes      = 12
	maxPersonaCatchphraseRunes = 18
)

func defaultMindArenaPersonas() []mindarena.Persona {
	return mindarena.DefaultPersonas(5)
}

func normalizeGeneratedPersonas(generated []mindarena.Persona) []mindarena.Persona {
	defaults := defaultMindArenaPersonas()
	if len(generated) == 0 {
		return defaults
	}

	used := make(map[int]bool, len(generated))
	for i := range defaults {
		if matched, matchedIdx := findGeneratedPersonaMatch(defaults[i], generated, used); matched != nil {
			used[matchedIdx] = true
			mergeGeneratedPersona(&defaults[i], *matched)
			continue
		}

		if i < len(generated) {
			mergeGeneratedPersona(&defaults[i], generated[i])
		}
	}

	return defaults
}

func normalizeGeneratedPersona(generated mindarena.Persona, target mindarena.Persona) mindarena.Persona {
	normalized := target
	mergeGeneratedPersona(&normalized, generated)
	return normalized
}

func buildSinglePersonaPromptInput(topic string, mode string, persona mindarena.Persona, index int, count int) string {
	payload := struct {
		Topic          string            `json:"topic"`
		Mode           string            `json:"mode"`
		PersonaIndex   int               `json:"personaIndex"`
		PersonaCount   int               `json:"personaCount"`
		CurrentPersona mindarena.Persona `json:"currentPersona"`
	}{
		Topic:          strings.TrimSpace(topic),
		Mode:           strings.TrimSpace(mode),
		PersonaIndex:   index + 1,
		PersonaCount:   count,
		CurrentPersona: persona,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func mergeGeneratedPersona(target *mindarena.Persona, generated mindarena.Persona) {
	if stance := strings.TrimSpace(generated.Stance); stance != "" {
		target.Stance = truncatePersonaText(stance, maxPersonaStanceRunes)
	}
	if catchphrase := strings.TrimSpace(generated.Catchphrase); catchphrase != "" {
		target.Catchphrase = truncatePersonaText(catchphrase, maxPersonaCatchphraseRunes)
	}
}

func findGeneratedPersonaMatch(target mindarena.Persona, generated []mindarena.Persona, used map[int]bool) (*mindarena.Persona, int) {
	for i := range generated {
		if used[i] {
			continue
		}
		if generated[i].ID == target.ID || generated[i].Name == target.Name {
			return &generated[i], i
		}
	}
	return nil, -1
}

func truncatePersonaText(value string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return strings.TrimSpace(string(runes[:limit]))
}
