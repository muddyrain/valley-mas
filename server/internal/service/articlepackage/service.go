package articlepackage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	pathpkg "path"
	"strings"
	"time"

	"valley-server/internal/model"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

const (
	StatusUploading = "uploading"
	StatusReady     = "ready"
	StatusBound     = "bound"
	StatusDeleted   = "deleted"

	UploadTicketTTL     = 15 * time.Minute
	TemporaryPackageTTL = 24 * time.Hour
	DownloadTicketTTL   = 5 * time.Minute
	objectHashChunkSize = 4 * 1024 * 1024
)

type UploadTicket struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

type CreateUploadResult struct {
	Package   PackageSummary    `json:"package"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

type ObjectInfo struct {
	Size int64
	ETag string
}

type ObjectStore interface {
	SignPut(ctx context.Context, key string, expires time.Duration) (UploadTicket, error)
	Head(ctx context.Context, key string) (ObjectInfo, error)
	ReadRange(ctx context.Context, key, etag string, start, end int64) ([]byte, error)
	Copy(ctx context.Context, sourceKey, destinationKey, etag string) (string, error)
	Delete(ctx context.Context, key string) error
	SignGet(ctx context.Context, key string, expires time.Duration, disposition string) (string, error)
}

type Service struct {
	db    *gorm.DB
	store ObjectStore
	now   func() time.Time
}

func NewService(db *gorm.DB, store ObjectStore) *Service {
	return &Service{db: db, store: store, now: time.Now}
}

type PackageSummary struct {
	ID              model.Int64String `json:"id"`
	Status          string            `json:"status"`
	OriginalName    string            `json:"originalName"`
	Size            int64             `json:"size"`
	EntryCount      int               `json:"entryCount"`
	ExpandedSize    int64             `json:"expandedSize"`
	DefaultPath     string            `json:"defaultPath,omitempty"`
	CollapsibleRoot string            `json:"collapsibleRoot,omitempty"`
	Entries         []PublicEntry     `json:"entries,omitempty"`
	ConfirmedAt     *time.Time        `json:"confirmedAt,omitempty"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

type PublicEntry struct {
	Path        string      `json:"path"`
	Directory   bool        `json:"directory,omitempty"`
	PreviewKind PreviewKind `json:"previewKind"`
	Sensitive   bool        `json:"sensitive,omitempty"`
	MediaType   string      `json:"mediaType,omitempty"`
	Size        uint64      `json:"size"`
}

type Preview struct {
	Path      string      `json:"path"`
	Kind      PreviewKind `json:"kind"`
	MediaType string      `json:"mediaType"`
	Content   []byte      `json:"-"`
}

func (s *Service) CreateUpload(ctx context.Context, ownerID model.Int64String, originalName string, size int64) (CreateUploadResult, error) {
	if s == nil || s.db == nil || s.store == nil {
		return CreateUploadResult{}, errors.New("文章配套包服务尚未初始化")
	}
	name := cleanOriginalName(originalName)
	if name == "" || !strings.EqualFold(pathpkg.Ext(name), ".zip") {
		return CreateUploadResult{}, errors.New("文章配套包必须是 ZIP 文件")
	}
	if size <= 0 || size > MaxArchiveBytes {
		return CreateUploadResult{}, errors.New("文章配套包不能为空且不能超过 64MB")
	}

	now := s.now().UTC()
	expiresAt := now.Add(TemporaryPackageTTL)
	packageID := model.Int64String(utils.GenerateID())
	key := fmt.Sprintf("article-packages/temp/%s/%s.zip", ownerID.String(), packageID.String())
	row := model.ArticlePackage{
		ID: packageID, OwnerID: ownerID, Status: StatusUploading, StorageKey: key,
		OriginalName: name, Size: size, ManifestJSON: "{}", ExpiresAt: &expiresAt,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return CreateUploadResult{}, fmt.Errorf("创建文章配套包上传记录失败: %w", err)
	}
	ticket, err := s.store.SignPut(ctx, key, UploadTicketTTL)
	if err != nil {
		_ = s.db.WithContext(ctx).Delete(&row).Error
		return CreateUploadResult{}, errors.New("生成文章配套包上传凭证失败，请稍后重试")
	}
	return CreateUploadResult{
		Package: summaryFromRow(row, Manifest{}), URL: ticket.URL, Headers: ticket.Headers,
		ExpiresAt: now.Add(UploadTicketTTL),
	}, nil
}

func (s *Service) Confirm(ctx context.Context, ownerID, packageID model.Int64String) (PackageSummary, error) {
	row, err := s.ownedPackage(ctx, ownerID, packageID)
	if err != nil {
		return PackageSummary{}, err
	}
	if row.Status == StatusReady || row.Status == StatusBound {
		manifest, decodeErr := DecodeManifest(row.ManifestJSON)
		if decodeErr != nil {
			return PackageSummary{}, decodeErr
		}
		return summaryFromRow(row, manifest), nil
	}
	if row.Status != StatusUploading {
		return PackageSummary{}, errors.New("文章配套包当前不能确认")
	}
	if row.ExpiresAt != nil && !row.ExpiresAt.After(s.now()) {
		return PackageSummary{}, errors.New("文章配套包上传已过期，请重新选择文件")
	}

	info, err := s.store.Head(ctx, row.StorageKey)
	if err != nil {
		return PackageSummary{}, errors.New("尚未收到完整的文章配套包")
	}
	if info.Size != row.Size || info.Size <= 0 || info.Size > MaxArchiveBytes {
		return PackageSummary{}, errors.New("上传文件大小与申请记录不一致")
	}
	sha256Value, err := hashObject(ctx, s.store, row.StorageKey, info.ETag, info.Size)
	if err != nil {
		return PackageSummary{}, errors.New("读取文章配套包失败，请稍后重试")
	}
	reader := &remoteReaderAt{ctx: ctx, store: s.store, key: row.StorageKey, etag: info.ETag, size: info.Size}
	manifest, err := InspectArchive(reader, info.Size)
	if err != nil {
		return PackageSummary{}, err
	}
	manifestJSON, err := EncodeManifest(manifest)
	if err != nil {
		return PackageSummary{}, err
	}
	confirmedAt := s.now().UTC()
	updates := map[string]any{
		"status": StatusReady, "etag": info.ETag, "entry_count": manifest.EntryCount,
		"expanded_size": int64(manifest.ExpandedSize), "manifest_json": manifestJSON,
		"sha256": sha256Value, "confirmed_at": confirmedAt,
	}
	result := s.db.WithContext(ctx).Model(&model.ArticlePackage{}).
		Where("id = ? AND owner_id = ? AND status = ?", packageID, ownerID, StatusUploading).
		Updates(updates)
	if result.Error != nil {
		return PackageSummary{}, fmt.Errorf("确认文章配套包失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return s.Confirm(ctx, ownerID, packageID)
	}
	row.Status = StatusReady
	row.ETag = info.ETag
	row.SHA256 = sha256Value
	row.EntryCount = manifest.EntryCount
	row.ExpandedSize = int64(manifest.ExpandedSize)
	row.ManifestJSON = manifestJSON
	row.ConfirmedAt = &confirmedAt
	return summaryFromRow(row, manifest), nil
}

func hashObject(ctx context.Context, store ObjectStore, key, etag string, size int64) (string, error) {
	digest := sha256.New()
	for start := int64(0); start < size; start += objectHashChunkSize {
		end := start + objectHashChunkSize - 1
		if end >= size {
			end = size - 1
		}
		content, err := store.ReadRange(ctx, key, etag, start, end)
		if err != nil {
			return "", err
		}
		if int64(len(content)) != end-start+1 {
			return "", errors.New("文章配套包范围读取长度不一致")
		}
		if _, err := digest.Write(content); err != nil {
			return "", err
		}
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func (s *Service) Promote(ctx context.Context, ownerID, packageID, postID model.Int64String) (model.ArticlePackage, error) {
	row, err := s.ownedPackage(ctx, ownerID, packageID)
	if err != nil {
		return model.ArticlePackage{}, err
	}
	if row.Status == StatusBound {
		if row.PostID != nil && *row.PostID == postID {
			return row, nil
		}
		return model.ArticlePackage{}, errors.New("文章配套包已经绑定到其他文章")
	}
	if row.Status != StatusReady {
		return model.ArticlePackage{}, errors.New("文章配套包尚未确认，不能发布")
	}

	durableKey := fmt.Sprintf("article-packages/posts/%s/%s.zip", postID.String(), packageID.String())
	etag, err := s.store.Copy(ctx, row.StorageKey, durableKey, row.ETag)
	if err != nil {
		return model.ArticlePackage{}, errors.New("保存文章配套包失败，请稍后重试")
	}
	temporaryKey := row.StorageKey
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{
			"post_id": postID, "status": StatusBound, "storage_key": durableKey,
			"etag": etag, "expires_at": nil,
		}
		result := tx.Model(&model.ArticlePackage{}).
			Where("id = ? AND owner_id = ? AND status = ?", packageID, ownerID, StatusReady).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("文章配套包状态已经变化")
		}
		return nil
	}); err != nil {
		_ = s.store.Delete(ctx, durableKey)
		return model.ArticlePackage{}, err
	}
	_ = s.store.Delete(ctx, temporaryKey)
	row.PostID = &postID
	row.Status = StatusBound
	row.StorageKey = durableKey
	row.ETag = etag
	row.ExpiresAt = nil
	return row, nil
}

func (s *Service) Preview(ctx context.Context, packageID model.Int64String, filePath string) (Preview, error) {
	var row model.ArticlePackage
	if err := s.db.WithContext(ctx).Where("id = ? AND status IN ?", packageID, []string{StatusReady, StatusBound}).First(&row).Error; err != nil {
		return Preview{}, errors.New("文章配套包不存在或尚未就绪")
	}
	manifest, err := DecodeManifest(row.ManifestJSON)
	if err != nil {
		return Preview{}, err
	}
	var selected *ManifestEntry
	for index := range manifest.Entries {
		if manifest.Entries[index].Path == filePath {
			selected = &manifest.Entries[index]
			break
		}
	}
	if selected == nil {
		return Preview{}, errors.New("文章配套包中没有这个文件")
	}
	if selected.PreviewKind == PreviewMetadata || selected.Directory || isSensitivePreviewPath(selected.Path) {
		return Preview{}, errors.New("这个文件暂不支持在线预览")
	}
	end := selected.DataOffset + int64(selected.CompressedSize) - 1
	compressed := []byte(nil)
	if selected.CompressedSize > 0 {
		var err error
		compressed, err = s.store.ReadRange(ctx, row.StorageKey, row.ETag, selected.DataOffset, end)
		if err != nil {
			return Preview{}, errors.New("读取预览文件失败，请稍后重试")
		}
	}
	content, err := ReadPreview(bytes.NewReader(compressed), *selected)
	if err != nil {
		return Preview{}, err
	}
	return Preview{Path: selected.Path, Kind: selected.PreviewKind, MediaType: selected.MediaType, Content: content}, nil
}

func (s *Service) SignDownload(ctx context.Context, packageID model.Int64String) (string, error) {
	var row model.ArticlePackage
	if err := s.db.WithContext(ctx).Where("id = ? AND status = ?", packageID, StatusBound).First(&row).Error; err != nil {
		return "", errors.New("文章配套包不存在")
	}
	disposition := fmt.Sprintf("attachment; filename*=UTF-8''%s", urlPathEscape(row.OriginalName))
	return s.store.SignGet(ctx, row.StorageKey, DownloadTicketTTL, disposition)
}

func (s *Service) GetSummary(ctx context.Context, packageID model.Int64String) (PackageSummary, error) {
	var row model.ArticlePackage
	if err := s.db.WithContext(ctx).First(&row, packageID).Error; err != nil {
		return PackageSummary{}, errors.New("文章配套包不存在")
	}
	manifest, err := DecodeManifest(row.ManifestJSON)
	if err != nil {
		return PackageSummary{}, err
	}
	return summaryFromRow(row, manifest), nil
}

func (s *Service) GetOwnedSummary(ctx context.Context, ownerID, packageID model.Int64String) (PackageSummary, error) {
	row, err := s.ownedPackage(ctx, ownerID, packageID)
	if err != nil {
		return PackageSummary{}, err
	}
	manifest, err := DecodeManifest(row.ManifestJSON)
	if err != nil {
		return PackageSummary{}, err
	}
	return summaryFromRow(row, manifest), nil
}

func (s *Service) ScheduleDelete(ctx context.Context, packageID model.Int64String, after time.Time) error {
	if packageID == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Model(&model.ArticlePackage{}).
		Where("id = ?", packageID).
		Updates(map[string]any{"delete_after": after.UTC(), "status": StatusDeleted}).Error
}

// CleanupExpired removes abandoned temporary packages and replaced durable
// packages. Database rows are retained as non-public audit tombstones.
func (s *Service) CleanupExpired(ctx context.Context, limit int) (int, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	now := s.now().UTC()
	var rows []model.ArticlePackage
	if err := s.db.WithContext(ctx).
		Where("(status IN ? AND expires_at IS NOT NULL AND expires_at <= ?) OR (status = ? AND delete_after IS NOT NULL AND delete_after <= ?)", []string{StatusUploading, StatusReady}, now, StatusDeleted, now).
		Limit(limit).Find(&rows).Error; err != nil {
		return 0, err
	}
	deleted := 0
	for _, row := range rows {
		if err := s.store.Delete(ctx, row.StorageKey); err != nil {
			continue
		}
		if err := s.db.WithContext(ctx).Model(&model.ArticlePackage{}).Where("id = ?", row.ID).
			Updates(map[string]any{"storage_key": fmt.Sprintf("deleted/%s", row.ID.String()), "expires_at": nil, "delete_after": nil}).Error; err != nil {
			return deleted, err
		}
		deleted++
	}
	return deleted, nil
}

func EncodeManifest(manifest Manifest) (string, error) {
	content, err := json.Marshal(manifest)
	if err != nil {
		return "", fmt.Errorf("编码文章配套包清单失败: %w", err)
	}
	return string(content), nil
}

func DecodeManifest(content string) (Manifest, error) {
	var manifest Manifest
	if err := json.Unmarshal([]byte(content), &manifest); err != nil {
		return Manifest{}, fmt.Errorf("文章配套包清单损坏: %w", err)
	}
	return manifest, nil
}

func (s *Service) ownedPackage(ctx context.Context, ownerID, packageID model.Int64String) (model.ArticlePackage, error) {
	var row model.ArticlePackage
	if err := s.db.WithContext(ctx).Where("id = ? AND owner_id = ?", packageID, ownerID).First(&row).Error; err != nil {
		return model.ArticlePackage{}, errors.New("文章配套包不存在")
	}
	return row, nil
}

func summaryFromRow(row model.ArticlePackage, manifest Manifest) PackageSummary {
	entries := make([]PublicEntry, 0, len(manifest.Entries))
	effectiveEntries := make([]ManifestEntry, 0, len(manifest.Entries))
	for _, entry := range manifest.Entries {
		sensitive := entry.Sensitive || isSensitivePreviewPath(entry.Path)
		previewKind := entry.PreviewKind
		mediaType := entry.MediaType
		if sensitive {
			previewKind = PreviewMetadata
			mediaType = ""
		}
		effectiveEntry := entry
		effectiveEntry.PreviewKind = previewKind
		effectiveEntry.MediaType = mediaType
		effectiveEntry.Sensitive = sensitive
		effectiveEntries = append(effectiveEntries, effectiveEntry)
		entries = append(entries, PublicEntry{
			Path: entry.Path, Directory: entry.Directory, PreviewKind: previewKind, Sensitive: sensitive,
			MediaType: mediaType, Size: entry.UncompressedSize,
		})
	}
	return PackageSummary{
		ID: row.ID, Status: row.Status, OriginalName: row.OriginalName, Size: row.Size,
		EntryCount: row.EntryCount, ExpandedSize: row.ExpandedSize,
		DefaultPath: chooseDefaultPath(effectiveEntries), CollapsibleRoot: manifest.CollapsibleRoot,
		Entries: entries, ConfirmedAt: row.ConfirmedAt, UpdatedAt: row.UpdatedAt,
	}
}

type remoteReaderAt struct {
	ctx   context.Context
	store ObjectStore
	key   string
	etag  string
	size  int64
}

func (r *remoteReaderAt) ReadAt(buffer []byte, offset int64) (int, error) {
	if len(buffer) == 0 {
		return 0, nil
	}
	if offset < 0 || offset >= r.size {
		return 0, io.EOF
	}
	end := offset + int64(len(buffer)) - 1
	if end >= r.size {
		end = r.size - 1
	}
	content, err := r.store.ReadRange(r.ctx, r.key, r.etag, offset, end)
	if err != nil {
		return 0, err
	}
	n := copy(buffer, content)
	if n != len(buffer) {
		return n, io.EOF
	}
	return n, nil
}

func cleanOriginalName(value string) string {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	value = pathpkg.Base(value)
	if value == "." || value == ".." || value == "" || len(value) > 255 {
		return ""
	}
	return value
}

func urlPathEscape(value string) string {
	var builder strings.Builder
	for _, current := range []byte(value) {
		if (current >= 'a' && current <= 'z') || (current >= 'A' && current <= 'Z') ||
			(current >= '0' && current <= '9') || strings.ContainsRune("-._~", rune(current)) {
			builder.WriteByte(current)
		} else {
			fmt.Fprintf(&builder, "%%%02X", current)
		}
	}
	return builder.String()
}
