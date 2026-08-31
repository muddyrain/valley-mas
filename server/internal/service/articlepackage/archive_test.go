package articlepackage

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"io/fs"
	"strings"
	"testing"
)

type zipFixtureEntry struct {
	name   string
	body   []byte
	method uint16
	mode   fs.FileMode
}

func makeZIP(t *testing.T, entries ...zipFixtureEntry) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.name, Method: entry.method}
		if entry.mode != 0 {
			header.SetMode(entry.mode)
		}
		file, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write(entry.body); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestInspectArchiveBuildsTrustedManifest(t *testing.T) {
	archive := makeZIP(t,
		zipFixtureEntry{name: "demo/README.md", body: []byte("# Demo\n"), method: zip.Deflate},
		zipFixtureEntry{name: "demo/src/main.ts", body: []byte("export const ok = true\n"), method: zip.Store},
		zipFixtureEntry{name: "demo/assets/cover.webp", body: []byte("RIFF-not-a-real-image"), method: zip.Deflate},
		zipFixtureEntry{name: "demo/demo.gif", body: []byte("GIF89a"), method: zip.Store},
	)

	manifest, err := InspectArchive(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("InspectArchive() error = %v", err)
	}
	if manifest.EntryCount != 4 || manifest.ExpandedSize == 0 {
		t.Fatalf("unexpected summary: %+v", manifest)
	}
	if manifest.DefaultPath != "demo/README.md" {
		t.Fatalf("DefaultPath = %q", manifest.DefaultPath)
	}
	if manifest.CollapsibleRoot != "demo" {
		t.Fatalf("CollapsibleRoot = %q", manifest.CollapsibleRoot)
	}

	entries := map[string]ManifestEntry{}
	for _, entry := range manifest.Entries {
		entries[entry.Path] = entry
		if entry.DataOffset < 0 || entry.DataOffset+int64(entry.CompressedSize) > int64(len(archive)) {
			t.Fatalf("invalid compressed range for %s: %+v", entry.Path, entry)
		}
	}
	if entries["demo/README.md"].PreviewKind != PreviewMarkdown {
		t.Fatalf("README preview = %q", entries["demo/README.md"].PreviewKind)
	}
	if entries["demo/src/main.ts"].PreviewKind != PreviewText {
		t.Fatalf("TypeScript preview = %q", entries["demo/src/main.ts"].PreviewKind)
	}
	if entries["demo/assets/cover.webp"].PreviewKind != PreviewImage {
		t.Fatalf("WebP preview = %q", entries["demo/assets/cover.webp"].PreviewKind)
	}
	if entries["demo/demo.gif"].PreviewKind != PreviewMetadata {
		t.Fatalf("GIF preview = %q", entries["demo/demo.gif"].PreviewKind)
	}

	entry := entries["demo/README.md"]
	content, err := ReadPreview(bytes.NewReader(archive[entry.DataOffset:entry.DataOffset+int64(entry.CompressedSize)]), entry)
	if err != nil {
		t.Fatalf("ReadPreview() error = %v", err)
	}
	if string(content) != "# Demo\n" {
		t.Fatalf("preview = %q", content)
	}
}

func TestInspectArchiveNeverPreviewsSensitiveFiles(t *testing.T) {
	archive := makeZIP(t,
		zipFixtureEntry{name: ".env", body: []byte("TOKEN=secret\n"), method: zip.Store},
		zipFixtureEntry{name: "config/.env.production", body: []byte("TOKEN=secret\n"), method: zip.Deflate},
		zipFixtureEntry{name: ".npmrc", body: []byte("//registry/:_authToken=secret\n"), method: zip.Store},
		zipFixtureEntry{name: "keys/id_ed25519", body: []byte("private-key"), method: zip.Store},
		zipFixtureEntry{name: "keys/server.pem", body: []byte("private-key"), method: zip.Store},
		zipFixtureEntry{name: "src/index.ts", body: []byte("export const ok = true\n"), method: zip.Store},
	)

	manifest, err := InspectArchive(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("InspectArchive() error = %v", err)
	}
	entries := map[string]ManifestEntry{}
	for _, entry := range manifest.Entries {
		entries[entry.Path] = entry
	}
	for _, path := range []string{".env", "config/.env.production", ".npmrc", "keys/id_ed25519", "keys/server.pem"} {
		if entries[path].PreviewKind != PreviewMetadata {
			t.Fatalf("sensitive file %q preview = %q", path, entries[path].PreviewKind)
		}
		if !entries[path].Sensitive {
			t.Fatalf("sensitive file %q was not marked sensitive", path)
		}
	}
	if entries["src/index.ts"].PreviewKind != PreviewText {
		t.Fatalf("safe source preview = %q", entries["src/index.ts"].PreviewKind)
	}
}

func TestInspectArchiveRejectsUnsafeEntries(t *testing.T) {
	tests := []struct {
		name  string
		entry zipFixtureEntry
	}{
		{name: "parent traversal", entry: zipFixtureEntry{name: "../secret.txt", body: []byte("x"), method: zip.Store}},
		{name: "absolute", entry: zipFixtureEntry{name: "/secret.txt", body: []byte("x"), method: zip.Store}},
		{name: "windows absolute", entry: zipFixtureEntry{name: "C:/secret.txt", body: []byte("x"), method: zip.Store}},
		{name: "backslash", entry: zipFixtureEntry{name: "folder\\secret.txt", body: []byte("x"), method: zip.Store}},
		{name: "non canonical", entry: zipFixtureEntry{name: "folder/../secret.txt", body: []byte("x"), method: zip.Store}},
		{name: "symlink", entry: zipFixtureEntry{name: "link", body: []byte("target"), method: zip.Store, mode: fs.ModeSymlink | 0o777}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			archive := makeZIP(t, test.entry)
			if _, err := InspectArchive(bytes.NewReader(archive), int64(len(archive))); err == nil {
				t.Fatal("InspectArchive() accepted unsafe entry")
			}
		})
	}
}

func TestInspectArchiveRejectsDuplicateNormalizedPath(t *testing.T) {
	archive := makeZIP(t,
		zipFixtureEntry{name: "README.md", body: []byte("first"), method: zip.Store},
		zipFixtureEntry{name: "README.md", body: []byte("second"), method: zip.Store},
	)
	if _, err := InspectArchive(bytes.NewReader(archive), int64(len(archive))); err == nil {
		t.Fatal("InspectArchive() accepted duplicate path")
	}
}

func TestInspectArchiveRejectsEncryptedFlag(t *testing.T) {
	archive := makeZIP(t, zipFixtureEntry{name: "README.md", body: []byte("secret"), method: zip.Store})
	for offset := 0; offset+8 <= len(archive); offset++ {
		signature := binary.LittleEndian.Uint32(archive[offset : offset+4])
		if signature == 0x04034b50 {
			flags := binary.LittleEndian.Uint16(archive[offset+6 : offset+8])
			binary.LittleEndian.PutUint16(archive[offset+6:offset+8], flags|1)
		} else if signature == 0x02014b50 {
			flags := binary.LittleEndian.Uint16(archive[offset+8 : offset+10])
			binary.LittleEndian.PutUint16(archive[offset+8:offset+10], flags|1)
		}
	}
	if _, err := InspectArchive(bytes.NewReader(archive), int64(len(archive))); err == nil {
		t.Fatal("InspectArchive() accepted encrypted entry")
	}
}

func TestInspectArchiveAppliesConfiguredLimits(t *testing.T) {
	archive := makeZIP(t,
		zipFixtureEntry{name: "a.txt", body: []byte("1234"), method: zip.Store},
		zipFixtureEntry{name: "b.txt", body: []byte("5678"), method: zip.Store},
	)
	limits := Limits{MaxArchiveBytes: 1024, MaxEntries: 1, MaxExpandedBytes: 128, MaxPathBytes: 512}
	if _, err := inspectArchive(bytes.NewReader(archive), int64(len(archive)), limits); err == nil {
		t.Fatal("inspectArchive() accepted too many entries")
	}
	limits.MaxEntries = 2
	limits.MaxExpandedBytes = 7
	if _, err := inspectArchive(bytes.NewReader(archive), int64(len(archive)), limits); err == nil {
		t.Fatal("inspectArchive() accepted excessive expanded size")
	}
}

func TestReadPreviewRejectsInvalidUTF8AndOversizedText(t *testing.T) {
	sensitive := ManifestEntry{Path: ".env", PreviewKind: PreviewText, CompressionMethod: zip.Store, UncompressedSize: 12, CompressedSize: 12}
	if _, err := ReadPreview(strings.NewReader("TOKEN=secret"), sensitive); err == nil {
		t.Fatal("ReadPreview() accepted a sensitive path from a legacy manifest")
	}

	invalid := ManifestEntry{Path: "bad.txt", PreviewKind: PreviewText, CompressionMethod: zip.Store, UncompressedSize: 1, CompressedSize: 1}
	if _, err := ReadPreview(bytes.NewReader([]byte{0xff}), invalid); err == nil {
		t.Fatal("ReadPreview() accepted invalid UTF-8")
	}

	oversized := ManifestEntry{
		Path: "large.txt", PreviewKind: PreviewText, CompressionMethod: zip.Store,
		UncompressedSize: MaxTextPreviewBytes + 1, CompressedSize: MaxTextPreviewBytes + 1,
	}
	if _, err := ReadPreview(strings.NewReader(""), oversized); err == nil {
		t.Fatal("ReadPreview() accepted oversized text")
	}
}
