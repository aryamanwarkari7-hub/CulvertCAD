# database\backup_mongodb.ps1
# Automates compressed BSON backups of the CulvertCAD_Documents MongoDB database.

$backupDir = "$PSScriptRoot\backups"
if (!(Test-Path $backupDir)) { 
    New-Item -ItemType Directory -Path $backupDir | Out-Null 
}

$mongoDumpPath = "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
if (!(Test-Path $mongoDumpPath)) {
    # Fallback to PATH lookup
    $cmd = Get-Command mongodump -ErrorAction SilentlyContinue
    if ($cmd) {
        $mongoDumpPath = $cmd.Source
    } else {
        Write-Error "mongodump.exe not found at '$mongoDumpPath' or in system PATH."
        exit 1
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveFile = "$backupDir\CulvertCAD_Documents_$timestamp.gz"

Write-Host "Starting CulvertCAD MongoDB Backup..." -ForegroundColor Cyan

& $mongoDumpPath `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --archive=$archiveFile `
    --gzip

if ($LASTEXITCODE -eq 0) {
    $sizeMb = [math]::Round((Get-Item $archiveFile).Length / 1MB, 2)
    Write-Host "[SUCCESS] Backup written to: $archiveFile ($sizeMb MB)" -ForegroundColor Green
    
    # Retention Policy: Clean up backups older than 7 days
    Get-ChildItem -Path $backupDir -Filter "CulvertCAD_Documents_*.gz" |
        Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } |
        Remove-Item -Force
} else {
    Write-Host "[ERROR] MongoDB backup failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

