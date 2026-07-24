package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	workflowTestStatusPassed   = "passed"
	workflowTestStatusFailed   = "failed"
	workflowTestStatusError    = "error"
	workflowTestStatusRejected = "rejected"
)

type workflowTestAssertion struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    any    `json:"value,omitempty"`
}

type workflowTestAssertionResult struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Passed   bool   `json:"passed"`
	Message  string `json:"message,omitempty"`
}

type workflowTestCaseSummary struct {
	model.WorkflowTestCase
	LatestResult *model.WorkflowTestResult `json:"latestResult,omitempty"`
}

func ListWorkflowTestCases(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	if !workflowOwnedBy(workflowID, userID) {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	var cases []model.WorkflowTestCase
	if err := database.DB.Where("workflow_id = ? AND user_id = ?", workflowID, userID).
		Order("updated_at DESC, id DESC").Find(&cases).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载测试用例失败")
		return
	}
	list := make([]workflowTestCaseSummary, 0, len(cases))
	for _, testCase := range cases {
		var latest model.WorkflowTestResult
		if err := database.DB.Where("workflow_test_case_id = ?", testCase.ID).
			Order("started_at DESC, id DESC").First(&latest).Error; err != nil && err != gorm.ErrRecordNotFound {
			Error(c, http.StatusInternalServerError, "加载测试结果失败")
			return
		}
		summary := workflowTestCaseSummary{WorkflowTestCase: testCase}
		if latest.ID != 0 {
			summary.LatestResult = &latest
		}
		list = append(list, summary)
	}
	Success(c, gin.H{"list": list})
}

func CreateWorkflowTestCase(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req struct {
		Name       string                  `json:"name"`
		VersionID  string                  `json:"versionId"`
		Inputs     map[string]any          `json:"inputs"`
		Assertions []workflowTestAssertion `json:"assertions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "测试用例格式错误")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len([]rune(req.Name)) > 120 {
		Error(c, http.StatusBadRequest, "测试用例名称需为 1 到 120 个字符")
		return
	}
	versionID, err := parseInt64String(req.VersionID)
	if err != nil {
		Error(c, http.StatusBadRequest, "请选择要锁定的工作流版本")
		return
	}
	if err := validateWorkflowTestAssertions(req.Assertions); err != nil {
		Error(c, http.StatusBadRequest, "测试断言无效: "+err.Error())
		return
	}
	inputs, err := json.Marshal(nonNilWorkflowTestInputs(req.Inputs))
	if err != nil {
		Error(c, http.StatusBadRequest, "测试输入无法序列化")
		return
	}
	assertions, err := json.Marshal(req.Assertions)
	if err != nil {
		Error(c, http.StatusBadRequest, "测试断言无法序列化")
		return
	}
	if _, _, err := workflowTestVersion(model.Int64String(workflowID), model.Int64String(userID), versionID); err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, http.StatusBadRequest, "锁定版本不存在或不属于当前工作流")
			return
		}
		Error(c, http.StatusInternalServerError, "校验测试版本失败")
		return
	}
	testCase := model.WorkflowTestCase{
		WorkflowID: model.Int64String(workflowID),
		UserID:     model.Int64String(userID),
		VersionID:  versionID,
		Name:       req.Name,
		Inputs:     string(inputs),
		Assertions: string(assertions),
	}
	if err := database.DB.Create(&testCase).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建测试用例失败")
		return
	}
	Success(c, testCase)
}

func DeleteWorkflowTestCase(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	testCaseID, err := parsePathInt64(c, "testCaseId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的测试用例 ID")
		return
	}
	result := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", testCaseID, workflowID, userID).
		Delete(&model.WorkflowTestCase{})
	if result.Error != nil {
		Error(c, http.StatusInternalServerError, "删除测试用例失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusNotFound, "测试用例不存在")
		return
	}
	Success(c, nil)
}

func RunWorkflowTestCase(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	testCaseID, err := parsePathInt64(c, "testCaseId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的测试用例 ID")
		return
	}
	var testCase model.WorkflowTestCase
	if err := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", testCaseID, workflowID, userID).First(&testCase).Error; err != nil {
		Error(c, http.StatusNotFound, "测试用例不存在")
		return
	}
	result, err := executeWorkflowTestCase(c.Request.Context(), testCase, role)
	if err != nil {
		Error(c, http.StatusInternalServerError, "执行测试用例失败")
		return
	}
	Success(c, gin.H{"result": result})
}

func workflowTestVersion(workflowID, userID, versionID model.Int64String) (model.AIApp, model.AIAppVersion, error) {
	var app model.AIApp
	if err := database.DB.Where("workflow_id = ? AND user_id = ? AND type = ?", workflowID, userID, aiAppTypeWorkflow).First(&app).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	var version model.AIAppVersion
	if err := database.DB.Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	return app, version, nil
}

func executeWorkflowTestCase(requestContext context.Context, testCase model.WorkflowTestCase, role string) (model.WorkflowTestResult, error) {
	startedAt := time.Now()
	_, version, err := workflowTestVersion(testCase.WorkflowID, testCase.UserID, testCase.VersionID)
	if err != nil {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusError, nil, nil, "TEST_VERSION_NOT_FOUND", startedAt)
	}
	graph, err := decodeWorkflowGraph(version.Config)
	if err != nil {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusError, nil, nil, "TEST_GRAPH_INVALID", startedAt)
	}
	registry := workflowRuntimeRegistry()
	if validationErrors := workflow.ValidateGraph(graph, registry); len(validationErrors) > 0 {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusError, nil, nil, "TEST_GRAPH_INVALID", startedAt)
	}
	budget := workflowExecutionBudget{}
	if err := validateSubworkflowReferences(database.DB, graph, testCase.UserID, testCase.WorkflowID, map[string]bool{}, &budget); err != nil {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusError, nil, nil, "TEST_GRAPH_INVALID", startedAt)
	}
	if workflowRetryRequiresConfirmation(graph, registry) {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusRejected, nil, nil, "TEST_SIDE_EFFECT_FORBIDDEN", startedAt)
	}
	var inputs map[string]any
	if err := json.Unmarshal([]byte(testCase.Inputs), &inputs); err != nil {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusError, nil, nil, "TEST_INPUT_INVALID", startedAt)
	}
	if err := validateWorkflowTestInputs(graph, inputs); err != nil {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusRejected, nil, nil, "TEST_INPUT_INVALID", startedAt)
	}
	if workflowRequiresARKImage(graph) {
		return persistWorkflowTestResult(testCase, nil, workflowTestStatusRejected, nil, nil, "TEST_SIDE_EFFECT_FORBIDDEN", startedAt)
	}
	encodedInputs, err := json.Marshal(safeWorkflowRunInputs(inputs))
	if err != nil {
		return model.WorkflowTestResult{}, err
	}
	run := model.WorkflowRun{
		WorkflowID:    testCase.WorkflowID,
		UserID:        testCase.UserID,
		Status:        string(workflow.StatusRunning),
		Inputs:        string(encodedInputs),
		GraphSnapshot: mustEncodeWorkflowGraph(graph, version.Config),
		StartedAt:     startedAt,
	}
	if err := database.DB.Create(&run).Error; err != nil {
		return model.WorkflowTestResult{}, err
	}
	nodeTypes := make(map[string]workflow.NodeType, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodeTypes[node.ID] = node.Type
	}
	var sequence int64
	var persistenceErr error
	var finalOutput map[string]any
	var failureCode string
	var failureMessage string
	persistTerminalEvent := func(status workflow.RunStatus, message, errorCode string, output map[string]any) error {
		sequence++
		return database.DB.Transaction(func(tx *gorm.DB) error {
			return persistWorkflowRunEvent(tx, run.ID, workflow.Event{
				RunID:    run.ID.String(),
				Sequence: sequence,
				Status:   status,
				Message:  message,
				Error:    errorCode,
				Output:   workflow.SafePreviewMap(output),
			})
		})
	}
	// Individual model requests and loop executions own their deadlines. The
	// controller context only coordinates user cancellation for a test run.
	executionContext, releaseRun := activeWorkflowRuns.Start(run.ID.String(), 0)
	defer releaseRun()
	if requestContext != nil {
		go func() {
			select {
			case <-requestContext.Done():
				activeWorkflowRuns.Cancel(run.ID.String())
			case <-executionContext.Done():
			}
		}()
	}
	executeErr := workflow.Execute(executionContext, graph, registry, workflow.RunContext{
		ID:                 run.ID.String(),
		Actor:              workflow.Actor{UserID: int64(testCase.UserID), Role: role},
		Inputs:             inputs,
		Outputs:            map[string]map[string]any{},
		KnowledgeRetriever: workflowKnowledgeRetriever(testCase.UserID, version),
		ContentSearcher:    workflowContentSearcher(testCase.UserID),
		NotionSearcher:     workflowNotionSearcher(testCase.UserID),
		CoverGenerator:     workflowCoverGenerator(),
		SubworkflowRunner:  workflowSubworkflowRunner(testCase.UserID),
	}, func(event workflow.Event) {
		if persistenceErr == nil {
			sequence++
			event.Sequence = sequence
			persistenceErr = database.DB.Transaction(func(tx *gorm.DB) error {
				if err := persistWorkflowNodeEvent(tx, run.ID, nodeTypes[event.NodeID], event); err != nil {
					return err
				}
				return persistWorkflowRunEvent(tx, run.ID, event)
			})
		}
		if event.NodeType == workflow.NodeTypeEnd && event.Status == workflow.StatusSucceeded {
			finalOutput = event.Output
		}
		if event.Status == workflow.StatusFailed || event.Status == workflow.StatusCancelled {
			failureCode = event.Error
			failureMessage = event.Message
		}
	})
	if persistenceErr != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		return persistWorkflowTestResult(testCase, &run.ID, workflowTestStatusError, nil, nil, "RUN_PERSISTENCE_FAILED", startedAt)
	}
	if executeErr != nil {
		if failureCode == "" {
			failureCode = "WORKFLOW_NODE_FAILED"
		}
		status := workflowTestStatusError
		if failureCode == "WORKFLOW_CANCELLED" {
			_ = finishWorkflowRun(&run, string(workflow.StatusCancelled), map[string]any{"error": failureCode})
			if err := persistTerminalEvent(workflow.StatusCancelled, failureMessage, failureCode, nil); err != nil {
				return persistWorkflowTestResult(testCase, &run.ID, workflowTestStatusError, nil, nil, "RUN_PERSISTENCE_FAILED", startedAt)
			}
			status = workflowTestStatusRejected
		} else {
			_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": failureCode})
			if err := persistTerminalEvent(workflow.StatusFailed, failureMessage, failureCode, nil); err != nil {
				return persistWorkflowTestResult(testCase, &run.ID, workflowTestStatusError, nil, nil, "RUN_PERSISTENCE_FAILED", startedAt)
			}
		}
		return persistWorkflowTestResult(testCase, &run.ID, status, nil, nil, failureCode, startedAt)
	}
	if finalOutput == nil {
		finalOutput = map[string]any{}
	}
	if err := finishWorkflowRun(&run, string(workflow.StatusSucceeded), finalOutput); err != nil {
		return persistWorkflowTestResult(testCase, &run.ID, workflowTestStatusError, nil, nil, "RUN_PERSISTENCE_FAILED", startedAt)
	}
	if err := persistTerminalEvent(workflow.StatusSucceeded, "测试运行完成", "", finalOutput); err != nil {
		return persistWorkflowTestResult(testCase, &run.ID, workflowTestStatusError, nil, nil, "RUN_PERSISTENCE_FAILED", startedAt)
	}
	assertions, err := parseWorkflowTestAssertions(testCase.Assertions)
	if err != nil {
		return persistWorkflowTestResult(testCase, &run.ID, workflowTestStatusError, finalOutput, nil, "TEST_ASSERTIONS_INVALID", startedAt)
	}
	assertionResults, passed := evaluateWorkflowTestAssertions(finalOutput, assertions)
	status := workflowTestStatusPassed
	if !passed {
		status = workflowTestStatusFailed
	}
	return persistWorkflowTestResult(testCase, &run.ID, status, finalOutput, assertionResults, "", startedAt)
}

func persistWorkflowTestResult(testCase model.WorkflowTestCase, runID *model.Int64String, status string, output map[string]any, assertions []workflowTestAssertionResult, errorCode string, startedAt time.Time) (model.WorkflowTestResult, error) {
	encodedOutput, err := json.Marshal(output)
	if err != nil {
		return model.WorkflowTestResult{}, err
	}
	encodedAssertions, err := json.Marshal(assertions)
	if err != nil {
		return model.WorkflowTestResult{}, err
	}
	finishedAt := time.Now()
	result := model.WorkflowTestResult{
		WorkflowTestCaseID: testCase.ID,
		WorkflowRunID:      runID,
		WorkflowID:         testCase.WorkflowID,
		UserID:             testCase.UserID,
		VersionID:          testCase.VersionID,
		Status:             status,
		Output:             string(encodedOutput),
		AssertionResults:   string(encodedAssertions),
		ErrorCode:          errorCode,
		StartedAt:          startedAt,
		FinishedAt:         &finishedAt,
	}
	if err := database.DB.Create(&result).Error; err != nil {
		return model.WorkflowTestResult{}, err
	}
	return result, nil
}

func nonNilWorkflowTestInputs(inputs map[string]any) map[string]any {
	if inputs == nil {
		return map[string]any{}
	}
	return inputs
}

func parseWorkflowTestAssertions(raw string) ([]workflowTestAssertion, error) {
	var assertions []workflowTestAssertion
	if err := json.Unmarshal([]byte(raw), &assertions); err != nil {
		return nil, err
	}
	if err := validateWorkflowTestAssertions(assertions); err != nil {
		return nil, err
	}
	return assertions, nil
}

func validateWorkflowTestAssertions(assertions []workflowTestAssertion) error {
	if len(assertions) == 0 || len(assertions) > 20 {
		return fmt.Errorf("请配置 1 到 20 条断言")
	}
	for _, assertion := range assertions {
		if strings.TrimSpace(assertion.Field) == "" || len(assertion.Field) > 160 {
			return fmt.Errorf("断言字段不能为空")
		}
		switch assertion.Operator {
		case "exists":
		case "type":
			if !isWorkflowTestValueType(assertion.Value) {
				return fmt.Errorf("类型断言需使用 string、number、boolean、object 或 string[]")
			}
		case "equals", "contains":
			if assertion.Value == nil {
				return fmt.Errorf("%s 断言需要比较值", assertion.Operator)
			}
		case "range":
			if _, _, ok := workflowTestRange(assertion.Value); !ok {
				return fmt.Errorf("范围断言需要 min 或 max 数字")
			}
		case "jsonSchema":
			if _, ok := assertion.Value.(map[string]any); !ok {
				return fmt.Errorf("JSON Schema 断言需要对象")
			}
		default:
			return fmt.Errorf("不支持的断言类型")
		}
	}
	return nil
}

func validateWorkflowTestInputs(graph workflow.Graph, inputs map[string]any) error {
	files, err := declaredStartFileInputs(graph)
	if err != nil {
		return err
	}
	for name := range files {
		if _, provided := inputs[name]; provided {
			return fmt.Errorf("首期测试用例不执行文件输入")
		}
	}
	return nil
}

func evaluateWorkflowTestAssertions(output map[string]any, assertions []workflowTestAssertion) ([]workflowTestAssertionResult, bool) {
	results := make([]workflowTestAssertionResult, 0, len(assertions))
	allPassed := true
	for _, assertion := range assertions {
		value, exists := workflowTestOutputValue(output, assertion.Field)
		result := workflowTestAssertionResult{Field: assertion.Field, Operator: assertion.Operator}
		switch assertion.Operator {
		case "exists":
			result.Passed = exists
			if !exists {
				result.Message = "未找到输出字段"
			}
		case "type":
			result.Passed = exists && workflowTestValueMatchesType(value, assertion.Value.(string))
			if !result.Passed {
				result.Message = "字段类型不符合预期"
			}
		case "equals":
			result.Passed = exists && workflowTestJSONEqual(value, assertion.Value)
			if !result.Passed {
				result.Message = "字段值不等于预期"
			}
		case "contains":
			result.Passed = exists && workflowTestContains(value, assertion.Value)
			if !result.Passed {
				result.Message = "字段不包含预期内容"
			}
		case "range":
			min, max, _ := workflowTestRange(assertion.Value)
			number, ok := workflowTestNumber(value)
			result.Passed = exists && ok && (min == nil || number >= *min) && (max == nil || number <= *max)
			if !result.Passed {
				result.Message = "字段值不在预期范围内"
			}
		case "jsonSchema":
			if exists {
				result.Passed, result.Message = workflowTestMatchesJSONSchema(value, assertion.Value.(map[string]any))
			} else {
				result.Message = "未找到输出字段"
			}
			if !result.Passed && result.Message == "" {
				result.Message = "字段不符合 JSON Schema"
			}
		}
		if !result.Passed {
			allPassed = false
		}
		results = append(results, result)
	}
	return results, allPassed
}

func workflowTestOutputValue(output map[string]any, path string) (any, bool) {
	var value any = output
	for _, part := range strings.Split(path, ".") {
		switch typed := value.(type) {
		case map[string]any:
			value, _ = typed[part]
			if value == nil {
				_, exists := typed[part]
				return value, exists
			}
		case []any:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(typed) {
				return nil, false
			}
			value = typed[index]
		default:
			return nil, false
		}
	}
	return value, true
}

func isWorkflowTestValueType(value any) bool {
	_, ok := value.(string)
	return ok && (value == "string" || value == "number" || value == "boolean" || value == "object" || value == "string[]")
}

func workflowTestValueMatchesType(value any, expected string) bool {
	switch expected {
	case "string":
		_, ok := value.(string)
		return ok
	case "number":
		_, ok := workflowTestNumber(value)
		return ok
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "object":
		return workflowTestObject(value) != nil
	case "string[]":
		switch values := value.(type) {
		case []string:
			return true
		case []any:
			for _, item := range values {
				if _, ok := item.(string); !ok {
					return false
				}
			}
			return true
		default:
			return false
		}
	default:
		return false
	}
}

func workflowTestContains(value, expected any) bool {
	if actual, ok := value.(string); ok {
		needle, ok := expected.(string)
		return ok && strings.Contains(actual, needle)
	}
	if values, ok := value.([]any); ok {
		for _, item := range values {
			if workflowTestJSONEqual(item, expected) {
				return true
			}
		}
	}
	if values, ok := value.([]string); ok {
		for _, item := range values {
			if workflowTestJSONEqual(item, expected) {
				return true
			}
		}
	}
	return false
}

func workflowTestRange(value any) (min, max *float64, ok bool) {
	config, ok := value.(map[string]any)
	if !ok {
		return nil, nil, false
	}
	if raw, exists := config["min"]; exists {
		if parsed, valid := workflowTestNumber(raw); valid {
			min = &parsed
		} else {
			return nil, nil, false
		}
	}
	if raw, exists := config["max"]; exists {
		if parsed, valid := workflowTestNumber(raw); valid {
			max = &parsed
		} else {
			return nil, nil, false
		}
	}
	return min, max, min != nil || max != nil
}

func workflowTestNumber(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, !math.IsNaN(typed) && !math.IsInf(typed, 0)
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func workflowTestMatchesJSONSchema(value any, schema map[string]any) (bool, string) {
	if rawType, exists := schema["type"]; exists {
		expected, ok := rawType.(string)
		if !ok || !isWorkflowTestValueType(expected) {
			return false, "JSON Schema 包含不支持的类型"
		}
		if !workflowTestValueMatchesType(value, expected) {
			return false, "字段类型不符合 JSON Schema"
		}
	}
	properties, hasProperties := schema["properties"].(map[string]any)
	required, hasRequired := schema["required"].([]any)
	if hasProperties || hasRequired {
		object := workflowTestObject(value)
		if object == nil {
			return false, "JSON Schema 属性仅适用于对象"
		}
		for _, rawName := range required {
			name, ok := rawName.(string)
			if !ok || name == "" {
				return false, "JSON Schema required 无效"
			}
			if _, exists := object[name]; !exists {
				return false, "缺少必填字段 " + name
			}
		}
		for name, rawProperty := range properties {
			child, exists := object[name]
			if !exists {
				continue
			}
			childSchema, ok := rawProperty.(map[string]any)
			if !ok {
				return false, "JSON Schema 属性无效"
			}
			if passed, message := workflowTestMatchesJSONSchema(child, childSchema); !passed {
				return false, name + " · " + message
			}
		}
	}
	return true, ""
}

func workflowTestJSONEqual(left, right any) bool {
	encodedLeft, leftErr := json.Marshal(left)
	encodedRight, rightErr := json.Marshal(right)
	return leftErr == nil && rightErr == nil && string(encodedLeft) == string(encodedRight)
}

func workflowTestObject(value any) map[string]any {
	if object, ok := value.(map[string]any); ok {
		return object
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var object map[string]any
	if json.Unmarshal(encoded, &object) != nil {
		return nil
	}
	return object
}

func parseInt64String(value string) (model.Int64String, error) {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid ID")
	}
	return model.Int64String(parsed), nil
}
