package handler

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	pathpkg "path"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const (
	maxAISkillUploadRequestBytes   = maxAISkillRepositoryArchiveSize + 1<<20
	maxAISkillArchiveEntries       = 2048
	maxAISkillArchiveExpandedBytes = 128 * 1024 * 1024
	maxAISkillArchivePathBytes     = 512
)

func readAISkillImportRequest(c *gin.Context) ([]aiSkillImportSource, []string, error) {
	if !strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		var payload installAISkillPayload
		if c.ShouldBindJSON(&payload) != nil {
			return nil, nil, errors.New("技能链接无效")
		}
		sources, err := discoverAISkillSources(c.Request.Context(), payload.URL)
		return sources, payload.Paths, err
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAISkillUploadRequestBytes)
	if err := c.Request.ParseMultipartForm(1 << 20); err != nil {
		return nil, nil, errors.New("ZIP 文件无效或超过 32MB")
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	} else {
		return nil, nil, errors.New("请选择一个 ZIP 技能包")
	}
	files := c.Request.MultipartForm.File["file"]
	if len(files) != 1 {
		return nil, nil, errors.New("请选择一个 ZIP 技能包")
	}
	fileHeader := files[0]
	if fileHeader.Size <= 0 || fileHeader.Size > maxAISkillRepositoryArchiveSize {
		return nil, nil, errors.New("ZIP 文件不能为空且不能超过 32MB")
	}
	if strings.ToLower(pathpkg.Ext(fileHeader.Filename)) != ".zip" {
		return nil, nil, errors.New("技能包必须是 ZIP 文件")
	}
	file, err := fileHeader.Open()
	if err != nil {
		return nil, nil, errors.New("读取 ZIP 文件失败")
	}
	content, readErr := io.ReadAll(io.LimitReader(file, maxAISkillRepositoryArchiveSize+1))
	closeErr := file.Close()
	if readErr != nil || closeErr != nil || len(content) == 0 || len(content) > maxAISkillRepositoryArchiveSize {
		return nil, nil, errors.New("读取 ZIP 文件失败")
	}
	sources, err := discoverZipAISkillSources(content, fileHeader.Filename)
	return sources, c.PostFormArray("paths"), err
}

func discoverZipAISkillSources(content []byte, fileName string) ([]aiSkillImportSource, error) {
	if len(content) == 0 || len(content) > maxAISkillRepositoryArchiveSize {
		return nil, errors.New("ZIP 文件不能为空且不能超过 32MB")
	}
	archive, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, errors.New("ZIP 文件格式无效")
	}
	if len(archive.File) == 0 || len(archive.File) > maxAISkillArchiveEntries {
		return nil, errors.New("ZIP 文件为空或文件数量超过限制")
	}

	files := make(map[string]*zip.File, len(archive.File))
	var expandedBytes uint64
	for _, file := range archive.File {
		cleanPath, pathErr := normalizeAISkillArchivePath(file.Name)
		if pathErr != nil {
			return nil, pathErr
		}
		if file.UncompressedSize64 > maxAISkillArchiveExpandedBytes-expandedBytes {
			return nil, errors.New("ZIP 解压后的总大小超过 128MB")
		}
		expandedBytes += file.UncompressedSize64
		if file.FileInfo().IsDir() {
			continue
		}
		if file.Mode()&fs.ModeSymlink != 0 {
			return nil, errors.New("ZIP 技能包不能包含符号链接")
		}
		if _, exists := files[cleanPath]; exists {
			return nil, errors.New("ZIP 技能包包含重复文件路径")
		}
		files[cleanPath] = file
	}

	skillPaths := make([]string, 0, maxAISkillCollectionEntries)
	for filePath := range files {
		if pathpkg.Base(filePath) == "SKILL.md" {
			skillPaths = append(skillPaths, filePath)
		}
	}
	sort.Strings(skillPaths)
	if len(skillPaths) == 0 {
		return nil, errors.New("ZIP 中未找到可导入的 SKILL.md")
	}
	if len(skillPaths) > maxAISkillCollectionEntries {
		return nil, errors.New("ZIP 中的技能数量超过 64 个")
	}

	digest := sha256.Sum256(content)
	archiveID := hex.EncodeToString(digest[:])
	sources := make([]aiSkillImportSource, 0, len(skillPaths))
	for _, skillPath := range skillPaths {
		source, buildErr := buildZipAISkillImportSource(
			files,
			skillPaths,
			skillPath,
			archiveID,
			pathpkg.Base(fileName),
		)
		if buildErr != nil {
			return nil, buildErr
		}
		if source.Content != "" {
			sources = append(sources, source)
		}
	}
	if len(sources) == 0 {
		return nil, errors.New("ZIP 中未找到有效的 SKILL.md")
	}
	return sources, nil
}

func normalizeAISkillArchivePath(rawPath string) (string, error) {
	if rawPath == "" || len(rawPath) > maxAISkillArchivePathBytes ||
		strings.ContainsAny(rawPath, "\\\x00") || strings.HasPrefix(rawPath, "/") {
		return "", errors.New("ZIP 技能包包含不安全的文件路径")
	}
	value := strings.TrimSuffix(rawPath, "/")
	cleaned := pathpkg.Clean(value)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || cleaned != value {
		return "", errors.New("ZIP 技能包包含不安全的文件路径")
	}
	return cleaned, nil
}

func buildZipAISkillImportSource(
	files map[string]*zip.File,
	skillPaths []string,
	skillPath string,
	archiveID string,
	fileName string,
) (aiSkillImportSource, error) {
	content, err := readAISkillArchiveText(files[skillPath], maxAIPromptImportSkillSize)
	if err != nil {
		return aiSkillImportSource{}, fmt.Errorf("读取 %s 失败: %w", skillPath, err)
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return aiSkillImportSource{}, fmt.Errorf("%s 不能为空", skillPath)
	}

	skillDirectory := pathpkg.Dir(skillPath)
	if skillDirectory == "." {
		skillDirectory = ""
	}
	referenceFiles := make([]*zip.File, 0, maxAISkillReferenceFiles)
	referenceImageFiles := make([]*zip.File, 0, maxAISkillReferenceFiles)
	scriptFiles := make([]*zip.File, 0, maxAISkillReferenceFiles)
	assetFiles := make([]*zip.File, 0, maxAISkillReferenceFiles)
	ignoredFileCount := 0
	for filePath, file := range files {
		if filePath == skillPath || belongsToAnotherArchivedSkill(filePath, skillPath, skillPaths) {
			continue
		}
		relativePath, belongs := relativeAISkillArchivePath(filePath, skillDirectory)
		if !belongs {
			continue
		}
		switch {
		case strings.HasPrefix(relativePath, "references/"):
			bundledPath := strings.TrimPrefix(relativePath, "references/")
			if bundledPath != "" && strings.Count(bundledPath, "/") <= maxAISkillReferenceDepth &&
				isSupportedAISkillReferenceFile(bundledPath) {
				referenceFiles = append(referenceFiles, file)
			} else if bundledPath != "" && strings.Count(bundledPath, "/") <= maxAISkillReferenceDepth && isSupportedAISkillReferenceImage(bundledPath) {
				referenceImageFiles = append(referenceImageFiles, file)
			} else {
				ignoredFileCount++
			}
		case strings.HasPrefix(relativePath, "scripts/"):
			bundledPath := strings.TrimPrefix(relativePath, "scripts/")
			if bundledPath != "" && strings.Count(bundledPath, "/") <= maxAISkillReferenceDepth &&
				isSupportedAISkillScriptFile(bundledPath) {
				scriptFiles = append(scriptFiles, file)
			} else {
				ignoredFileCount++
			}
		case strings.HasPrefix(relativePath, "assets/"):
			bundledPath := strings.TrimPrefix(relativePath, "assets/")
			if bundledPath != "" && strings.Count(bundledPath, "/") <= maxAISkillReferenceDepth && isSupportedAISkillAssetFile(bundledPath) {
				assetFiles = append(assetFiles, file)
			} else {
				ignoredFileCount++
			}
		default:
			ignoredFileCount++
		}
	}

	referenceContent, referenceCount, ignoredReferences, err := buildAISkillArchiveBundle(referenceFiles, "## 参考资料：")
	if err != nil {
		return aiSkillImportSource{}, err
	}
	scriptContent, scriptCount, ignoredScripts, err := buildAISkillArchiveBundle(scriptFiles, "## 脚本：")
	if err != nil {
		return aiSkillImportSource{}, err
	}
	ignoredFileCount += ignoredReferences + ignoredScripts
	importedFiles, ignoredFiles, err := buildZipAISkillFiles(referenceFiles, referenceImageFiles, scriptFiles, assetFiles)
	if err != nil {
		return aiSkillImportSource{}, err
	}
	ignoredFileCount += ignoredFiles

	fallbackName := strings.TrimSuffix(fileName, pathpkg.Ext(fileName))
	if skillDirectory != "" {
		fallbackName = pathpkg.Base(skillDirectory)
	}
	archiveURL := "zip://" + archiveID
	return aiSkillImportSource{
		RepositoryURL:    archiveURL,
		Path:             skillPath,
		Name:             extractAISkillName(content, fallbackName),
		Description:      extractAISkillDescription(content),
		Content:          content,
		ReferenceContent: referenceContent,
		ReferenceCount:   referenceCount,
		ScriptContent:    scriptContent,
		ScriptCount:      scriptCount,
		IgnoredFileCount: ignoredFileCount,
		Tags:             extractAISkillTags(content),
		URL:              archiveURL + "/" + escapeGitHubRepositoryPath(skillPath),
		Author:           "ZIP 文件",
		Files:            importedFiles,
	}, nil
}

func isSupportedAISkillReferenceImage(fileName string) bool {
	switch strings.ToLower(pathpkg.Ext(fileName)) {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	default:
		return false
	}
}

func isSupportedAISkillAssetFile(fileName string) bool {
	return isSupportedAISkillReferenceFile(fileName) || isSupportedAISkillReferenceImage(fileName)
}

func buildZipAISkillFiles(referenceFiles, referenceImageFiles, scriptFiles, assetFiles []*zip.File) ([]aiSkillImportFile, int, error) {
	files := make([]aiSkillImportFile, 0, len(referenceFiles)+len(referenceImageFiles)+len(scriptFiles)+len(assetFiles))
	ignored := 0
	appendText := func(entries []*zip.File, kind string) error {
		sort.Slice(entries, func(left, right int) bool { return entries[left].Name < entries[right].Name })
		for _, entry := range entries {
			content, err := readAISkillArchiveText(entry, maxAIPromptImportSkillSize)
			if err != nil {
				return err
			}
			if strings.TrimSpace(content) == "" {
				ignored++
				continue
			}
			files = append(files, aiSkillImportFile{Path: entry.Name, Kind: kind, Content: strings.TrimSpace(content), MimeType: "text/plain"})
		}
		return nil
	}
	if err := appendText(referenceFiles, "reference"); err != nil { return nil, ignored, err }
	if err := appendText(scriptFiles, "script"); err != nil { return nil, ignored, err }
	textAssets := make([]*zip.File, 0, len(assetFiles))
	imageAssets := make([]*zip.File, 0, len(assetFiles))
	for _, entry := range assetFiles {
		if isSupportedAISkillReferenceImage(entry.Name) { imageAssets = append(imageAssets, entry) } else { textAssets = append(textAssets, entry) }
	}
	if err := appendText(textAssets, "asset"); err != nil { return nil, ignored, err }
	appendImage := func(entries []*zip.File, kind string) error {
		sort.Slice(entries, func(left, right int) bool { return entries[left].Name < entries[right].Name })
		for _, entry := range entries {
			content, mimeType, err := readAISkillArchiveImage(entry)
			if err != nil { return err }
			files = append(files, aiSkillImportFile{Path: entry.Name, Kind: kind, Binary: content, MimeType: mimeType})
		}
		return nil
	}
	if err := appendImage(referenceImageFiles, "reference_image"); err != nil { return nil, ignored, err }
	if err := appendImage(imageAssets, "asset_image"); err != nil { return nil, ignored, err }
	return files, ignored, nil
}

func readAISkillArchiveImage(file *zip.File) ([]byte, string, error) {
	if file == nil || file.UncompressedSize64 == 0 || file.UncompressedSize64 > maxAISkillReferenceImageBytes {
		return nil, "", errors.New("参考图片必须小于 5MB")
	}
	reader, err := file.Open()
	if err != nil { return nil, "", errors.New("无法打开参考图片") }
	content, readErr := io.ReadAll(io.LimitReader(reader, maxAISkillReferenceImageBytes+1))
	closeErr := reader.Close()
	if readErr != nil || closeErr != nil || len(content) == 0 || len(content) > maxAISkillReferenceImageBytes {
		return nil, "", errors.New("读取参考图片失败")
	}
	mimeType := http.DetectContentType(content)
	if !isSupportedAISkillImageMIME(mimeType) { return nil, "", errors.New("参考图片必须是 JPG、PNG 或 WebP") }
	return content, mimeType, nil
}

func isSupportedAISkillImageMIME(mimeType string) bool {
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp": return true
	default: return false
	}
}

func relativeAISkillArchivePath(filePath, skillDirectory string) (string, bool) {
	if skillDirectory == "" {
		return filePath, true
	}
	prefix := skillDirectory + "/"
	if !strings.HasPrefix(filePath, prefix) {
		return "", false
	}
	return strings.TrimPrefix(filePath, prefix), true
}

func belongsToAnotherArchivedSkill(filePath, currentSkillPath string, skillPaths []string) bool {
	for _, skillPath := range skillPaths {
		if skillPath == currentSkillPath {
			continue
		}
		directory := pathpkg.Dir(skillPath)
		if directory == "." {
			if filePath == skillPath {
				return true
			}
			continue
		}
		if filePath == skillPath || strings.HasPrefix(filePath, directory+"/") {
			return true
		}
	}
	return false
}

func buildAISkillArchiveBundle(files []*zip.File, sectionMarker string) (string, int, int, error) {
	sort.Slice(files, func(left, right int) bool {
		return files[left].Name < files[right].Name
	})
	var builder strings.Builder
	importedCount := 0
	ignoredCount := 0
	for _, file := range files {
		if importedCount >= maxAISkillReferenceFiles {
			ignoredCount++
			continue
		}
		content, err := readAISkillArchiveText(file, maxAIPromptImportSkillSize)
		if err != nil {
			return "", 0, 0, fmt.Errorf("读取技能附带文件 %s 失败: %w", file.Name, err)
		}
		content = strings.TrimSpace(content)
		if content == "" {
			ignoredCount++
			continue
		}
		entry := "\n\n" + sectionMarker + file.Name + "\n" + content
		if builder.Len()+len(entry) > maxAISkillReferenceContentBytes {
			ignoredCount++
			continue
		}
		builder.WriteString(entry)
		importedCount++
	}
	return strings.TrimSpace(builder.String()), importedCount, ignoredCount, nil
}

func readAISkillArchiveText(file *zip.File, maxBytes int64) (string, error) {
	if file == nil || file.UncompressedSize64 > uint64(maxBytes) {
		return "", errors.New("文本文件超过 48KB")
	}
	reader, err := file.Open()
	if err != nil {
		return "", errors.New("无法打开文件")
	}
	content, readErr := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	closeErr := reader.Close()
	if readErr != nil || closeErr != nil || len(content) > int(maxBytes) {
		return "", errors.New("读取文件失败或超过 48KB")
	}
	if !utf8.Valid(content) {
		return "", errors.New("文本文件必须使用 UTF-8 编码")
	}
	return strings.TrimPrefix(string(content), "\ufeff"), nil
}
