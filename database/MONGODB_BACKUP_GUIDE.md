# MongoDB Backup, Copy & Restore Guide — CulvertCAD

This guide outlines the standard operating procedures for creating backups, snapshots, and copies of the **`CulvertCAD_Documents`** MongoDB database.

---

## 1. Quick Environment Reference

| Property | Value |
| :--- | :--- |
| **Database Name** | `CulvertCAD_Documents` |
| **Local Connection String** | `mongodb://localhost:27017` |
| **Key Collections** | `surveys`, `alignments`, `culvert_solids`, `calc_results`, `drawings` |
| **MongoDB Tools Location (Windows)** | `C:\Program Files\MongoDB\Tools\100\bin` |

> [!TIP]
> If `mongodump` or `mongorestore` are not in your system `PATH`, you can run them directly by pointing to their full directory:
> ```powershell
> & "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe" ...
> ```
> Or temporarily add them to your current session `PATH`:
> ```powershell
> $env:Path += ";C:\Program Files\MongoDB\Tools\100\bin"
> ```

---

## 2. Method 1: Complete Database Backup & Restore (`mongodump` / `mongorestore`)

This is the **recommended production method**. It captures BSON binaries, preserves indexes, and applies gzip compression.

### A. Backup Entire Database to a Single Compressed Archive
Run the following in PowerShell:

```powershell
# Create a dedicated backups directory if it doesn't exist
New-Item -ItemType Directory -Force -Path ".\database\backups"

# Dump the full CulvertCAD_Documents database into a gzipped archive
& "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe" `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --archive=".\database\backups\CulvertCAD_Backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').gz" `
    --gzip
```

### B. Restore the Database
To restore the backup archive back into `CulvertCAD_Documents`:

```powershell
# CAUTION: --drop deletes existing collections before restoring them
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
    --uri="mongodb://localhost:27017" `
    --archive=".\database\backups\CulvertCAD_Backup_YYYYMMDD_HHMMSS.gz" `
    --gzip `
    --drop
```

### C. Clone / Restore as a New Database (e.g. `CulvertCAD_Documents_DEV`)
To restore the snapshot into a separate sandbox database without modifying the main database:

```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
    --uri="mongodb://localhost:27017" `
    --archive=".\database\backups\CulvertCAD_Backup_YYYYMMDD_HHMMSS.gz" `
    --gzip `
    --nsFrom="CulvertCAD_Documents.*" `
    --nsTo="CulvertCAD_Documents_DEV.*"
```

---

## 3. Method 2: Single Collection Backup (e.g., `culvert_solids` or `surveys`)

If you only want to back up a specific collection before running a large data migration:

### Backup a Single Collection
```powershell
# Back up only the 3D and 2D models in culvert_solids
& "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe" `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --collection=culvert_solids `
    --archive=".\database\backups\culvert_solids_backup.gz" `
    --gzip
```

### Restore a Single Collection
```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --collection=culvert_solids `
    --archive=".\database\backups\culvert_solids_backup.gz" `
    --gzip `
    --drop
```

---

## 4. Method 3: Automated Daily Backup Script (PowerShell)

Save this script as `database\backup_mongodb.ps1` to run automated snapshots with a 7-day retention cleanup:

```powershell
# database\backup_mongodb.ps1
$backupDir = "$PSScriptRoot\backups"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$mongoDumpPath = "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveFile = "$backupDir\CulvertCAD_Documents_$timestamp.gz"

Write-Host "Starting CulvertCAD MongoDB Backup..." -ForegroundColor Cyan

& $mongoDumpPath `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --archive=$archiveFile `
    --gzip

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Backup written to: $archiveFile" -ForegroundColor Green
    
    # Retention: Remove backups older than 7 days
    Get-ChildItem -Path $backupDir -Filter "CulvertCAD_Documents_*.gz" |
        Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } |
        Remove-Item -Force
} else {
    Write-Host "[ERROR] MongoDB backup failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
```

---

## 5. Method 4: In-Database Instant Clone (Via `mongosh`)

If you want an immediate copy of collections inside MongoDB without exporting files to disk, run this script in `mongosh`:

```javascript
// Connect to MongoDB
use CulvertCAD_Documents;

// 1. Clone surveys
db.surveys.aggregate([ { $match: {} }, { $out: "surveys_backup" } ]);

// 2. Clone culvert solids
db.culvert_solids.aggregate([ { $match: {} }, { $out: "culvert_solids_backup" } ]);

// 3. Clone alignments
db.alignments.aggregate([ { $match: {} }, { $out: "alignments_backup" } ]);

print("Collections cloned to *_backup successfully!");
```

To revert back:
```javascript
use CulvertCAD_Documents;

db.culvert_solids.drop();
db.culvert_solids_backup.aggregate([ { $match: {} }, { $out: "culvert_solids" } ]);
```

---

## 6. Method 5: Human-Readable JSON Export (`mongoexport`)

If you need to inspect raw JSON in VS Code or share survey points with another tool:

```powershell
# Export all detected culverts and surveys to a readable JSON array
& "C:\Program Files\MongoDB\Tools\100\bin\mongoexport.exe" `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --collection=surveys `
    --out=".\database\backups\surveys_export.json" `
    --jsonArray `
    --pretty
```

To import back from JSON:
```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongoimport.exe" `
    --uri="mongodb://localhost:27017" `
    --db=CulvertCAD_Documents `
    --collection=surveys `
    --file=".\database\backups\surveys_export.json" `
    --jsonArray `
    --mode=upsert
```

---

## 7. Verification Checklist

After restoring or copying, verify data integrity:

1. **Check Collection Counts**:
   ```powershell
   mongosh "mongodb://localhost:27017/CulvertCAD_Documents" --eval "db.getCollectionNames().forEach(c => print(c + ': ' + db[c].countDocuments()))"
   ```
2. **Launch Web App**:
   Navigate to `/Survey` and `/CadDrawings` to verify that surveys, 2D drawings, and 3D solids load immediately from database.

