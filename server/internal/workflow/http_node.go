package workflow

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	maxHTTPRequestTimeout = 60 * time.Second
	maxHTTPResponseBytes  = 1 << 20
)

var (
	allowedHTTPMethods = map[string]bool{"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true}
	blockedHTTPHeaders = map[string]bool{
		"authorization": true, "cookie": true, "host": true, "proxy-authorization": true,
		"connection": true, "content-length": true, "transfer-encoding": true,
	}
)

type httpKeyValue struct {
	Name  string `json:"name"`
	Value any    `json:"value"`
}

type httpNodeConfig struct {
	Method         string         `json:"method"`
	URL            string         `json:"url"`
	Params         []httpKeyValue `json:"params"`
	Headers        []httpKeyValue `json:"headers"`
	BodyType       string         `json:"bodyType"`
	Body           any            `json:"body"`
	TimeoutSeconds int            `json:"timeoutSeconds"`
	RetryCount     int            `json:"retryCount"`
	IgnoreError    bool           `json:"ignoreError"`
}

// HTTPOutboundPolicy holds the explicit development-only loopback targets that
// the HTTP node may call. It never broadens access to arbitrary private hosts.
type HTTPOutboundPolicy struct {
	localTargets map[string]struct{}
}

func NewHTTPOutboundPolicy(localAllowlist []string) HTTPOutboundPolicy {
	policy := HTTPOutboundPolicy{localTargets: make(map[string]struct{})}
	for _, target := range localAllowlist {
		if key, ok := normalizeLocalTarget(target); ok {
			policy.localTargets[key] = struct{}{}
		}
	}
	return policy
}

func normalizeLocalTarget(raw string) (string, bool) {
	parsed, err := url.Parse("http://" + strings.TrimSpace(raw))
	if err != nil || parsed == nil || parsed.Host == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false
	}
	port := parsed.Port()
	if port == "" {
		return "", false
	}
	portNumber, err := strconv.Atoi(port)
	if err != nil || portNumber < 1 || portNumber > 65535 {
		return "", false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" {
		return net.JoinHostPort(host, port), true
	}
	address, err := netip.ParseAddr(host)
	if err != nil || !address.IsLoopback() {
		return "", false
	}
	return net.JoinHostPort(address.Unmap().String(), port), true
}

func (policy HTTPOutboundPolicy) allowsLocalTarget(target *url.URL) bool {
	if target == nil {
		return false
	}
	port := target.Port()
	if port == "" {
		return false
	}
	_, allowed := policy.localTargets[net.JoinHostPort(strings.ToLower(target.Hostname()), port)]
	return allowed
}

func (policy HTTPOutboundPolicy) allowsLocalAddress(host, port string) bool {
	_, allowed := policy.localTargets[net.JoinHostPort(strings.ToLower(host), port)]
	return allowed
}

func httpConfigFromMap(config map[string]any) (httpNodeConfig, error) {
	return httpConfigFromMapWithPolicy(config, HTTPOutboundPolicy{})
}

func httpConfigFromMapWithPolicy(config map[string]any, policy HTTPOutboundPolicy) (httpNodeConfig, error) {
	encoded, err := json.Marshal(config)
	if err != nil {
		return httpNodeConfig{}, err
	}
	var parsed httpNodeConfig
	if err := json.Unmarshal(encoded, &parsed); err != nil {
		return httpNodeConfig{}, err
	}
	parsed.Method = strings.ToUpper(strings.TrimSpace(parsed.Method))
	parsed.URL = strings.TrimSpace(parsed.URL)
	parsed.BodyType = strings.ToLower(strings.TrimSpace(parsed.BodyType))
	if parsed.BodyType == "" {
		parsed.BodyType = "none"
	}
	if !allowedHTTPMethods[parsed.Method] {
		return httpNodeConfig{}, fmt.Errorf("method 仅支持 GET、POST、PUT、PATCH 或 DELETE")
	}
	if parsed.URL == "" {
		return httpNodeConfig{}, fmt.Errorf("URL 不能为空")
	}
	if !strings.Contains(parsed.URL, "{{") {
		if _, err := parseOutboundURLWithPolicy(parsed.URL, policy); err != nil {
			return httpNodeConfig{}, err
		}
	}
	if parsed.BodyType != "none" && parsed.BodyType != "json" {
		return httpNodeConfig{}, fmt.Errorf("bodyType 仅支持 none 或 json")
	}
	if parsed.TimeoutSeconds == 0 {
		parsed.TimeoutSeconds = 30
	}
	if parsed.TimeoutSeconds < 1 || parsed.TimeoutSeconds > int(maxHTTPRequestTimeout.Seconds()) {
		return httpNodeConfig{}, fmt.Errorf("超时必须在 1 到 %d 秒之间", int(maxHTTPRequestTimeout.Seconds()))
	}
	if parsed.RetryCount < 0 || parsed.RetryCount > 3 {
		return httpNodeConfig{}, fmt.Errorf("重试次数必须在 0 到 3 次之间")
	}
	for _, group := range [][]httpKeyValue{parsed.Params, parsed.Headers} {
		for _, item := range group {
			if strings.TrimSpace(item.Name) == "" {
				return httpNodeConfig{}, fmt.Errorf("请求参数和请求头名称不能为空")
			}
		}
	}
	for _, header := range parsed.Headers {
		if blockedHTTPHeaders[strings.ToLower(strings.TrimSpace(header.Name))] {
			return httpNodeConfig{}, fmt.Errorf("请求头 %s 不允许在 HTTP 节点中配置", header.Name)
		}
	}
	return parsed, nil
}

type HTTPRequestExecutor struct {
	Client         *http.Client
	OutboundPolicy HTTPOutboundPolicy
}

func (HTTPRequestExecutor) Type() NodeType { return NodeTypeHTTP }

func (executor HTTPRequestExecutor) Execute(ctx context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	config, err := httpConfigFromMapWithPolicy(execution.Input, executor.OutboundPolicy)
	if err != nil {
		return NodeResult{}, err
	}
	requestURL, err := buildHTTPRequestURL(config.URL, config.Params, executor.OutboundPolicy)
	if err != nil {
		return executor.failedResult(config.IgnoreError, err)
	}
	if err := validateSafeOutboundURL(ctx, requestURL, executor.OutboundPolicy); err != nil {
		return executor.failedResult(config.IgnoreError, err)
	}
	body, contentType, err := encodeHTTPRequestBody(config)
	if err != nil {
		return executor.failedResult(config.IgnoreError, err)
	}
	requestContext, cancel := context.WithTimeout(ctx, time.Duration(config.TimeoutSeconds)*time.Second)
	defer cancel()
	client := executor.Client
	if client == nil {
		client = safeHTTPClient(executor.OutboundPolicy)
	}
	var lastErr error
	for attempt := 0; attempt <= config.RetryCount; attempt++ {
		request, requestErr := http.NewRequestWithContext(requestContext, config.Method, requestURL.String(), bytes.NewReader(body))
		if requestErr != nil {
			return executor.failedResult(config.IgnoreError, requestErr)
		}
		if contentType != "" {
			request.Header.Set("Content-Type", contentType)
		}
		for _, header := range config.Headers {
			request.Header.Set(strings.TrimSpace(header.Name), valueAsString(header.Value))
		}
		response, requestErr := client.Do(request)
		if requestErr != nil {
			lastErr = requestErr
			if requestContext.Err() != nil || attempt == config.RetryCount {
				break
			}
			continue
		}
		result, responseErr := readHTTPResponse(response)
		if responseErr == nil && response.StatusCode >= 200 && response.StatusCode < 300 {
			return NodeResult{Output: result}, nil
		}
		if responseErr != nil {
			lastErr = responseErr
		} else {
			lastErr = fmt.Errorf("HTTP 请求返回状态码 %d", response.StatusCode)
		}
		if response.StatusCode < 500 || attempt == config.RetryCount {
			if config.IgnoreError {
				result["error"] = lastErr.Error()
				return NodeResult{Output: result}, nil
			}
			break
		}
	}
	return executor.failedResult(config.IgnoreError, lastErr)
}

func (executor HTTPRequestExecutor) failedResult(ignore bool, err error) (NodeResult, error) {
	if err == nil {
		err = fmt.Errorf("HTTP 请求失败")
	}
	if ignore {
		return NodeResult{Output: map[string]any{"body": "", "statusCode": 0, "headers": map[string]any{}, "error": err.Error()}}, nil
	}
	return NodeResult{}, err
}

func buildHTTPRequestURL(raw string, params []httpKeyValue, policy HTTPOutboundPolicy) (*url.URL, error) {
	parsed, err := parseOutboundURLWithPolicy(raw, policy)
	if err != nil {
		return nil, err
	}
	query := parsed.Query()
	for _, param := range params {
		query.Set(strings.TrimSpace(param.Name), valueAsString(param.Value))
	}
	parsed.RawQuery = query.Encode()
	return parsed, nil
}

func encodeHTTPRequestBody(config httpNodeConfig) ([]byte, string, error) {
	if config.BodyType == "none" {
		return nil, "", nil
	}
	if config.Body == nil || config.Body == "" {
		return []byte("{}"), "application/json", nil
	}
	if text, ok := config.Body.(string); ok {
		if !json.Valid([]byte(text)) {
			return nil, "", fmt.Errorf("JSON 请求体格式无效")
		}
		return []byte(text), "application/json", nil
	}
	encoded, err := json.Marshal(config.Body)
	if err != nil {
		return nil, "", fmt.Errorf("JSON 请求体格式无效: %w", err)
	}
	return encoded, "application/json", nil
}

func readHTTPResponse(response *http.Response) (map[string]any, error) {
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxHTTPResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("读取 HTTP 响应失败: %w", err)
	}
	if len(body) > maxHTTPResponseBytes {
		return nil, fmt.Errorf("HTTP 响应正文超过 1 MiB 限制")
	}
	headers := make(map[string]any, len(response.Header))
	for name, values := range response.Header {
		headers[name] = strings.Join(values, ", ")
	}
	return map[string]any{"body": string(body), "statusCode": response.StatusCode, "headers": headers}, nil
}

func parseOutboundURL(raw string) (*url.URL, error) {
	return parseOutboundURLWithPolicy(raw, HTTPOutboundPolicy{})
}

func parseOutboundURLWithPolicy(raw string, policy HTTPOutboundPolicy) (*url.URL, error) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed == nil || !parsed.IsAbs() || parsed.Host == "" {
		return nil, fmt.Errorf("URL 必须是完整的 HTTP(S) 地址")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("URL 仅支持 HTTP 或 HTTPS")
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return nil, fmt.Errorf("URL 不能包含用户信息或片段")
	}
	if port := parsed.Port(); port != "" && port != "80" && port != "443" && !policy.allowsLocalTarget(parsed) {
		return nil, fmt.Errorf("URL 不允许使用非标准端口")
	}
	return parsed, nil
}

func validateSafeOutboundURL(ctx context.Context, target *url.URL, policy HTTPOutboundPolicy) error {
	host := target.Hostname()
	if host == "" {
		return fmt.Errorf("URL 主机无效")
	}
	if policy.allowsLocalTarget(target) {
		return nil
	}
	if address, err := netip.ParseAddr(host); err == nil {
		if blockedOutboundIP(address) {
			return fmt.Errorf("URL 不允许访问内网或保留地址")
		}
		return nil
	}
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(addresses) == 0 {
		return fmt.Errorf("无法解析 URL 主机")
	}
	for _, address := range addresses {
		if blockedOutboundIP(address) {
			return fmt.Errorf("URL 不允许访问内网或保留地址")
		}
	}
	return nil
}

func blockedOutboundIP(address netip.Addr) bool {
	address = address.Unmap()
	if !address.IsValid() || !address.IsGlobalUnicast() || address.IsPrivate() || address.IsLoopback() || address.IsLinkLocalUnicast() || address.IsMulticast() || address.IsUnspecified() {
		return true
	}
	for _, prefix := range []netip.Prefix{
		netip.MustParsePrefix("0.0.0.0/8"), netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("192.0.0.0/24"), netip.MustParsePrefix("192.0.2.0/24"),
		netip.MustParsePrefix("198.18.0.0/15"), netip.MustParsePrefix("198.51.100.0/24"),
		netip.MustParsePrefix("203.0.113.0/24"), netip.MustParsePrefix("224.0.0.0/4"),
		netip.MustParsePrefix("240.0.0.0/4"), netip.MustParsePrefix("2001:db8::/32"),
	} {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}

func safeHTTPClient(policy HTTPOutboundPolicy) *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	transport := &http.Transport{
		Proxy:              nil,
		DisableCompression: true,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil || ((port != "80" && port != "443") && !policy.allowsLocalAddress(host, port)) {
				return nil, fmt.Errorf("HTTP 连接地址无效")
			}
			addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
			if err != nil || len(addresses) == 0 {
				return nil, fmt.Errorf("无法解析 URL 主机")
			}
			for _, resolved := range addresses {
				if policy.allowsLocalAddress(host, port) {
					if !resolved.IsLoopback() {
						return nil, fmt.Errorf("本地白名单主机未解析到回环地址")
					}
					continue
				}
				if blockedOutboundIP(resolved) {
					return nil, fmt.Errorf("URL 不允许访问内网或保留地址")
				}
			}
			return dialer.DialContext(ctx, network, net.JoinHostPort(addresses[0].String(), port))
		},
	}
	return &http.Client{Transport: transport, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
}

func valueAsString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(typed), 'f', -1, 32)
	case bool:
		return strconv.FormatBool(typed)
	default:
		return fmt.Sprint(value)
	}
}
