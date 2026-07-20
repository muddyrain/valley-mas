# P13.3.2：选择器（Switch）节点设计规格

## 状态

已实现，待浏览器运行时验收。此切片为 Graph v4 增加无模型、可预测的多路分流，用于把已有枚举字段或上游结构化结果接到不同内容处理路径。

## 目标

当前 `condition` 只有 true / false 两条路径。遇到“按内容类型、审核级别或上游结构化字段选择三条以上路径”时，用户必须串联多个条件节点，画布冗长且容易漏接分支。

新增 `switch` 节点后，用户可对一个标量值声明 2 至 8 个精确匹配 case 和必填默认出口；一次运行只激活一个分支。它不调用模型、不引入副作用，也不改变现有意图识别节点。

## 与现有节点的边界

| 场景 | 使用节点 |
| --- | --- |
| 一个布尔或比较条件 | `condition` |
| 自由文本需要 AI 判断意图 | `intent` |
| 已有 string / number / boolean 值按多种固定值分流 | `switch` |

`switch` 是确定性路由器，不是分类器：不支持自然语言理解、表达式、范围、正则、类型转换、多个 case 命中或 fallthrough。复杂规则继续由前置 LLM、意图识别或条件节点显式产生可引用的标量结果。

## Graph v4 合约

新增节点类型 `switch`，节点配置如下：

```json
{
  "value": "{{start.output.contentType}}",
  "valueType": "string",
  "cases": [
    { "id": "article", "label": "文章", "value": "article" },
    { "id": "resource", "label": "资源", "value": "resource" }
  ]
}
```

- `value` 是一个固定值或上游变量引用；保存与运行前必须与 `valueType` 相符。
- `valueType` 仅允许 `string`、`number`、`boolean`，禁止隐式转换。
- `cases` 数量为 2 至 8；每项 `id` 为稳定的 ASCII 标识，`label` 仅用于显示，`value` 与 `valueType` 同类型且在同一节点内唯一。
- 该节点输出 `matchedCaseId`、`matchedLabel`、`matchedValue`，供下游记录、End 映射或 Merge 使用。
- 输出 handles 为每个 `case:<id>` 及必填 `default`。每个 handle 必须且只能连接一条边；选中分支以外的节点记录为 `skipped`，不调用模型或工具。
- 未匹配任一 case、`value` 为 `null` 或运行时类型不符时，走 `default`，并输出 `matchedCaseId: "default"`、`matchedLabel: "默认"` 和原始 `matchedValue`。这不是运行错误。

## 运行与校验

1. Graph 校验验证配置、case 值唯一性、变量引用类型、动态 handles 和每个出口的一条连线。
2. 执行器采用严格相等比较；不调用 ARK，也不增加模型或写入预算。
3. 运行调度沿用 `condition` / `intent` 的单分支选择机制；运行事件与节点详情显示被选中的 case 或默认分支，但不暴露任何额外敏感数据。
4. AI 创建和上下文副驾驶只在用户明确提供或已存在可枚举字段时提议 `switch`；自由文本路由必须使用 `intent`，不得猜测 case 值。

## 编辑器

- 节点选择器的“流程控制”分组新增“选择器”。
- 属性面板依次提供：分流值变量、值类型、case 列表与默认出口说明；值类型切换时不自动转换或保留不兼容 case，须由用户确认编辑。
- 节点卡为所有 case 和默认出口显示可访问标签；连线、键盘焦点、移动端选择器和现有 shadcn 样式保持一致。
- 保存前不完整配置显示“待完善”；主动保存或运行时定位具体错误。不得新增专用页面、第三方依赖或独立状态管理。

## 非目标

- 不新增批处理、循环、任意代码、HTTP、SQL、自动发布或触发器。
- 不调整 capability 版本冻结。严格 capability manifest 仅在进入 P14 的生产治理前重新评估。
- 不替换 `condition`、`intent` 或 `merge`，也不迁移现有 Graph v4 数据。

## 验收标准

1. string 完整 Graph 覆盖 case、默认出口与未选分支零调用；number、boolean 覆盖执行器的严格匹配，公共 Graph 路由与校验逻辑复用同一路径。
2. 重复 case、缺失 default、无效 handle、引用类型不符和运行时异常值均有稳定、可理解的校验结果。
3. `intent → switch` 可用 `intentId` 做二次确定性路由；自由文本不会被 `switch` 误当作 AI 分类。
4. AI 提案、保存、运行与历史运行详情一致使用动态出口合约。
5. Graph v4 既有条件、意图、Merge、工具副作用确认、取消和重试回归通过。
