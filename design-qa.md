# AI App 私有会话与智能体选择器 Design QA

## Source visual truth

- 已选定的阅读式工作台方向：`/Users/bytedance/.codex/generated_images/019f69f6-3ede-7231-b725-44275514a9b2/exec-172a3056-7490-4dd9-b7e0-731aa0fd87ad.png`
- 用户问题截图（私有会话的重复入口、未占满高度与边框层级）：`/var/folders/68/4sshfgt96fv2p3v8x71ngbn80000gn/T/codex-clipboard-0c81cad7-dc0c-4eb4-a4c4-bfdafb2c1f44.png`
- 用户问题截图（全站 AI 助手）：`/var/folders/68/4sshfgt96fv2p3v8x71ngbn80000gn/T/codex-clipboard-697e12f0-7d97-45c6-8403-a62792474445.png`

以上问题截图是改造依据，而不是要求逐像素复刻的目标：本次视觉真值是保留阅读式工作台方向，并消除两个聊天入口的语义冲突。

## Implementation evidence

- 视口：桌面端 `2048 × 960`。
- 私有会话空状态：`/private/tmp/valley-p8-conversation-after.png`。
- 工作台右侧智能体选择状态：`/private/tmp/valley-p8-agent-selected.png`。
- 已验证交互：工作台可打开快速助手；下拉可见“快速助手”和当前用户的智能体；选择智能体后展示固定版本与“进入专属会话”确认操作；未在验收中创建额外会话。
- 视觉证据已在本轮浏览器中逐张打开检查；全视图足以检查工作区比例，选择器区域额外展开检查了标签、选项、选中态和主操作。

## Findings

- [P1，已修复] 两套独立聊天入口造成语义冲突。
  - 原始证据：私有会话与右侧助手都表现为通用聊天。
  - 修复：AI App 工作区隐藏右侧快速助手；工作区外的右侧面板可选择智能体，并以明确操作进入该智能体的专属会话。
  - 复核：会话页不再渲染右侧助手；工作台选择器可见“快速助手”“测试智能体”“未命名智能体”。

- [P1，已修复] 会话页未占满内容高度，且外框与内部边框层级混杂。
  - 原始证据：会话容器限宽，底部留有页面空隙，标题、外框、侧栏和输入区使用不同透明度的边框。
  - 修复：会话页改为全高工作区，移除重复标题和外层限宽边框；保留侧栏、输入区和组件本身必要的 `border-border` 分隔。
  - 复核：实现截图中会话区域从标题到输入区连续占满视口，边框使用同一主题 token。

- [P2，已修复] 选择智能体会立即创建会话，动作不可预期。
  - 修复：下拉仅选择智能体；选择后展示名称、固定版本标记和“进入专属会话”按钮，由用户确认后才创建会话并跳转。
  - 复核：已选择“测试智能体”状态显示确认按钮，未发生导航或会话创建。

## Required fidelity surfaces

- 字体与层级：沿用现有 shadcn 字体、标题层级和小号辅助文字；快速助手、会话标题和空状态的阅读顺序清晰。
- 间距与布局：AI App 会话采用全高双栏；消息阅读列保留最大宽度以保证长文本可读，输入区固定在工作区底部。
- 颜色与 token：没有新增独立配色；所有结构分隔使用 `border-border`，状态继续使用既有 `Badge` 和主题 token。
- 资产与图标：沿用项目现有 Logo 和 Lucide 图标，没有新增图片资产或替代图标。
- 文案与内容：右侧“快速助手”对应即时问答；智能体选择明确导向“专属会话”，避免把实现解释写入 UI。

## Comparison history

1. 初始问题：会话页与右侧助手冲突、会话画布未占满、边框层级不一致。
2. 第一次实现：隐藏 AI App 工作区的右侧面板、会话画布全高化与边框统一。
3. 第二次实现：根据用户建议，把右侧快速助手升级为智能体选择器；将会话创建改为显式确认操作。
4. 复核：桌面空状态、选择器展开态和选择智能体后的确认态均已通过浏览器截图检查。

## Final result

passed

---

# AI 资源工作台 Design QA

## Context

- Source visual truth: `C:\Users\A\AppData\Local\Temp\codex-clipboard-0a228bff-9bad-433f-826e-9385fd03b5d2.png`
- Implemented route: `http://127.0.0.1:5175/workbench/resources?tab=knowledge`
- Intended desktop canvas: 1920 × 1080
- Captured evidence: `output/product-design/ai-resources-reference-redesign-auth-blocked.png`

## Full-view comparison

Blocked. The implemented route is protected and redirects an unauthenticated browser session to `/login`; no authenticated visual capture was available. The login redirect was preserved rather than bypassing authentication.

## Focused-region comparison

Blocked for the same reason. The reference's AI resource Tabs, left knowledge-base rail, and document table require an authenticated session to render.

## Findings

- [P1] Authenticated 1920 × 1080 visual comparison is pending a signed-in browser session.
  - Intended implementation changes: strengthened blue-underlined Tabs; a left knowledge-base rail with real search state; a right document table using actual document data; a matching workflow management surface.

## Comparison history

1. Previous reference used a broader AI resource concept and could not be captured while signed out.
2. Current iteration adopted the user-provided knowledge-base workspace reference and rebuilt the resource Tabs, knowledge-base rail, document table, and workflow table around that structure.
3. Browser capture redirected to `/login`, so no same-state visual comparison was possible.

## Current result

blocked
