package migrations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateExternalConnectionsMigrationProtectsOAuthSecrets(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("066_create_external_connections.sql"))
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS external_connections",
		"access_token_ciphertext TEXT NOT NULL",
		"refresh_token_ciphertext TEXT NOT NULL DEFAULT ''",
		"CREATE TABLE IF NOT EXISTS external_oauth_states",
		"state_hash VARCHAR(64) NOT NULL UNIQUE",
		"CREATE TABLE IF NOT EXISTS external_connection_audits",
	} {
		if !strings.Contains(string(raw), fragment) {
			t.Fatalf("migration is missing %q", fragment)
		}
	}
}
