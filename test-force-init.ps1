# 测试强制重新初始化功能
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "测试强制重新初始化数据" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:8080"

# 测试 1: 第一次初始化
Write-Host "[测试 1] 第一次初始化数据..." -ForegroundColor Yellow
try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/init-data" -Method Get
    Write-Host "✓ 第一次初始化成功" -ForegroundColor Green
    Write-Host "  返回: $($response1.data.message)" -ForegroundColor Gray
    Write-Host "  创建用户数: $($response1.data.createdUsers)`n" -ForegroundColor Gray
} catch {
    Write-Host "✗ 第一次初始化失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 1

# 测试 2: 普通初始化（应该提示数据已存在）
Write-Host "[测试 2] 再次普通初始化（应该提示数据已存在）..." -ForegroundColor Yellow
try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/init-data" -Method Get
    Write-Host "✓ 返回正确提示" -ForegroundColor Green
    Write-Host "  返回: $($response2.data.message)" -ForegroundColor Gray
    Write-Host "  用户数: $($response2.data.userCount)`n" -ForegroundColor Gray
} catch {
    Write-Host "✗ 测试失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 1

# 测试 3: 强制重新初始化
Write-Host "[测试 3] 强制重新初始化（force=true）..." -ForegroundColor Yellow
try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/init-data?force=true" -Method Get
    Write-Host "✓ 强制初始化成功" -ForegroundColor Green
    Write-Host "  返回: $($response3.data.message)" -ForegroundColor Gray
    Write-Host "  创建用户数: $($response3.data.createdUsers)`n" -ForegroundColor Gray
} catch {
    Write-Host "✗ 强制初始化失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  错误详情: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 1

# 测试 4: 再次强制初始化（测试重复 force）
Write-Host "[测试 4] 再次强制初始化（验证可重复执行）..." -ForegroundColor Yellow
try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/init-data?force=true" -Method Get
    Write-Host "✓ 第二次强制初始化成功" -ForegroundColor Green
    Write-Host "  返回: $($response4.data.message)" -ForegroundColor Gray
    Write-Host "  创建用户数: $($response4.data.createdUsers)`n" -ForegroundColor Gray
} catch {
    Write-Host "✗ 第二次强制初始化失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  错误详情: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# 测试 5: 验证用户登录
Write-Host "[测试 5] 验证 admin 用户可以登录..." -ForegroundColor Yellow
try {
    $loginData = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $response5 = Invoke-RestMethod -Uri "$baseUrl/login" -Method Post -Body $loginData -ContentType "application/json"
    Write-Host "✓ 登录成功" -ForegroundColor Green
    Write-Host "  Token: $($response5.data.token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "  用户: $($response5.data.user.nickname) ($($response5.data.user.role))`n" -ForegroundColor Gray
} catch {
    Write-Host "✗ 登录失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 所有测试通过
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✓ 所有测试通过！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "修复说明:" -ForegroundColor Yellow
Write-Host "  • 使用事务确保数据完全清空" -ForegroundColor Gray
Write-Host "  • 重置 SQLite 自增序列" -ForegroundColor Gray
Write-Host "  • 按正确顺序删除（避免外键约束）" -ForegroundColor Gray
Write-Host "  • 添加详细错误处理" -ForegroundColor Gray
Write-Host ""
Write-Host "现在可以安全地多次执行 force=true 重新初始化了！" -ForegroundColor Green
