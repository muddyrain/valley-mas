package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	pathpkg "path"
	"sort"
	"strings"
)

const (
	maxAISkillCollectionEntries     = 64
	maxAISkillDirectoryListingSize  = 256 * 1024
	maxAISkillReferenceFiles        = 24
	maxAISkillReferenceContentBytes = 96 * 1024
	maxAISkillReferenceDepth        = 3
	maxAISkillRepositoryArchiveSize = 32 * 1024 * 1024
	maxAISkillReferenceImageBytes   = 5 << 20
)

type gitHubAISkillLocation struct {
	RepositoryURL string
	Owner         string
	Repository    string
	Ref           string
	Directory     string
}

type gitHubAISkillDirectoryEntry struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type aiSkillImportSource struct {
	RepositoryURL    string
	Path             string
	Name             string
	Description      string
	Content          string
	ReferenceContent string
	ReferenceCount   int
	ScriptContent    string
	ScriptCount      int
	IgnoredFileCount int
	Tags             []string
	URL              string
	Author           string
	Files            []aiSkillImportFile
}

type aiSkillImportFile struct {
	Path     string
	Kind     string
	Content  string
	Binary   []byte
	MimeType string
}

// discoverGitHubAISkillSources accepts a repository URL or a GitHub tree/blob
// URL. A direct SKILL.md wins; otherwise the selected directory is treated as
// a collection whose direct child folders each contain a SKILL.md.
func discoverGitHubAISkillSources(ctx context.Context, rawURL string) ([]aiSkillImportSource, error) {
	normalizedURL, requestedNames, err := normalizeAISkillInstallSource(rawURL)
	if err != nil {
		return nil, err
	}
	location, err := parseGitHubAISkillLocation(normalizedURL)
	if err != nil {
		return nil, err
	}

	for _, skillPath := range directAISkillPaths(location) {
		content, fetchErr := fetchGitHubRawFile(ctx, location.Owner, location.Repository, location.Ref, skillPath)
		if fetchErr != nil {
			continue
		}
		source, sourceErr := buildAISkillImportSource(ctx, location, skillPath, content)
		if sourceErr != nil {
			return nil, sourceErr
		}
		if source.Content == "" {
			continue
		}
		if len(requestedNames) > 0 && !matchesAISkillRequestedName(source, requestedNames) {
			return nil, errors.New("未找到 npx skills add 指定的技能")
		}
		return []aiSkillImportSource{source}, nil
	}

	for _, directory := range collectionAISkillDirectories(location) {
		entries, found, listErr := fetchGitHubAISkillDirectory(ctx, location.Owner, location.Repository, location.Ref, directory)
		if listErr != nil {
			return nil, listErr
		}
		if !found {
			continue
		}
		sources := make([]aiSkillImportSource, 0, len(entries))
		for _, entry := range entries {
			if entry.Type != "dir" || !isSafeAISkillDirectoryName(entry.Name) {
				continue
			}
			skillPath := pathpkg.Join(directory, entry.Name, "SKILL.md")
			content, fetchErr := fetchGitHubRawFile(ctx, location.Owner, location.Repository, location.Ref, skillPath)
			if fetchErr != nil {
				continue
			}
			source, sourceErr := buildAISkillImportSource(ctx, location, skillPath, content)
			if sourceErr != nil {
				return nil, sourceErr
			}
			if source.Content == "" {
				continue
			}
			sources = append(sources, source)
			if len(sources) >= maxAISkillCollectionEntries {
				break
			}
		}
		if len(sources) > 0 {
			if len(requestedNames) > 0 {
				sources = filterAISkillRequestedNames(sources, requestedNames)
				if len(sources) == 0 {
					return nil, errors.New("未找到 npx skills add 指定的技能")
				}
			}
			return sources, nil
		}
	}

	return nil, errors.New("未找到可导入的 SKILL.md；请提供仓库链接或包含技能的 GitHub 目录链接")
}

func normalizeAISkillInstallSource(rawValue string) (string, []string, error) {
	value := strings.TrimSpace(rawValue)
	if !strings.HasPrefix(value, "npx ") {
		return normalizeAISkillGitHubSource(value), nil, nil
	}
	parts := strings.Fields(value)
	if len(parts) < 4 || parts[0] != "npx" || !strings.HasPrefix(parts[1], "skills") || parts[2] != "add" {
		return "", nil, errors.New("仅支持 npx skills add <来源> [--skill <技能>] 格式")
	}
	source := parts[3]
	requestedNames := make([]string, 0, 4)
	for index := 4; index < len(parts); index++ {
		switch parts[index] {
		case "--skill", "-s":
			index++
			if index >= len(parts) || strings.HasPrefix(parts[index], "-") {
				return "", nil, errors.New("npx skills add 缺少 --skill 名称")
			}
			for _, name := range strings.Split(parts[index], ",") {
				if normalized := strings.TrimSpace(name); normalized != "" {
					requestedNames = append(requestedNames, normalized)
				}
			}
		default:
			return "", nil, errors.New("仅支持 npx skills add 的 --skill 选项")
		}
	}
	return normalizeAISkillGitHubSource(source), requestedNames, nil
}

func normalizeAISkillGitHubSource(value string) string {
	value = strings.TrimSpace(value)
	if strings.Count(value, "/") == 1 && !strings.Contains(value, "://") {
		return "https://github.com/" + value
	}
	return value
}

func matchesAISkillRequestedName(source aiSkillImportSource, names []string) bool {
	for _, name := range names {
		if name == source.Name || name == pathpkg.Base(pathpkg.Dir(source.Path)) {
			return true
		}
	}
	return false
}

func filterAISkillRequestedNames(sources []aiSkillImportSource, names []string) []aiSkillImportSource {
	result := make([]aiSkillImportSource, 0, len(names))
	for _, source := range sources {
		if matchesAISkillRequestedName(source, names) {
			result = append(result, source)
		}
	}
	return result
}

func parseGitHubAISkillLocation(rawURL string) (gitHubAISkillLocation, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme != "https" {
		return gitHubAISkillLocation{}, errors.New("仅支持公开 GitHub 仓库或目录链接")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "github.com" && host != "www.github.com" {
		return gitHubAISkillLocation{}, errors.New("仅支持公开 GitHub 仓库或目录链接")
	}
	segments := strings.Split(strings.Trim(parsed.EscapedPath(), "/"), "/")
	if len(segments) < 2 {
		return gitHubAISkillLocation{}, errors.New("请输入完整的 GitHub 仓库或目录链接")
	}
	owner, ownerErr := url.PathUnescape(segments[0])
	repository, repositoryErr := url.PathUnescape(strings.TrimSuffix(segments[1], ".git"))
	if ownerErr != nil || repositoryErr != nil || owner == "" || repository == "" ||
		strings.ContainsAny(owner+repository, "\\?#") {
		return gitHubAISkillLocation{}, errors.New("GitHub 仓库链接无效")
	}
	location := gitHubAISkillLocation{
		RepositoryURL: "https://github.com/" + owner + "/" + repository,
		Owner:         owner,
		Repository:    repository,
		Ref:           "HEAD",
	}
	if len(segments) == 2 {
		return location, nil
	}
	if len(segments) < 5 || (segments[2] != "tree" && segments[2] != "blob") {
		return gitHubAISkillLocation{}, errors.New("GitHub 目录链接无效")
	}
	ref, refErr := url.PathUnescape(segments[3])
	if refErr != nil || ref == "" || strings.ContainsAny(ref, "\\?#") {
		return gitHubAISkillLocation{}, errors.New("GitHub 分支无效")
	}
	pathSegments := make([]string, 0, len(segments)-4)
	for _, segment := range segments[4:] {
		decoded, decodeErr := url.PathUnescape(segment)
		if decodeErr != nil || !isSafeAISkillDirectoryName(decoded) && decoded != "SKILL.md" {
			return gitHubAISkillLocation{}, errors.New("GitHub 技能目录无效")
		}
		pathSegments = append(pathSegments, decoded)
	}
	location.Ref = ref
	location.Directory = strings.Join(pathSegments, "/")
	if segments[2] == "blob" {
		if pathpkg.Base(location.Directory) != "SKILL.md" {
			return gitHubAISkillLocation{}, errors.New("仅支持指向 SKILL.md 的 GitHub 文件链接")
		}
		location.Directory = pathpkg.Dir(location.Directory)
		if location.Directory == "." {
			location.Directory = ""
		}
	}
	return location, nil
}

func directAISkillPaths(location gitHubAISkillLocation) []string {
	if location.Directory != "" {
		return []string{pathpkg.Join(location.Directory, "SKILL.md")}
	}
	return []string{"SKILL.md", "skills/SKILL.md", ".agents/skills/SKILL.md", ".claude/skills/SKILL.md", ".codex/skills/SKILL.md", ".cursor/skills/SKILL.md"}
}

func collectionAISkillDirectories(location gitHubAISkillLocation) []string {
	if location.Directory != "" {
		return []string{location.Directory}
	}
	return []string{"skills", "skills/.curated", "skills/.experimental", "skills/.system", ".agents/skills", ".claude/skills", ".codex/skills", ".cursor/skills"}
}

func buildAISkillImportSource(ctx context.Context, location gitHubAISkillLocation, skillPath, content string) (aiSkillImportSource, error) {
	content = strings.TrimSpace(content)
	referenceContent, referenceCount, err := fetchAISkillReferenceContent(ctx, location, skillPath)
	if err != nil {
		return aiSkillImportSource{}, err
	}
	scriptContent, scriptCount, err := fetchAISkillScriptContent(ctx, location, skillPath)
	if err != nil {
		return aiSkillImportSource{}, err
	}
	fallbackName := location.Repository
	if skillPath != "SKILL.md" {
		fallbackName = pathpkg.Base(pathpkg.Dir(skillPath))
	}
	sourceURL := location.RepositoryURL
	if skillPath != "SKILL.md" {
		sourceURL = fmt.Sprintf(
			"%s/blob/%s/%s",
			location.RepositoryURL,
			url.PathEscape(location.Ref),
			escapeGitHubRepositoryPath(skillPath),
		)
	}
	return aiSkillImportSource{
		RepositoryURL:    location.RepositoryURL,
		Path:             skillPath,
		Name:             extractAISkillName(content, fallbackName),
		Description:      extractAISkillDescription(content),
		Content:          content,
		ReferenceContent: referenceContent,
		ReferenceCount:   referenceCount,
		ScriptContent:    scriptContent,
		ScriptCount:      scriptCount,
		Tags:             extractAISkillTags(content),
		URL:              sourceURL,
		Author:           location.Owner,
	}, nil
}

func extractAISkillTags(content string) []string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "tags:") {
			continue
		}
		value := strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "tags:")), "[]")
		items := strings.Split(value, ",")
		tags := make([]string, 0, len(items))
		for _, item := range items {
			if tag := strings.Trim(strings.TrimSpace(item), "\"'"); tag != "" {
				tags = append(tags, tag)
			}
		}
		normalized, err := normalizeAIPromptTags(tags)
		if err == nil {
			return normalized
		}
		return []string{}
	}
	return []string{}
}

func extractAISkillName(content, fallback string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "name:") {
			continue
		}
		name := strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "name:")), "\"'")
		if name != "" {
			return truncateAIPromptImportName(name)
		}
	}
	return truncateAIPromptImportName(fallback)
}

func fetchGitHubAISkillDirectory(ctx context.Context, owner, repository, ref, directory string) ([]gitHubAISkillDirectoryEntry, bool, error) {
	endpoint := fmt.Sprintf(
		"https://api.github.com/repos/%s/%s/contents/%s?ref=%s",
		url.PathEscape(owner),
		url.PathEscape(repository),
		escapeGitHubRepositoryPath(directory),
		url.QueryEscape(ref),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, false, errors.New("无法读取 GitHub 技能目录")
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Valley-MAS-Skill-Importer")
	response, err := promptImportHTTPClient.Do(req)
	if err != nil {
		return nil, false, errors.New("读取 GitHub 技能目录失败")
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return nil, false, nil
	}
	if response.StatusCode == http.StatusForbidden || response.StatusCode == http.StatusTooManyRequests {
		entries, found, archiveErr := fetchGitHubAISkillDirectoryFromArchive(ctx, owner, repository, ref, directory)
		if archiveErr == nil {
			return entries, found, nil
		}
		return nil, false, errors.New("GitHub API 访问受限，且暂时无法读取仓库技能目录")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, false, errors.New("GitHub 暂时无法返回技能目录")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAISkillDirectoryListingSize+1))
	if err != nil || len(body) > maxAISkillDirectoryListingSize {
		return nil, false, errors.New("读取 GitHub 技能目录失败")
	}
	var entries []gitHubAISkillDirectoryEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		return nil, false, errors.New("GitHub 技能目录格式无效")
	}
	return entries, true, nil
}

// fetchGitHubAISkillDirectoryFromArchive is a rate-limit fallback for the
// unauthenticated GitHub Contents API. codeload is public and does not consume
// the Contents API core quota, while the actual SKILL.md bodies still come from
// raw.githubusercontent.com below.
func fetchGitHubAISkillDirectoryFromArchive(ctx context.Context, owner, repository, ref, directory string) ([]gitHubAISkillDirectoryEntry, bool, error) {
	endpoint := fmt.Sprintf(
		"https://codeload.github.com/%s/%s/zip/%s",
		url.PathEscape(owner),
		url.PathEscape(repository),
		url.PathEscape(ref),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, false, errors.New("无法读取 GitHub 仓库压缩包")
	}
	req.Header.Set("User-Agent", "Valley-MAS-Skill-Importer")
	response, err := promptImportHTTPClient.Do(req)
	if err != nil {
		return nil, false, errors.New("读取 GitHub 仓库压缩包失败")
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return nil, false, nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, false, errors.New("GitHub 仓库压缩包暂时无法读取")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAISkillRepositoryArchiveSize+1))
	if err != nil || len(body) > maxAISkillRepositoryArchiveSize {
		return nil, false, errors.New("GitHub 仓库过大，无法读取技能目录")
	}
	archive, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return nil, false, errors.New("GitHub 仓库压缩包格式无效")
	}

	directory = strings.Trim(directory, "/")
	entriesByName := make(map[string]gitHubAISkillDirectoryEntry)
	for _, file := range archive.File {
		parts := strings.Split(strings.Trim(file.Name, "/"), "/")
		if len(parts) < 2 {
			continue
		}
		repositoryPath := strings.Join(parts[1:], "/")
		prefix := directory + "/"
		if !strings.HasPrefix(repositoryPath, prefix) {
			continue
		}
		relativePath := strings.TrimPrefix(repositoryPath, prefix)
		if relativePath == "" {
			continue
		}
		entryName, nestedPath, _ := strings.Cut(relativePath, "/")
		if !isSafeAISkillDirectoryName(entryName) {
			continue
		}
		entryType := "file"
		if nestedPath != "" || file.FileInfo().IsDir() {
			entryType = "dir"
		}
		if existing, exists := entriesByName[entryName]; !exists || entryType == "dir" && existing.Type != "dir" {
			entriesByName[entryName] = gitHubAISkillDirectoryEntry{Name: entryName, Type: entryType}
		}
	}
	if len(entriesByName) == 0 {
		return nil, false, nil
	}
	entries := make([]gitHubAISkillDirectoryEntry, 0, len(entriesByName))
	for _, entry := range entriesByName {
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(left, right int) bool {
		return entries[left].Name < entries[right].Name
	})
	return entries, true, nil
}

func fetchAISkillReferenceContent(ctx context.Context, location gitHubAISkillLocation, skillPath string) (string, int, error) {
	return fetchAISkillBundledContent(ctx, location, skillPath, "references", "## 参考资料：", isSupportedAISkillReferenceFile)
}

func fetchAISkillScriptContent(ctx context.Context, location gitHubAISkillLocation, skillPath string) (string, int, error) {
	return fetchAISkillBundledContent(ctx, location, skillPath, "scripts", "## 脚本：", isSupportedAISkillScriptFile)
}

func fetchAISkillBundledContent(
	ctx context.Context,
	location gitHubAISkillLocation,
	skillPath, directoryName, sectionMarker string,
	isSupportedFile func(string) bool,
) (string, int, error) {
	directory := pathpkg.Join(pathpkg.Dir(skillPath), directoryName)
	paths, err := collectAISkillBundledPaths(ctx, location, directory, 0, isSupportedFile)
	if err != nil {
		return "", 0, err
	}
	if len(paths) == 0 {
		return "", 0, nil
	}

	var builder strings.Builder
	referenceCount := 0
	for _, filePath := range paths {
		content, fetchErr := fetchGitHubRawFile(ctx, location.Owner, location.Repository, location.Ref, filePath)
		if fetchErr != nil {
			return "", 0, errors.New("读取技能附带文件失败")
		}
		content = strings.TrimSpace(content)
		if content == "" {
			continue
		}
		entry := "\n\n" + sectionMarker + filePath + "\n" + content
		if builder.Len()+len(entry) > maxAISkillReferenceContentBytes {
			break
		}
		builder.WriteString(entry)
		referenceCount++
	}
	referenceContent := strings.TrimSpace(builder.String())
	if referenceContent == "" {
		return "", 0, nil
	}
	return referenceContent, referenceCount, nil
}

func collectAISkillBundledPaths(
	ctx context.Context,
	location gitHubAISkillLocation,
	directory string,
	depth int,
	isSupportedFile func(string) bool,
) ([]string, error) {
	if depth > maxAISkillReferenceDepth {
		return nil, nil
	}
	entries, found, err := fetchGitHubAISkillDirectory(ctx, location.Owner, location.Repository, location.Ref, directory)
	if err != nil || !found {
		return nil, err
	}
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !isSafeAISkillDirectoryName(entry.Name) {
			continue
		}
		entryPath := pathpkg.Join(directory, entry.Name)
		switch {
		case entry.Type == "file" && isSupportedFile(entry.Name):
			paths = append(paths, entryPath)
		case entry.Type == "dir" && depth < maxAISkillReferenceDepth:
			nested, nestedErr := collectAISkillBundledPaths(ctx, location, entryPath, depth+1, isSupportedFile)
			if nestedErr != nil {
				return nil, nestedErr
			}
			paths = append(paths, nested...)
		}
		if len(paths) >= maxAISkillReferenceFiles {
			break
		}
	}
	sort.Strings(paths)
	if len(paths) > maxAISkillReferenceFiles {
		paths = paths[:maxAISkillReferenceFiles]
	}
	return paths, nil
}

func isSupportedAISkillReferenceFile(fileName string) bool {
	switch strings.ToLower(pathpkg.Ext(fileName)) {
	case ".md", ".mdx", ".txt":
		return true
	default:
		return false
	}
}

func isSupportedAISkillScriptFile(fileName string) bool {
	switch strings.ToLower(pathpkg.Ext(fileName)) {
	case ".py", ".pyw", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".rb", ".php", ".pl", ".lua", ".r":
		return true
	default:
		return false
	}
}

func isSafeAISkillDirectoryName(value string) bool {
	return value != "" && value != "." && value != ".." && !strings.ContainsAny(value, "\\?#") && !strings.Contains(value, "/")
}

func escapeGitHubRepositoryPath(value string) string {
	segments := strings.Split(strings.Trim(value, "/"), "/")
	for index, segment := range segments {
		segments[index] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}
