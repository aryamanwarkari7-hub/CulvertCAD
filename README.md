# CulvertCAD — Pipe Culvert Location & 3D CAD Visualization System

**CulvertCAD Location** is an enterprise-grade ASP.NET Core 8 MVC engineering application for road culvert location identification, geospatial survey processing, terrain visualization, and 2D/3D CAD integration.

---

## Key Features

### 1. Geospatial Survey & Culvert Detection
- **Survey CSV Import**: Parses total station / GPS survey points in Grid (Easting/Northing) or Geodetic (Lat/Long) coordinates with automatic UTM zone conversion.
- **Centerline Road Alignment**: Imports LandXML and DXF alignments, computing chainages, gradients, and perpendicular offsets.
- **Automated Culvert Discovery**: Spatial clustering algorithms detect existing culverts (`EX_CD`), bridges, and drainage structures along the surveyed road alignment.
- **Interactive 3D Terrain Map**: Three.js + Leaflet dual visualization with Delaunay TIN mesh, elevation contours, and clickable culvert markers.
- **Engineering Review & Confirmation**: Verified culvert locations transition from Candidate (`Pending`) to `Confirmed` with a single click.

### 2. Surveys Directory Workspace (`/Survey`)
- **Centralized Management**: Dedicated directory page listing all road corridor surveys across accessible projects.
- **Live Statistics**: Real-time aggregation of surveys loaded, total points processed, detected culvert locations, and confirmed structures.
- **Instant Search & Filter**: Filter by project name, road, code, or CSV filename, with filter pills (`All`, `Survey Loaded`, `No Survey`, `With Culverts`) and a dedicated project selector.
- **Dual Display Modes**: Responsive cards grid and high-density table view with instant state preservation.

### 3. Integrated CAD Viewers (2D & 3D)
- **2D Drawing Viewer (`/CadDrawings`)**:
  - HTML5 canvas-based DXF viewer with pan, zoom, layer visibility toggle, and measure tools.
  - Auto-saves parsed 2D DXF drawings to MongoDB with 1-click loading from the "Recent Drawings" drawer.
- **3D Solid Viewer (`/CadSolidViewer`)**:
  - Interactive Three.js viewer for standalone HTML solid models and binary/ASCII STL meshes.
  - Auto-saves models to MongoDB with Base64 encoding to prevent binary float byte corruption.
  - Engineering metrics cards: surface area, bounding dimensions, mesh complexity, and units inspection.
- **Isolated Storage**: 2D DXF (`2D_DXF`), 3D HTML Solids (`3D_SOLID`), and 3D STL meshes (`3D_STL`) are stored independently in MongoDB per project without collision.

### 4. Project & User Management
- **Role-Based Access Control**: `SuperAdmin`, `Admin`, `Engineer`, and `Viewer` roles.
- **Modern Dashboard**: High-level statistics, quick navigation, and responsive project cards with styled action triggers.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | ASP.NET Core 8.0 MVC (C#) |
| **Relational Database** | MySQL 8.x via Entity Framework Core (Projects, Members, Identity) |
| **Document Database** | MongoDB 6.x / 7.x (Surveys, Alignments, Culvert Solids, 2D DXFs) |
| **CAD & 3D Graphics** | netDxf, Three.js (r128), OrbitControls, Delaunator.js, Leaflet 1.9 |
| **Geospatial Projections** | ProjNet4GeoAPI (UTM / WGS84 transformations) |
| **Styling** | Custom Dark CAD Theme CSS, Bootstrap Icons 1.11 |

---

## Architecture & Database Schemas

### Relational Context (MySQL)
- `Projects`: Metadata, Client, Road Name, Status, Chainage Range.
- `ProjectMembers`: User assignment and role-based permissions.
- `AspNetUsers`: Identity authentication and user profiles.

### Document Collections (MongoDB `CulvertCAD_Documents`)
- `surveys`: `SurveyDocument` containing raw points, TBMs, and `DetectedCulverts` array (`LocationIndex`, `Chainage`, `InvertRL`, `RoadRL`, `IsConfirmed`).
- `alignments`: `AlignmentDocument` with horizontal and vertical road alignment geometry.
- `culvert_solids`: `CulvertSolidDocument` keyed by `(ProjectId, ModelType)` storing 2D/3D models, geometry JSON, Base64 STL binaries, and file metadata.

---

## Getting Started

### Prerequisites
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [MySQL Server 8.0+](https://dev.mysql.com/downloads/mysql/)
- [MongoDB Community Server 6.0+](https://www.mongodb.com/try/download/community)

### Configuration
Update connection strings in `CulvertCAD.Web/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=culvertcad;User=root;Password=your_password;",
    "MongoConnection": "mongodb://localhost:27017",
    "MongoDatabase": "CulvertCAD_Documents"
  }
}
```

### Running the Application

```bash
# 1. Restore & Build
dotnet build

# 2. Run Tests
dotnet test

# 3. Launch Web Application
dotnet run --project CulvertCAD.Web
```

Access the application in your browser at `https://localhost:58709` or `http://localhost:58710`.
