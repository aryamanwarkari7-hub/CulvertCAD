# DigitalOcean Droplet Deployment Guide — CulvertCAD

This guide contains the exact steps and commands used to set up, deploy, and run CulvertCAD on an Ubuntu 24.04 DigitalOcean Droplet.

---

## 1. Prerequisites on the Droplet

### Install ASP.NET Core 8 Runtime
```bash
sudo apt update
sudo apt install -y aspnetcore-runtime-8.0
```

---

## 2. Directory & File Upload (via WinSCP)

1. Connect to the Droplet via **WinSCP** using your `.ppk` SSH key as `root`.
2. Target directory on Droplet:
   ```text
   /root/CulvertLocator
   ```
3. Upload all contents of your local `Publish` directory into `/root/CulvertLocator`.

---

## 3. Database Setup

### A. MySQL Database & Dedicated User
Log in using Debian maintenance credentials so existing databases/projects are untouched:

```bash
sudo mysql --defaults-file=/etc/mysql/debian.cnf
```

In the `mysql>` prompt, run:
```sql
CREATE DATABASE IF NOT EXISTS CulvertCAD_Core;
CREATE USER IF NOT EXISTS 'culvertcad'@'localhost' IDENTIFIED BY 'KEAHQK!ne1';
GRANT ALL PRIVILEGES ON CulvertCAD_Core.* TO 'culvertcad'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Restoring MySQL Backup (Case-Sensitivity Fix)
Windows `mysqldump` exports table names in lowercase. Linux MySQL is case-sensitive, so table names must be converted to PascalCase before importing:

```bash
# 1. Convert Windows UTF-16 dump to UTF-8
iconv -f UTF-16LE -t UTF-8 /root/CulvertLocator/culvertcad_mysql_backup.sql -o /root/CulvertLocator/backup_utf8.sql

# 2. Fix casing to match EF Core
sed -i \
  -e 's/`__efmigrationshistory`/`__EFMigrationsHistory`/g' \
  -e 's/`aspnetroles`/`AspNetRoles`/g' \
  -e 's/`aspnetusers`/`AspNetUsers`/g' \
  -e 's/`auditlogs`/`AuditLogs`/g' \
  -e 's/`organisations`/`Organisations`/g' \
  -e 's/`pipecatalog`/`PipeCatalog`/g' \
  -e 's/`aspnetroleclaims`/`AspNetRoleClaims`/g' \
  -e 's/`aspnetuserclaims`/`AspNetUserClaims`/g' \
  -e 's/`aspnetuserlogins`/`AspNetUserLogins`/g' \
  -e 's/`aspnetuserroles`/`AspNetUserRoles`/g' \
  -e 's/`aspnetusertokens`/`AspNetUserTokens`/g' \
  -e 's/`projects`/`Projects`/g' \
  -e 's/`culvertdesigns`/`CulvertDesigns`/g' \
  -e 's/`projectmembers`/`ProjectMembers`/g' \
  -e 's/`designrevisions`/`DesignRevisions`/g' \
  -e 's/`revisioncomments`/`RevisionComments`/g' \
  -e 's/`revisionstatushistory`/`RevisionStatusHistory`/g' \
  /root/CulvertLocator/backup_utf8.sql

# 3. Import into MySQL
mysql -u culvertcad -p'KEAHQK!ne1' CulvertCAD_Core < /root/CulvertLocator/backup_utf8.sql
```

---

### B. MongoDB (Docker Container)
Run MongoDB inside a dedicated Docker container with auto-restart:

```bash
# Start MongoDB container
docker run -d --name culvert-mongo -p 127.0.0.1:27017:27017 -v mongo_culvert_data:/data/db --restart unless-stopped mongo:7.0

# Restore backup archive
docker exec -i culvert-mongo mongorestore --archive --gzip --drop < /root/CulvertLocator/culvertcad_mongo_backup.archive
```

---

## 4. Application Configuration

In `/root/CulvertLocator/appsettings.json`, ensure your connection strings are:

```json
{
  "ConnectionStrings": {
    "MySQL": "Server=localhost;Port=3306;Database=CulvertCAD_Core;User=culvertcad;Password=KEAHQK!ne1;CharSet=utf8mb4;",
    "MongoDB": "mongodb://localhost:27017"
  },
  "MongoDbName": "CulvertCAD_Documents",
  "AllowedHosts": "*"
}
```

---

## 5. Background Service (`systemd`)

Create a systemd unit file to keep the application running 24/7 on port **5005**:

```bash
sudo nano /etc/systemd/system/culvertcad.service
```

Paste the following:
```ini
[Unit]
Description=CulvertCAD Web Application
After=network.target

[Service]
WorkingDirectory=/root/CulvertLocator
ExecStart=/usr/bin/dotnet /root/CulvertLocator/CulvertCAD.Web.dll --urls "http://0.0.0.0:5005"
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=culvertcad
User=root
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now culvertcad
```

---

## 6. Firewall Configuration (`ufw`)

Open port 5005 for external web access:
```bash
sudo ufw allow 5005/tcp
sudo ufw status
```

---

## 7. Service Management & Deploying Updates

| Task | Command |
| :--- | :--- |
| **Check App Status** | `sudo systemctl status culvertcad` |
| **View Live Logs** | `journalctl -u culvertcad -f` |
| **Restart App** | `sudo systemctl restart culvertcad` |
| **Stop App** | `sudo systemctl stop culvertcad` |

### Updating with New Code
1. Rebuild locally: `dotnet publish -c Release -o ..\Publish`
2. Upload the updated `.dll` files via WinSCP to `/root/CulvertLocator`.
3. Restart the service:
   ```bash
   sudo systemctl restart culvertcad
   ```

