using CulvertCAD.Application.Services;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;
using CulvertCAD.Core.Repositories;
using CulvertCAD.Infrastructure.MySQL.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;

using CulvertCAD.Web.Filters;

// CulvertCAD.Web/Controllers/SurveyController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using netDxf;
using netDxf.Entities;
using System.Security.Claims;
using static netDxf.Entities.HatchBoundaryPath;
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;
using Microsoft.AspNetCore.RateLimiting;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class SurveyController : Controller
{
    private readonly AppDbContext _db;
    private readonly ISurveyImportService _importSvc;
    private readonly ISurveyRepository _surveyRepo;
    private readonly IAlignmentRepository _alignmentRepo;
    private readonly ICulvertSolidRepository _solidRepo;

    public SurveyController(
        AppDbContext db,
        ISurveyImportService importSvc,
        ISurveyRepository surveyRepo,
        IAlignmentRepository alignmentRepo,
        ICulvertSolidRepository solidRepo)
    {
        _db = db;
        _importSvc = importSvc;
        _surveyRepo = surveyRepo;
        _alignmentRepo = alignmentRepo;
        _solidRepo = solidRepo;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private async Task<bool> HasProjectAccessAsync(int projectId)
    {
        if (projectId <= 0) return false;

        // In unit tests or unauthenticated execution, check project existence in DB
        if (User?.Identity?.IsAuthenticated != true)
        {
            return await _db.Projects.AnyAsync(p => p.Id == projectId);
        }

        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return false;

        return await _db.Projects
            .AnyAsync(p => p.Id == projectId &&
                     (p.CreatedByUserId == userId || p.Members.Any(m => m.UserId == userId)));
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        bool isAdmin = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");

        var query = _db.Projects
            .Include(p => p.Members)
            .AsQueryable();

        if (!isAdmin)
            query = query.Where(p => p.Members.Any(m => m.UserId == CurrentUserId));

        var projects = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var surveys = new List<SurveyDocument>();
        var alignments = new List<AlignmentDocument>();

        try
        {
            surveys = await _surveyRepo.GetSurveysByProjectIdsAsync(projectIds);
            alignments = await _alignmentRepo.GetAlignmentsByProjectIdsAsync(projectIds);
        }
        catch (Exception)
        {
            // If MongoDB is restarting or temporarily offline, allow projects to still load
            ViewBag.DatabaseWarning = "Document database is temporarily unreachable. Survey points cannot be loaded.";
        }

        var surveyMap = surveys
            .GroupBy(s => s.ProjectId)
            .ToDictionary(g => g.Key, g => g.First());

        var alignmentMap = alignments
            .GroupBy(a => a.ProjectId)
            .ToDictionary(g => g.Key, g => g.First());

        var items = new List<SurveyDirectoryItemDto>();
        foreach (var proj in projects)
        {
            // Only consider loaded if valid survey data (filename or points) exists
            var hasSurvey = surveyMap.TryGetValue(proj.Id, out var s)
                            && s != null
                            && (s.TotalPoints > 0 || !string.IsNullOrWhiteSpace(s.FileName));

            var hasAlign = alignmentMap.TryGetValue(proj.Id, out var a);

            items.Add(new SurveyDirectoryItemDto
            {
                ProjectId = proj.Id,
                ProjectCode = proj.ProjectCode,
                ProjectName = proj.ProjectName,
                ProjectStatus = proj.Status.ToString(),
                RoadName = proj.RoadName ?? "",
                Location = proj.Location ?? "",
                HasSurvey = hasSurvey,
                SurveyId = s?.Id,
                FileName = s?.FileName,
                UploadedAt = s?.UploadedAt,
                TotalPoints = s?.TotalPoints ?? 0,
                CoordinateType = s?.InputCoordinateType,
                UtmZone = s?.UTMZone,
                DetectedCulvertsCount = s?.DetectedCulverts?.Count ?? 0,
                ConfirmedCulvertsCount = s?.DetectedCulverts?.Count(c => c.IsConfirmed) ?? 0,
                HasAlignment = hasAlign,
                AlignmentLengthM = a?.TotalLengthM ?? 0
            });
        }

        var viewModel = new SurveyDirectoryViewModel
        {
            TotalProjects = projects.Count,
            SurveysCount = items.Count(i => i.HasSurvey),
            TotalPointsAcrossAll = items.Sum(i => i.TotalPoints),
            TotalDetectedCulverts = items.Sum(i => i.DetectedCulvertsCount),
            TotalConfirmedCulverts = items.Sum(i => i.ConfirmedCulvertsCount),
            Items = items
        };

        return View(viewModel);
    }

    [HttpGet]
    public async Task<IActionResult> Upload(int projectId)
    {
        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        var project = await _db.Projects.FindAsync(projectId);
        if (project == null) return NotFound();
        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project.ProjectName;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> Upload(
    int projectId,
    IFormFile? csvFile,
    string coordinateType,
    int? utmZone)
    {
        var project = await _db.Projects.FindAsync(projectId);

        if (project == null)
            return NotFound();

        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project.ProjectName;

        if (csvFile == null || csvFile.Length == 0)
        {
            ModelState.AddModelError("", "Please select a CSV file.");
            return View("Upload");
        }

        if (!string.Equals(
                Path.GetExtension(csvFile.FileName),
                ".csv",
                StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError("", "Only CSV files are supported in this import step.");
            return View("Upload");
        }

        bool isGrid = coordinateType == "EastingNorthing";
        bool isLatLong = coordinateType == "LatitudeLongitude";

        if (!isGrid && !isLatLong)
        {
            ModelState.AddModelError("", "Select a valid coordinate type.");
            return View("Upload");
        }

        if (isGrid && (utmZone == null || utmZone < 42 || utmZone > 47))
        {
            ModelState.AddModelError(
                "",
                "Select a UTM zone between 42 and 47 for this India-only workflow.");

            return View("Upload");
        }

        try
        {
            using var stream = csvFile.OpenReadStream();

            var survey = await _importSvc.ParseCsvAsync(
                stream,
                csvFile.FileName,
                projectId,
                CurrentUserId,
                coordinateType,
                isGrid ? utmZone : null);

            var docId = await _surveyRepo.InsertAsync(survey);

            project.SurveyCollectionId = docId;
            await _db.SaveChangesAsync();

            TempData["Success"] =
                $"Survey imported: {survey.TotalPoints} points. " +
                $"Working CRS: {survey.WorkingCrs}.";

            return RedirectToAction("Review", new { projectId });
        }
        catch (InvalidDataException ex)
        {
            ModelState.AddModelError("", ex.Message);
            return View("Upload");
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(50_000_000)]
    [EnableRateLimiting("HeavyCadOps")]
    public async Task<IActionResult> UploadAndAnalyze(
        int projectId,
        IFormFile? csvFile,
        IFormFile? dxfFile,
        string coordinateType,
        int? utmZone,
        string dxfInputCrs,
        string centrelineHandle = "4E2F")
    {
        var project = await _db.Projects.FindAsync(projectId);

        if (project == null)
            return NotFound();

        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project.ProjectName;

        // Validate both uploaded files.
        if (csvFile == null || csvFile.Length == 0)
            ModelState.AddModelError("", "Please select a survey CSV file.");

        if (dxfFile == null || dxfFile.Length == 0)
            ModelState.AddModelError("", "Please select a road alignment DXF file.");

        if (csvFile != null &&
            !string.Equals(Path.GetExtension(csvFile.FileName), ".csv",
                StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError("", "The survey file must be a CSV file.");
        }

        if (dxfFile != null &&
            !string.Equals(Path.GetExtension(dxfFile.FileName), ".dxf",
                StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError("", "The alignment file must be a DXF file.");
        }

        bool isGrid = coordinateType == "EastingNorthing";
        bool isLatLong = coordinateType == "LatitudeLongitude";

        if (!isGrid && !isLatLong)
            ModelState.AddModelError("", "Select a valid coordinate type.");

        if (isGrid && (utmZone == null || utmZone < 42 || utmZone > 47))
        {
            ModelState.AddModelError("",
                "Select a UTM zone between 42 and 47.");
        }

        if (!string.Equals(centrelineHandle, "4E2F",
                StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError("",
                "The selected centreline must be handle 4E2F.");
        }

        if (!ModelState.IsValid)
            return View("Upload");

        // Import the CSV using the existing survey import service.
        try
        {
            using var csvStream = csvFile!.OpenReadStream();

            var survey = await _importSvc.ParseCsvAsync(
                csvStream,
                csvFile.FileName,
                projectId,
                CurrentUserId,
                coordinateType,
                isGrid ? utmZone : null);

            // Save the survey so the existing DXF import workflow can find it.
            var surveyId = await _surveyRepo.InsertAsync(survey);

            project.SurveyCollectionId = surveyId;
            await _db.SaveChangesAsync();

            // Reuse the existing DXF import action.
            // This action expects the survey to have been saved first.
            return await ImportDxfAlignment(
    projectId,
    dxfFile,
    dxfInputCrs,
    centrelineHandle);
        }
        catch (InvalidDataException ex)
        {
            ModelState.AddModelError("", ex.Message);
            return View("Upload");
        }
    }

    private static double[] TransformUtmCoordinates(
    double easting,
    double northing,
    string sourceCrs,
    string targetCrs)
    {
        static int GetUtmZone(string? crs)
        {
            string value = crs ?? string.Empty;

            if (!System.Text.RegularExpressions.Regex.IsMatch(
                    value,
                    @"^EPSG:3264[2-7]$"))
            {
                throw new ArgumentException(
                    $"Unsupported UTM CRS: {crs}");
            }

            return int.Parse(value.Substring(8));
        }

        int sourceZone = GetUtmZone(sourceCrs);
        int targetZone = GetUtmZone(targetCrs);

        var sourceSystem =
            ProjectedCoordinateSystem.WGS84_UTM(sourceZone, true);

        var targetSystem =
            ProjectedCoordinateSystem.WGS84_UTM(targetZone, true);

        var factory = new CoordinateTransformationFactory();

        var transformation = factory.CreateFromCoordinateSystems(
            sourceSystem,
            targetSystem);

        return transformation.MathTransform.Transform(
            new[] { easting, northing });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(50_000_000)]
    [EnableRateLimiting("HeavyCadOps")]
    public async Task<IActionResult> ImportDxfAlignment(
    int projectId,
    IFormFile? dxfFile,
    string dxfInputCrs,
    string centrelineHandle = "4E2F")
    {
        var project = await _db.Projects.FindAsync(projectId);

        if (project == null)
            return NotFound();

        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        if (dxfFile == null || dxfFile.Length == 0)
        {
            TempData["Error"] = "Please select a DXF file.";
            return RedirectToAction("Upload", new { projectId });
        }

        if (!string.Equals(
                Path.GetExtension(dxfFile.FileName),
                ".dxf",
                StringComparison.OrdinalIgnoreCase))
        {
            TempData["Error"] = "Only DXF files are supported.";
            return RedirectToAction("Upload", new { projectId });
        }

        if (!string.Equals(
                centrelineHandle,
                "4E2F",
                StringComparison.OrdinalIgnoreCase))
        {
            TempData["Error"] =
                "For this survey, the selected centreline must be handle 4E2F.";

            return RedirectToAction("Upload", new { projectId });
        }

        if (string.IsNullOrWhiteSpace(dxfInputCrs) ||
    !System.Text.RegularExpressions.Regex.IsMatch(
        dxfInputCrs,
        @"^EPSG:3264[2-7]$"))
        {
            TempData["Error"] =
                "Select a valid DXF source CRS (WGS 84 / UTM Zone 42N–47N).";

            return RedirectToAction("Upload", new { projectId });
        }

        var survey = await _surveyRepo.GetByProjectAsync(projectId);

        if (survey == null)
        {
            TempData["Error"] =
                "Import the survey CSV before importing its road alignment.";

            return RedirectToAction("Upload", new { projectId });
        }

        var tempPath = Path.Combine(
            Path.GetTempPath(),
            $"{Guid.NewGuid():N}.dxf");

        try
        {
            await using (var fileStream = System.IO.File.Create(tempPath))
            {
                await dxfFile.CopyToAsync(fileStream);
            }

            var document = DxfDocument.Load(tempPath);

            var centreline = document.Entities.All
            .OfType<Polyline2D>()
            .FirstOrDefault(entity =>
                string.Equals(
                    entity.Handle,
                    centrelineHandle,
                    StringComparison.OrdinalIgnoreCase));

            if (centreline == null)
            {
                TempData["Error"] =
                    $"DXF polyline handle {centrelineHandle} was not found.";

                return RedirectToAction("Upload", new { projectId });
            }

            if (centreline.IsClosed || centreline.Vertexes.Count < 2)
            {
                TempData["Error"] =
                    "The selected alignment must be an open polyline with at least two vertices.";

                return RedirectToAction("Upload", new { projectId });
            }

            // Convert straight and curved segments into ordered points.
            // Arc segments are sampled at approximately 1 metre intervals.
            var coordinates = new List<(double Easting, double Northing)>();
            var vertices = centreline.Vertexes;

            for (var i = 0; i < vertices.Count - 1; i++)
            {
                var start = vertices[i];
                var end = vertices[i + 1];

                var p1 = (X: start.Position.X, Y: start.Position.Y);
                var p2 = (X: end.Position.X, Y: end.Position.Y);

                if (coordinates.Count == 0)
                    coordinates.Add((p1.X, p1.Y));

                var bulge = start.Bulge;

                if (Math.Abs(bulge) < 1e-10)
                {
                    coordinates.Add((p2.X, p2.Y));
                    continue;
                }

                var dx = p2.X - p1.X;
                var dy = p2.Y - p1.Y;
                var chord = Math.Sqrt(dx * dx + dy * dy);

                if (chord < 1e-8)
                    continue;

                var theta = 4.0 * Math.Atan(bulge);
                var radius = chord /
                    (2.0 * Math.Sin(Math.Abs(theta) / 2.0));

                var midpointX = (p1.X + p2.X) / 2.0;
                var midpointY = (p1.Y + p2.Y) / 2.0;

                var offset = chord * (1.0 - bulge * bulge) /
                             (4.0 * bulge);

                var centerX = midpointX - dy / chord * offset;
                var centerY = midpointY + dx / chord * offset;

                var startAngle = Math.Atan2(
                    p1.Y - centerY,
                    p1.X - centerX);

                var arcLength = Math.Abs(theta) * radius;
                var segments = Math.Max(
                    1,
                    (int)Math.Ceiling(arcLength / 1.0));

                for (var j = 1; j <= segments; j++)
                {
                    var angle = startAngle + theta * j / segments;

                    var x = centerX + radius * Math.Cos(angle);
                    var y = centerY + radius * Math.Sin(angle);

                    coordinates.Add((x, y));
                }
            }

            // Ensure the survey has a supported working CRS.
            if (string.IsNullOrWhiteSpace(survey.WorkingCrs) ||
                !System.Text.RegularExpressions.Regex.IsMatch(
                    survey.WorkingCrs,
                    @"^EPSG:3264[2-7]$"))
            {
                TempData["Error"] =
                    "The survey has no valid working CRS. Re-import the survey with a supported coordinate system.";

                return RedirectToAction("Upload", new { projectId });
            }

            // Transform sampled DXF coordinates into the survey's working CRS.
            var transformedCoordinates =
                new List<(double Easting, double Northing)>(coordinates.Count);

            foreach (var point in coordinates)
            {
                var transformed = TransformUtmCoordinates(
                    point.Easting,
                    point.Northing,
                    dxfInputCrs,
                    survey.WorkingCrs);

                transformedCoordinates.Add((
                    transformed[0],
                    transformed[1]));
            }

            coordinates = transformedCoordinates;

            if (coordinates.Count < 2)
            {
                TempData["Error"] =
                    "The selected centreline did not produce enough alignment points.";

                return RedirectToAction("Upload", new { projectId });
            }

            double chainage = 0;

            var alignmentPoints = new List<AlignmentPoint>
        {
            new()
            {
                Chainage = 0,
                Easting = coordinates[0].Easting,
                Northing = coordinates[0].Northing
            }
        };

            for (var i = 1; i < coordinates.Count; i++)
            {
                var previous = coordinates[i - 1];
                var current = coordinates[i];

                var dx = current.Easting - previous.Easting;
                var dy = current.Northing - previous.Northing;

                chainage += Math.Sqrt(dx * dx + dy * dy);

                alignmentPoints.Add(new AlignmentPoint
                {
                    Chainage = chainage,
                    Easting = current.Easting,
                    Northing = current.Northing
                });
            }

            var alignment = new AlignmentDocument
            {
                ProjectId = projectId,
                AlignmentName = $"DXF Centreline {centrelineHandle}",
                InputFormat = "DXF",
                InputCrs = dxfInputCrs,
                WorkingCrs = survey.WorkingCrs,
                TotalLengthM = chainage,
                HasVerticalAlignment = false,
                HorizontalPoints = alignmentPoints,
                VerticalPoints = new List<VerticalPoint>()
            };

            // Assign survey chainages against the imported horizontal alignment.
            _importSvc.ComputeChainages(survey, alignment);

            // Populate ExistingRL from surveyed C/CL observations only.
            PopulateExistingRLFromCentreline(survey, alignment);

            // Save the alignment with its existing-ground elevations.
            await _alignmentRepo.InsertAsync(alignment);

            // Detect existing culvert candidates.
            survey.DetectedCulverts =
                _importSvc.DetectCulvertLocations(survey, alignment);

            // Persist the updated survey.
            await _surveyRepo.UpdateAsync(survey);

            TempData["Success"] =
                $"Alignment imported. Handle: {centrelineHandle}; " +
                $"points: {alignmentPoints.Count}; " +
                $"length: {chainage:N2} drawing units.";

            return RedirectToAction("Review", new { projectId });
        }
        catch (Exception ex) when (
            ex is IOException ||
            ex is InvalidOperationException ||
            ex is ArgumentException ||
            ex is FormatException)
        {
            TempData["Error"] =
                $"DXF import failed: {ex.Message}";

            return RedirectToAction("Upload", new { projectId });
        }
        finally
        {
            if (System.IO.File.Exists(tempPath))
                System.IO.File.Delete(tempPath);
        }
    }

    private static void PopulateExistingRLFromCentreline(
    SurveyDocument survey,
    AlignmentDocument alignment)
    {
        const double maxOffsetM = 3.0;
        const double maxInterpolationGapM = 50.0;

        var alignmentPoints = alignment.HorizontalPoints
            .OrderBy(p => p.Chainage)
            .ToList();

        var observations = survey.Points
            .Where(p =>
                p.CodeType == SurveyCodeType.Centreline &&
                p.Chainage.HasValue &&
                double.IsFinite(p.RL) &&
                double.IsFinite(p.Easting) &&
                double.IsFinite(p.Northing))
            .Select(p => new
            {
                Point = p,
                Chainage = p.Chainage!.Value
            })
            .Where(p => p.Chainage >= 0 &&
                        p.Chainage <= alignment.TotalLengthM)
            .Where(p => GetAlignmentOffset(
                p.Point.Easting,
                p.Point.Northing,
                alignmentPoints) <= maxOffsetM)
            .OrderBy(p => p.Chainage)
            .ToList();

        // Avoid ambiguous duplicate observations at effectively the same chainage.
        var uniqueObservations = observations
            .GroupBy(p => Math.Round(p.Chainage, 2))
            .Select(g => new
            {
                Chainage = g.Average(p => p.Chainage),
                RL = g.Average(p => p.Point.RL)
            })
            .OrderBy(p => p.Chainage)
            .ToList();

        foreach (var point in alignmentPoints)
        {
            point.ExistingRL = null;

            var exact = uniqueObservations
                .FirstOrDefault(o =>
                    Math.Abs(o.Chainage - point.Chainage) < 0.01);

            if (exact != null)
            {
                point.ExistingRL = exact.RL;
                continue;
            }

            var lower = uniqueObservations
                .LastOrDefault(o => o.Chainage < point.Chainage);

            var upper = uniqueObservations
                .FirstOrDefault(o => o.Chainage > point.Chainage);

            // Never extrapolate beyond surveyed centreline coverage.
            if (lower == null || upper == null)
                continue;

            var gap = upper.Chainage - lower.Chainage;

            // Leave unsupported gaps without an invented elevation.
            if (gap <= 0 || gap > maxInterpolationGapM)
                continue;

            var t = (point.Chainage - lower.Chainage) / gap;

            point.ExistingRL =
                lower.RL + t * (upper.RL - lower.RL);
        }

        Serilog.Log.Information(
            "ExistingRL assignment: Observations={Observations}, " +
            "AlignmentPoints={AlignmentPoints}, Assigned={Assigned}, Unassigned={Unassigned}",
            uniqueObservations.Count,
            alignmentPoints.Count,
            alignmentPoints.Count(p => p.ExistingRL.HasValue),
            alignmentPoints.Count(p => !p.ExistingRL.HasValue));
    }

    private static double GetAlignmentOffset(
        double easting,
        double northing,
        IReadOnlyList<AlignmentPoint> points)
    {
        double bestDistanceSquared = double.PositiveInfinity;

        for (int i = 0; i < points.Count - 1; i++)
        {
            var a = points[i];
            var b = points[i + 1];

            double dx = b.Easting - a.Easting;
            double dy = b.Northing - a.Northing;
            double lengthSquared = dx * dx + dy * dy;

            if (lengthSquared < 1e-12)
                continue;

            double t = Math.Clamp(
                ((easting - a.Easting) * dx +
                 (northing - a.Northing) * dy) / lengthSquared,
                0.0,
                1.0);

            double offsetE = easting - (a.Easting + t * dx);
            double offsetN = northing - (a.Northing + t * dy);

            double distanceSquared =
                offsetE * offsetE + offsetN * offsetN;

            bestDistanceSquared = Math.Min(
                bestDistanceSquared,
                distanceSquared);
        }

        return Math.Sqrt(bestDistanceSquared);
    }

    [HttpGet]
    public async Task<IActionResult> Review(int projectId)
    {
        var project = await _db.Projects.FindAsync(projectId);
        if (project == null)
            return NotFound();

        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        var survey = await _surveyRepo.GetByProjectAsync(projectId);
        if (survey == null)
        {
            TempData["Error"] = "No survey data found. Please upload first.";
            return RedirectToAction("Upload", new { projectId });
        }

        // Load the road alignment independently, then show its status
        // alongside the survey on the same analysis page.
        var alignment = await _alignmentRepo.GetByProjectAsync(projectId);

        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project.ProjectName;
        ViewBag.Alignment = alignment;
        ViewBag.HasAlignment = alignment != null;

        var summary = new SurveySummaryDto
        {
            TotalPoints = survey.TotalPoints,
            CentrelinePoints = survey.Points.Count(
                p => p.CodeType == SurveyCodeType.Centreline),

            ExCdPoints = survey.Points.Count(
                p => p.CodeType == SurveyCodeType.ExistingCulvert),

            BridgePoints = survey.Points.Count(
                p => p.CodeType == SurveyCodeType.Bridge),

            TBMCount = survey.TBMs.Count,

            // Prefer the imported DXF alignment length when available.
            // Otherwise retain the existing survey-based fallback.
            AlignmentLengthM = alignment != null
                ? alignment.TotalLengthM
                : survey.Points
                    .Where(p => p.CodeType == SurveyCodeType.Centreline
                             && p.Chainage.HasValue)
                    .Select(p => p.Chainage!.Value)
                    .DefaultIfEmpty(0)
                    .Max(),

            MinRL = survey.MinRL,
            MaxRL = survey.MaxRL,
            DetectedCulverts = survey.DetectedCulverts.Count
        };

        ViewBag.Summary = summary;
        ViewBag.Locations = survey.DetectedCulverts;
        ViewBag.TBMs = survey.TBMs;

        // Data for the Survey Terrain Map
        ViewBag.SurveyMapPoints = survey.Points;
        ViewBag.SurveyMapAlignment = alignment?.HorizontalPoints;
        ViewBag.SurveyMapCulverts = survey.DetectedCulverts;

        return View(survey);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfirmLocation(int projectId, int locationIndex)
    {
        if (projectId <= 0 || locationIndex < 0)
        {
            return BadRequest("Invalid project or location index parameter.");
        }

        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        var survey = await _surveyRepo.GetByProjectAsync(projectId);
        if (survey == null)
        {
            return NotFound($"No survey data found for Project #{projectId}.");
        }

        var loc = survey.DetectedCulverts.FirstOrDefault(l => l.LocationIndex == locationIndex);
        if (loc == null)
        {
            return NotFound($"Culvert Location #{locationIndex} was not found in this survey.");
        }

        if (!loc.IsConfirmed)
        {
            loc.IsConfirmed = true;
            await _surveyRepo.UpdateAsync(survey);
        }

        return RedirectToAction("Review", new { projectId });
    }

    [HttpGet]
    public async Task<IActionResult> GetCulvertSolid(int projectId, string modelType = "3D_SOLID")
    {
        if (projectId <= 0)
        {
            return BadRequest(new { success = false, message = "Invalid project ID." });
        }

        var project = await _db.Projects.FindAsync(projectId);
        if (project == null)
        {
            return NotFound(new { success = false, message = $"Project {projectId} not found." });
        }

        if (!await HasProjectAccessAsync(projectId))
        {
            return Forbid();
        }

        var doc = await _solidRepo.GetByProjectAsync(projectId, modelType);
        if (doc == null || string.IsNullOrWhiteSpace(doc.SolidDataJson))
        {
            return Json(new { success = false, message = "No saved culvert solid model found." });
        }

        return Content(doc.SolidDataJson, "application/json");
    }

    [HttpGet]
    [Route("api/cad/recent-models")]
    public async Task<IActionResult> GetRecentModels([FromQuery] string modelType = "3D_SOLID")
    {
        if (User.Identity?.IsAuthenticated != true)
            return Unauthorized();

        bool isAdmin = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");

        // Fetch accessible projects for the current user
        var projectQuery = _db.Projects.AsQueryable();
        if (!isAdmin)
        {
            projectQuery = projectQuery.Where(p => p.CreatedByUserId == CurrentUserId || p.Members.Any(m => m.UserId == CurrentUserId));
        }

        var accessibleProjects = await projectQuery
            .Select(p => new { p.Id, p.ProjectCode, p.ProjectName })
            .ToDictionaryAsync(p => p.Id);

        if (!accessibleProjects.Any())
        {
            return Json(new { success = true, items = new List<object>() });
        }

        List<CulvertSolidDocument> solids = new();
        try
        {
            solids = await _solidRepo.GetRecentSolidsAsync(accessibleProjects.Keys, limit: 20);
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = "Document database is temporarily unreachable.", items = new List<object>() });
        }

        var items = solids
       .Where(s => string.IsNullOrEmpty(modelType)
             || (modelType == "3D" && (s.ModelType == "3D_SOLID" || s.ModelType == "3D_STL"))
             || string.Equals(s.ModelType, modelType, StringComparison.OrdinalIgnoreCase))
            .Select(s => new
            {
                id = s.Id,
                projectId = s.ProjectId,
                projectCode = accessibleProjects.TryGetValue(s.ProjectId, out var p) ? p.ProjectCode : "PROJ",
                projectName = accessibleProjects.TryGetValue(s.ProjectId, out var proj) ? proj.ProjectName : "Unknown",
                fileName = s.FileName,
                modelType = s.ModelType,
                uploadedAt = s.UploadedAt
            });

        return Json(new { success = true, items });
    }

    public class SaveCulvertSolidRequest
    {
        public int ProjectId { get; set; }
        public string? FileName { get; set; }
        public string? ModelType { get; set; }
        public string? SolidDataJson { get; set; }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("HeavyCadOps")]
    public async Task<IActionResult> SaveCulvertSolid([FromBody] SaveCulvertSolidRequest request)
    {
        if (request == null || request.ProjectId <= 0 || string.IsNullOrWhiteSpace(request.SolidDataJson))
        {
            return BadRequest(new { success = false, message = "Invalid project ID or solid data." });
        }

        const int MaxSolidJsonBytes = 15 * 1024 * 1024; // 15 MB payload guard
        if (request.SolidDataJson.Length > MaxSolidJsonBytes)
        {
            return BadRequest(new { success = false, message = "Solid geometry payload exceeds the maximum 15 MB limit." });
        }

        var allowedTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "3D_SOLID", "3D_STL", "2D_DXF" };
        var modelType = string.IsNullOrWhiteSpace(request.ModelType) ? "3D_SOLID" : request.ModelType.Trim().ToUpperInvariant();
        if (!allowedTypes.Contains(modelType))
        {
            return BadRequest(new { success = false, message = $"Unsupported model type '{request.ModelType}'. Allowed: 3D_SOLID, 3D_STL, 2D_DXF." });
        }

        var project = await _db.Projects.FindAsync(request.ProjectId);
        if (project == null)
        {
            return NotFound(new { success = false, message = $"Project with ID {request.ProjectId} does not exist." });
        }

        if (!await HasProjectAccessAsync(request.ProjectId))
        {
            return Forbid();
        }

        var doc = new CulvertSolidDocument
        {
            ProjectId = request.ProjectId,
            FileName = request.FileName ?? (modelType == "3D_STL" ? "culvert_model.stl" : "culvert_model.html"),
            ModelType = modelType,
            UploadedAt = DateTime.UtcNow,
            SolidDataJson = request.SolidDataJson
        };

        await _solidRepo.UpsertByProjectAsync(doc);
        return Json(new { success = true, message = $"Model ({modelType}) saved successfully." });
    }
}

// ============================================================
// CulvertCAD.Web/Controllers/DrawingsController.cs
// ============================================================

[Authorize]
[EngineeringRoutesDisabled]
public class DrawingsController : Controller
{
    private readonly AppDbContext _db;
    private readonly ICalcResultRepository _calcRepo;
    private readonly IDrawingRepository _drawingRepo;
    private readonly CulvertCAD.Infrastructure.Drawing.IDxfDrawingEngine _dxfEngine;

    public DrawingsController(AppDbContext db, ICalcResultRepository calcRepo,
        IDrawingRepository drawingRepo, CulvertCAD.Infrastructure.Drawing.IDxfDrawingEngine dxfEngine)
    { _db = db; _calcRepo = calcRepo; _drawingRepo = drawingRepo; _dxfEngine = dxfEngine; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IActionResult> Viewer(int revisionId)
    {
        var rev = await _db.DesignRevisions
            .Include(r => r.Design).ThenInclude(d => d.Project)
            .FirstOrDefaultAsync(r => r.Id == revisionId);
        if (rev == null) return NotFound();

        var calc = await _calcRepo.GetByRevisionAsync(revisionId);
        if (calc == null) return NotFound("No calculation results found.");

        // Build Three.js data DTOs
        double D = calc.SelectedDiameterMm;
        var xsData = new CrossSectionDataDto
        {
            DiameterMm = D,
            WallThicknessMm = GetWallThickness(calc.SelectedDiameterMm, calc.SelectedPipeClass),
            TrenchWidthMm = D + 600,
            TrenchDepthMm = D + 300,
            BeddingDepthMm = 150,
            FillHeightMm = (double)(rev.Design.FillHeightM ?? 0.5m) * 1000,
            BeddingClass = calc.BeddingClass,
            NumberOfPipes = calc.NumberOfPipes,
            PipeSpacingMm = 100
        };

        var lsData = new LongitudinalDataDto
        {
            TotalLengthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m) + 1.0,
            InvertRLStart = 100.0,
            InvertRLEnd = 100.0 - (double)(rev.Design.SlopePercent ?? 0.5m) / 100 * 8.5,
            RoadRLStart = 100.0 + (double)(rev.Design.FillHeightM ?? 0.5m) + D / 1000,
            RoadRLEnd = 100.0 + (double)(rev.Design.FillHeightM ?? 0.5m) + D / 1000 - (double)(rev.Design.SlopePercent ?? 0.5m) / 100 * 8.5,
            PipeDiameterMm = D,
            RoadwayWidthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m),
            WingwallAngle = 30
        };

        ViewBag.XsData = xsData;
        ViewBag.LsData = lsData;
        ViewBag.RevisionId = revisionId;
        ViewBag.DesignName = rev.Design.DesignName;
        ViewBag.ProjectName = rev.Design.Project?.ProjectName ?? "";

        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> GenerateDxf(int revisionId, string drawingType = "CrossSection")
    {
        var rev = await _db.DesignRevisions
            .Include(r => r.Design).ThenInclude(d => d.Project)
            .Include(r => r.CreatedBy).Include(r => r.CheckedBy).Include(r => r.ApprovedBy)
            .FirstOrDefaultAsync(r => r.Id == revisionId);
        if (rev == null) return NotFound();

        var calc = await _calcRepo.GetByRevisionAsync(revisionId);
        if (calc == null) return NotFound("No calculation results found.");

        var titleBlock = new TitleBlockData
        {
            ProjectName = rev.Design.Project?.ProjectName ?? "",
            DrawingNumber = $"{rev.Design.DesignCode ?? "CUL"}-{drawingType.ToUpper()}-{rev.RevisionCode}",
            DrawingTitle = drawingType == "CrossSection" ? "Cross-Section of Pipe Culvert" : "Longitudinal Section",
            Scale = "1:50",
            RevisionCode = rev.RevisionCode,
            DrawnBy = rev.CreatedBy?.FullName ?? "",
            CheckedBy = rev.CheckedBy?.FullName ?? "",
            ApprovedBy = rev.ApprovedBy?.FullName ?? "",
            Date = rev.RevisionDate,
        };

        byte[] dxfBytes;
        string fileName;

        double D = calc.SelectedDiameterMm;

        if (drawingType == "CrossSection")
        {
            var xs = new CrossSectionDataDto
            {
                DiameterMm = D,
                WallThicknessMm = GetWallThickness(calc.SelectedDiameterMm, calc.SelectedPipeClass),
                TrenchWidthMm = D + 600,
                TrenchDepthMm = D + 300,
                BeddingDepthMm = 150,
                FillHeightMm = (double)(rev.Design.FillHeightM ?? 0.5m) * 1000,
                BeddingClass = calc.BeddingClass,
                NumberOfPipes = calc.NumberOfPipes
            };
            dxfBytes = _dxfEngine.GenerateCrossSection(xs, titleBlock);
            fileName = $"{titleBlock.DrawingNumber}_CrossSection.dxf";
        }
        else
        {
            var ls = new LongitudinalDataDto
            {
                TotalLengthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m) + 1.0,
                InvertRLStart = 100.0,
                InvertRLEnd = 99.5,
                RoadRLStart = 100.0 + (double)(rev.Design.FillHeightM ?? 0.5m) + D / 1000,
                RoadRLEnd = 99.9,
                PipeDiameterMm = D,
                RoadwayWidthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m)
            };
            dxfBytes = _dxfEngine.GenerateLongitudinalSection(ls, titleBlock);
            fileName = $"{titleBlock.DrawingNumber}_LSection.dxf";
        }

        // Save to MongoDB
        var drawingDoc = new DrawingDocument
        {
            DesignId = rev.DesignId,
            RevisionId = revisionId,
            DrawingNumber = titleBlock.DrawingNumber,
            DrawingTitle = titleBlock.DrawingTitle,
            GeneratedBy = CurrentUserId,
            DxfBase64 = Convert.ToBase64String(dxfBytes),
            TitleBlock = titleBlock,
        };
        await _drawingRepo.InsertAsync(drawingDoc);

        return File(dxfBytes, "application/dxf", fileName);
    }

    private static double GetWallThickness(int diaMm, string pipeClassStr)
    {
        bool isNP3 = pipeClassStr.Contains("NP3");
        return (diaMm, isNP3) switch
        {
            (300, true) => 44,
            (300, false) => 38,
            (400, true) => 50,
            (400, false) => 43,
            (500, true) => 56,
            (500, false) => 47,
            (600, true) => 62,
            (600, false) => 52,
            (700, true) => 68,
            (700, false) => 57,
            (800, true) => 74,
            (800, false) => 62,
            (900, true) => 80,
            (900, false) => 67,
            (1000, true) => 86,
            (1000, false) => 72,
            _ => 50
        };
    }
}

// ============================================================
// CulvertCAD.Web/Controllers/BOQController.cs
// ============================================================

[Authorize]
[EngineeringRoutesDisabled]
public class BOQController : Controller
{
    private readonly AppDbContext _db;
    private readonly ICalcResultRepository _calcRepo;
    private readonly IBOQService _boqSvc;

    public BOQController(AppDbContext db, ICalcResultRepository calcRepo, IBOQService boqSvc)
    { _db = db; _calcRepo = calcRepo; _boqSvc = boqSvc; }

    public async Task<IActionResult> Generate(int revisionId)
    {
        var rev = await _db.DesignRevisions
            .Include(r => r.Design).ThenInclude(d => d.Project)
            .FirstOrDefaultAsync(r => r.Id == revisionId);
        if (rev == null) return NotFound();

        var calc = await _calcRepo.GetByRevisionAsync(revisionId);
        if (calc == null) return NotFound("No calculation results found.");

        var boq = _boqSvc.GenerateBOQ(rev.Design, calc);
        return View(boq);
    }
}

// ============================================================
// CulvertCAD.Web/Controllers/HomeController.cs
// ============================================================

[Authorize]
public class HomeController : Controller
{
    private readonly AppDbContext _db;
    private readonly Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> _um;
    private readonly ICulvertSolidRepository _solidRepo;

    public HomeController(
        AppDbContext db,
        Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> um,
        ICulvertSolidRepository solidRepo)
    {
        _db = db;
        _um = um;
        _solidRepo = solidRepo;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IActionResult> Index()
    {
        var user = await _um.GetUserAsync(User);
        var roles = await _um.GetRolesAsync(user!);
        bool isAdmin = roles.Contains("SuperAdmin") || roles.Contains("Admin");

        var projectQuery = _db.Projects.AsQueryable();

        if (!isAdmin)
        {
            projectQuery = projectQuery.Where(
                p => p.Members.Any(m => m.UserId == CurrentUserId));
        }

        int totalProjects = await projectQuery.CountAsync();
        int activeProjects = await projectQuery.CountAsync(p => p.Status == ProjectStatus.Active);

        var accessibleProjects = await projectQuery
            .Select(p => new { p.Id, p.ProjectCode, p.ProjectName })
            .ToDictionaryAsync(p => p.Id);

        var myProjects = await projectQuery
            .OrderByDescending(p => p.CreatedAt)
            .Take(8)
            .Select(p => new ProjectSummaryDto
            {
                Id = p.Id,
                ProjectName = p.ProjectName,
                ProjectCode = p.ProjectCode,
                Status = p.Status.ToString()
            })
            .ToListAsync();

        var myDrawings = new List<DrawingSummaryDto>();
        try
        {
            if (accessibleProjects.Any())
            {
                var solids = await _solidRepo.GetRecentSolidsAsync(accessibleProjects.Keys, limit: 8);
                myDrawings = solids.Select(s => new DrawingSummaryDto
                {
                    Id = s.Id,
                    ProjectId = s.ProjectId,
                    ProjectCode = accessibleProjects.TryGetValue(s.ProjectId, out var p) ? p.ProjectCode : "PROJ",
                    ProjectName = accessibleProjects.TryGetValue(s.ProjectId, out var proj) ? proj.ProjectName : $"Project #{s.ProjectId}",
                    FileName = s.FileName,
                    ModelType = s.ModelType,
                    UploadedAt = s.UploadedAt
                }).ToList();
            }
        }
        catch
        {
            // Fail-safe if MongoDB is temporarily unreachable
        }

        return View(new DashboardDto
        {
            TotalProjects = totalProjects,
            ActiveProjects = activeProjects,
            MyProjects = myProjects,
            MyDrawings = myDrawings
        });
    }
}