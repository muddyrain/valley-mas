# 创作者管理 API 测试脚本
# PowerShell 脚本

$baseUrl = "http://localhost:8080/api/v1"

Write-Host "================================" -ForegroundColor Green
Write-Host "创作者管理 API 测试" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# 1. 获取创作者列表
Write-Host "1. 测试：获取创作者列表" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/admin/creators?page=1&pageSize=10" -Method GET
Write-Host "结果：" -ForegroundColor Cyan
$response | ConvertTo-Json -Depth 5
Write-Host ""

# 2. 搜索创作者
Write-Host "2. 测试：搜索创作者（关键词：创作者）" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/admin/creators?keyword=创作者" -Method GET
Write-Host "结果：" -ForegroundColor Cyan
$response | ConvertTo-Json -Depth 5
Write-Host ""

# 3. 创建创作者
Write-Host "3. 测试：创建创作者" -ForegroundColor Yellow
$body = @{
    userId = "2028025683447386288"
    name = "测试创作者"
    description = "这是一个测试创作者"
    isActive = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators" -Method POST -Body $body -ContentType "application/json"
    Write-Host "结果：" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5
    
    # 保存创建的创作者ID
    $creatorId = $response.data.id
    Write-Host ""
    Write-Host "创建的创作者ID: $creatorId" -ForegroundColor Green
    Write-Host "生成的口令: $($response.data.code)" -ForegroundColor Green
    Write-Host ""

    if ($creatorId) {
        # 4. 获取创作者详情
        Write-Host "4. 测试：获取创作者详情" -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$creatorId" -Method GET
        Write-Host "结果：" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 5
        Write-Host ""

        # 5. 更新创作者
        Write-Host "5. 测试：更新创作者" -ForegroundColor Yellow
        $updateBody = @{
            name = "测试创作者（已更新）"
            description = "描述已更新"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$creatorId" -Method PUT -Body $updateBody -ContentType "application/json"
        Write-Host "结果：" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 5
        Write-Host ""

        # 6. 重新生成口令
        Write-Host "6. 测试：重新生成口令" -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$creatorId/regenerate-code" -Method POST
        Write-Host "结果：" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 5
        Write-Host "新口令: $($response.data.code)" -ForegroundColor Green
        Write-Host ""

        # 7. 切换状态
        Write-Host "7. 测试：切换状态（禁用）" -ForegroundColor Yellow
        $statusBody = @{
            isActive = $false
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$creatorId/status" -Method PUT -Body $statusBody -ContentType "application/json"
        Write-Host "结果：" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 5
        Write-Host ""

        # 8. 再次切换状态
        Write-Host "8. 测试：切换状态（启用）" -ForegroundColor Yellow
        $statusBody = @{
            isActive = $true
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$creatorId/status" -Method PUT -Body $statusBody -ContentType "application/json"
        Write-Host "结果：" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 5
        Write-Host ""

        # 9. 删除创作者
        Write-Host "9. 测试：删除创作者" -ForegroundColor Yellow
        Write-Host "确认要删除测试创作者吗？(Y/N)" -ForegroundColor Red
        $confirm = Read-Host
        
        if ($confirm -eq "Y" -or $confirm -eq "y") {
            $response = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$creatorId" -Method DELETE
            Write-Host "结果：" -ForegroundColor Cyan
            $response | ConvertTo-Json -Depth 5
            Write-Host ""
        } else {
            Write-Host "跳过删除测试" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "错误：" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "测试完成" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
