# AI Knowledge 多模态 PDF 摄取实施计划

> 状态：代码已完成，待线上 Poppler 安装与真实视觉模型验收。

关联设计：[2026-07-22-ai-knowledge-pdf-multimodal-design.md](../specs/2026-07-22-ai-knowledge-pdf-multimodal-design.md)

1. [x] 增加文档/片段来源元数据与生产 SQL 迁移。
2. [x] 实现 Poppler 页渲染、视觉模型解析、失败映射与可重试后台摄取。
3. [x] 将分段改为保留页码与来源的段落优先分段，保持 embedding 和检索兼容。
4. [x] 增加 Web 视觉模型选择、状态文案与片段来源预览。
5. [x] 为文本回退、模型校验、真实 Poppler 渲染、视觉结果与来源元数据增加测试。
6. [x] 在服务端部署文档中加入本地和线上 Poppler 安装、验证与发布顺序。
7. [ ] 已通过 PDF 定向 Go 测试、Harness 与编码校验；Web 类型检查受并行的工作流审批改动影响，真实视觉模型调用和线上 Poppler 安装待验收。
