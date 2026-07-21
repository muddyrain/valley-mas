package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
)

const (
	featureWorkflowDraft   = "ai-workbench-workflow-draft"
	featureWorkflowExplain = "ai-workbench-workflow-explain"
)

type aiWorkflowDraft struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Graph       workflow.Graph `json:"graph"`
}

type workflowRunExplanation struct {
	Cause       string   `json:"cause"`
	Suggestions []string `json:"suggestions"`
	NodeID      string   `json:"nodeId"`
}

func CreateAIWorkflowDraft(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	var payload struct {
		Description string           `json:"description"`
		ModelID     string           `json:"modelId"`
		Current     *aiWorkflowDraft `json:"current"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Description) == "" || strings.TrimSpace(payload.ModelID) == "" {
		Error(c, http.StatusBadRequest, "请描述需求并选择文本模型")
		return
	}
	current, _ := json.Marshal(payload.Current)
	capabilities, _ := json.Marshal(workflow.Capabilities(workflowRuntimeRegistry()))
	systemPrompt := `你是 Valley Graph v4 工作流规划器。只输出 JSON，字段必须且只能是 name、description、graph。graph.schemaVersion 必须为 4。节点类型只能是 start、end、llm、tool、condition、switch、merge、variable、subworkflow、intent；业务能力必须用 tool 节点并在 config.capabilityId 中选择能力目录里的工具 ID。只能生成 DAG，必须各有一个 Start 和 End，最多 30 个节点。条件节点使用 true/false 端口；switch 只对已有 string、number 或 boolean 字段做 2 至 8 个固定值分流，必须含 default 出口，不得用于自由文本分类；自由文本分类使用 intent。可选执行优先使用节点 when，不要创建多余 Condition。变量引用严格使用 {{upstreamNodeId.output.field}}。生成封面时在摘要节点后插入 tool/image.generateCover，默认直接执行；只有用户明确要求依赖已有上游布尔输出时，才设置该封面节点的 node.when，不要为封面新增 Start 输入。不要运行、发布或调用工具。根据需求生成最少节点。`
	userPrompt := fmt.Sprintf("能力目录：\n%s\n\n用户需求：\n%s\n\n当前草稿（可能为空）：\n%s", capabilities, truncateAIAgentRunes(payload.Description, 4000), current)
	var draft aiWorkflowDraft
	err := runStructuredWorkbenchAIWithCatalog(c.Request.Context(), featureWorkflowDraft, model.Int64String(userID), payload.ModelID, systemPrompt, userPrompt, &draft, func() error {
		return validateAIWorkflowDraft(&draft)
	})
	if err != nil {
		respondWorkbenchAIError(c, err)
		return
	}
	Success(c, gin.H{"draft": draft})
}

func validateAIWorkflowDraft(draft *aiWorkflowDraft) error {
	draft.Name = truncateAIAgentRunes(strings.TrimSpace(draft.Name), 100)
	draft.Description = truncateAIAgentRunes(strings.TrimSpace(draft.Description), 500)
	if draft.Name == "" || draft.Description == "" {
		return errors.New("工作流名称和简介不能为空")
	}
	if validationErrors := workflow.ValidateGraph(draft.Graph, workflowRuntimeRegistry()); len(validationErrors) > 0 {
		return errors.New(strings.Join(validationErrors, "；"))
	}
	return nil
}

func ExplainWorkflowRun(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return
	}
	runID, err := parsePathInt64(c, "runId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的运行 ID")
		return
	}
	var payload struct {
		ModelID string `json:"modelId"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.ModelID) == "" {
		Error(c, http.StatusBadRequest, "请选择文本模型")
		return
	}
	var run model.WorkflowRun
	if err := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", runID, workflowID, userID).First(&run).Error; err != nil {
		Error(c, http.StatusNotFound, "运行记录不存在")
		return
	}
	if run.Status != string(workflow.StatusFailed) {
		Error(c, http.StatusBadRequest, "仅失败运行支持 AI 解释")
		return
	}
	var nodes []model.WorkflowNodeRun
	if err := database.DB.Where("workflow_run_id = ?", run.ID).Order("created_at ASC").Find(&nodes).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载节点摘要失败")
		return
	}
	type safeNodeSummary struct {
		ID           string   `json:"id"`
		Type         string   `json:"type"`
		Status       string   `json:"status"`
		ErrorCode    string   `json:"errorCode,omitempty"`
		DurationMs   int64    `json:"durationMs"`
		ConfigFields []string `json:"configFields,omitempty"`
	}
	configFields := safeWorkflowNodeConfigFields(run.GraphSnapshot)
	summaries := make([]safeNodeSummary, 0, len(nodes))
	for _, node := range nodes {
		summaries = append(summaries, safeNodeSummary{ID: node.NodeID, Type: node.NodeType, Status: node.Status, ErrorCode: node.ErrorCode, DurationMs: node.DurationMs, ConfigFields: configFields[node.NodeID]})
	}
	summaryJSON, _ := json.Marshal(gin.H{"runStatus": run.Status, "nodes": summaries})
	systemPrompt := `你是工作流故障解释助手。只输出 JSON，字段必须且只能是 cause、suggestions、nodeId。只依据安全运行摘要判断，不猜测凭据、私有输入或节点原始配置。cause 用一句话说明最可能原因；suggestions 给出 1-5 条可操作修复建议；nodeId 填最可能需要定位的节点，没有则为空。不要声称已自动修改工作流。`
	var explanation workflowRunExplanation
	err = runStructuredWorkbenchAIWithCatalog(c.Request.Context(), featureWorkflowExplain, model.Int64String(userID), payload.ModelID, systemPrompt, string(summaryJSON), &explanation, func() error {
		explanation.Cause = truncateAIAgentRunes(strings.TrimSpace(explanation.Cause), 500)
		explanation.NodeID = truncateAIAgentRunes(strings.TrimSpace(explanation.NodeID), 120)
		if explanation.Cause == "" || len(explanation.Suggestions) == 0 || len(explanation.Suggestions) > 5 {
			return errors.New("失败解释结构无效")
		}
		knownNodes := map[string]struct{}{}
		for _, node := range nodes {
			knownNodes[node.NodeID] = struct{}{}
		}
		if explanation.NodeID != "" {
			if _, exists := knownNodes[explanation.NodeID]; !exists {
				return errors.New("解释定位了未知节点")
			}
		}
		for index := range explanation.Suggestions {
			explanation.Suggestions[index] = truncateAIAgentRunes(strings.TrimSpace(explanation.Suggestions[index]), 300)
		}
		return nil
	})
	if err != nil {
		respondWorkbenchAIError(c, err)
		return
	}
	Success(c, gin.H{"explanation": explanation})
}

func safeWorkflowNodeConfigFields(raw string) map[string][]string {
	graph, err := decodeWorkflowGraph(raw)
	if err != nil {
		return nil
	}
	result := make(map[string][]string, len(graph.Nodes))
	for _, node := range graph.Nodes {
		var config map[string]any
		if json.Unmarshal(node.Config, &config) != nil {
			continue
		}
		fields := make([]string, 0, len(config))
		for field := range config {
			fields = append(fields, field)
		}
		sort.Strings(fields)
		result[node.ID] = fields
	}
	return result
}
