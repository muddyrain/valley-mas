# ELP-1 英语学习功能：数据来源、授权边界与落地方案

## 1. 目标与范围

在 Valley MAS Web 内新增英语学习能力，形成可持续闭环：

- 查词与词汇学习（词典 + 生词本）。
- 在线学习计划（每日任务、复习节奏、进度追踪）。
- 英文文章学习（分级阅读、查词联动、题目练习）。
- 口语练习（录音、识别、发音反馈）。
- 听力练习（配音生成、精听题型、听写）。

本期仅冻结方案与治理边界，不直接复制任何受版权限制的考试内容。

## 2. 版权与品牌边界（强约束）

1. 可做“IELTS 风格训练”，不可直接搬运 IELTS 官方真题文本、音频与素材。
2. 可接 Cambridge / Oxford 词典 API，但必须遵守各自商业协议（缓存、展示、再分发限制）。
3. 未明确授权前，不抓取词典站点 HTML 直接入库。
4. 所有外部语料入库前记录许可证与来源 URL；无明确许可证条目的数据不进入生产库。

## 3. 数据来源策略（推荐混合架构）

### 3.1 商业词典层（高质量、实时查询）

- Oxford Dictionaries API（定义、发音、例句、同义词等）。
- Cambridge Dictionary API（需开发 Key 与正式商用协议）。
- Merriam-Webster API（含词典产品与音频能力选项）。

用途：词义权威展示、查词详情页、词性/搭配辅助。

### 3.2 开源语料层（可自建学习资产）

- WordNet（可商用，适合构建词汇关系网）。
- Wiktionary Dumps（需遵守 CC BY-SA / GFDL 要求）。
- Tatoeba（句子与部分语音数据，按条目 license 使用）。
- Common Voice（语音与句子开源生态）。
- LibriSpeech（英文语音数据集，适合听力与语音建模训练素材）。

用途：自建例句、练习语料、听写题库、分级阅读训练原料。

### 3.3 自建内容层（产品差异化）

- 自研英文文章（含 CEFR 难度标注）。
- 自研口语题目（场景问答、看图表达、复述）。
- 自研听力脚本（主题短文、对话、讲座片段）。

用途：沉淀你们自己的课程资产，避免受单一第三方协议掣肘。

## 4. 数据是否导入：决策规则

1. 商业词典 API：
   - 默认实时查询。
   - 是否缓存由协议决定；若协议限制缓存，则仅存查询日志与学习行为，不落词典正文。
2. 开源语料：
   - 可导入自有库，但必须保存 `source_name/source_url/license_type/license_note`。
3. 用户学习数据：
   - 必须导入并长期保存（学习计划、错题、复习轨迹、口语成绩）。

## 5. 产品形态：用户可在线学习（MVP）

### 5.1 页面结构

- `/learn`：学习中心总览（今日任务、进度、推荐）。
- `/learn/dictionary`：查词与词汇页（收藏、生词本、例句、发音）。
- `/learn/typing`：打字训练（单词听打、句子跟打、WPM/准确率）。
- `/learn/reading`：分级阅读（查词联动、段落测验）。
- `/learn/speaking`：口语练习（录音、评分、反馈）。
- `/learn/listening`：听力练习（倍速、逐句回放、听写）。
- `/learn/plan`：学习计划（每日任务编排、复习提醒）。

### 5.2 学习闭环

1. 查词加入生词本。
2. 生词自动进入复习队列（SRS）。
3. 每日计划编排词汇/阅读/听力/口语任务。
4. 完成任务后回写掌握度，更新次日计划。

## 6. 技术架构（贴合 Valley MAS）

### 6.1 后端（`server/internal`）

- `handler/learning_dictionary.go`：词典代理查询、词条入学习队列。
- `handler/learning_plan.go`：每日计划生成、任务完成回写。
- `handler/learning_reading.go`：文章列表、详情、练习题提交。
- `handler/learning_speaking.go`：录音上传、STT、口语评分。
- `handler/learning_listening.go`：听力题、字幕与答题记录。

### 6.2 前端（`apps/web/src/pages`）

- 新增 `LearningHub / LearningDictionary / LearningTyping / LearningReading / LearningSpeaking / LearningListening / LearningPlan` 页面。
- 复用现有 URL 状态同步范式，保证可分享与刷新恢复。

### 6.3 数据库（建议首批表）

- `learning_word_entry`：词条快照与来源映射（仅存允许落库字段）。
- `learning_wordbook`：用户生词本。
- `learning_study_plan`：计划头（日期、目标时长、状态）。
- `learning_study_task`：计划子任务（词汇/阅读/听力/口语）。
- `learning_review_log`：复习日志与下次复习时间。
- `learning_reading_article`：文章元数据（难度、题材、来源）。
- `learning_reading_attempt`：阅读答题记录。
- `learning_speaking_attempt`：口语评分结果与反馈要点。
- `learning_listening_attempt`：听力答题记录。
- `learning_asset_source`：外部数据来源与许可证追踪。

## 7. 英文文章能力如何添加

1. 内容来源接入：
   - 自建稿件优先，开放授权源补充。
2. 入库标准化：
   - 清洗正文、段落切分、关键词抽取、CEFR 难度估计。
3. 练习生成：
   - 每篇至少生成 5~10 题（词义、细节理解、推断）。
4. 查词联动：
   - 阅读页点击单词可调用词典能力，并支持加入生词本。

## 8. 口语练习如何添加

1. 前端录音：
   - 使用 `MediaRecorder` 采集音频并上传。
2. 后端识别：
   - STT 服务转写文本，返回时间戳与置信度。
3. 发音评估：
   - 基础：文本匹配 + 流利度 + 语速。
   - 进阶：音素/音节维度评估（可接 Azure Pronunciation Assessment）。
4. 学习回流：
   - 评分结果写入 `learning_speaking_attempt`，并驱动计划系统安排复练。

## 9. 听力配音如何做

### 9.1 配音方案

- 方案 A（优先上线）：TTS 生成音频（英音/美音、语速可调）。
- 方案 B（高质量专题）：真人录音。
- 方案 C（推荐）：日常题库用 TTS，关键课程用真人。

### 9.2 生成流程

1. 脚本入库（段落切分）。
2. 调用 TTS 生成音频（按 voice/速度/口音参数）。
3. 存储到对象存储并走 CDN。
4. 回写字幕与句级时间戳，供跟读/精听/定位回放使用。

## 10. 分阶段实施（与 WEB-TASKS 对齐）

- ELP-1（已完成）：方案冻结与合规边界。
- ELP-2：API 契约 + 数据库迁移草案。
- ELP-3：Web 路由与页面骨架（先用 mock 数据打通流程）。
- ELP-4：TTS + STT + 口语评分 PoC 跑通。
- ELP-5：词典与学习计划 MVP 联调上线（小流量）。

## 11. 风险与应对

1. 风险：第三方词典协议限制缓存或二次分发。  
   应对：按 provider 维度做能力开关，采用最小化缓存策略。
2. 风险：语料许可证混杂导致合规风险。  
   应对：导入前强制 license 校验，不明来源直接拦截。
3. 风险：口语评分波动影响用户信任。  
   应对：先给“诊断建议”而非绝对分，结合多次平均分与人工抽检。

## 12. 参考来源（2026-04-20 核验）

- Oxford Dictionaries API Getting Started: <https://developer.oxforddictionaries.com/documentation/getting_started>
- Oxford API Updates: <https://developer.oxforddictionaries.com/updates>
- Cambridge Dictionary API Resources: <https://dictionary-api.cambridge.org/api/resources>
- Cambridge Dictionary API Terms: <https://dictionary-api.cambridge.org/api/terms-and-conditions>
- Merriam-Webster API Products: <https://dictionaryapi.com/products/index>
- IELTS Copyright Statement: <https://ielts.org/legal/ielts-copyright-and-trade-mark-statement>
- WordNet License: <https://wordnet.princeton.edu/license-and-commercial-use>
- Wikimedia Dump License: <https://dumps.wikimedia.org/legal.html>
- Tatoeba Downloads: <https://tatoeba.org/en/downloads>
- Common Voice Repository: <https://github.com/common-voice/common-voice>
- LibriSpeech (OpenSLR): <https://www.openslr.org/12>
- OpenAI TTS Guide: <https://developers.openai.com/api/docs/guides/text-to-speech>
- OpenAI STT Guide: <https://developers.openai.com/api/docs/guides/speech-to-text>
- Azure Pronunciation Assessment: <https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment>
