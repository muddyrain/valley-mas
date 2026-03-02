# 测试用户下载流程的 PowerShell 脚本

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "测试用户下载流程 API" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080/api/v1"

# 测试 1: 获取创作者空间信息
Write-Host "1️⃣  测试：获取创作者空间信息" -ForegroundColor Yellow
Write-Host "   GET $baseUrl/public/space/y2722" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/public/space/y2722" -Method Get
    Write-Host "   ✅ 成功获取创作者空间" -ForegroundColor Green
    Write-Host "   创作者：$($response.data.creator.name)" -ForegroundColor Green
    Write-Host "   资源数量：$($response.data.resources.Count)" -ForegroundColor Green
    Write-Host "   总浏览量：$($response.data.stats.totalViews)" -ForegroundColor Green
    Write-Host "   总下载量：$($response.data.stats.totalDownloads)" -ForegroundColor Green
    
    # 保存第一个资源 ID 用于后续测试
    if ($response.data.resources.Count -gt 0) {
        $global:testResourceId = $response.data.resources[0].id
        Write-Host "   测试资源ID：$global:testResourceId" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ 失败：$($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 测试 2: 下载资源
if ($global:testResourceId) {
    Write-Host "2️⃣  测试：下载资源" -ForegroundColor Yellow
    Write-Host "   POST $baseUrl/public/resource/$global:testResourceId/download" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/public/resource/$global:testResourceId/download" -Method Post
        Write-Host "   ✅ 成功获取下载链接" -ForegroundColor Green
        Write-Host "   资源标题：$($response.data.resource.title)" -ForegroundColor Green
        Write-Host "   下载链接：$($response.data.downloadUrl)" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ 失败：$($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "2️⃣  跳过：下载资源测试（没有可用资源）" -ForegroundColor Yellow
}

Write-Host ""

# 测试 3: 获取我的下载记录（需要登录）
Write-Host "3️⃣  测试：获取我的下载记录" -ForegroundColor Yellow
Write-Host "   GET $baseUrl/user/downloads" -ForegroundColor Gray
Write-Host "   ⚠️  需要登录，先尝试登录..." -ForegroundColor Yellow

try {
    # 先登录获取 token
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -SessionVariable 'session'
    
    $token = $loginResponse.data.token
    Write-Host "   ✅ 登录成功，Token: $($token.Substring(0, 20))..." -ForegroundColor Green
    
    # 获取下载记录
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/user/downloads?page=1&pageSize=10" `
        -Method Get `
        -Headers $headers
    
    Write-Host "   ✅ 成功获取下载记录" -ForegroundColor Green
    Write-Host "   总记录数：$($response.data.total)" -ForegroundColor Green
    Write-Host "   当前页记录：$($response.data.list.Count)" -ForegroundColor Green
    
} catch {
    Write-Host "   ❌ 失败：$($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 提示：" -ForegroundColor Yellow
Write-Host "   - 访问 http://localhost:8080/swagger/index.html 查看完整 API 文档" -ForegroundColor Gray
Write-Host "   - 默认创作者口令：y2722" -ForegroundColor Gray
Write-Host "   - 默认管理员账号：admin / admin123" -ForegroundColor Gray
