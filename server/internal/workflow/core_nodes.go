package workflow

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var variableNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

type VariableExecutor struct{}

func (VariableExecutor) Type() NodeType { return NodeTypeVariable }

func (VariableExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	varName, exists := execution.Input["variableName"]
	if !exists {
		return NodeResult{}, fmt.Errorf("变量赋值节点缺少 variableName")
	}
	varNameText, ok := varName.(string)
	if !ok {
		return NodeResult{}, fmt.Errorf("变量名必须为字符串")
	}
	variableName := strings.TrimSpace(varNameText)
	if variableName == "" {
		return NodeResult{}, fmt.Errorf("变量赋值节点变量名不能为空")
	}
	if !variableNamePattern.MatchString(variableName) {
		return NodeResult{}, fmt.Errorf("变量名不能包含 . [ ]")
	}
	value, exists := execution.Input["valueExpression"]
	if !exists {
		value = ""
	}
	if valueText, ok := value.(string); ok {
		value = strings.TrimSpace(valueText)
	}
	return NodeResult{Output: map[string]any{variableName: value}}, nil
}

type HTTPExecutor struct{}

func (HTTPExecutor) Type() NodeType { return NodeTypeHTTP }

func (HTTPExecutor) Execute(ctx context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	methodText, _ := execution.Input["method"].(string)
	method := "GET"
	if strings.TrimSpace(methodText) != "" {
		method = strings.ToUpper(strings.TrimSpace(methodText))
	}
	if method == "" {
		method = "GET"
	}
	if !isSupportedHTTPMethod(method) {
		return NodeResult{}, fmt.Errorf("HTTP 方法不支持: %s", method)
	}
	urlText, ok := execution.Input["url"].(string)
	if !ok || strings.TrimSpace(urlText) == "" {
		return NodeResult{}, fmt.Errorf("HTTP 节点 URL 不能为空")
	}
	urlText = strings.TrimSpace(urlText)
	target, parseErr := url.Parse(urlText)
	if parseErr != nil {
		return NodeResult{}, fmt.Errorf("HTTP 节点 URL 无效: %w", parseErr)
	}
	if target.Scheme != "http" && target.Scheme != "https" {
		return NodeResult{}, fmt.Errorf("HTTP 节点仅支持 http 或 https")
	}
	if target.Host == "" {
		return NodeResult{}, fmt.Errorf("HTTP 节点 URL 必须包含主机")
	}
	if !isPublicHTTPHost(target.Hostname()) {
		return NodeResult{}, fmt.Errorf("HTTP 节点不允许访问本机或内网地址")
	}

	var bodyReader io.Reader
	if hasBody(method) {
		rawBody, bodySet := execution.Input["body"]
		if bodySet {
			bodyText, marshalErr := normalizeHTTPBody(rawBody)
			if marshalErr != nil {
				return NodeResult{}, marshalErr
			}
			if len(bodyText) > 0 {
				bodyReader = bytes.NewReader([]byte(bodyText))
			}
		}
	}

	request, requestErr := http.NewRequestWithContext(ctx, method, target.String(), bodyReader)
	if requestErr != nil {
		return NodeResult{}, fmt.Errorf("创建 HTTP 请求失败: %w", requestErr)
	}
	request.Header.Set("User-Agent", "ValleyMAS-Workflow/1.0")
	headers, headersErr := parseHeadersFromExecutionInput(execution.Input["headers"])
	if headersErr != nil {
		return NodeResult{}, headersErr
	}
	for key, values := range headers {
		if strings.TrimSpace(key) != "" {
			request.Header[key] = append([]string{}, values...)
		}
	}
	if hasBody(method) && request.Header.Get("Content-Type") == "" {
		request.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	response, responseErr := client.Do(request)
	if responseErr != nil {
		return NodeResult{}, fmt.Errorf("HTTP 请求失败: %w", responseErr)
	}
	defer response.Body.Close()

	body, readErr := io.ReadAll(io.LimitReader(response.Body, maxHTTPResponseBytes+1))
	if readErr != nil {
		return NodeResult{}, fmt.Errorf("读取响应失败: %w", readErr)
	}
	if int64(len(body)) > maxHTTPResponseBytes {
		return NodeResult{}, fmt.Errorf("HTTP 响应超过 %d 字节上限", maxHTTPResponseBytes)
	}

	responseHeaders := make(map[string]any, len(response.Header))
	for key, values := range response.Header {
		if strings.EqualFold(key, "Set-Cookie") {
			continue
		}
		if len(values) == 1 {
			responseHeaders[key] = values[0]
		} else {
			responseHeaders[key] = values
		}
	}
	output := map[string]any{
		"status":     response.Status,
		"statusCode": response.StatusCode,
		"headers":    responseHeaders,
		"url":        response.Request.URL.String(),
	}
	output["contentType"] = response.Header.Get("Content-Type")
	if isTextResponse(output["contentType"]) {
		output["body"] = string(body)
	}
	return NodeResult{Output: output}, nil
}

type CodeExecutor struct{}

func (CodeExecutor) Type() NodeType { return NodeTypeCode }

func (CodeExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	code, _ := execution.Input["code"].(string)
	if strings.TrimSpace(code) == "" {
		return NodeResult{}, fmt.Errorf("代码节点不能为空")
	}
	return NodeResult{}, fmt.Errorf("代码执行节点当前未开放")
}

const maxHTTPResponseBytes int64 = 2 * 1024 * 1024

func isTextResponse(contentType any) bool {
	typed := strings.ToLower(strings.TrimSpace(stringFromValue(contentType)))
	return strings.Contains(typed, "application/json") || strings.Contains(typed, "text/") || strings.Contains(typed, "application/xml") || strings.Contains(typed, "text/plain")
}

func hasBody(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead:
		return false
	default:
		return true
	}
}

func isSupportedHTTPMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func normalizeHTTPBody(value any) ([]byte, error) {
	switch typed := value.(type) {
	case nil:
		return nil, nil
	case string:
		return []byte(strings.TrimSpace(typed)), nil
	case []byte:
		return typed, nil
	default:
		raw, err := json.Marshal(typed)
		if err != nil {
			return nil, fmt.Errorf("请求体不支持: %w", err)
		}
		return raw, nil
	}
}

func isPublicHTTPHost(host string) bool {
	host = strings.TrimSpace(strings.ToLower(host))
	if host == "" {
		return false
	}
	switch host {
	case "localhost", "127.0.0.1", "::1":
		return false
	}
	switch parsed := net.ParseIP(host); {
	case parsed != nil:
		if parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast() || parsed.IsLinkLocalMulticast() || parsed.Equal(net.IPv4zero) || parsed.Equal(net.IPv6unspecified) {
			return false
		}
		return true
	default:
		if strings.HasSuffix(host, ".localhost") || host == "localhost" {
			return false
		}
	}
	return true
}

func parseHeadersFromExecutionInput(raw any) (http.Header, error) {
	headers := make(http.Header)
	if raw == nil {
		return headers, nil
	}
	entries, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("请求头配置必须是数组")
	}
	for index, value := range entries {
		object, ok := value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("请求头配置第 %d 项格式错误", index+1)
		}
		key := strings.TrimSpace(stringFromValue(object["key"]))
		if key == "" {
			continue
		}
		headerValue := strings.TrimSpace(stringFromValue(object["value"]))
		if headerValue == "" {
			continue
		}
		if strings.ContainsAny(key, "\r\n") || strings.ContainsAny(headerValue, "\r\n") {
			return nil, fmt.Errorf("请求头不允许包含换行字符")
		}
		headers.Add(key, headerValue)
	}
	return headers, nil
}

func normalizeHeaders(rawHeaders map[string][]string) map[string]any {
	result := make(map[string]any, len(rawHeaders))
	for key, values := range rawHeaders {
		if len(values) == 1 {
			result[key] = values[0]
		} else {
			result[key] = values
		}
	}
	return result
}

func isLoopbackHost(host string) bool {
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		parsed := net.ParseIP(host)
		if parsed == nil {
			return false
		}
		if parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast() || parsed.IsLinkLocalMulticast() {
			return true
		}
		return parsed.Equal(net.IPv4zero) || parsed.Equal(net.IPv6unspecified)
	}
}
