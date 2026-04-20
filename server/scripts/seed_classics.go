//go:build ignore

// 用法：go run scripts/seed_classics.go <DB_DSN>
// 插入/更新名著测试数据（覆盖分类与朝代筛选），可重复执行且不产生重复书籍。

package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	postgresDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type chapterSeed struct {
	Title   string
	Content string
}

type bookSeed struct {
	Title              string
	Category           string
	Dynasty            string
	Brief              string
	EstimatedWordCount int
	AuthorName         string
	AuthorDynasty      string
	AuthorBrief        string
	EditionLabel       string
	Chapters           []chapterSeed
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run scripts/seed_classics.go <DB_DSN>")
	}
	dsn := strings.TrimSpace(os.Args[1])
	if dsn == "" {
		log.Fatal("empty DB_DSN")
	}

	db, err := gorm.Open(postgresDriver.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}

	books := classicsSeeds()
	upsertedBooks := 0
	upsertedChapters := 0

	for _, seed := range books {
		authorID, err := ensureAuthor(db, seed)
		if err != nil {
			log.Fatalf("ensure author %s failed: %v", seed.AuthorName, err)
		}

		bookID, err := ensureBook(db, seed)
		if err != nil {
			log.Fatalf("ensure book %s failed: %v", seed.Title, err)
		}
		upsertedBooks++

		if err := db.Exec(
			`INSERT INTO classics_book_authors (book_id, author_id, sort_order)
			 VALUES (?,?,0)
			 ON CONFLICT (book_id, author_id) DO NOTHING`,
			bookID, authorID,
		).Error; err != nil {
			log.Fatalf("link book-author %s failed: %v", seed.Title, err)
		}

		editionID, err := ensureEdition(db, bookID, seed.EditionLabel)
		if err != nil {
			log.Fatalf("ensure edition for %s failed: %v", seed.Title, err)
		}

		chapterCount := len(seed.Chapters)
		computedWords := 0
		for idx, ch := range seed.Chapters {
			wordCount := len([]rune(ch.Content))
			computedWords += wordCount
			if err := upsertChapter(db, editionID, bookID, idx, ch.Title, ch.Content, wordCount); err != nil {
				log.Fatalf("upsert chapter %s failed: %v", ch.Title, err)
			}
			upsertedChapters++
		}

		bookWords := seed.EstimatedWordCount
		if bookWords <= 0 {
			bookWords = computedWords
		}

		if err := db.Exec(
			`UPDATE classics_books
			 SET chapter_count = ?, word_count = ?, updated_at = NOW(), is_published = TRUE
			 WHERE id = ?`,
			chapterCount, bookWords, bookID,
		).Error; err != nil {
			log.Fatalf("update book stats %s failed: %v", seed.Title, err)
		}

		fmt.Printf("✅ %s（%s/%s）章节=%d\n", seed.Title, seed.Category, seed.Dynasty, chapterCount)
	}

	fmt.Printf("\n🎉 名著测试数据准备完成：%d 本书，%d 章（可重复执行，不会新增重复书目）\n", upsertedBooks, upsertedChapters)
}

func ensureAuthor(db *gorm.DB, seed bookSeed) (int64, error) {
	id, err := queryID(db, `SELECT id FROM classics_authors WHERE name = ? ORDER BY id ASC LIMIT 1`, seed.AuthorName)
	if err != nil {
		return 0, err
	}
	if id > 0 {
		if err := db.Exec(
			`UPDATE classics_authors SET dynasty = ?, brief = ?, updated_at = NOW() WHERE id = ?`,
			seed.AuthorDynasty, seed.AuthorBrief, id,
		).Error; err != nil {
			return 0, err
		}
		return id, nil
	}

	if err := db.Exec(
		`INSERT INTO classics_authors (name, dynasty, brief)
		 VALUES (?,?,?)`,
		seed.AuthorName, seed.AuthorDynasty, seed.AuthorBrief,
	).Error; err != nil {
		return 0, err
	}
	return queryID(db, `SELECT id FROM classics_authors WHERE name = ? ORDER BY id DESC LIMIT 1`, seed.AuthorName)
}

func ensureBook(db *gorm.DB, seed bookSeed) (int64, error) {
	id, err := queryID(db, `SELECT id FROM classics_books WHERE title = ? ORDER BY id ASC LIMIT 1`, seed.Title)
	if err != nil {
		return 0, err
	}
	if id > 0 {
		if err := db.Exec(
			`UPDATE classics_books
			 SET category = ?, dynasty = ?, brief = ?, is_published = TRUE, deleted_at = NULL, updated_at = NOW(), word_count = ?
			 WHERE id = ?`,
			seed.Category, seed.Dynasty, seed.Brief, seed.EstimatedWordCount, id,
		).Error; err != nil {
			return 0, err
		}
		return id, nil
	}

	if err := db.Exec(
		`INSERT INTO classics_books
		 (title, category, dynasty, brief, word_count, chapter_count, is_published)
		 VALUES (?,?,?,?,?,?,TRUE)`,
		seed.Title, seed.Category, seed.Dynasty, seed.Brief,
		seed.EstimatedWordCount, len(seed.Chapters),
	).Error; err != nil {
		return 0, err
	}
	return queryID(db, `SELECT id FROM classics_books WHERE title = ? ORDER BY id DESC LIMIT 1`, seed.Title)
}

func ensureEdition(db *gorm.DB, bookID int64, label string) (int64, error) {
	if err := db.Exec(`UPDATE classics_editions SET is_default = FALSE WHERE book_id = ?`, bookID).Error; err != nil {
		return 0, err
	}

	id, err := queryID(
		db,
		`SELECT id FROM classics_editions WHERE book_id = ? AND label = ? ORDER BY id ASC LIMIT 1`,
		bookID, label,
	)
	if err != nil {
		return 0, err
	}
	if id > 0 {
		if err := db.Exec(`UPDATE classics_editions SET is_default = TRUE, updated_at = NOW() WHERE id = ?`, id).Error; err != nil {
			return 0, err
		}
		return id, nil
	}

	if err := db.Exec(
		`INSERT INTO classics_editions (book_id, label, is_default) VALUES (?,?,TRUE)`,
		bookID, label,
	).Error; err != nil {
		return 0, err
	}

	return queryID(
		db,
		`SELECT id FROM classics_editions WHERE book_id = ? AND label = ? ORDER BY id DESC LIMIT 1`,
		bookID, label,
	)
}

func upsertChapter(db *gorm.DB, editionID, bookID int64, chapterIndex int, title, content string, wordCount int) error {
	existingID, err := queryID(
		db,
		`SELECT id FROM classics_chapters WHERE edition_id = ? AND chapter_index = ? LIMIT 1`,
		editionID, chapterIndex,
	)
	if err != nil {
		return err
	}
	if existingID > 0 {
		return db.Exec(
			`UPDATE classics_chapters
			 SET title = ?, content = ?, word_count = ?, updated_at = NOW()
			 WHERE id = ?`,
			title, content, wordCount, existingID,
		).Error
	}
	return db.Exec(
		`INSERT INTO classics_chapters (edition_id, book_id, chapter_index, title, content, word_count)
		 VALUES (?,?,?,?,?,?)`,
		editionID, bookID, chapterIndex, title, content, wordCount,
	).Error
}

func queryID(db *gorm.DB, query string, args ...any) (int64, error) {
	var row struct {
		ID int64 `gorm:"column:id"`
	}
	if err := db.Raw(query, args...).Scan(&row).Error; err != nil {
		return 0, err
	}
	return row.ID, nil
}

func classicsSeeds() []bookSeed {
	return []bookSeed{
		{
			Title:              "朝花夕拾",
			Category:           "现代文学",
			Dynasty:            "近现代",
			Brief:              "鲁迅的回忆散文集，语言白话清晰，从个人经历切入社会观察。",
			EstimatedWordCount: 120000,
			AuthorName:         "鲁迅",
			AuthorDynasty:      "近现代",
			AuthorBrief:        "现代文学家、思想家，代表作包括《呐喊》《朝花夕拾》。",
			EditionLabel:       "人民文学出版社版",
			Chapters: []chapterSeed{
				{Title: "狗·猫·鼠", Content: "从童年记忆出发，写日常动物，也写社会偏见和人情冷暖。"},
				{Title: "阿长与《山海经》", Content: "通过一位普通长者的细节，写出朴素善意与成长中的情感记忆。"},
				{Title: "从百草园到三味书屋", Content: "以白话叙事并置童年自由与课堂秩序，读感亲切、画面感强。"},
			},
		},
		{
			Title:              "呐喊",
			Category:           "现代文学",
			Dynasty:            "近现代",
			Brief:              "中国现代短篇小说集代表作，以白话表达社会切面与人物精神困境。",
			EstimatedWordCount: 90000,
			AuthorName:         "鲁迅",
			AuthorDynasty:      "近现代",
			AuthorBrief:        "现代文学家、思想家，代表作包括《呐喊》《朝花夕拾》。",
			EditionLabel:       "人民文学出版社版",
			Chapters: []chapterSeed{
				{Title: "狂人日记", Content: "借叙述者的主观视角，揭示社会结构中的压迫与个体恐惧。"},
				{Title: "孔乙己", Content: "通过一个小人物的命运，折射时代观念与群体冷漠。"},
				{Title: "故乡", Content: "以返乡见闻串联记忆与现实，语言简洁却有强烈情绪张力。"},
			},
		},
		{
			Title:              "彷徨",
			Category:           "现代文学",
			Dynasty:            "近现代",
			Brief:              "鲁迅中后期小说集，延续白话写作，人物心理刻画更克制深沉。",
			EstimatedWordCount: 100000,
			AuthorName:         "鲁迅",
			AuthorDynasty:      "近现代",
			AuthorBrief:        "现代文学家、思想家，代表作包括《呐喊》《朝花夕拾》。",
			EditionLabel:       "人民文学出版社版",
			Chapters: []chapterSeed{
				{Title: "祝福", Content: "以女性命运为中心，展示旧观念下个体的反复受困。"},
				{Title: "在酒楼上", Content: "借重逢对谈反映理想与现实之间的持续拉扯。"},
				{Title: "伤逝", Content: "用白话叙事书写青年爱情与生活压力的双重消耗。"},
			},
		},
		{
			Title:              "鲁滨逊漂流记",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "冒险叙事经典，章节结构清晰，现代读者可直接进入故事主线。",
			EstimatedWordCount: 240000,
			AuthorName:         "Daniel Defoe",
			AuthorDynasty:      "英国近代",
			AuthorBrief:        "英国小说家，《鲁滨逊漂流记》作者。",
			EditionLabel:       "Project Gutenberg 完整版",
			Chapters: []chapterSeed{
				{Title: "第一章", Content: "主人公讲述出海起因与遭遇风暴，故事从航海风险迅速展开。"},
				{Title: "第二章", Content: "流落荒岛后开始盘点物资、搭建住处，生存细节密集。"},
				{Title: "第三章", Content: "逐步建立日常秩序并改造环境，叙事重点转向长期生存。"},
			},
		},
		{
			Title:              "简爱",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "英国成长小说经典，现代简体译本阅读顺畅，兼具情感与自我意识主题。",
			EstimatedWordCount: 180000,
			AuthorName:         "夏洛蒂·勃朗特",
			AuthorDynasty:      "英国维多利亚时代",
			AuthorBrief:        "英国小说家，《简爱》作者。",
			EditionLabel:       "经典简体译本",
			Chapters: []chapterSeed{
				{Title: "童年与学校", Content: "主人公在压抑环境中成长，逐步形成独立判断与自尊意识。"},
				{Title: "庄园生活", Content: "在新环境中建立情感连接，也不断面对身份与价值冲突。"},
				{Title: "自我选择", Content: "关键抉择围绕尊严、爱情与自由展开，叙事清晰有力量。"},
			},
		},
		{
			Title:              "傲慢与偏见",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "以婚恋叙事切入阶层与偏见问题，简体译本对白自然，节奏轻快。",
			EstimatedWordCount: 160000,
			AuthorName:         "简·奥斯汀",
			AuthorDynasty:      "英国乔治时代",
			AuthorBrief:        "英国小说家，擅长以细腻讽刺描绘家庭与社交关系。",
			EditionLabel:       "经典简体译本",
			Chapters: []chapterSeed{
				{Title: "初识与误解", Content: "人物初次交锋中充满先入判断，为后续关系转折奠定基础。"},
				{Title: "冲突升级", Content: "在家庭与社交压力中，主角不断修正对彼此的认知。"},
				{Title: "理解与成长", Content: "误解逐步化解，人物完成观念成长并建立更成熟关系。"},
			},
		},
		{
			Title:              "了不起的盖茨比",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "美国现代小说经典，简体译文易读，通过个人叙事折射时代幻象。",
			EstimatedWordCount: 90000,
			AuthorName:         "F. Scott Fitzgerald",
			AuthorDynasty:      "美国现代",
			AuthorBrief:        "美国作家，20 世纪英语文学代表人物之一。",
			EditionLabel:       "经典简体译本",
			Chapters: []chapterSeed{
				{Title: "夏日长岛", Content: "叙述者进入上层社交圈，逐步接触光鲜外表下的情感裂缝。"},
				{Title: "派对与真相", Content: "繁华场景背后，人物关系与过往经历开始显露复杂层次。"},
				{Title: "梦的代价", Content: "结局部分集中讨论理想、阶层与时代速度对个体命运的影响。"},
			},
		},
		{
			Title:              "巴斯克维尔的猎犬",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "福尔摩斯系列长篇代表作，悬疑节奏稳定，章节推进明确。",
			EstimatedWordCount: 120000,
			AuthorName:         "Arthur Conan Doyle",
			AuthorDynasty:      "英国近代",
			AuthorBrief:        "英国侦探小说家，福尔摩斯系列作者。",
			EditionLabel:       "Project Gutenberg 完整版",
			Chapters: []chapterSeed{
				{Title: "第一章", Content: "案件从家族传说与离奇线索切入，迅速建立悬疑气氛。"},
				{Title: "第二章", Content: "侦探调查逐步深入，信息层层展开并不断制造反转。"},
				{Title: "第三章", Content: "关键线索收束到行动现场，真相在多方证据中拼合。"},
			},
		},
		{
			Title:              "月亮与六便士",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "现代小说经典，简体译本可读性强，围绕理想与现实的冲突展开。",
			EstimatedWordCount: 140000,
			AuthorName:         "W. Somerset Maugham",
			AuthorDynasty:      "英国现代",
			AuthorBrief:        "英国作家，作品以冷静叙事和人性观察见长。",
			EditionLabel:       "经典简体译本",
			Chapters: []chapterSeed{
				{Title: "突然离场", Content: "主角放下稳定生活追逐绘画理想，直接打破常规成功路径。"},
				{Title: "远赴他乡", Content: "人物在异地创作与生活中持续承受代价，也不断靠近内心目标。"},
				{Title: "理想的背面", Content: "作品收束在对天赋、欲望与责任边界的复杂讨论上。"},
			},
		},
	}
}
