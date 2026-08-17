# CulvertCAD — Pipe Culvert Design System

Complete .NET Core 8 MVC application for IS-code compliant pipe culvert design,
with revision management, survey data import, DXF/3D drawing generation, and BOQ reports.

## Technology Stack

| Layer        | Technology                                          |
|--------------|------------------------------------------------------|
| Backend      | ASP.NET Core 8 MVC (Razor Views)                     |
| Relational DB| MySQL 8.x (users, projects, designs, revisions)      |
| Document DB  | MongoDB 6.x (survey data, calc results, drawings)     |
| Drawing      | netDxf (DXF generation) + Three.js (3D browser viewer)|
| Auth         | ASP.NET Core Identity (cookie-based)                  |
| Design codes | IS 783:1985 · IS 458:2003 · IRC 89:1997 · IRC SP 13   |

## Project Structure

```
CulvertCAD/
├── CulvertCAD.sln
├── CulvertCAD.Web/              ← MVC application (Controllers, Views, wwwroot)
├── CulvertCAD.Core/              ← Entities, DTOs, Enums (shared contracts)
├── CulvertCAD.Application/       ← Business logic (Design calc engine, Revision service, BOQ, Survey import)
├── CulvertCAD.Infrastructure/    ← EF Core (MySQL), MongoDB repositories, DXF engine
├── CulvertCAD.Tests/             ← Unit tests
└── database/
    └── mongodb_setup.js          ← MongoDB collection + index setup
```

## Prerequisites

- .NET 8 SDK
- MySQL 8.x running locally or remote
- MongoDB 6.x running locally or remote
- Visual Studio 2022 (or VS Code with C# extension)

## Setup Instructions

### 1. Clone / Extract

Extract the ZIP and open `CulvertCAD.sln` in Visual Studio.

### 2. Configure Connection Strings

Edit `CulvertCAD.Web/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "MySQL":   "Server=localhost;Port=3306;Database=CulvertCAD_Core;User=root;Password=YOUR_PASSWORD;CharSet=utf8mb4;",
    "MongoDB": "mongodb://localhost:27017"
  }
}
```

### 3. MySQL — Create Database & Run Migrations

```bash
cd CulvertCAD.Web
dotnet ef migrations add InitialCreate --project ../CulvertCAD.Infrastructure --startup-project .
dotnet ef database update --project ../CulvertCAD.Infrastructure --startup-project .
```

This creates all tables (Identity, Projects, CulvertDesigns, DesignRevisions, etc.)
and seeds the IS 458:2003 pipe catalog automatically.

### 4. MongoDB — Create Collections

```bash
mongosh < database/mongodb_setup.js
```

### 5. Download Third-Party JS Libraries

The following files are placeholders — download and replace before running:

| File | Download from |
|------|---------------|
| `wwwroot/lib/jquery/jquery.min.js` | https://jquery.com/download/ (3.7.x minified) |
| `wwwroot/lib/three/three.min.js` | https://threejs.org/build/three.min.js (r150+) |
| `wwwroot/lib/three/OrbitControls.js` | three.js repo: `examples/jsm/controls/OrbitControls.js` (UMD build) |

### 6. Run the Application

```bash
cd CulvertCAD.Web
dotnet restore
dotnet run
```

Navigate to `https://localhost:5001` (or the port shown in console).

### 7. Default Login

```
Email:    admin@culvertcad.in
Password: Admin@123
Role:     SuperAdmin
```

**Change this password immediately in production.**

## Key Features

### Authentication & Roles
- ASP.NET Core Identity with cookie auth
- 5 roles: SuperAdmin, Admin, DesignEngineer, CheckingEngineer, Viewer
- Account lockout after 5 failed attempts

### Survey Data Import
- Upload CSV survey files (PointNo, Northing, Easting, RL, Code format)
- Automatic feature code classification (C, L, R, ex cd, TBM, Bridge, etc.)
- Automatic chainage computation along centreline
- Automatic culvert location detection by clustering `ex cd` points

### Design Calculation Engine (IS Code Compliant)
- **Hydraulic**: Manning's Equation, IS 783:1985 / IRC 89:1997
- **Structural**: Marston's Formula (earth load), IS 783 Table 1 (live load)
- **Pipe Selection**: IS 458:2003 NP2/NP3/NP4 catalog matching
- Returns full step-by-step calculation trail with IS clause references

### Revision Management
- Every design change creates a new numbered revision (R0, R1, R2...)
- Workflow: Draft → Submitted → Under Review → Approved / Revision Required
- Full audit trail (status history with user, timestamp, remarks)
- Threaded comments per revision
- Approved revisions are locked (immutable)

### Drawing Generation
- **DXF** (netDxf): Cross-section and Longitudinal section, downloadable, IS 962 title block
- **3D Viewer** (Three.js): 4 interactive views —
  - Cross-Section (pipe in trench with bedding)
  - Longitudinal Section (pipe barrel + road profile)
  - Full 3D Model (pipe + wingwalls + embankment)
  - Alignment Map (road + culvert pins)

### BOQ Generation
- Auto-generated Bill of Quantities per culvert
- Items: excavation, bedding, pipes (IS 458), wingwalls (RCC), apron (PCC), backfill
- Indicative rates (update with current SoR before tender use)

## Database Schema Overview

### MySQL (Relational — CulvertCAD_Core)
- `AspNetUsers`, `AspNetRoles` — Identity tables
- `Organisations`, `Projects`, `ProjectMembers`
- `PipeCatalog` — IS 458:2003 NP2/NP3/NP4 pipe data (seeded)
- `CulvertDesigns`, `DesignRevisions`, `RevisionStatusHistory`, `RevisionComments`
- `AuditLogs`

### MongoDB (Document — CulvertCAD_Documents)
- `surveys` — Raw survey points, TBMs, detected culvert locations
- `calc_results` — Full IS-code calculation results with step-by-step trail
- `drawings` — DXF byte data, title block info, entity records
- `alignments` — Horizontal/vertical alignment data
- `batch_runs` — Batch design run tracking (for future terrain-driven auto-design)

## Extending the System

### Adding Terrain/Alignment-Driven Auto-Design (Future Phase)
The `AlignmentDocument` and `BatchDesignRunDocument` MongoDB models are already
in place. To complete the terrain pipeline:
1. Add a D8 flow analysis service in `CulvertCAD.Infrastructure/Terrain/`
2. Add LandXML/KML alignment parsers alongside the existing CSV survey parser
3. Wire up Hangfire (already referenced) for background batch processing

### Adding PDF Calculation Reports
QuestPDF is already referenced in `CulvertCAD.Infrastructure.csproj`.
Add a `PdfReportService` similar to `BOQService` using the same calculation
result documents from MongoDB.

## Support

This is a generated reference implementation. Before production use:
- Review and update BOQ rates to current Schedule of Rates
- Add comprehensive input validation (FluentValidation is referenced)
- Add HTTPS certificate configuration for production deployment
- Review and harden the JWT/cookie security settings
- Add comprehensive unit tests (test project scaffold included)
