//go:build ignore

// 用法：go run scripts/import_classics_fulltext.go <DB_DSN>
// 从公版来源抓取完整正文并回填到 classics_chapters（覆盖当前默认版本章节）。

package main

import (
	"encoding/base64"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"os"

	postgresDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

type sourceItem struct {
	BookTitle    string
	URL          string
	EditionLabel string
	Parser       func(string) ([]chapterItem, error)
	NeedsTrimPG  bool
}

type chapterItem struct {
	Title   string
	Content string
}

type chapterRow struct {
	EditionID    int64  `gorm:"column:edition_id"`
	BookID       int64  `gorm:"column:book_id"`
	ChapterIndex int    `gorm:"column:chapter_index"`
	Title        string `gorm:"column:title"`
	Content      string `gorm:"column:content"`
	WordCount    int    `gorm:"column:word_count"`
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run scripts/import_classics_fulltext.go <DB_DSN>")
	}
	dsn := strings.TrimSpace(os.Args[1])
	if dsn == "" {
		log.Fatal("empty DB_DSN")
	}

	db, err := gorm.Open(postgresDriver.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		log.Fatalf("connect db failed: %v", err)
	}

	sources := []sourceItem{
		{BookTitle: "三国演义", URL: "https://www.gutenberg.org/cache/epub/23950/pg23950.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseChineseHuiChapter(`(?m)^第[一二三四五六七八九十百千〇零]+回[：:].*$`), NeedsTrimPG: true},
		{BookTitle: "红楼梦", URL: "https://www.gutenberg.org/cache/epub/24264/pg24264.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseChineseHuiChapter(`(?m)^第[一二三四五六七八九十百千〇零]+回[　 ].*$`), NeedsTrimPG: true},
		{BookTitle: "论语", URL: "https://www.gutenberg.org/cache/epub/23839/pg23839.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseLunyuOrShishuo, NeedsTrimPG: true},
		{BookTitle: "史记", URL: "https://www.gutenberg.org/cache/epub/24226/pg24226.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseShiji, NeedsTrimPG: true},
		{BookTitle: "世说新语", URL: "https://www.gutenberg.org/cache/epub/24047/pg24047.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseLunyuOrShishuo, NeedsTrimPG: true},
		{BookTitle: "唐诗三百首", URL: "https://www.gutenberg.org/cache/epub/52323/pg52323.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseTang300, NeedsTrimPG: true},
		{BookTitle: "宋词三百首", URL: "https://zh.wikisource.org/wiki/%E5%AE%8B%E8%A9%9E%E4%B8%89%E7%99%BE%E9%A6%96?action=raw", EditionLabel: "维基文库整理版", Parser: parseSongCiFromWikisource, NeedsTrimPG: false},
		{BookTitle: "窦娥冤", URL: "https://www.gutenberg.org/cache/epub/52276/pg52276.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseDouE, NeedsTrimPG: true},
		{BookTitle: "朝花夕拾", URL: "https://zh.wikisource.org/wiki/%E6%9C%9D%E8%8A%B1%E5%A4%95%E6%8B%BE?action=raw", EditionLabel: "维基文库整理版", Parser: parseZhaohuaxishiFromWikisource, NeedsTrimPG: false},
		{BookTitle: "呐喊", URL: "https://zh.wikisource.org/wiki/%E5%91%90%E5%96%8A?action=raw", EditionLabel: "维基文库整理版", Parser: parseNahanFromWikisource, NeedsTrimPG: false},
		{BookTitle: "彷徨", URL: "https://zh.wikisource.org/wiki/%E5%BD%B7%E5%BE%A8?action=raw", EditionLabel: "维基文库整理版", Parser: parsePanghuangFromWikisource, NeedsTrimPG: false},
		{BookTitle: "简爱", URL: "https://www.gutenberg.org/cache/epub/1260/pg1260.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseEnglishChapterHeadings, NeedsTrimPG: true},
		{BookTitle: "傲慢与偏见", URL: "https://www.gutenberg.org/cache/epub/1342/pg1342.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseEnglishChapterHeadings, NeedsTrimPG: true},
		{BookTitle: "了不起的盖茨比", URL: "https://www.gutenberg.org/cache/epub/64317/pg64317.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseGatsbyChapters, NeedsTrimPG: true},
		{BookTitle: "月亮与六便士", URL: "https://www.gutenberg.org/cache/epub/222/pg222.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseEnglishChapterHeadings, NeedsTrimPG: true},
		{BookTitle: "鲁滨逊漂流记", URL: "https://www.gutenberg.org/cache/epub/521/pg521.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseEnglishChapterHeadings, NeedsTrimPG: true},
		{BookTitle: "巴斯克维尔的猎犬", URL: "https://www.gutenberg.org/cache/epub/2852/pg2852.txt", EditionLabel: "Project Gutenberg 完整版", Parser: parseEnglishChapterHeadings, NeedsTrimPG: true},
	}

	onlyRaw := strings.TrimSpace(os.Getenv("CLASSICS_ONLY"))
	if onlyRaw != "" {
		selected := map[string]struct{}{}
		for _, part := range strings.Split(onlyRaw, ",") {
			name := strings.TrimSpace(part)
			if name != "" {
				selected[name] = struct{}{}
			}
		}
		filtered := make([]sourceItem, 0, len(selected))
		for _, s := range sources {
			if _, ok := selected[s.BookTitle]; ok {
				filtered = append(filtered, s)
			}
		}
		if len(filtered) == 0 {
			log.Fatalf("CLASSICS_ONLY did not match any book, input=%q", onlyRaw)
		}
		sources = filtered
		fmt.Printf("🎯 仅导入指定书目：%s\n", onlyRaw)
	}

	totalBooks := 0
	totalChapters := 0

	for _, src := range sources {
		fmt.Printf("\n📚 导入《%s》\n", src.BookTitle)

		text, err := fetchTextWithRetry(src.URL, 4)
		if err != nil {
			log.Fatalf("fetch %s failed: %v", src.BookTitle, err)
		}
		if src.NeedsTrimPG {
			text = trimProjectGutenberg(text)
		}
		text = normalizeText(text)

		chapters, err := src.Parser(text)
		if err != nil {
			log.Fatalf("parse %s failed: %v", src.BookTitle, err)
		}
		if len(chapters) == 0 {
			log.Fatalf("parse %s got 0 chapters", src.BookTitle)
		}

		bookID, err := mustGetBookID(db, src.BookTitle)
		if err != nil {
			log.Fatalf("find book %s failed: %v", src.BookTitle, err)
		}
		editionID, err := ensureDefaultEdition(db, bookID, src.EditionLabel)
		if err != nil {
			log.Fatalf("ensure edition %s failed: %v", src.BookTitle, err)
		}

		wordCount := 0
		rows := make([]chapterRow, 0, len(chapters))
		for i, ch := range chapters {
			content := strings.TrimSpace(ch.Content)
			if content == "" {
				continue
			}
			title := strings.TrimSpace(ch.Title)
			if title == "" {
				title = fmt.Sprintf("第 %d 节", i+1)
			}
			wc := len([]rune(content))
			wordCount += wc
			rows = append(rows, chapterRow{
				EditionID:    editionID,
				BookID:       bookID,
				ChapterIndex: len(rows),
				Title:        title,
				Content:      content,
				WordCount:    wc,
			})
		}
		if len(rows) == 0 {
			log.Fatalf("book %s has no valid chapter content", src.BookTitle)
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(`DELETE FROM classics_chapters WHERE edition_id = ?`, editionID).Error; err != nil {
				return err
			}
			if err := tx.Table("classics_chapters").CreateInBatches(rows, 80).Error; err != nil {
				return err
			}
			if err := tx.Exec(
				`UPDATE classics_books
				 SET chapter_count = ?, word_count = ?, is_published = TRUE, updated_at = NOW(), deleted_at = NULL
				 WHERE id = ?`,
				len(rows), wordCount, bookID,
			).Error; err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			log.Fatalf("save %s failed: %v", src.BookTitle, err)
		}

		totalBooks++
		totalChapters += len(rows)
		fmt.Printf("✅ %s: %d 章，%d 字\n", src.BookTitle, len(rows), wordCount)
	}

	fmt.Printf("\n🎉 完整正文导入完成：%d 本书，%d 章\n", totalBooks, totalChapters)
}

func fetchTextWithRetry(url string, attempts int) (string, error) {
	if attempts < 1 {
		attempts = 1
	}
	var lastErr error
	for i := 1; i <= attempts; i++ {
		text, err := fetchText(url)
		if err == nil {
			return text, nil
		}
		lastErr = err
		// 在当前 Windows 环境下，Go 原生网络偶发 TLS/连接中断；统一使用 Python 再兜底一次。
		if fallbackText, fallbackErr := fetchTextViaPython(url); fallbackErr == nil {
			return fallbackText, nil
		}
		if i < attempts {
			time.Sleep(time.Duration(i) * time.Second)
		}
	}
	return "", lastErr
}

func fetchText(url string) (string, error) {
	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Valley-MAS-Classics-Importer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("http status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func fetchTextViaPython(url string) (string, error) {
	script := `import urllib.request,sys,base64
req=urllib.request.Request(sys.argv[1],headers={'User-Agent':'Valley-MAS-Classics-Importer/1.0'})
data=urllib.request.urlopen(req,timeout=60).read()
sys.stdout.write(base64.b64encode(data).decode('ascii'))`
	cmd := exec.Command("python", "-c", script, url)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out)))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func normalizeText(text string) string {
	text = strings.TrimPrefix(text, "\ufeff")
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	return strings.TrimSpace(text)
}

func trimProjectGutenberg(text string) string {
	text = normalizeText(text)
	startKey := "*** START OF THE PROJECT GUTENBERG EBOOK"
	endKey := "*** END OF THE PROJECT GUTENBERG EBOOK"

	if idx := strings.Index(text, startKey); idx >= 0 {
		text = text[idx:]
		if nl := strings.Index(text, "\n"); nl >= 0 {
			text = text[nl+1:]
		}
	}
	if idx := strings.Index(text, endKey); idx >= 0 {
		text = text[:idx]
	}
	return strings.TrimSpace(text)
}

func mustGetBookID(db *gorm.DB, title string) (int64, error) {
	var row struct {
		ID int64 `gorm:"column:id"`
	}
	err := db.Raw(`SELECT id FROM classics_books WHERE title = ? ORDER BY id ASC LIMIT 1`, title).Scan(&row).Error
	if err != nil {
		return 0, err
	}
	if row.ID == 0 {
		return 0, fmt.Errorf("book not found")
	}
	return row.ID, nil
}

func ensureDefaultEdition(db *gorm.DB, bookID int64, label string) (int64, error) {
	var row struct {
		ID int64 `gorm:"column:id"`
	}
	_ = db.Exec(`UPDATE classics_editions SET is_default = FALSE WHERE book_id = ?`, bookID).Error
	if err := db.Raw(
		`SELECT id FROM classics_editions WHERE book_id = ? ORDER BY id ASC LIMIT 1`,
		bookID,
	).Scan(&row).Error; err != nil {
		return 0, err
	}
	if row.ID > 0 {
		if err := db.Exec(
			`UPDATE classics_editions SET is_default = TRUE, label = ?, updated_at = NOW() WHERE id = ?`,
			label, row.ID,
		).Error; err != nil {
			return 0, err
		}
		return row.ID, nil
	}

	if err := db.Exec(
		`INSERT INTO classics_editions (book_id, label, is_default, created_at, updated_at)
		 VALUES (?, ?, TRUE, NOW(), NOW())`,
		bookID, label,
	).Error; err != nil {
		return 0, err
	}
	if err := db.Raw(
		`SELECT id FROM classics_editions WHERE book_id = ? ORDER BY id DESC LIMIT 1`,
		bookID,
	).Scan(&row).Error; err != nil {
		return 0, err
	}
	if row.ID == 0 {
		return 0, fmt.Errorf("create edition failed")
	}
	return row.ID, nil
}

func parseByHeadingRegex(text, pattern string) ([]chapterItem, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	locs := re.FindAllStringIndex(text, -1)
	if len(locs) == 0 {
		return nil, fmt.Errorf("no headings matched: %s", pattern)
	}
	chapters := make([]chapterItem, 0, len(locs))
	for i, loc := range locs {
		title := strings.TrimSpace(text[loc[0]:loc[1]])
		contentStart := loc[1]
		contentEnd := len(text)
		if i+1 < len(locs) {
			contentEnd = locs[i+1][0]
		}
		content := strings.TrimSpace(text[contentStart:contentEnd])
		if content == "" {
			continue
		}
		chapters = append(chapters, chapterItem{Title: title, Content: content})
	}
	return chapters, nil
}

func parseChineseHuiChapter(pattern string) func(string) ([]chapterItem, error) {
	return func(text string) ([]chapterItem, error) {
		return parseByHeadingRegex(text, pattern)
	}
}

func parseLunyuOrShishuo(text string) ([]chapterItem, error) {
	return parseByHeadingRegex(text, `(?m)^[\p{Han}·]{1,12}第[一二三四五六七八九十百千〇零]+$`)
}

func parseShiji(text string) ([]chapterItem, error) {
	return parseByHeadingRegex(text, `(?m)^史記\s+[\p{Han}]+$`)
}

func parseDouE(text string) ([]chapterItem, error) {
	return parseByHeadingRegex(text, `(?m)^(楔子|第[一二三四五六七八九十]+折)\s*$`)
}

func parseEnglishChapterHeadings(text string) ([]chapterItem, error) {
	return parseByHeadingRegex(text, `(?mi)^\s*CHAPTER\s+[IVXLCDM0-9]+(?:[\s\.\-—:].*)?$`)
}

func parseGatsbyChapters(text string) ([]chapterItem, error) {
	re, err := regexp.Compile(`(?m)^\s*([IVXLCDM]{1,8})\s*$`)
	if err != nil {
		return nil, err
	}
	locs := re.FindAllStringSubmatchIndex(text, -1)
	if len(locs) == 0 {
		return nil, fmt.Errorf("no roman numeral chapter headings found")
	}
	chapters := make([]chapterItem, 0, 12)
	for i, loc := range locs {
		title := strings.TrimSpace(text[loc[2]:loc[3]])
		contentStart := loc[1]
		contentEnd := len(text)
		if i+1 < len(locs) {
			contentEnd = locs[i+1][0]
		}
		content := strings.TrimSpace(text[contentStart:contentEnd])
		// 过滤目录中相邻罗马数字行，保留正文段落。
		if len([]rune(content)) < 600 {
			continue
		}
		chapters = append(chapters, chapterItem{Title: title, Content: content})
	}
	if len(chapters) == 0 {
		return nil, fmt.Errorf("no valid gatsby chapter content after filtering toc")
	}
	return chapters, nil
}

func parseTang300(text string) ([]chapterItem, error) {
	lines := strings.Split(normalizeText(text), "\n")
	numRe := regexp.MustCompile(`^\d{3}$`)
	chapters := make([]chapterItem, 0, 320)

	for i := 0; i < len(lines); {
		line := strings.TrimSpace(lines[i])
		if !numRe.MatchString(line) {
			i++
			continue
		}
		num := line
		i++
		for i < len(lines) && strings.TrimSpace(lines[i]) == "" {
			i++
		}
		if i >= len(lines) {
			break
		}
		title := strings.TrimSpace(lines[i])
		i++

		var b strings.Builder
		for i < len(lines) {
			cur := strings.TrimSpace(lines[i])
			if numRe.MatchString(cur) {
				break
			}
			b.WriteString(strings.TrimRight(lines[i], "\r"))
			b.WriteString("\n")
			i++
		}
		content := strings.TrimSpace(b.String())
		if content == "" {
			continue
		}
		chapters = append(chapters, chapterItem{Title: num + " " + title, Content: content})
	}
	if len(chapters) == 0 {
		return nil, fmt.Errorf("no numbered poems parsed")
	}
	return chapters, nil
}

func parseSongCiFromWikisource(text string) ([]chapterItem, error) {
	text = normalizeText(text)
	re := regexp.MustCompile(`(?s)=='''([^']+?)'''(?:（[^）]*）)?==\s*<poem>\s*(.*?)\s*</poem>`)
	matches := re.FindAllStringSubmatch(text, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no ci entries parsed from wikisource")
	}
	chapters := make([]chapterItem, 0, len(matches))
	for _, m := range matches {
		title := strings.TrimSpace(m[1])
		content := strings.TrimSpace(m[2])
		if title == "" || content == "" {
			continue
		}
		chapters = append(chapters, chapterItem{Title: title, Content: content})
	}
	if len(chapters) == 0 {
		return nil, fmt.Errorf("all parsed ci entries are empty")
	}
	return chapters, nil
}

func parseZhaohuaxishi(text string) ([]chapterItem, error) {
	re := regexp.MustCompile(`(?m)^(小引|狗·貓·鼠|阿長與山海經|二十四孝圖|五猖會|無常|從百草園到三味書屋|父親的病|瑣記|藤野先生|范愛農|後記)\s*$`)
	locs := re.FindAllStringSubmatchIndex(text, -1)
	if len(locs) == 0 {
		return nil, fmt.Errorf("no headings found for 朝花夕拾")
	}
	chapters := make([]chapterItem, 0, len(locs))
	for i, loc := range locs {
		title := strings.TrimSpace(text[loc[2]:loc[3]])
		contentStart := loc[1]
		contentEnd := len(text)
		if i+1 < len(locs) {
			contentEnd = locs[i+1][0]
		}
		content := strings.TrimSpace(text[contentStart:contentEnd])
		if content == "" {
			continue
		}
		chapters = append(chapters, chapterItem{Title: title, Content: content})
	}
	return chapters, nil
}

func parseZhaohuaxishiFromWikisource(_ string) ([]chapterItem, error) {
	pages := []struct {
		Title string
		URL   string
	}{
		{"小引", "https://zh.wikisource.org/wiki/%E6%9C%9D%E8%8A%B1%E5%A4%95%E6%8B%BE/%E5%B0%8F%E5%BC%95?action=raw"},
		{"狗·猫·鼠", "https://zh.wikisource.org/wiki/%E7%8B%97%C2%B7%E8%B2%93%C2%B7%E9%BC%A0?action=raw"},
		{"阿长与《山海经》", "https://zh.wikisource.org/wiki/%E9%98%BF%E9%95%B7%E8%88%87%E3%80%8A%E5%B1%B1%E6%B5%B7%E7%B6%93%E3%80%8B?action=raw"},
		{"二十四孝图", "https://zh.wikisource.org/wiki/%E4%BA%8C%E5%8D%81%E5%9B%9B%E5%AD%9D%E5%9C%96?action=raw"},
		{"五猖会", "https://zh.wikisource.org/wiki/%E4%BA%94%E7%8C%96%E6%9C%83?action=raw"},
		{"无常", "https://zh.wikisource.org/wiki/%E7%84%A1%E5%B8%B8?action=raw"},
		{"从百草园到三味书屋", "https://zh.wikisource.org/wiki/%E5%BE%9E%E7%99%BE%E8%8D%89%E5%9C%92%E5%88%B0%E4%B8%89%E5%91%B3%E6%9B%B8%E5%B1%8B?action=raw"},
		{"父亲的病", "https://zh.wikisource.org/wiki/%E7%88%B6%E8%A6%AA%E7%9A%84%E7%97%85?action=raw"},
		{"琐记", "https://zh.wikisource.org/wiki/%E7%91%A3%E8%A8%98?action=raw"},
		{"藤野先生", "https://zh.wikisource.org/wiki/%E8%97%A4%E9%87%8E%E5%85%88%E7%94%9F?action=raw"},
		{"范爱农", "https://zh.wikisource.org/wiki/%E8%8C%83%E6%84%9B%E8%BE%B2?action=raw"},
		{"后记", "https://zh.wikisource.org/wiki/%E6%9C%9D%E8%8A%B1%E5%A4%95%E6%8B%BE/%E5%BE%8C%E8%A8%98?action=raw"},
	}
	return parseWikisourcePages(pages)
}

func parseNahanFromWikisource(_ string) ([]chapterItem, error) {
	pages := []struct {
		Title string
		URL   string
	}{
		{"狂人日记", "https://zh.wikisource.org/wiki/%E7%8B%82%E4%BA%BA%E6%97%A5%E8%AE%B0?action=raw"},
		{"孔乙己", "https://zh.wikisource.org/wiki/%E5%AD%94%E4%B9%99%E5%B7%B1?action=raw"},
		{"药", "https://zh.wikisource.org/wiki/%E8%97%A5?action=raw"},
		{"明天", "https://zh.wikisource.org/wiki/%E6%98%8E%E5%A4%A9?action=raw"},
		{"一件小事", "https://zh.wikisource.org/wiki/%E4%B8%80%E4%BB%B6%E5%B0%8F%E4%BA%8B?action=raw"},
		{"头发的故事", "https://zh.wikisource.org/wiki/%E9%A0%AD%E9%AB%AE%E7%9A%84%E6%95%85%E4%BA%8B?action=raw"},
		{"风波", "https://zh.wikisource.org/wiki/%E9%A2%A8%E6%B3%A2?action=raw"},
		{"故乡", "https://zh.wikisource.org/wiki/%E6%95%85%E9%84%89?action=raw"},
		{"阿Q正传", "https://zh.wikisource.org/wiki/%E9%98%BF%EF%BC%B1%E6%AD%A3%E5%82%B3?action=raw"},
		{"端午节", "https://zh.wikisource.org/wiki/%E7%AB%AF%E5%8D%88%E7%AF%80?action=raw"},
		{"白光", "https://zh.wikisource.org/wiki/%E7%99%BD%E5%85%89?action=raw"},
		{"兔和猫", "https://zh.wikisource.org/wiki/%E5%85%94%E5%92%8C%E8%B2%93?action=raw"},
		{"鸭的喜剧", "https://zh.wikisource.org/wiki/%E9%B4%A8%E7%9A%84%E5%96%9C%E5%8A%87?action=raw"},
		{"社戏", "https://zh.wikisource.org/wiki/%E7%A4%BE%E6%88%B2?action=raw"},
	}
	return parseWikisourcePages(pages)
}

func parsePanghuangFromWikisource(_ string) ([]chapterItem, error) {
	pages := []struct {
		Title string
		URL   string
	}{
		{"祝福", "https://zh.wikisource.org/wiki/%E7%A5%9D%E7%A6%8F?action=raw"},
		{"在酒楼上", "https://zh.wikisource.org/wiki/%E5%9C%A8%E9%85%92%E6%A8%93%E4%B8%8A?action=raw"},
		{"幸福的家庭", "https://zh.wikisource.org/wiki/%E5%B9%B8%E7%A6%8F%E7%9A%84%E5%AE%B6%E5%BA%AD?action=raw"},
		{"肥皂", "https://zh.wikisource.org/wiki/%E8%82%A5%E7%9A%82?action=raw"},
		{"长明灯", "https://zh.wikisource.org/wiki/%E9%95%B7%E6%98%8E%E7%87%88?action=raw"},
		{"示众", "https://zh.wikisource.org/wiki/%E7%A4%BA%E8%A1%86?action=raw"},
		{"高老夫子", "https://zh.wikisource.org/wiki/%E9%AB%98%E8%80%81%E5%A4%AB%E5%AD%90?action=raw"},
		{"孤独者", "https://zh.wikisource.org/wiki/%E5%AD%A4%E7%8D%A8%E8%80%85?action=raw"},
		{"伤逝", "https://zh.wikisource.org/wiki/%E5%82%B7%E9%80%9D?action=raw"},
		{"弟兄", "https://zh.wikisource.org/wiki/%E5%BC%9F%E5%85%84?action=raw"},
		{"离婚", "https://zh.wikisource.org/wiki/%E9%9B%A2%E5%A9%9A?action=raw"},
	}
	return parseWikisourcePages(pages)
}

func parseWikisourcePages(pages []struct {
	Title string
	URL   string
}) ([]chapterItem, error) {
	if len(pages) == 0 {
		return nil, fmt.Errorf("empty wikisource pages")
	}

	chapters := make([]chapterItem, 0, len(pages))
	for _, page := range pages {
		content, err := fetchAndCleanWikisourcePage(page.URL)
		if err != nil {
			return nil, fmt.Errorf("fetch %s failed: %w", page.Title, err)
		}
		if content == "" {
			return nil, fmt.Errorf("empty wiki content: %s", page.Title)
		}
		chapters = append(chapters, chapterItem{
			Title:   page.Title,
			Content: content,
		})
	}
	return chapters, nil
}

func fetchAndCleanWikisourcePage(rawURL string) (string, error) {
	renderURL := toWikisourceRenderURL(rawURL)
	rendered, err := fetchTextWithRetry(renderURL, 4)
	if err == nil {
		cleaned := cleanWikisourceRenderedText(rendered)
		if cleaned != "" {
			return cleaned, nil
		}
	}

	raw, rawErr := fetchTextWithRetry(rawURL, 4)
	if rawErr != nil {
		if err != nil {
			return "", err
		}
		return "", rawErr
	}
	return cleanWikiRawText(raw), nil
}

func toWikisourceRenderURL(rawURL string) string {
	if !strings.Contains(rawURL, "wikisource.org") {
		return rawURL
	}
	u := strings.Replace(rawURL, "action=raw", "action=render&variant=zh-hans", 1)
	if strings.Contains(u, "action=render") && !strings.Contains(u, "variant=") {
		u += "&variant=zh-hans"
	}
	return u
}

func cleanWikisourceRenderedText(input string) string {
	s := strings.TrimSpace(input)
	if s == "" {
		return ""
	}
	s = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?is)<!--.*?-->`).ReplaceAllString(s, "")

	lineBreakReplacer := strings.NewReplacer(
		"<br>", "\n", "<br/>", "\n", "<br />", "\n",
		"</p>", "\n", "</div>", "\n", "</li>", "\n",
		"</h1>", "\n", "</h2>", "\n", "</h3>", "\n",
	)
	s = lineBreakReplacer.Replace(s)
	s = regexp.MustCompile(`(?is)<[^>]+>`).ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	s = strings.ReplaceAll(s, "\u00a0", " ")
	s = strings.ReplaceAll(s, "\u200b", "")
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")

	lines := strings.Split(s, "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			filtered = append(filtered, "")
			continue
		}
		if strings.Contains(line, "作者：") ||
			strings.Contains(line, "版本信息") ||
			strings.Contains(line, "姊妹计划") ||
			strings.Contains(line, "本作品收录于") {
			continue
		}
		filtered = append(filtered, line)
	}
	s = strings.Join(filtered, "\n")
	s = regexp.MustCompile(`\n{3,}`).ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}

func cleanWikiRawText(raw string) string {
	s := normalizeText(raw)
	s = regexp.MustCompile(`(?s)<!--.*?-->`).ReplaceAllString(s, "")
	s = stripWikiTemplates(s)
	s = strings.ReplaceAll(s, "__NOTOC__", "")
	s = strings.ReplaceAll(s, "__TOC__", "")
	s = regexp.MustCompile(`(?m)^\s*\[\[Category:[^\]]+\]\]\s*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?m)^\s*<references\s*/>\s*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?m)^\s*<noinclude>.*?</noinclude>\s*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?m)^\s*<onlyinclude>\s*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?m)^\s*</onlyinclude>\s*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?m)^\s*\|[^\n]*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`(?m)^\s*=+\s*[^=]+\s*=+\s*$`).ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "'''", "")
	s = strings.ReplaceAll(s, "''", "")
	s = replaceWikiLinks(s)
	s = regexp.MustCompile(`\n{3,}`).ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}

func stripWikiTemplates(input string) string {
	var b strings.Builder
	depth := 0
	for i := 0; i < len(input); i++ {
		if i+1 < len(input) && input[i] == '{' && input[i+1] == '{' {
			depth++
			i++
			continue
		}
		if i+1 < len(input) && input[i] == '}' && input[i+1] == '}' {
			if depth > 0 {
				depth--
			}
			i++
			continue
		}
		if depth == 0 {
			b.WriteByte(input[i])
		}
	}
	return b.String()
}

func replaceWikiLinks(s string) string {
	rePipe := regexp.MustCompile(`\[\[([^\]|]+)\|([^\]]+)\]\]`)
	s = rePipe.ReplaceAllString(s, `$2`)
	reSimple := regexp.MustCompile(`\[\[([^\]]+)\]\]`)
	s = reSimple.ReplaceAllString(s, `$1`)
	return s
}
