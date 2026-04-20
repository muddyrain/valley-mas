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
			Title:              "论语",
			Category:           "古典文学",
			Dynasty:            "先秦",
			Brief:              "记录孔子及其弟子言行的语录体经典，涵盖修身、为政、教育等核心思想。",
			EstimatedWordCount: 160000,
			AuthorName:         "孔子",
			AuthorDynasty:      "先秦",
			AuthorBrief:        "名丘，字仲尼，儒家学派创始人。",
			EditionLabel:       "中华书局注译本",
			Chapters: []chapterSeed{
				{Title: "学而篇", Content: "学而时习之，不亦说乎。通过学习与实践并行，强调为学之本在于持久与自省。"},
				{Title: "为政篇", Content: "为政以德，譬如北辰。以德行治理国家，重视礼乐秩序与人格感召。"},
				{Title: "里仁篇", Content: "里仁为美。择善而居、见贤思齐，构成个人修养与社会关系的基础。"},
			},
		},
		{
			Title:              "史记",
			Category:           "历史传记",
			Dynasty:            "汉",
			Brief:              "纪传体通史巨著，上起黄帝下迄汉武帝，兼具史学价值与文学性。",
			EstimatedWordCount: 526000,
			AuthorName:         "司马迁",
			AuthorDynasty:      "汉",
			AuthorBrief:        "西汉史学家、文学家，被誉为“史家之绝唱”。",
			EditionLabel:       "中华书局点校本",
			Chapters: []chapterSeed{
				{Title: "太史公自序", Content: "叙述著书缘起与史学志向，强调通古今之变，成一家之言。"},
				{Title: "项羽本纪", Content: "以楚汉相争为中心，塑造项羽悲剧英雄形象。"},
				{Title: "李将军列传", Content: "记录李广生平事迹，展现边塞将领的忠勇与命运。"},
			},
		},
		{
			Title:              "世说新语",
			Category:           "古典文学",
			Dynasty:            "魏晋南北朝",
			Brief:              "志人小说代表作，通过短篇轶事呈现魏晋名士风度与时代气质。",
			EstimatedWordCount: 120000,
			AuthorName:         "刘义庆",
			AuthorDynasty:      "魏晋南北朝",
			AuthorBrief:        "南朝宋宗室文学家，组织门客编撰《世说新语》。",
			EditionLabel:       "中华书局校注本",
			Chapters: []chapterSeed{
				{Title: "德行", Content: "通过人物言行刻画士人品德，突出清谈时代的伦理理想。"},
				{Title: "言语", Content: "收录机锋对答与妙语，体现魏晋人物的思辨与风采。"},
				{Title: "雅量", Content: "以危急情境下的从容表现，勾勒名士的精神气度。"},
			},
		},
		{
			Title:              "唐诗三百首",
			Category:           "诗词歌赋",
			Dynasty:            "唐",
			Brief:              "清代编选的唐诗普及读本，涵盖五言七言、古体近体等多类题材。",
			EstimatedWordCount: 90000,
			AuthorName:         "孙洙",
			AuthorDynasty:      "清",
			AuthorBrief:        "清代诗人、教育家，《唐诗三百首》编者。",
			EditionLabel:       "蘅塘退士编注本",
			Chapters: []chapterSeed{
				{Title: "五言古诗选", Content: "收录边塞、山水、送别等题材，语言质朴而意境悠远。"},
				{Title: "七言律诗选", Content: "展示律诗格律之美，强调对仗与声律的均衡。"},
				{Title: "绝句选", Content: "以短章见长，凝练表达情绪与画面感。"},
			},
		},
		{
			Title:              "宋词三百首",
			Category:           "诗词歌赋",
			Dynasty:            "宋",
			Brief:              "宋词经典选本，兼收豪放与婉约，适合入门与检索主题风格。",
			EstimatedWordCount: 85000,
			AuthorName:         "朱祖谋",
			AuthorDynasty:      "清",
			AuthorBrief:        "词学家，参与宋词选本整理与传播。",
			EditionLabel:       "上疆村民辑本",
			Chapters: []chapterSeed{
				{Title: "婉约词选", Content: "以儿女情思和细腻景物描摹见长，语言含蓄。"},
				{Title: "豪放词选", Content: "兼具家国情怀与人生意气，节奏开阔，气象雄浑。"},
				{Title: "咏物词选", Content: "借物抒怀，往往通过梅、柳、月等意象折射心境。"},
			},
		},
		{
			Title:              "窦娥冤",
			Category:           "古典文学",
			Dynasty:            "元",
			Brief:              "元杂剧代表作，以强烈戏剧冲突揭示冤狱与社会不公。",
			EstimatedWordCount: 110000,
			AuthorName:         "关汉卿",
			AuthorDynasty:      "元",
			AuthorBrief:        "元代戏曲作家，被誉为“曲圣”。",
			EditionLabel:       "元曲选注本",
			Chapters: []chapterSeed{
				{Title: "楔子", Content: "交代人物关系与悲剧因果，为后续冲突埋下伏笔。"},
				{Title: "第一折", Content: "窦娥被迫改嫁，命运急转直下，矛盾逐步升级。"},
				{Title: "第四折", Content: "昭雪冤案，完成道德审判与情感宣泄。"},
			},
		},
		{
			Title:              "三国演义",
			Category:           "古典文学",
			Dynasty:            "明",
			Brief:              "章回体历史演义巨著，以群雄逐鹿展现权谋、忠义与时代变局。",
			EstimatedWordCount: 600000,
			AuthorName:         "罗贯中",
			AuthorDynasty:      "元末明初",
			AuthorBrief:        "元末明初小说家，《三国演义》作者。",
			EditionLabel:       "人民文学出版社版",
			Chapters: []chapterSeed{
				{Title: "第一回 宴桃园豪杰三结义", Content: "东汉末年政局动荡，刘备、关羽、张飞结义，拉开群雄并起序幕。"},
				{Title: "第三回 议温明董卓叱丁原", Content: "朝堂权力更替频繁，董卓入京后天下局势进一步恶化。"},
				{Title: "第五回 发矫诏诸镇应曹公", Content: "各路诸侯会盟讨董，联盟与分裂并行，乱世格局形成。"},
			},
		},
		{
			Title:              "红楼梦",
			Category:           "古典文学",
			Dynasty:            "清",
			Brief:              "以贾府兴衰为主线，兼具家族史、社会史与人物心理书写。",
			EstimatedWordCount: 730000,
			AuthorName:         "曹雪芹",
			AuthorDynasty:      "清",
			AuthorBrief:        "清代小说家，《红楼梦》作者。",
			EditionLabel:       "人民文学出版社版",
			Chapters: []chapterSeed{
				{Title: "第一回 甄士隐梦幻识通灵", Content: "以“真事隐去”的叙述策略开篇，构建全书梦幻与现实交织的格局。"},
				{Title: "第三回 林黛玉抛父进京都", Content: "黛玉初入贾府，人物关系与审美气质逐步展开。"},
				{Title: "第五回 游幻境指迷十二钗", Content: "太虚幻境章节集中呈现人物命运隐喻。"},
			},
		},
		{
			Title:              "朝花夕拾",
			Category:           "现代文学",
			Dynasty:            "近现代",
			Brief:              "鲁迅回忆性散文集，以个人经验折射时代精神与社会观察。",
			EstimatedWordCount: 120000,
			AuthorName:         "鲁迅",
			AuthorDynasty:      "近现代",
			AuthorBrief:        "现代文学家、思想家，代表作包括《呐喊》《朝花夕拾》。",
			EditionLabel:       "人民文学出版社版",
			Chapters: []chapterSeed{
				{Title: "狗·猫·鼠", Content: "由动物叙述切入社会讽刺，展示杂文式锋芒。"},
				{Title: "阿长与《山海经》", Content: "通过童年记忆书写普通人物的善意与局限。"},
				{Title: "从百草园到三味书屋", Content: "并置童年自由与课堂秩序，形成强烈对照。"},
			},
		},
		{
			Title:              "傲慢与偏见",
			Category:           "外国文学",
			Dynasty:            "外国",
			Brief:              "英国现实主义长篇小说，以婚恋叙事探讨阶层、偏见与自我成长。",
			EstimatedWordCount: 120000,
			AuthorName:         "简·奥斯汀",
			AuthorDynasty:      "英国乔治时代",
			AuthorBrief:        "英国小说家，擅长以讽刺笔法描绘乡绅社会。",
			EditionLabel:       "经典译林版",
			Chapters: []chapterSeed{
				{Title: "Chapter 1", Content: "A wealthy bachelor arrives in the neighborhood, stirring family hopes and social speculation."},
				{Title: "Chapter 34", Content: "Elizabeth confronts Darcy's first proposal and challenges his pride and assumptions."},
				{Title: "Chapter 61", Content: "Through reflection and change, misunderstanding is resolved and mutual respect is established."},
			},
		},
	}
}
