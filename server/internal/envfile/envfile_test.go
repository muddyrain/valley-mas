package envfile

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadFileAcceptsUTF8BOM(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, append([]byte{0xEF, 0xBB, 0xBF}, []byte("VALLEY_ENVFILE_TEST=loaded\n")...), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("VALLEY_ENVFILE_TEST", "")

	if err := loadFile(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("VALLEY_ENVFILE_TEST"); got != "loaded" {
		t.Fatalf("loaded value = %q, want loaded", got)
	}
}
