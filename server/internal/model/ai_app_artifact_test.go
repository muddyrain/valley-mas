package model

import (
	"testing"
	"time"
)

func TestAIAppArtifactTemporaryLifecycle(t *testing.T) {
	now := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(72 * time.Hour)
	artifact := AIAppArtifact{ExpiresAt: &expiresAt}

	if !artifact.IsTemporary() {
		t.Fatal("artifact with an expiry and no persisted timestamp should be temporary")
	}
	if artifact.IsExpired(now.Add(71 * time.Hour)) {
		t.Fatal("artifact expired too early")
	}
	if !artifact.IsExpired(now.Add(73 * time.Hour)) {
		t.Fatal("artifact should expire after its deadline")
	}

	persistedAt := now.Add(time.Hour)
	artifact.PersistedAt = &persistedAt
	if artifact.IsTemporary() || artifact.IsExpired(now.Add(100*time.Hour)) {
		t.Fatal("persisted artifacts must no longer use the temporary expiry")
	}
}
