# ============================================================================
# 数据库迁移执行脚本
# 文件：migrate.ps1
# 用途：简化数据库迁移操作
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "up",  # up | down | status
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "002"  # 迁移版本号
)

# 配置
$DbPath = "data/valley.db"
$MigrationsDir = "migrations"

# 颜色输出
function Write-Success { 
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green 
}

function Write-Error { 
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red 
}

function Write-Info { 
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan 
}

function Write-Warning { 
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow 
}

# 检查数据库文件是否存在
if (-not (Test-Path $DbPath)) {
    Write-Error "数据库文件不存在: $DbPath"
    Write-Info "请先启动服务器创建数据库"
    exit 1
}

# 检查 sqlite3 是否安装
$sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
if (-not $sqlite3) {
    Write-Error "未找到 sqlite3 命令"
    Write-Info "请安装 SQLite: https://www.sqlite.org/download.html"
    Write-Info "或使用 chocolatey: choco install sqlite"
    exit 1
}

Write-Info "数据库路径: $DbPath"
Write-Info "迁移目录: $MigrationsDir"
Write-Host ""

# 执行迁移
switch ($Action) {
    "up" {
        $MigrationFile = "$MigrationsDir/${Version}_creator_space_features.sql"
        
        if (-not (Test-Path $MigrationFile)) {
            Write-Error "迁移文件不存在: $MigrationFile"
            exit 1
        }
        
        Write-Info "准备执行迁移: $MigrationFile"
        Write-Warning "此操作将修改数据库结构"
        
        # 询问确认
        $confirm = Read-Host "是否继续？(y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Info "已取消迁移"
            exit 0
        }
        
        Write-Info "执行迁移中..."
        
        # 备份数据库
        $BackupPath = "$DbPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $DbPath $BackupPath
        Write-Success "已备份数据库到: $BackupPath"
        
        # 执行迁移
        Get-Content $MigrationFile | sqlite3 $DbPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "迁移执行成功！"
            Write-Info "备份文件: $BackupPath"
            Write-Info "如需回滚，请运行: .\migrate.ps1 -Action down -Version $Version"
        } else {
            Write-Error "迁移执行失败！"
            Write-Warning "正在恢复备份..."
            Copy-Item $BackupPath $DbPath -Force
            Write-Success "已恢复到迁移前状态"
            exit 1
        }
    }
    
    "down" {
        $RollbackFile = "$MigrationsDir/${Version}_creator_space_features_down.sql"
        
        if (-not (Test-Path $RollbackFile)) {
            Write-Error "回滚文件不存在: $RollbackFile"
            exit 1
        }
        
        Write-Warning "准备回滚迁移: $RollbackFile"
        Write-Warning "⚠️  警告：回滚操作会删除数据！"
        
        # 询问确认
        $confirm = Read-Host "是否继续？请输入 'YES' 确认"
        if ($confirm -ne "YES") {
            Write-Info "已取消回滚"
            exit 0
        }
        
        Write-Info "执行回滚中..."
        
        # 备份数据库
        $BackupPath = "$DbPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $DbPath $BackupPath
        Write-Success "已备份数据库到: $BackupPath"
        
        # 执行回滚
        Get-Content $RollbackFile | sqlite3 $DbPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "回滚执行成功！"
            Write-Info "备份文件: $BackupPath"
        } else {
            Write-Error "回滚执行失败！"
            Write-Warning "正在恢复备份..."
            Copy-Item $BackupPath $DbPath -Force
            Write-Success "已恢复到回滚前状态"
            exit 1
        }
    }
    
    "status" {
        Write-Info "查询数据库状态..."
        Write-Host ""
        
        # 查询 creators 表结构
        Write-Host "=== creators 表结构 ===" -ForegroundColor Yellow
        sqlite3 $DbPath "PRAGMA table_info(creators);"
        Write-Host ""
        
        # 查询 code_access_logs 表是否存在
        Write-Host "=== code_access_logs 表 ===" -ForegroundColor Yellow
        $tableExists = sqlite3 $DbPath "SELECT name FROM sqlite_master WHERE type='table' AND name='code_access_logs';"
        if ($tableExists) {
            Write-Success "code_access_logs 表已存在"
            sqlite3 $DbPath "PRAGMA table_info(code_access_logs);"
        } else {
            Write-Warning "code_access_logs 表不存在"
        }
        Write-Host ""
        
        # 查询 creators 表记录数
        $creatorCount = sqlite3 $DbPath "SELECT COUNT(*) FROM creators;"
        Write-Info "creators 表记录数: $creatorCount"
        
        # 查询 code_access_logs 表记录数（如果存在）
        if ($tableExists) {
            $logCount = sqlite3 $DbPath "SELECT COUNT(*) FROM code_access_logs;"
            Write-Info "code_access_logs 表记录数: $logCount"
        }
    }
    
    default {
        Write-Error "未知操作: $Action"
        Write-Info "用法："
        Write-Info "  执行迁移:   .\migrate.ps1 -Action up -Version 002"
        Write-Info "  回滚迁移:   .\migrate.ps1 -Action down -Version 002"
        Write-Info "  查看状态:   .\migrate.ps1 -Action status"
        exit 1
    }
}

Write-Host ""
Write-Success "操作完成！"

