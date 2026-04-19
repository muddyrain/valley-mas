# 名著 CLD-3 元数据模型定版

## 1. 目标

- 定版名著库的元数据字段，涵盖作者、译者、版本、章节四个核心维度。
- 字段设计需与 CLD-2 输出的章节数据契约对齐，避免导入链路与阅读器之间出现字段断层。
- 本文作为数据库 Schema、API 响应结构、前端展示字段的统一基线。

---

## 2. 模型层级

```
Book（书目）
  ├── Author[]（作者，1..n）
  ├── Translator[]（译者，0..n）
  ├── Edition（版本，1 本书可有多版本）
  │     └── Chapter[]（章节，来自 CLD-2 清洗输出）
  └── Tags[]（标签/分类）
```

---

## 3. Book（书目）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ | 系统主键 |
| `title` | string | ✅ | 书名（原始语言） |
| `title_zh` | string | ⬜ | 中文书名（若原文非中文） |
| `title_original` | string | ⬜ | 原文书名（非中文来源时填写） |
| `language` | string (BCP 47) | ✅ | 正文语言，如 `zh`、`en`、`fr` |
| `category` | string | ✅ | 分类：`novel`/`poetry`/`drama`/`essay`/`classic` |
| `period` | string | ⬜ | 时代/朝代，如 `先秦`、`19世纪`、`Renaissance` |
| `region` | string | ⬜ | 地域，如 `China`、`UK`、`Russia` |
| `synopsis` | string | ⬜ | 简介（300 字以内） |
| `cover_url` | string (URL) | ⬜ | 封面图 URL，来自 CLD-2 图片处理 |
| `tags` | string[] | ⬜ | 标签数组，如 `["爱情","战争"]` |
| `status` | enum | ✅ | `draft`/`published`/`hidden` |
| `created_at` | ISO 8601 | ✅ | 入库时间 |
| `updated_at` | ISO 8601 | ✅ | 最后更新时间 |

---

## 4. Author（作者）

一本书可对应多位作者（合著场景）。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ | 系统主键 |
| `name` | string | ✅ | 作者姓名（展示用，与来源一致） |
| `name_zh` | string | ⬜ | 中文姓名（外国作者） |
| `name_original` | string | ⬜ | 原文姓名 |
| `birth_year` | integer | ⬜ | 出生年份（公元，负数为 BC） |
| `death_year` | integer | ⬜ | 逝世年份；`null` 表示在世或不详 |
| `nationality` | string | ⬜ | 国籍/地域，如 `中国`、`England` |
| `bio` | string | ⬜ | 简介（200 字以内） |
| `external_url` | string (URL) | ⬜ | 维基百科或权威来源链接 |

**Book ↔ Author 关联表**：`book_authors`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `book_id` | string | |
| `author_id` | string | |
| `role` | enum | `primary`（主要作者）/`contributor`（贡献者） |
| `order` | integer | 展示顺序，从 1 起 |

---

## 5. Translator（译者）

译者仅在存在译本时出现，与版本（Edition）绑定，而非直接绑定书目。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ | 系统主键 |
| `name` | string | ✅ | 译者姓名 |
| `name_original` | string | ⬜ | 原文姓名（译者本人为外国人时） |
| `nationality` | string | ⬜ | 国籍/地域 |
| `bio` | string | ⬜ | 简介（100 字以内） |
| `external_url` | string (URL) | ⬜ | 权威来源链接 |

**Edition ↔ Translator 关联表**：`edition_translators`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `edition_id` | string | |
| `translator_id` | string | |
| `order` | integer | 展示顺序，从 1 起 |

---

## 6. Edition（版本）

一本书可有多个版本（不同译者、不同出版年份、不同来源格式）。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ | 系统主键 |
| `book_id` | string | ✅ | 关联 Book |
| `edition_label` | string | ✅ | 版本标签，如 `朱生豪译本`、`1859年英文版`、`现代汉语整理版` |
| `language` | string (BCP 47) | ✅ | 本版本正文语言 |
| `is_translation` | boolean | ✅ | 是否为译本 |
| `source_language` | string (BCP 47) | ⬜ | 译本的原文语言（`is_translation=true` 时必填） |
| `publish_year` | integer | ⬜ | 出版/发布年份 |
| `publisher` | string | ⬜ | 出版机构或来源平台名称 |
| `source_name` | string | ✅ | 来源名称（对应 CLD-1 白名单 `source_name`） |
| `source_url` | string (URL) | ✅ | 原始页面 URL（对应 CLD-1 `source_url`） |
| `license_type` | string | ✅ | 许可证类型，如 `PD`/`CC0`/`CC BY-SA` |
| `license_url` | string (URL) | ⬜ | 许可证链接 |
| `rights_note` | string | ⬜ | 权利说明摘录（CLD-1 `rights_note`） |
| `import_format` | enum | ✅ | `epub`/`txt`/`html`（来自 CLD-2） |
| `import_at` | ISO 8601 | ✅ | 导入时间（来自 CLD-2 输出） |
| `chapter_count` | integer | ✅ | 章节总数（由 CLD-2 清洗后写入） |
| `word_count` | integer | ⬜ | 全书总字数（由 CLD-2 清洗后累加） |
| `is_default` | boolean | ✅ | 是否为该书目的默认展示版本（每本书只有一个 `true`） |
| `status` | enum | ✅ | `draft`/`published`/`hidden` |

---

## 7. Chapter（章节）

章节数据由 CLD-2 清洗 Pipeline 直接写入，本节定版存储字段。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ | 系统主键 |
| `edition_id` | string | ✅ | 关联 Edition |
| `chapter_index` | integer | ✅ | 章节顺序，从 0 起（来自 CLD-2） |
| `chapter_title` | string | ⬜ | 章节标题（来自 CLD-2；无标题时为 null） |
| `chapter_html` | text | ✅ | 已清洗的 HTML 正文，可直接渲染（来自 CLD-2） |
| `word_count` | integer | ✅ | 本章字数（来自 CLD-2） |
| `has_footnotes` | boolean | ✅ | 是否含脚注（便于阅读器按需加载） |
| `footnotes` | jsonb | ⬜ | 脚注数组（来自 CLD-2 `footnotes[]`） |
| `has_illustrations` | boolean | ✅ | 是否含插图 |
| `illustrations` | jsonb | ⬜ | 插图数组（来自 CLD-2 `illustrations[]`） |

---

## 8. 字段校验规则

### 8.1 Book 必填校验

- `title`：非空，长度 1~200。
- `language`：有效 BCP 47 代码（最低接受 `zh`/`en`/`fr`/`de`/`ja`/`ru`/`es`）。
- `category`：枚举值之一。
- `status`：枚举值之一，默认 `draft`。

### 8.2 Edition 必填校验

- `edition_label`：非空，长度 1~100。
- `source_name` + `source_url`：必须同时填写，`source_name` 需在 CLD-1 白名单内（`import_policy = allow` 或 `conditional`）。
- `license_type`：枚举值，拒绝 `unknown`（须明确）。
- `is_translation = true` 时，`source_language` 必填且不得与 `language` 相同。
- 同一 `book_id` 下只能有一条 `is_default = true`；写入时自动将同书其他版本的 `is_default` 置为 `false`。
- `chapter_count`：>= 1，否则拒绝写入（CLD-2 质量门槛前置保证）。

### 8.3 Chapter 必填校验

- `chapter_index`：整数，同一 `edition_id` 下不重复，从 0 连续排列。
- `chapter_html`：非空，长度 > 0。
- `word_count`：>= 0（允许极短章节，但 0 会触发警告日志）。

### 8.4 Author / Translator 通用校验

- `name`：非空，长度 1~100。
- `birth_year` <= `death_year`（若同时存在）。
- `external_url`：若填写，须为合法 URL。

---

## 9. 与其他任务的接口约定

| 下游任务 | 本文输出什么 | 下游接收什么 |
| --- | --- | --- |
| CLR-1（列表/详情页结构稿） | `Book` + `Edition` + `Author[]` 字段集 | 前端列表展示字段：`title`/`title_zh`/`cover_url`/`category`/`author.name`/`edition_label`/`word_count` |
| CLR-2（阅读器 MVP） | `Chapter` 字段集（含 `chapter_html`/`footnotes`/`illustrations`） | 阅读器直接消费，不再自行解析原始文件 |
| CLAI-1（AI 伴读入口） | `Chapter.chapter_html`（纯文本提取） | AI 服务接收章节纯文本；`word_count` 用于判断是否超长 |

---

## 10. 本文结论

- CLD-3 已定版四个维度的元数据模型：Book / Author / Translator / Edition / Chapter。
- 字段校验规则已明确，拒绝写入条件与告警条件均已区分。
- 与 CLD-1（白名单）、CLD-2（章节数据契约）的字段对齐已完成。
- 下一步：启动 CLR-1，产出名著列表与详情页结构稿。
