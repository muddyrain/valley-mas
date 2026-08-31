package articlepackage

import (
	"archive/zip"
	"compress/flate"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"io/fs"
	pathpkg "path"
	"sort"
	"strings"
	"unicode/utf8"
)

const (
	MaxArchiveBytes      int64  = 64 << 20
	MaxArchiveEntries           = 2048
	MaxExpandedBytes     uint64 = 128 << 20
	MaxArchivePathBytes         = 512
	MaxTextPreviewBytes  uint64 = 1 << 20
	MaxImagePreviewBytes uint64 = 10 << 20
)

type PreviewKind string

const (
	PreviewMetadata PreviewKind = "metadata"
	PreviewText     PreviewKind = "text"
	PreviewMarkdown PreviewKind = "markdown"
	PreviewImage    PreviewKind = "image"
)

type Limits struct {
	MaxArchiveBytes  int64
	MaxEntries       int
	MaxExpandedBytes uint64
	MaxPathBytes     int
}

var DefaultLimits = Limits{
	MaxArchiveBytes:  MaxArchiveBytes,
	MaxEntries:       MaxArchiveEntries,
	MaxExpandedBytes: MaxExpandedBytes,
	MaxPathBytes:     MaxArchivePathBytes,
}

type Manifest struct {
	EntryCount      int             `json:"entryCount"`
	ExpandedSize    uint64          `json:"expandedSize"`
	DefaultPath     string          `json:"defaultPath,omitempty"`
	CollapsibleRoot string          `json:"collapsibleRoot,omitempty"`
	Entries         []ManifestEntry `json:"entries"`
}

type ManifestEntry struct {
	Path              string      `json:"path"`
	Directory         bool        `json:"directory,omitempty"`
	PreviewKind       PreviewKind `json:"previewKind"`
	Sensitive         bool        `json:"sensitive,omitempty"`
	MediaType         string      `json:"mediaType,omitempty"`
	CompressionMethod uint16      `json:"compressionMethod"`
	CompressedSize    uint64      `json:"compressedSize"`
	UncompressedSize  uint64      `json:"uncompressedSize"`
	CRC32             uint32      `json:"crc32"`
	DataOffset        int64       `json:"dataOffset"`
}

func InspectArchive(reader io.ReaderAt, size int64) (Manifest, error) {
	return inspectArchive(reader, size, DefaultLimits)
}

func inspectArchive(reader io.ReaderAt, size int64, limits Limits) (Manifest, error) {
	if reader == nil || size <= 0 || size > limits.MaxArchiveBytes {
		return Manifest{}, fmt.Errorf("ZIP 文件不能为空且不能超过 %dMB", limits.MaxArchiveBytes>>20)
	}
	archive, err := zip.NewReader(reader, size)
	if err != nil {
		return Manifest{}, errors.New("ZIP 文件格式无效")
	}
	if len(archive.File) == 0 || len(archive.File) > limits.MaxEntries {
		return Manifest{}, errors.New("ZIP 文件为空或文件数量超过限制")
	}

	manifest := Manifest{Entries: make([]ManifestEntry, 0, len(archive.File))}
	seen := make(map[string]struct{}, len(archive.File))
	for _, file := range archive.File {
		cleanPath, pathErr := normalizeArchivePath(file.Name, limits.MaxPathBytes)
		if pathErr != nil {
			return Manifest{}, pathErr
		}
		if file.Flags&1 != 0 {
			return Manifest{}, errors.New("ZIP 文件不能包含加密条目")
		}
		if file.Mode()&fs.ModeSymlink != 0 {
			return Manifest{}, errors.New("ZIP 文件不能包含符号链接")
		}
		if _, exists := seen[cleanPath]; exists {
			return Manifest{}, errors.New("ZIP 文件包含重复路径")
		}
		seen[cleanPath] = struct{}{}
		if file.UncompressedSize64 > limits.MaxExpandedBytes-manifest.ExpandedSize {
			return Manifest{}, errors.New("ZIP 解压后的总大小超过限制")
		}
		manifest.ExpandedSize += file.UncompressedSize64

		entry := ManifestEntry{
			Path:              cleanPath,
			Directory:         file.FileInfo().IsDir(),
			CompressionMethod: file.Method,
			CompressedSize:    file.CompressedSize64,
			UncompressedSize:  file.UncompressedSize64,
			CRC32:             file.CRC32,
			PreviewKind:       PreviewMetadata,
		}
		if !entry.Directory {
			entry.Sensitive = isSensitivePreviewPath(cleanPath)
			if !entry.Sensitive {
				entry.PreviewKind, entry.MediaType = classifyPreview(cleanPath, file.UncompressedSize64, file.Method)
			}
			offset, offsetErr := file.DataOffset()
			if offsetErr != nil || offset < 0 || file.CompressedSize64 > uint64(size-offset) {
				return Manifest{}, errors.New("ZIP 文件条目范围无效")
			}
			entry.DataOffset = offset
		}
		manifest.Entries = append(manifest.Entries, entry)
	}

	manifest.EntryCount = len(manifest.Entries)
	sort.Slice(manifest.Entries, func(left, right int) bool {
		return manifest.Entries[left].Path < manifest.Entries[right].Path
	})
	manifest.DefaultPath = chooseDefaultPath(manifest.Entries)
	manifest.CollapsibleRoot = collapsibleRoot(manifest.Entries)
	return manifest, nil
}

func normalizeArchivePath(rawPath string, maxBytes int) (string, error) {
	if rawPath == "" || len(rawPath) > maxBytes || !utf8.ValidString(rawPath) ||
		strings.ContainsAny(rawPath, "\\\x00") || strings.HasPrefix(rawPath, "/") ||
		(len(rawPath) >= 2 && rawPath[1] == ':') {
		return "", errors.New("ZIP 文件包含不安全的文件路径")
	}
	value := strings.TrimSuffix(rawPath, "/")
	cleaned := pathpkg.Clean(value)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || cleaned != value {
		return "", errors.New("ZIP 文件包含不安全的文件路径")
	}
	return cleaned, nil
}

func classifyPreview(filePath string, size uint64, method uint16) (PreviewKind, string) {
	if isSensitivePreviewPath(filePath) {
		return PreviewMetadata, ""
	}
	if method != zip.Store && method != zip.Deflate {
		return PreviewMetadata, ""
	}
	extension := strings.ToLower(pathpkg.Ext(filePath))
	base := strings.ToLower(pathpkg.Base(filePath))
	switch extension {
	case ".jpg", ".jpeg":
		if size <= MaxImagePreviewBytes {
			return PreviewImage, "image/jpeg"
		}
	case ".png":
		if size <= MaxImagePreviewBytes {
			return PreviewImage, "image/png"
		}
	case ".webp":
		if size <= MaxImagePreviewBytes {
			return PreviewImage, "image/webp"
		}
	case ".md", ".markdown":
		if size <= MaxTextPreviewBytes {
			return PreviewMarkdown, "text/markdown; charset=utf-8"
		}
	default:
		if size <= MaxTextPreviewBytes && (isTextExtension(extension) || base == "dockerfile" || base == "makefile") {
			return PreviewText, "text/plain; charset=utf-8"
		}
	}
	return PreviewMetadata, ""
}

func isSensitivePreviewPath(filePath string) bool {
	cleaned := strings.ToLower(strings.TrimSpace(filePath))
	base := pathpkg.Base(cleaned)
	extension := pathpkg.Ext(base)
	if base == ".env" || strings.HasPrefix(base, ".env.") {
		return true
	}
	switch base {
	case ".npmrc", ".pypirc", ".netrc", ".git-credentials", "credentials", "credentials.json",
		"secrets.json", "secret.json", "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519":
		return true
	}
	switch extension {
	case ".pem", ".key", ".p12", ".pfx", ".jks", ".keystore":
		return true
	}
	return cleaned == ".aws/credentials" || cleaned == ".docker/config.json"
}

func isTextExtension(extension string) bool {
	switch extension {
	case ".txt", ".log", ".csv", ".tsv", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".conf", ".env", ".xml", ".html", ".htm", ".svg", ".css", ".scss", ".less", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".py", ".go", ".rs", ".java", ".kt", ".kts", ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".php", ".rb", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".sql", ".graphql", ".gql", ".proto", ".dockerfile":
		return true
	default:
		return false
	}
}

func chooseDefaultPath(entries []ManifestEntry) string {
	readmes := make([]string, 0, 2)
	previewable := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.Directory || entry.PreviewKind == PreviewMetadata {
			continue
		}
		previewable = append(previewable, entry.Path)
		base := strings.ToLower(pathpkg.Base(entry.Path))
		if base == "readme.md" || base == "readme.markdown" {
			readmes = append(readmes, entry.Path)
		}
	}
	if len(readmes) > 0 {
		sort.Slice(readmes, func(left, right int) bool {
			leftDepth := strings.Count(readmes[left], "/")
			rightDepth := strings.Count(readmes[right], "/")
			if leftDepth != rightDepth {
				return leftDepth < rightDepth
			}
			return readmes[left] < readmes[right]
		})
		return readmes[0]
	}
	if len(previewable) > 0 {
		sort.Strings(previewable)
		return previewable[0]
	}
	return ""
}

func collapsibleRoot(entries []ManifestEntry) string {
	root := ""
	foundFile := false
	for _, entry := range entries {
		if entry.Directory {
			continue
		}
		parts := strings.SplitN(entry.Path, "/", 2)
		if len(parts) != 2 {
			return ""
		}
		if !foundFile {
			root = parts[0]
			foundFile = true
		} else if parts[0] != root {
			return ""
		}
	}
	if !foundFile {
		return ""
	}
	return root
}

func ReadPreview(compressed io.Reader, entry ManifestEntry) ([]byte, error) {
	if compressed == nil || entry.Directory || entry.PreviewKind == PreviewMetadata || isSensitivePreviewPath(entry.Path) {
		return nil, errors.New("该文件不支持在线预览")
	}
	limit := MaxTextPreviewBytes
	if entry.PreviewKind == PreviewImage {
		limit = MaxImagePreviewBytes
	}
	if entry.UncompressedSize > limit {
		return nil, errors.New("文件超过在线预览大小限制")
	}

	var reader io.ReadCloser
	switch entry.CompressionMethod {
	case zip.Store:
		reader = io.NopCloser(compressed)
	case zip.Deflate:
		reader = flate.NewReader(compressed)
	default:
		return nil, errors.New("该压缩方式不支持在线预览")
	}
	defer reader.Close()
	content, err := io.ReadAll(io.LimitReader(reader, int64(limit)+1))
	if err != nil || uint64(len(content)) != entry.UncompressedSize {
		return nil, errors.New("读取预览内容失败")
	}
	if crc32.ChecksumIEEE(content) != entry.CRC32 {
		return nil, errors.New("预览内容校验失败")
	}
	if entry.PreviewKind != PreviewImage && !utf8.Valid(content) {
		return nil, errors.New("文本文件必须使用 UTF-8 编码")
	}
	return content, nil
}
