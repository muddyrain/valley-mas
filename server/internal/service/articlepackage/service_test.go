package articlepackage

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type fakeObjectStore struct {
	objects     map[string][]byte
	etags       map[string]string
	deleted     []string
	readCalls   int
	downloadURL string
}

func (s *fakeObjectStore) SignPut(_ context.Context, key string, _ time.Duration) (UploadTicket, error) {
	return UploadTicket{URL: "https://upload.invalid/" + key, Headers: map[string]string{"x-tos-acl": "private"}}, nil
}

func (s *fakeObjectStore) Head(_ context.Context, key string) (ObjectInfo, error) {
	content, ok := s.objects[key]
	if !ok {
		return ObjectInfo{}, errors.New("missing object")
	}
	return ObjectInfo{Size: int64(len(content)), ETag: s.etags[key]}, nil
}

func (s *fakeObjectStore) ReadRange(_ context.Context, key, etag string, start, end int64) ([]byte, error) {
	s.readCalls++
	if s.etags[key] != etag {
		return nil, errors.New("etag mismatch")
	}
	content := s.objects[key]
	if start < 0 || end >= int64(len(content)) || end < start {
		return nil, fmt.Errorf("bad range %d-%d", start, end)
	}
	return append([]byte(nil), content[start:end+1]...), nil
}

func (s *fakeObjectStore) Copy(_ context.Context, sourceKey, destinationKey, etag string) (string, error) {
	if s.etags[sourceKey] != etag {
		return "", errors.New("etag mismatch")
	}
	s.objects[destinationKey] = append([]byte(nil), s.objects[sourceKey]...)
	s.etags[destinationKey] = "promoted-etag"
	return "promoted-etag", nil
}

func (s *fakeObjectStore) Delete(_ context.Context, key string) error {
	s.deleted = append(s.deleted, key)
	delete(s.objects, key)
	delete(s.etags, key)
	return nil
}

func (s *fakeObjectStore) SignGet(_ context.Context, _ string, _ time.Duration, _ string) (string, error) {
	return s.downloadURL, nil
}

func setupService(t *testing.T, now time.Time) (*Service, *gorm.DB, *fakeObjectStore) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Post{}, &model.ArticlePackage{}); err != nil {
		t.Fatal(err)
	}
	store := &fakeObjectStore{objects: map[string][]byte{}, etags: map[string]string{}, downloadURL: "https://download.invalid/signed"}
	service := NewService(db, store)
	service.now = func() time.Time { return now }
	return service, db, store
}

func loadPackageRow(t *testing.T, db *gorm.DB, id model.Int64String) model.ArticlePackage {
	t.Helper()
	var row model.ArticlePackage
	if err := db.First(&row, id).Error; err != nil {
		t.Fatal(err)
	}
	return row
}

func TestCreateUploadAndConfirmArePrivateAndIdempotent(t *testing.T) {
	now := time.Date(2026, 8, 26, 8, 0, 0, 0, time.UTC)
	service, db, store := setupService(t, now)
	archive := makeZIP(t, zipFixtureEntry{name: "README.md", body: []byte("# hello\n"), method: zip.Deflate})

	created, err := service.CreateUpload(context.Background(), 42, "source.zip", int64(len(archive)))
	if err != nil {
		t.Fatalf("CreateUpload() error = %v", err)
	}
	if created.Headers["x-tos-acl"] != "private" || created.ExpiresAt.Sub(now) != UploadTicketTTL {
		t.Fatalf("unexpected ticket: %+v", created)
	}
	var packageRow model.ArticlePackage
	if err := db.First(&packageRow, created.Package.ID).Error; err != nil {
		t.Fatal(err)
	}
	if packageRow.Status != StatusUploading || packageRow.ExpiresAt == nil || packageRow.ExpiresAt.Sub(now) != TemporaryPackageTTL {
		t.Fatalf("unexpected package row: %+v", packageRow)
	}
	store.objects[packageRow.StorageKey] = archive
	store.etags[packageRow.StorageKey] = "upload-etag"

	confirmed, err := service.Confirm(context.Background(), 42, packageRow.ID)
	if err != nil {
		t.Fatalf("Confirm() error = %v", err)
	}
	firstReadCalls := store.readCalls
	if confirmed.Status != StatusReady || confirmed.EntryCount != 1 || confirmed.DefaultPath != "README.md" {
		t.Fatalf("unexpected confirmed package: %+v", confirmed)
	}
	persisted := loadPackageRow(t, db, packageRow.ID)
	expectedHash := sha256.Sum256(archive)
	if persisted.SHA256 != hex.EncodeToString(expectedHash[:]) {
		t.Fatalf("persisted SHA-256 = %q", persisted.SHA256)
	}
	confirmedAgain, err := service.Confirm(context.Background(), 42, packageRow.ID)
	if err != nil || confirmedAgain.Status != StatusReady {
		t.Fatalf("second Confirm() = %+v, %v", confirmedAgain, err)
	}
	if store.readCalls != firstReadCalls {
		t.Fatal("idempotent confirmation re-read object storage")
	}
}

func TestConfirmRejectsObjectSizeMismatch(t *testing.T) {
	service, db, store := setupService(t, time.Now())
	created, err := service.CreateUpload(context.Background(), 42, "source.zip", 100)
	if err != nil {
		t.Fatal(err)
	}
	row := loadPackageRow(t, db, created.Package.ID)
	store.objects[row.StorageKey] = []byte("short")
	store.etags[row.StorageKey] = "etag"
	if _, err := service.Confirm(context.Background(), 42, created.Package.ID); err == nil {
		t.Fatal("Confirm() accepted mismatched object size")
	}
}

func TestPreviewReadsOnlyTrustedCompressedRange(t *testing.T) {
	service, db, store := setupService(t, time.Now())
	archive := makeZIP(t, zipFixtureEntry{name: "README.md", body: []byte("# hello\n"), method: zip.Deflate})
	created, err := service.CreateUpload(context.Background(), 42, "source.zip", int64(len(archive)))
	if err != nil {
		t.Fatal(err)
	}
	row := loadPackageRow(t, db, created.Package.ID)
	store.objects[row.StorageKey] = archive
	store.etags[row.StorageKey] = "etag"
	if _, err := service.Confirm(context.Background(), 42, created.Package.ID); err != nil {
		t.Fatal(err)
	}
	store.readCalls = 0
	preview, err := service.Preview(context.Background(), created.Package.ID, "README.md")
	if err != nil {
		t.Fatal(err)
	}
	if string(preview.Content) != "# hello\n" || preview.Kind != PreviewMarkdown || store.readCalls != 1 {
		t.Fatalf("unexpected preview: %+v readCalls=%d", preview, store.readCalls)
	}
	if int64(len(store.objects[row.StorageKey])) <= int64(len(preview.Content)) {
		t.Fatal("fixture must prove preview did not need the full archive")
	}
}

func TestPromoteCopiesBeforeBindingAndDeletesTemporaryObject(t *testing.T) {
	service, db, store := setupService(t, time.Now())
	archive := makeZIP(t, zipFixtureEntry{name: "README.md", body: []byte("ok"), method: zip.Store})
	created, err := service.CreateUpload(context.Background(), 42, "source.zip", int64(len(archive)))
	if err != nil {
		t.Fatal(err)
	}
	temporaryKey := loadPackageRow(t, db, created.Package.ID).StorageKey
	store.objects[temporaryKey] = archive
	store.etags[temporaryKey] = "etag"
	if _, err := service.Confirm(context.Background(), 42, created.Package.ID); err != nil {
		t.Fatal(err)
	}
	postID := model.Int64String(77)
	promoted, err := service.Promote(context.Background(), 42, created.Package.ID, postID)
	if err != nil {
		t.Fatal(err)
	}
	if promoted.Status != StatusBound || promoted.PostID == nil || *promoted.PostID != postID || promoted.StorageKey == temporaryKey {
		t.Fatalf("unexpected promoted package: %+v", promoted)
	}
	if _, exists := store.objects[promoted.StorageKey]; !exists {
		t.Fatal("durable object missing")
	}
	if len(store.deleted) != 1 || store.deleted[0] != temporaryKey {
		t.Fatalf("temporary deletion = %v", store.deleted)
	}
	var persisted model.ArticlePackage
	if err := db.First(&persisted, created.Package.ID).Error; err != nil || persisted.StorageKey != promoted.StorageKey {
		t.Fatalf("persisted package = %+v, %v", persisted, err)
	}
}

func TestCreateUploadRejectsNonZIPAndLimit(t *testing.T) {
	service, _, _ := setupService(t, time.Now())
	for _, test := range []struct {
		name string
		size int64
	}{
		{name: "source.tar", size: 100},
		{name: "source.zip", size: MaxArchiveBytes + 1},
	} {
		if _, err := service.CreateUpload(context.Background(), 42, test.name, test.size); err == nil {
			t.Fatalf("CreateUpload(%q, %d) accepted invalid input", test.name, test.size)
		}
	}
}

func TestManifestJSONRoundTrip(t *testing.T) {
	manifest := Manifest{EntryCount: 1, Entries: []ManifestEntry{{Path: "a.txt", PreviewKind: PreviewText}}}
	encoded, err := EncodeManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := DecodeManifest(encoded)
	if err != nil || !bytes.Equal([]byte(decoded.Entries[0].Path), []byte("a.txt")) {
		t.Fatalf("round trip = %+v, %v", decoded, err)
	}
}

func TestSummaryFromRowSanitizesLegacySensitiveManifest(t *testing.T) {
	manifest := Manifest{
		DefaultPath: ".env",
		Entries: []ManifestEntry{
			{Path: ".env", PreviewKind: PreviewText, MediaType: "text/plain; charset=utf-8"},
			{Path: "src/index.ts", PreviewKind: PreviewText, MediaType: "text/plain; charset=utf-8"},
		},
	}

	summary := summaryFromRow(model.ArticlePackage{}, manifest)
	if summary.DefaultPath != "src/index.ts" {
		t.Fatalf("DefaultPath = %q", summary.DefaultPath)
	}
	if summary.Entries[0].PreviewKind != PreviewMetadata || !summary.Entries[0].Sensitive {
		t.Fatalf("legacy sensitive entry was not sanitized: %+v", summary.Entries[0])
	}
}
