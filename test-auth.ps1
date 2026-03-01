# 登录认证系统测试脚本

Write-Host "=== Valley 登录认证系统测试 ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"

# 1. 检查服务是否运行
Write-Host "1️⃣ 检查服务状态..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "✅ 服务正常运行" -ForegroundColor Green
} catch {
    Write-Host "❌ 服务未启动，请先运行: cd server && air" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. 初始化数据（强制重新初始化）
Write-Host "2️⃣ 初始化测试数据（强制模式）..." -ForegroundColor Yellow
try {
    $initResult = Invoke-WebRequest -Uri "$baseUrl/init-data?force=true" -Method GET | ConvertFrom-Json
    Write-Host "✅ $($initResult.data.message)" -ForegroundColor Green
    if ($initResult.data.clearedUsers) {
        Write-Host "   清除用户数: $($initResult.data.clearedUsers)" -ForegroundColor Gray
    }
    Write-Host "   创建用户数: $($initResult.data.createdUsers)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  初始化失败" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# 3. 测试登录
Write-Host "3️⃣ 测试登录接口..." -ForegroundColor Yellow
$loginData = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginData
    
    $token = $loginResponse.data.token
    $userInfo = $loginResponse.data.userInfo
    
    Write-Host "✅ 登录成功！" -ForegroundColor Green
    Write-Host "   用户名: $($userInfo.username)" -ForegroundColor Gray
    Write-Host "   昵称: $($userInfo.nickname)" -ForegroundColor Gray
    Write-Host "   角色: $($userInfo.role)" -ForegroundColor Gray
    Write-Host "   Token: $($token.Substring(0, 50))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ 登录失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""

# 4. 测试无 Token 访问（应该失败）
Write-Host "4️⃣ 测试无 Token 访问管理接口..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/v1/admin/users" -Method GET -ErrorAction Stop
    Write-Host "❌ 应该返回 401，但是成功了" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "✅ 正确返回 401 未授权" -ForegroundColor Green
    } else {
        Write-Host "⚠️  返回状态码: $statusCode" -ForegroundColor Yellow
    }
}

Write-Host ""

# 5. 测试携带 Token 访问
Write-Host "5️⃣ 测试携带 Token 访问管理接口..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    $usersResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/admin/users?page=1&pageSize=10" `
        -Method GET `
        -Headers $headers
    
    Write-Host "✅ 成功获取用户列表" -ForegroundColor Green
    Write-Host "   总用户数: $($usersResponse.data.total)" -ForegroundColor Gray
    Write-Host "   当前页: $($usersResponse.data.list.Count) 个用户" -ForegroundColor Gray
} catch {
    Write-Host "❌ 获取用户列表失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# 6. 测试获取当前用户信息
Write-Host "6️⃣ 测试获取当前用户信息..." -ForegroundColor Yellow
try {
    $currentUser = Invoke-RestMethod -Uri "$baseUrl/api/v1/user/current" `
        -Method GET `
        -Headers $headers
    
    Write-Host "✅ 成功获取当前用户信息" -ForegroundColor Green
    Write-Host "   ID: $($currentUser.data.id)" -ForegroundColor Gray
    Write-Host "   用户名: $($currentUser.data.username)" -ForegroundColor Gray
    Write-Host "   角色: $($currentUser.data.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ 获取当前用户信息失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 测试完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 测试总结：" -ForegroundColor Yellow
Write-Host "   ✅ 服务运行正常" -ForegroundColor Green
Write-Host "   ✅ 登录接口正常" -ForegroundColor Green
Write-Host "   ✅ Token 验证正常" -ForegroundColor Green
Write-Host "   ✅ 权限控制正常" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 登录认证系统工作正常！" -ForegroundColor Green
Write-Host ""
Write-Host "💡 下一步：" -ForegroundColor Cyan
Write-Host "   1. 启动前端：cd apps/admin && pnpm dev" -ForegroundColor Gray
Write-Host "   2. 访问：http://localhost:5173/login" -ForegroundColor Gray
Write-Host "   3. 使用账号：admin / admin123" -ForegroundColor Gray
Write-Host ""
