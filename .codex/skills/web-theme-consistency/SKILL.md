---
name: web-theme-consistency
description: 在 Valley MAS Web 端维护整站主题一致性。适用于任何 Web 页面、共享组件、导航、Banner、空状态、按钮、卡片、表单、个人中心页、资源页、创作者页以及后续新增页面；当实现可能写死紫蓝橙粉等独立色系、绕开 theme token、或让局部页面脱离当前主题设定时，使用这个 skill，把样式收口到当前主题变量、theme-* 工具类和共享组件上。
category: web
---

# Web 主题一致性

这个 skill 关注的是“整个 Web 端是否还像同一个产品”，而不是某几个页面单独好不好看。只要任务会影响 Web 端用户可感知的视觉主题，就优先检查是否仍然跟随当前主题系统。

## 和现有主题 skill 的分工

- `brand-theme-guard` 更偏品牌方向和全站主基调，负责守住 Valley MAS 的主题气质、主色取向和视觉方向。
- `web-theme-consistency` 更偏实现落地，负责具体页面和组件有没有真正吃到主题 token，避免出现“品牌方向对了，但页面代码还是各写各的配色”。

如果任务既涉及品牌方向，又涉及具体页面落地，可以两个一起用；如果主要是修某个页面或组件没有跟随主题，优先用这个 skill。

## 核心规则

1. Web 页面的大面积背景、Banner、卡片头、空状态、按钮、表单 focus、标签和图标 fallback，优先复用 `--theme-*` 变量、`theme-*` 工具类和共享组件。
2. 不要在单页里继续写死 `from-purple-*`、`text-sky-*`、`border-orange-*`、`bg-pink-*` 这类固定色系，除非这个颜色本身就是明确的语义色，例如危险操作或报错。
3. 可以保留轻微层次差异，但差异应来自主题变量混合，而不是把每个页面做成独立配色专题。
4. 如果共享组件本身还带着固定色，优先扩组件接口或调整默认实现，而不是让每个页面各自覆盖一遍。
5. 用户可见中文文案改动要保持产品语气自然，不要因为样式调整顺手改成模板味或占位感文案。

## 优先检查的区域

- 页面根背景与 section 背景
- 顶部 Banner 与 Hero
- 空状态图标底色与 CTA 按钮
- 卡片边框、阴影、hover 态
- 标签、Badge、头像 fallback
- 表单输入框、focus ring、主按钮
- 头像菜单、导航入口、侧边入口卡片
- 任何后续新增的 Web 页面与共享组件

## 推荐工作顺序

1. 先找固定色来源，尤其是写死的 Tailwind 色阶类和内联颜色。
2. 判断能否直接替换成 `theme-*` 工具类；如果不能，就看是否应该扩展共享组件接口。
3. 背景和 Banner 优先使用 CSS 变量或基于变量的渐变，避免为不同主题写分支判断。
4. 空状态、按钮、表单等高复用 UI 优先改成组件级主题跟随，这样后续页面天然继承。
5. 改完后至少抽查一个其他复用该组件的页面，确认这次不是只服务当前页面的特例修补。

## 当前仓库里的参考点

- `apps/web/src/index.css`
- `apps/web/src/components/PageBanner.tsx`
- `apps/web/src/components/EmptyState.tsx`
- `apps/web/src/components/ApplyCreatorBanner.tsx`
- `apps/web/src/pages/Profile.tsx`
- `apps/web/src/pages/Favorites.tsx`
- `apps/web/src/pages/Follows.tsx`
- `apps/web/src/pages/Downloads.tsx`

## 校验

1. 运行 Web 类型检查：`pnpm --filter web exec tsc --noEmit`
2. 编辑中文文件后运行 [$encoding-guard](/D:/my-code/valley-mas/.codex/skills/encoding-guard/SKILL.md)
3. 最终说明里明确写出：
   - 哪些 Web 页面或组件已经改成跟随主题
   - 是否顺手增强了共享组件
   - 这次更新的是哪个主题一致性 skill
