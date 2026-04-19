//go:build ignore

// 用法：go run scripts/seed_classics.go <DB_DSN>
// 插入少量测试名著数据（《三国演义》《红楼梦》），用于本地验证接口和前端页面。

package main

import (
	"fmt"
	"log"
	"os"

	postgresDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run scripts/seed_classics.go <DB_DSN>")
	}
	dsn := os.Args[1]
	db, err := gorm.Open(postgresDriver.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	// ---- 作者 ----
	type Author struct {
		ID      int64
		Name    string
		Dynasty string
		Brief   string
	}
	authors := []Author{
		{Name: "罗贯中", Dynasty: "元末明初", Brief: "名本，字贯中，号湖海散人，元末明初小说家，《三国演义》作者。"},
		{Name: "曹雪芹", Dynasty: "清", Brief: "名霑，字梦阮，号雪芹，清代小说家，《红楼梦》作者。"},
	}
	for i := range authors {
		if err := db.Raw(
			`INSERT INTO classics_authors (name, dynasty, brief) VALUES (?,?,?) ON CONFLICT DO NOTHING RETURNING id`,
			authors[i].Name, authors[i].Dynasty, authors[i].Brief,
		).Scan(&authors[i].ID).Error; err != nil {
			log.Fatalf("insert author %s: %v", authors[i].Name, err)
		}
		// 如果已存在，查一下 id
		if authors[i].ID == 0 {
			db.Raw(`SELECT id FROM classics_authors WHERE name = ?`, authors[i].Name).Scan(&authors[i].ID)
		}
		fmt.Printf("✅ 作者 %s id=%d\n", authors[i].Name, authors[i].ID)
	}

	// ---- 书籍 ----
	type Book struct {
		ID       int64
		Title    string
		Category string
		Dynasty  string
		Brief    string
		AuthorID int64
	}
	books := []Book{
		{
			Title:    "三国演义",
			Category: "古典文学",
			Dynasty:  "元末明初",
			Brief:    "中国古典四大名著之一，以东汉末年为背景，描绘魏蜀吴三国鼎立、争霸天下的历史演义故事。",
			AuthorID: authors[0].ID,
		},
		{
			Title:    "红楼梦",
			Category: "古典文学",
			Dynasty:  "清",
			Brief:    "中国古典四大名著之首，以贾、史、王、薛四大家族的兴衰为背景，描绘封建社会末期的人情世故与儿女情长。",
			AuthorID: authors[1].ID,
		},
	}
	for i := range books {
		if err := db.Raw(
			`INSERT INTO classics_books (title, category, dynasty, brief, word_count, chapter_count, is_published)
			 VALUES (?,?,?,?,?,?,true) ON CONFLICT DO NOTHING RETURNING id`,
			books[i].Title, books[i].Category, books[i].Dynasty, books[i].Brief,
			600000, 5,
		).Scan(&books[i].ID).Error; err != nil {
			log.Fatalf("insert book %s: %v", books[i].Title, err)
		}
		if books[i].ID == 0 {
			db.Raw(`SELECT id FROM classics_books WHERE title = ?`, books[i].Title).Scan(&books[i].ID)
		}
		fmt.Printf("✅ 书籍 %s id=%d\n", books[i].Title, books[i].ID)

		// 关联作者
		db.Exec(`INSERT INTO classics_book_authors (book_id, author_id, sort_order) VALUES (?,?,0) ON CONFLICT DO NOTHING`,
			books[i].ID, books[i].AuthorID)
	}

	// ---- 版本 ----
	type Edition struct {
		ID     int64
		BookID int64
		Label  string
	}
	editions := []Edition{
		{BookID: books[0].ID, Label: "人民文学出版社版"},
		{BookID: books[1].ID, Label: "人民文学出版社版"},
	}
	for i := range editions {
		if err := db.Raw(
			`INSERT INTO classics_editions (book_id, label, is_default) VALUES (?,?,true) ON CONFLICT DO NOTHING RETURNING id`,
			editions[i].BookID, editions[i].Label,
		).Scan(&editions[i].ID).Error; err != nil {
			log.Fatalf("insert edition: %v", err)
		}
		if editions[i].ID == 0 {
			db.Raw(`SELECT id FROM classics_editions WHERE book_id = ? AND label = ?`, editions[i].BookID, editions[i].Label).Scan(&editions[i].ID)
		}
		fmt.Printf("✅ 版本 \"%s\" id=%d\n", editions[i].Label, editions[i].ID)
	}

	// ---- 章节 ----
	type Chapter struct {
		EditionID int64
		BookID    int64
		Index     int
		Title     string
		Content   string
	}

	// 三国演义前5章
	sgChapters := []Chapter{
		{EditionID: editions[0].ID, BookID: books[0].ID, Index: 0, Title: "第一回 宴桃园豪杰三结义 斩黄巾英雄首立功",
			Content: "话说天下大势，分久必合，合久必分。周末七国分争，并入于秦。及秦灭之后，楚、汉分争，又并入于汉。汉朝自高祖斩白蛇而起义，一统天下，后来光武中兴，传至献帝，遂分为三国。\n\n推其致乱之由，殆始于桓、灵二帝。桓帝禁锢善类，崇信宦官。及桓帝崩，灵帝即位，大将军窦武、太傅陈蕃共相辅佐。时有宦官曹节等弄权，窦武、陈蕃谋诛之，机事不密，反为所害，中涓自此愈横。\n\n建宁二年四月望日，帝御温德殿。方升座，殿角狂风骤起。只见一条大青蛇，从梁上飞将下来，蟠于椅上。帝惊倒，左右急救入宫，百官俱奔避。须臾，蛇不见了。忽然大雷大雨，加以冰雹，落了半个时辰，损坏房屋无数。"},
		{EditionID: editions[0].ID, BookID: books[0].ID, Index: 1, Title: "第二回 张翼德怒鞭督邮 何国舅谋诛宦竖",
			Content: "且说董卓字仲颖，陇西临洮人也，官拜河东太守，自来骄傲。当日怠慢了玄德，张飞性发，便欲杀之。玄德与关公急止之曰：'他是朝廷命官，岂可擅杀？'飞曰：'若不杀这厮，反要在他部下听令，其实不甘！'玄德曰：'且耐些，别作商议。'"},
		{EditionID: editions[0].ID, BookID: books[0].ID, Index: 2, Title: "第三回 议温明董卓叱丁原 馈金珠李肃说吕布",
			Content: "且说何进字遂高，南阳人也。因其妹入宫为贵人，生皇子辩，被立为皇后，进由是得居高位，封为大将军。灵帝病笃，召进与中常侍蹇硕等，受遗诏辅太子。灵帝崩，太子即位，是为少帝。何太后临朝，进总朝政。"},
		{EditionID: editions[0].ID, BookID: books[0].ID, Index: 3, Title: "第四回 废汉帝陈留践位 谋董贼孟德献刀",
			Content: "却说陈宫临欲下手，忽转念曰：'我为国家跟他到此，欲杀董卓，不期错杀好人；今若杀之，是不义也。'遂收刀，插于腰间，连夜便走，骑马出城，望故乡而去。曹操独卧，不能成寐，听得更点，翻身起坐，思忖半晌，乃作歌曰：关东有义士，兴兵讨群凶。初期会盟津，乃心在咸阳。白骨露于野，千里无鸡鸣。生民百遗一，念之断人肠。"},
		{EditionID: editions[0].ID, BookID: books[0].ID, Index: 4, Title: "第五回 发矫诏诸镇应曹公 破关兵三英战吕布",
			Content: "操传檄文，使人星夜驰报各镇。操首先兴兵，领精兵五千，先到陈留招募，并发矫诏，声罪董卓，共聚兵马。陈留太守张邈与操交厚，也起兵相助。于是各路诸侯，俱来会盟。"},
	}

	// 红楼梦前5章
	hlmChapters := []Chapter{
		{EditionID: editions[1].ID, BookID: books[1].ID, Index: 0, Title: "第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀",
			Content: "此开卷第一回也。作者自云：因曾历过一番梦幻之后，故将真事隐去，而借'通灵'之说，撰此石头记一书也。故曰甄士隐云云。\n\n但书中所记何事何人？自己又云：今风尘碌碌，一事无成，忽念及当日所有之女子，一一细考较去，觉其行止见识，皆出于我之上。何我堂堂须眉，诚不若彼裙钗哉？实愧则有余，悔又无益。故曰贾雨村云云。"},
		{EditionID: editions[1].ID, BookID: books[1].ID, Index: 1, Title: "第二回 贾夫人仙逝扬州城 冷子兴演说荣国府",
			Content: "却说封肃因听见公差传唤，好生疑惑，忙出来陪笑启问。那些公人只嚷：当日葫芦庙失火，烧了一条街，他便扬长而去，不知去向，今有何事？封肃忙赔笑道：小人姓封，并非姓甄。众人道：你就是甄老爷的亲丈人，我们要你带路，快去请出甄老爷来见我们老爷。"},
		{EditionID: editions[1].ID, BookID: books[1].ID, Index: 2, Title: "第三回 贾雨村夤缘复旧职 林黛玉抛父进京都",
			Content: "且说黛玉自那日弃舟登岸时，便有荣国府打发了轿子并拉行李车辆久候了。这林黛玉常听得母亲说过，他外祖母家与别家不同。因此步步留心，时时在意，不肯轻易多说一句话，多行一步路，惟恐被人耻笑了他去。"},
		{EditionID: editions[1].ID, BookID: books[1].ID, Index: 3, Title: "第四回 薄命女偏逢薄命郎 葫芦僧乱判葫芦案",
			Content: "且说雨村自到任后，每日设堂办事，这日退堂后，有门子上来禀道：今日老爷在堂上，偶然失于觉察，有一件事须密禀。雨村延之进密室，令茶，门子方说道：老爷莫不认得这被打之死鬼？雨村道：面善，想来曾会过的。"},
		{EditionID: editions[1].ID, BookID: books[1].ID, Index: 4, Title: "第五回 游幻境指迷十二钗 饮仙醪曲演红楼梦",
			Content: "一日，贾母因溺爱宝玉，生恐读书太苦，命他只去随意玩耍。宝玉便来至秦氏房中，因见正面高悬一幅画，画的人物隽雅，其语意曰：世事洞明皆学问，人情练达即文章。宝玉看了，好像有什么话要说，欲待发泄，不觉已到梦境。"},
	}

	allChapters := append(sgChapters, hlmChapters...)
	for _, ch := range allChapters {
		if err := db.Exec(
			`INSERT INTO classics_chapters (edition_id, book_id, chapter_index, title, content, word_count)
			 VALUES (?,?,?,?,?,?) ON CONFLICT (edition_id, chapter_index) DO NOTHING`,
			ch.EditionID, ch.BookID, ch.Index, ch.Title, ch.Content, len([]rune(ch.Content)),
		).Error; err != nil {
			log.Fatalf("insert chapter %s: %v", ch.Title, err)
		}
		fmt.Printf("  ✅ 章节 %s\n", ch.Title)
	}

	// 更新 chapter_count
	for _, b := range books {
		db.Exec(`UPDATE classics_books SET chapter_count = 5 WHERE id = ?`, b.ID)
	}

	fmt.Println("\n🎉 测试数据插入完成，共 2 本书 × 5 章")
}
