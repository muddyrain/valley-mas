//go:build ignore

// 用法：go run scripts/backfill_foreign_cn_editions.go <DB_DSN>
// 为“外国文学”书目补齐简体中文导读版章节，支持与英文原版切换。

package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	postgresDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

type chapterSeed struct {
	Title   string
	Content string
}

type foreignGuideSeed struct {
	BookTitle   string
	EditionLabel string
	Translator  string
	Chapters    []chapterSeed
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run scripts/backfill_foreign_cn_editions.go <DB_DSN>")
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

	seeds := []foreignGuideSeed{
		{
			BookTitle:   "鲁滨逊漂流记",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "第一章", Content: "主人公讲述出海起因与遭遇风暴，故事从航海风险迅速展开。"},
				{Title: "第二章", Content: "流落荒岛后开始盘点物资、搭建住处，生存细节密集。"},
				{Title: "第三章", Content: "逐步建立日常秩序并改造环境，叙事重点转向长期生存。"},
			},
		},
		{
			BookTitle:   "简爱",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "童年与学校", Content: "主人公在压抑环境中成长，逐步形成独立判断与自尊意识。"},
				{Title: "庄园生活", Content: "在新环境中建立情感连接，也不断面对身份与价值冲突。"},
				{Title: "自我选择", Content: "关键抉择围绕尊严、爱情与自由展开，叙事清晰有力量。"},
			},
		},
		{
			BookTitle:   "傲慢与偏见",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "初识与误解", Content: "人物初次交锋中充满先入判断，为后续关系转折奠定基础。"},
				{Title: "冲突升级", Content: "在家庭与社交压力中，主角不断修正对彼此的认知。"},
				{Title: "理解与成长", Content: "误解逐步化解，人物完成观念成长并建立更成熟关系。"},
			},
		},
		{
			BookTitle:   "了不起的盖茨比",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "夏日长岛", Content: "叙述者进入上层社交圈，逐步接触光鲜外表下的情感裂缝。"},
				{Title: "派对与真相", Content: "繁华场景背后，人物关系与过往经历开始显露复杂层次。"},
				{Title: "梦的代价", Content: "结局部分集中讨论理想、阶层与时代速度对个体命运的影响。"},
			},
		},
		{
			BookTitle:   "巴斯克维尔的猎犬",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "第一章", Content: "案件从家族传说与离奇线索切入，迅速建立悬疑气氛。"},
				{Title: "第二章", Content: "侦探调查逐步深入，信息层层展开并不断制造反转。"},
				{Title: "第三章", Content: "关键线索收束到行动现场，真相在多方证据中拼合。"},
			},
		},
		{
			BookTitle:   "月亮与六便士",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "突然离场", Content: "主角放下稳定生活追逐绘画理想，直接打破常规成功路径。"},
				{Title: "远赴他乡", Content: "人物在异地创作与生活中持续承受代价，也不断靠近内心目标。"},
				{Title: "理想的背面", Content: "作品收束在对天赋、欲望与责任边界的复杂讨论上。"},
			},
		},
		{
			BookTitle:   "老人与海",
			EditionLabel: "简体中文导读版",
			Translator:  "Valley MAS 导读整理",
			Chapters: []chapterSeed{
				{Title: "漫长空网", Content: "老渔夫连续多日空手而归，却依然坚持出海，人物的尊严与韧性从开篇就被确立。"},
				{Title: "海上鏖战", Content: "与大马林鱼的拉锯成为全书核心，体力、意志与经验在海上极限对抗中层层展开。"},
				{Title: "带着尊严归来", Content: "归航后虽只剩鱼骨，人物仍保有不屈精神，小说以克制笔法完成关于失败与尊严的讨论。"},
			},
		},
	}

	totalBooks := 0
	totalChapters := 0
	for _, seed := range seeds {
		bookID, err := mustGetBookID(db, seed.BookTitle)
		if err != nil {
			log.Fatalf("find book %s failed: %v", seed.BookTitle, err)
		}
		editionID, err := ensureGuideEdition(db, bookID, seed.EditionLabel, seed.Translator)
		if err != nil {
			log.Fatalf("ensure edition %s failed: %v", seed.BookTitle, err)
		}

		if err := replaceEditionChapters(db, editionID, bookID, seed.Chapters); err != nil {
			log.Fatalf("replace chapters %s failed: %v", seed.BookTitle, err)
		}

		totalBooks++
		totalChapters += len(seed.Chapters)
		fmt.Printf("✅ %s: %s %d章\n", seed.BookTitle, seed.EditionLabel, len(seed.Chapters))
	}

	fmt.Printf("\n🎉 导读版补齐完成：%d 本书，%d 章\n", totalBooks, totalChapters)
}

func mustGetBookID(db *gorm.DB, title string) (int64, error) {
	var row struct {
		ID int64 `gorm:"column:id"`
	}
	err := db.Raw(`SELECT id FROM classics_books WHERE title = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`, title).Scan(&row).Error
	if err != nil {
		return 0, err
	}
	if row.ID == 0 {
		return 0, fmt.Errorf("book not found")
	}
	return row.ID, nil
}

func ensureGuideEdition(db *gorm.DB, bookID int64, label, translator string) (int64, error) {
	var row struct {
		ID int64 `gorm:"column:id"`
	}
	if err := db.Raw(
		`SELECT id FROM classics_editions WHERE book_id = ? AND label = ? ORDER BY id ASC LIMIT 1`,
		bookID, label,
	).Scan(&row).Error; err != nil {
		return 0, err
	}
	if row.ID > 0 {
		if err := db.Exec(
			`UPDATE classics_editions SET translator = ?, updated_at = NOW() WHERE id = ?`,
			translator, row.ID,
		).Error; err != nil {
			return 0, err
		}
		return row.ID, nil
	}

	if err := db.Exec(
		`INSERT INTO classics_editions (book_id, label, translator, is_default, created_at, updated_at)
		 VALUES (?, ?, ?, FALSE, NOW(), NOW())`,
		bookID, label, translator,
	).Error; err != nil {
		return 0, err
	}
	if err := db.Raw(
		`SELECT id FROM classics_editions WHERE book_id = ? AND label = ? ORDER BY id DESC LIMIT 1`,
		bookID, label,
	).Scan(&row).Error; err != nil {
		return 0, err
	}
	if row.ID == 0 {
		return 0, fmt.Errorf("create edition failed")
	}
	return row.ID, nil
}

func replaceEditionChapters(db *gorm.DB, editionID, bookID int64, chapters []chapterSeed) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`DELETE FROM classics_chapters WHERE edition_id = ?`, editionID).Error; err != nil {
			return err
		}
		now := time.Now()
		for i, ch := range chapters {
			content := strings.TrimSpace(ch.Content)
			if content == "" {
				continue
			}
			wordCount := len([]rune(content))
			if err := tx.Exec(
				`INSERT INTO classics_chapters
				 (edition_id, book_id, chapter_index, title, content, word_count, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				editionID, bookID, i, ch.Title, content, wordCount, now, now,
			).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
