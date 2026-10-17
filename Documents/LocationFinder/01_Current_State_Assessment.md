# CulvertCAD — Culvert Location Finder Refactor Assessment

**Assessment basis:** `CulvertCAD_Complete_Source (1).zip` and the Markdown documentation included in that archive.  
**Target scope:** Steps 1–5 only. Manual location adjustment/review workflows and integration into the existing culvert-design workflow are explicitly on hold.  
**Important:** This is a source inspection, not a fresh build/test run. Existing application behaviour is treated as the working baseline; no code was changed for this assessment.

## 1. Updated objective

CulvertCAD must take:
1. Survey data describing terrain points, coordinates, elevations and feature codes.
2. A separately provided, prescribed road alignment (horizontal geometry and, where available, formation/vertical alignment).

It must then analyse terrain around and along that fixed alignment, identify *potential* drainage crossings/culvert locations, and display the alignment, terrain/contours/elevations and candidate locations on a Leaflet map.

The system is **not** to generate or optimize the road alignment. It is **not** to implement manual adjustment/approval or create designs from detected locations in this phase. Existing culvert design capability remains intact but outside the active scope of this work.

## 2. Executive assessment

The source has a starting point for survey CSV import and a simple rule that groups survey points explicitly coded as existing culverts. It does **not yet implement the required Culvert Location Finder end-to-end**.

| Scope item | Current source evidence | Assessment |
|---|---|---|
| 1. Import survey data | `SurveyImportService.ParseCsvAsync` accepts a five-column CSV: PointNo, Northing, Easting, RL, Code; stores survey points/TBMs in a `SurveyDocument`. | Partial foundation. Input validation, import diagnostics, CRS/units and reliable CSV handling are missing or limited. |
| 2. Import provided alignment | `AlignmentDocument`, `AlignmentPoint`, `VerticalPoint`, `IAlignmentRepository` and Mongo repository exist. `ProjectsController` injects `IAlignmentRepository`, but no alignment import controller/service/view is present in the inspected source. | Data model/storage foundation only; user-facing import and validation path appears missing. |
| 3. Analyse terrain around fixed alignment | Survey chainage is derived by sorting centreline points by Northing. No terrain surface, TIN/DEM interpolation, contour generation, drainage-path or flow analysis was found in the inspected source. | Major implementation gap. Current chainage logic is not reliable for curved alignments. |
| 4. Automatically detect potential culvert locations | `DetectCulvertLocations` returns no candidates unless survey records already have the `ExistingCulvert` code; it clusters those points within 25 m. | Does not meet the new objective. It detects/group existing culvert survey codes, not new potential drainage crossings. |
| 5. Leaflet map | `culvert-3d-viewer.js` has an “Alignment Map” view using Three.js and `generateDemoAlignment()` / `generateDemoCulverts()` fallbacks. | Not a Leaflet location-finder map; it is a demo-oriented 3D viewer. |
| Scope boundary | `Review.cshtml` exposes confirmation and `CreateDesignFromLocation`; controller contains `ConfirmLocation` and `CreateDesignFromLocation`. | These workflows must be held out of the new task as requested; do not delete them or disrupt existing design functionality. |

## 3. Specific code findings

### 3.1 Survey import

**File:** `CulvertCAD.Application/Services/SurveyImportService.cs`

Current behaviour:
- Parses a fixed five-column CSV layout.
- Silently skips rows with too few columns or values that fail numeric parsing.
- Uses `line.Split(',')`, which is not a complete CSV parser for quoted values containing commas.
- Does not return an import report showing accepted/rejected rows and reasons.
- Does not record coordinate reference system, horizontal/vertical units, datum, or survey-source metadata.
- Calculates min/max extents and elevations, then calls `ComputeChainages` and `DetectCulvertLocations`.

Refactor recommendation:
- Keep survey parsing separate from analysis.
- Add an explicit import contract/profile: required columns, coordinate fields, elevation field, feature-code field, units, CRS/datum and optional metadata.
- Validate file type, size, header, duplicate point identifiers, finite numeric values, empty/invalid rows, and plausible coordinate/elevation values.
- Return a structured import result with counts and row-level errors/warnings instead of silently skipping bad rows.
- Use a proper CSV parser.
- Preserve the original imported observations; analysis should not overwrite or confuse raw survey data with derived results.

### 3.2 Chainage and alignment relationship

**Files:** `SurveyImportService.cs`, `MongoDocuments.cs`

Current behaviour:
- `ComputeChainages` orders centreline survey points by Northing before accumulating distances.
- Existing culvert and TBM chainages are assigned from the nearest centreline survey point.
- This assumes Northing order approximates route order, which can fail for curved, reversing or looping alignments.
- It also assumes surveyed centreline points define the route, whereas the updated objective says the prescribed alignment is provided separately.

Refactor recommendation:
- Treat the imported alignment as authoritative for road chainage.
- Preserve the alignment's own station/chainage if supplied; otherwise calculate cumulative chainage in the actual alignment point order, after validating geometry and direction.
- Project each terrain point onto the nearest suitable alignment segment to obtain offset and chainage; do not derive chainage by sorting terrain points.
- Keep alignment chainage, perpendicular offset, survey point ID and coordinate reference together in analysis outputs.
- Define tolerances for alignment corridor width and nearest-segment matching; flag ambiguous/off-corridor points rather than inventing a match.

### 3.3 Alignment import

**Existing foundation:**
- `AlignmentDocument` stores `HorizontalPoints`, `VerticalPoints`, `TotalLengthM`, `InputFormat`, and `HasVerticalAlignment`.
- `IAlignmentRepository` and `AlignmentRepository` support storage and retrieval.
- `Project` has an `AlignmentCollectionId`; `ProjectDto` has `HasAlignment`.

**Gap:** In the inspected source, there is no complete user-facing alignment import/validation path to populate these structures.

Refactor recommendation:
- Add an alignment import service with separate format adapters, initially supporting only the alignment format the project can reliably receive (decide this before implementation).
- Validate point order, duplicate chainages, coordinate values, geometry continuity, length and optional vertical profile.
- Persist source filename/format, CRS/datum, units, import timestamp, validation status and alignment version.
- Connect the stored alignment to its project and show a clear alignment-import status.
- Do not treat survey centreline points as a substitute for the prescribed design alignment unless the user explicitly chooses that input mode.

### 3.4 Terrain surface and contour analysis

**Finding:** No terrain-surface builder or terrain-analysis pipeline was found in the inspected source. Survey points are stored, but storage alone does not create a usable terrain surface.

Refactor recommendation:
- Introduce a terrain-analysis layer that can create a validated surface from surveyed XYZ/RL points. Choose and document the supported method (for example, a TIN from suitable survey points); do not silently assume that every point is suitable for triangulation.
- Keep breaklines, boundaries, excluded points and feature codes where the input provides them.
- Generate contours only if required from the validated surface, or import existing contour data as a distinct source. Do not present interpolated contours as surveyed observations.
- Record surface method, source survey version, units, CRS/datum, interpolation limits and warnings.
- Identify insufficient coverage, large data gaps, duplicate coordinates, and unsupported extrapolation. Do not extrapolate a surface without warning beyond the surveyed coverage.

### 3.5 Potential culvert detection

**File:** `SurveyImportService.cs`, method `DetectCulvertLocations`

Current behaviour:
- It returns an empty list if there are no points coded as existing culverts.
- It groups `ExistingCulvert` points within a hard-coded 25 m radius.
- It derives candidate invert RL from the average RL of those existing-culvert-coded points.
- It uses the nearest centreline point's RL as road RL, with a fallback `avgInvRL + 0.5`.
- It calculates a local slope from centreline RL and falls back to 0.5 when insufficient points exist.
- Those results describe grouped *existing* features, not independently detected new drainage crossings.

Refactor recommendation:
- Separate **existing-culvert recognition** from **new candidate detection**. Existing culverts are useful validation/training/reference features, not a prerequisite for finding new candidates.
- Candidate detection should analyse the terrain surface and its relationship to the fixed alignment: catchment flow paths or drainage lines intersecting the alignment, valleys/depressions, cross-drainage routes and topographic convergence.
- Define the data and method needed to infer flow direction/accumulation. If only sparse survey points are available and hydrologic terrain analysis cannot be supported, label the result as a lower-confidence terrain-screening candidate rather than claiming a definitive drainage crossing.
- For each candidate, store at minimum: stable ID, alignment chainage, projected coordinates, offset, evidence/reason codes, nearby terrain elevations, contributing survey/surface source, confidence/quality flags, and whether it coincides with an existing culvert.
- Avoid fabricated defaults for invert RL, road RL, slope or fill height. These are not needed merely to locate a candidate; compute them only when the required source data supports them.
- Detection output in this phase is **suggested location only**, not design approval.

### 3.6 Leaflet map

**File:** `CulvertCAD.Web/wwwroot/js/drawing/culvert-3d-viewer.js`

Current behaviour:
- The “Alignment Map” is part of the Three.js 3D viewer.
- It uses `generateDemoAlignment()` and `generateDemoCulverts()` as fallbacks.
- No Leaflet-based location-finder implementation was found in the inspected source.

Refactor recommendation:
- Build a separate project-level Leaflet map page for location finding; do not repurpose or break the existing 3D culvert viewer.
- Render the actual prescribed alignment, terrain/survey point layers, contour layer (only when sourced/generated), and candidate culvert markers from project data.
- Include useful layer toggles and a legend, scale, coordinate/chainage readout and loading/error/empty states.
- Use a consistent coordinate reference and transform data to the map's required CRS correctly. Do not plot raw projected Easting/Northing as longitude/latitude.
- Map display must clearly distinguish raw survey points, imported alignment, derived terrain/contours, existing culverts and algorithm-suggested candidates.
- For this phase, map interactions are for viewing and inspecting information only. Manual adjustment/confirmation and design-creation actions remain out of scope.

## 4. Recommended target architecture

Keep the existing clean separation between projects, application services, Core models and Infrastructure persistence. Add a dedicated location-finder pipeline rather than placing more logic in `SurveyImportService`.

Suggested responsibilities:

- **Core**
  - `SurveyImportModel` / existing survey entities, with explicit coordinate metadata.
  - `AlignmentDocument` and alignment point models, strengthened with CRS/unit/source/version metadata.
  - `TerrainSurfaceModel` and `TerrainAnalysisResultModel`.
  - `CulvertCandidateModel` (or a candidate entity distinct from existing `DetectedCulvertLocation` if the existing model is tightly coupled to design creation).
  - DTOs for import report, analysis summary, candidate list and map layers.
- **Application**
  - `SurveyImportService`: parse and validate source observations only.
  - `AlignmentImportService`: parse and validate the prescribed alignment.
  - `AlignmentProjectionService`: project survey/terrain points to alignment chainage and offset.
  - `TerrainSurfaceService`: build or load a supported terrain representation.
  - `TerrainAnalysisService`: derive terrain/drainage evidence.
  - `CulvertLocationDetectionService`: produce candidate locations and evidence.
  - `LocationMapDataService`: prepare actual project data for map display.
- **Infrastructure**
  - Repository persistence for source survey, alignment, terrain/surface outputs and analysis results.
  - Keep raw inputs separate from derived analysis so re-running analysis does not corrupt original imports.
- **Web**
  - Survey upload/status page.
  - Prescribed alignment import/status page.
  - Analysis run/results page.
  - Separate Leaflet map page.
  - No new manual candidate editing/approval or design-creation integration in this phase.

Names are recommendations, not a requirement to create every class immediately. Introduce only the components needed for each tested slice.

## 5. Data and engineering decisions required before coding

These must be answered from actual project input formats or explicit project decisions. Do not guess:

1. **Survey format:** Is the input always the current five-column CSV, or are there real files with headers, extra columns, feature-code variations or multiple formats?
2. **Coordinate reference:** What CRS/datum are Northing/Easting in? What are the horizontal and vertical units?
3. **Alignment source format:** What exact file is supplied for the fixed alignment (CSV, LandXML, DXF, shapefile/GeoJSON, or another format)? Does it include chainage and vertical formation profile?
4. **Terrain source:** Is the surface to be derived from point survey data, supplied as contours, supplied as a DEM/TIN, or some combination?
5. **Available drainage evidence:** Are there surveyed drainage/stream lines, flow direction, catchment boundaries or only XYZ points and feature codes?
6. **Candidate rule:** What qualifies as a candidate in this project—every terrain-derived drainage path crossing the alignment, a defined contributing catchment threshold, survey-coded drainage features, or a combination?
7. **Map extent/performance:** Typical corridor width, point count and maximum route length. This determines whether surface processing and map data must be tiled or simplified.
8. **Meaning of “surface”:** Confirm whether this means existing-ground terrain only, or whether design/formation levels are also supplied as a vertical alignment.

These decisions affect whether the application can perform real drainage-network detection or only identify terrain-screening candidates from the available evidence.

## 6. Refactor order — limited to Steps 1–5

### Phase A — Freeze and document the working baseline
- Preserve the current buildable project.
- Capture current survey upload/review behaviour and representative test files.
- Do not change culvert-design calculations or structural services for this scope.

### Phase B — Make source inputs reliable
- Improve survey import validation and diagnostics.
- Implement prescribed alignment import and validation.
- Persist coordinate systems, units, source files and versions.
- Test malformed files, empty data, duplicates and incompatible coordinate metadata.

### Phase C — Use the supplied alignment as the chainage authority
- Implement point-to-alignment projection.
- Test straight, curved and reversing alignments with known chainages and offsets.
- Stop relying on sorting centreline points by Northing.

### Phase D — Build terrain and derive drainage evidence
- Choose the supported terrain input/surface method.
- Add coverage/quality checks.
- Produce terrain and drainage evidence that can be explained and traced to source data.

### Phase E — Detect candidate locations
- Keep existing-culvert detection separate.
- Implement candidate generation from terrain/drainage crossings against the fixed alignment.
- Add deterministic test cases with known crossing locations and known non-crossings.
- Store why each candidate was proposed and any limitations.

### Phase F — Build the Leaflet map
- Add actual alignment, survey/surface/contour and candidate layers.
- Remove demo fallbacks from the new location-finder map.
- Test that map coordinates are transformed correctly and candidates line up with the alignment.

### Phase G — Verify end-to-end
- Import survey → import fixed alignment → validate/build terrain → analyse → detect candidates → display on Leaflet.
- Verify long alignments and realistic survey volumes.
- Confirm the existing culvert-design workflow still builds and behaves as before.
- Do not include manual location adjustment/approval or create-design integration in acceptance criteria for this phase.

## 7. Existing workflows to hold out of this task

The current `Survey/Review.cshtml` includes confirmation status and “Create Design” actions; `SurveyController` has `ConfirmLocation` and `CreateDesignFromLocation`. These are outside the updated Steps 1–5 scope.

For now:
- Do not expand or redesign those workflows.
- Do not delete them as part of this task; preserve existing functionality.
- Keep the new candidate/map pipeline decoupled so future adjustment/approval and design handoff can be addressed as a separate project task.

## 8. Documentation organization

Recommended folder inside the repository:

```text
Documents/
  Engineering/                 # Existing design/engineering reference documents
  CulvertLocationFinder/
    00_Objective_and_Scope.md
    01_Current_State_Assessment.md
    02_Input_Data_Contracts.md
    03_Terrain_and_Drainage_Method.md
    04_Candidate_Detection_Rules.md
    05_Leaflet_Map_Requirements.md
    06_Implementation_Roadmap.md
    07_Test_and_Acceptance_Plan.md
```

Keep the existing engineering decision registers and fault audits as historical records for the culvert-design subsystem. Do not silently repurpose or overwrite them as the location-finder specification. Add a new location-finder requirements/decision log and a separate implementation status log. Move/rename existing Markdown files only after checking references and Git history.

## 9. Acceptance criteria for the new objective

The location finder is ready for its first useful release when it can:

1. Import a valid survey dataset and report rejected/accepted records.
2. Import and validate the provided alignment without generating a new alignment.
3. Reliably assign chainage/offset relative to the provided alignment.
4. Build or consume a defined terrain representation and disclose its limitations.
5. Generate candidate drainage crossings without requiring existing-culvert codes.
6. Explain the evidence for each candidate and distinguish it from surveyed existing culverts.
7. Show the actual alignment and actual candidates on a Leaflet map with correct coordinates.
8. Run end-to-end reproducibly on a representative corridor and preserve existing design functionality.
9. Avoid any manual adjustment, approval or design-creation requirement in this phase.

## 10. Immediate next step

Before changing code, confirm the **actual alignment input format and the actual survey/terrain input format** using representative files. Then implement Phase B only: input contracts, validation and alignment import. Do not start by rewriting the current detector or map; their correct design depends on those input contracts.
