// CulvertCAD.Web/Controllers/SurveyController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Enums;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Infrastructure.MongoDB.Repositories;
using CulvertCAD.Application.Services;
using System.Security.Claims;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class SurveyController : Controller
{
    private readonly AppDbContext _db;
    private readonly ISurveyImportService _importSvc;
    private readonly ISurveyRepository _surveyRepo;

    public SurveyController(AppDbContext db, ISurveyImportService importSvc, ISurveyRepository surveyRepo)
    { _db = db; _importSvc = importSvc; _surveyRepo = surveyRepo; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Upload(int projectId)
    {
        var project = await _db.Projects.FindAsync(projectId);
        if (project == null) return NotFound();
        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project.ProjectName;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> Upload(int projectId, IFormFile csvFile)
    {
        if (csvFile == null || csvFile.Length == 0)
        {
            ModelState.AddModelError("", "Please select a CSV file.");
            ViewBag.ProjectId = projectId;
            return View();
        }

        using var stream = csvFile.OpenReadStream();
        var survey = await _importSvc.ParseCsvAsync(stream, csvFile.FileName, projectId, CurrentUserId);
        var docId  = await _surveyRepo.InsertAsync(survey);

        var project = await _db.Projects.FindAsync(projectId);
        if (project != null)
        {
            project.SurveyCollectionId = docId;
            await _db.SaveChangesAsync();
        }

        TempData["Success"] = $"Survey imported: {survey.TotalPoints} points, {survey.DetectedCulverts.Count} culvert locations detected.";
        return RedirectToAction("Review", new { projectId });
    }

    public async Task<IActionResult> Review(int projectId)
    {
        var survey = await _surveyRepo.GetByProjectAsync(projectId);
        if (survey == null)
        {
            TempData["Error"] = "No survey data found. Please upload first.";
            return RedirectToAction("Upload", new { projectId });
        }

        var project = await _db.Projects.FindAsync(projectId);
        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project?.ProjectName ?? "";

        var summary = new SurveySummaryDto
        {
            TotalPoints      = survey.TotalPoints,
            CentrelinePoints = survey.Points.Count(p => p.CodeType == SurveyCodeType.Centreline),
            ExCdPoints       = survey.Points.Count(p => p.CodeType == SurveyCodeType.ExistingCulvert),
            BridgePoints     = survey.Points.Count(p => p.CodeType == SurveyCodeType.Bridge),
            TBMCount         = survey.TBMs.Count,
            AlignmentLengthM = survey.Points.Where(p => p.CodeType == SurveyCodeType.Centreline && p.Chainage.HasValue)
                                            .Select(p => p.Chainage!.Value).DefaultIfEmpty(0).Max(),
            MinRL = survey.MinRL, MaxRL = survey.MaxRL,
            DetectedCulverts = survey.DetectedCulverts.Count
        };

        ViewBag.Summary = summary;
        ViewBag.Locations = survey.DetectedCulverts;
        ViewBag.TBMs = survey.TBMs;

        return View(survey);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfirmLocation(int projectId, int locationIndex)
    {
        var survey = await _surveyRepo.GetByProjectAsync(projectId);
        if (survey == null) return NotFound();

        var loc = survey.DetectedCulverts.FirstOrDefault(l => l.LocationIndex == locationIndex);
        if (loc != null)
        {
            loc.IsConfirmed = true;
            await _surveyRepo.UpdateAsync(survey);
        }
        return RedirectToAction("Review", new { projectId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateDesignFromLocation(int projectId, int locationIndex)
    {
        var survey = await _surveyRepo.GetByProjectAsync(projectId);
        if (survey == null) return NotFound();

        var loc = survey.DetectedCulverts.FirstOrDefault(l => l.LocationIndex == locationIndex);
        if (loc == null) return NotFound();

        int chKm = (int)(loc.Chainage / 1000);
        int chM  = (int)(loc.Chainage % 1000);
        string chFmt = $"{chKm}+{chM:D3}";

        var design = new CulvertDesign
        {
            ProjectId       = projectId,
            DesignName      = $"Culvert at Ch. {chFmt}",
            DesignCode      = $"CUL-{locationIndex:D3}",
            CulvertLocation = $"Survey-detected location {locationIndex}",
            Chainage        = chFmt,
            CulvertType     = CulvertType.SinglePipe,
            FillHeightM     = (decimal)loc.FillHeightM,
            SlopePercent    = (decimal)loc.BedSlopePct,
            SoilUnitWeightKNm3 = 18.5m,
            DesignStandard  = "IRC 89:1997",
            LoadClass       = LoadClass.IRC_ClassA,
            CreatedByUserId = CurrentUserId,
        };

        _db.CulvertDesigns.Add(design);
        await _db.SaveChangesAsync();

        loc.DesignId = design.Id;
        await _surveyRepo.UpdateAsync(survey);

        return RedirectToAction("Create", "Designs", new { projectId, prefillFromSurvey = locationIndex });
    }
}


// ============================================================
// CulvertCAD.Web/Controllers/DrawingsController.cs
// ============================================================
namespace CulvertCAD.Web.Controllers;

[Authorize]
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
            DiameterMm = D, WallThicknessMm = GetWallThickness(calc.SelectedDiameterMm, calc.SelectedPipeClass),
            TrenchWidthMm = D + 600, TrenchDepthMm = D + 300, BeddingDepthMm = 150,
            FillHeightMm = (double)(rev.Design.FillHeightM ?? 0.5m) * 1000,
            BeddingClass = calc.BeddingClass, NumberOfPipes = calc.NumberOfPipes, PipeSpacingMm = 100
        };

        var lsData = new LongitudinalDataDto
        {
            TotalLengthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m) + 1.0,
            InvertRLStart = 100.0, InvertRLEnd = 100.0 - (double)(rev.Design.SlopePercent ?? 0.5m)/100 * 8.5,
            RoadRLStart = 100.0 + (double)(rev.Design.FillHeightM ?? 0.5m) + D/1000,
            RoadRLEnd = 100.0 + (double)(rev.Design.FillHeightM ?? 0.5m) + D/1000 - (double)(rev.Design.SlopePercent ?? 0.5m)/100*8.5,
            PipeDiameterMm = D, RoadwayWidthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m), WingwallAngle = 30
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
            ProjectName   = rev.Design.Project?.ProjectName ?? "",
            DrawingNumber = $"{rev.Design.DesignCode ?? "CUL"}-{drawingType.ToUpper()}-{rev.RevisionCode}",
            DrawingTitle  = drawingType == "CrossSection" ? "Cross-Section of Pipe Culvert" : "Longitudinal Section",
            Scale         = "1:50",
            RevisionCode  = rev.RevisionCode,
            DrawnBy       = rev.CreatedBy?.FullName ?? "",
            CheckedBy     = rev.CheckedBy?.FullName ?? "",
            ApprovedBy    = rev.ApprovedBy?.FullName ?? "",
            Date          = rev.RevisionDate,
        };

        byte[] dxfBytes;
        string fileName;

        double D = calc.SelectedDiameterMm;

        if (drawingType == "CrossSection")
        {
            var xs = new CrossSectionDataDto
            {
                DiameterMm = D, WallThicknessMm = GetWallThickness(calc.SelectedDiameterMm, calc.SelectedPipeClass),
                TrenchWidthMm = D + 600, TrenchDepthMm = D + 300, BeddingDepthMm = 150,
                FillHeightMm = (double)(rev.Design.FillHeightM ?? 0.5m) * 1000,
                BeddingClass = calc.BeddingClass, NumberOfPipes = calc.NumberOfPipes
            };
            dxfBytes = _dxfEngine.GenerateCrossSection(xs, titleBlock);
            fileName = $"{titleBlock.DrawingNumber}_CrossSection.dxf";
        }
        else
        {
            var ls = new LongitudinalDataDto
            {
                TotalLengthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m) + 1.0,
                InvertRLStart = 100.0, InvertRLEnd = 99.5,
                RoadRLStart = 100.0 + (double)(rev.Design.FillHeightM ?? 0.5m) + D/1000,
                RoadRLEnd = 99.9, PipeDiameterMm = D,
                RoadwayWidthM = (double)(rev.Design.RoadwayWidthM ?? 7.5m)
            };
            dxfBytes = _dxfEngine.GenerateLongitudinalSection(ls, titleBlock);
            fileName = $"{titleBlock.DrawingNumber}_LSection.dxf";
        }

        // Save to MongoDB
        var drawingDoc = new DrawingDocument
        {
            DesignId      = rev.DesignId,
            RevisionId    = revisionId,
            DrawingNumber = titleBlock.DrawingNumber,
            DrawingTitle  = titleBlock.DrawingTitle,
            GeneratedBy   = CurrentUserId,
            DxfBase64     = Convert.ToBase64String(dxfBytes),
            TitleBlock    = titleBlock,
        };
        await _drawingRepo.InsertAsync(drawingDoc);

        return File(dxfBytes, "application/dxf", fileName);
    }

    private static double GetWallThickness(int diaMm, string pipeClassStr)
    {
        bool isNP3 = pipeClassStr.Contains("NP3");
        return (diaMm, isNP3) switch
        {
            (300, true)  => 44,  (300, false) => 38,
            (400, true)  => 50,  (400, false) => 43,
            (500, true)  => 56,  (500, false) => 47,
            (600, true)  => 62,  (600, false) => 52,
            (700, true)  => 68,  (700, false) => 57,
            (800, true)  => 74,  (800, false) => 62,
            (900, true)  => 80,  (900, false) => 67,
            (1000, true) => 86,  (1000, false) => 72,
            _ => 50
        };
    }
}


// ============================================================
// CulvertCAD.Web/Controllers/BOQController.cs
// ============================================================
namespace CulvertCAD.Web.Controllers;

[Authorize]
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
namespace CulvertCAD.Web.Controllers;

[Authorize]
public class HomeController : Controller
{
    private readonly AppDbContext _db;
    private readonly UserManager<Microsoft.AspNetCore.Identity.IdentityUser<int>> _umBase;
    private readonly Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> _um;

    public HomeController(AppDbContext db, Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> um)
    { _db = db; _um = um; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IActionResult> Index()
    {
        var user  = await _um.GetUserAsync(User);
        var roles = await _um.GetRolesAsync(user!);
        bool isAdmin = roles.Contains("SuperAdmin") || roles.Contains("Admin");

        var projectQuery = _db.Projects.AsQueryable();
        if (!isAdmin) projectQuery = projectQuery.Where(p => p.Members.Any(m => m.UserId == CurrentUserId));

        int totalProjects  = await projectQuery.CountAsync();
        int activeProjects = await projectQuery.CountAsync(p => p.Status == ProjectStatus.Active);

        var designQuery = _db.CulvertDesigns.Where(d => d.IsActive);
        if (!isAdmin) designQuery = designQuery.Where(d => d.Project.Members.Any(m => m.UserId == CurrentUserId));
        int totalDesigns = await designQuery.CountAsync();

        int pendingReviews = await _db.DesignRevisions
            .Where(r => r.Status == RevisionStatus.Submitted || r.Status == RevisionStatus.UnderReview)
            .CountAsync();
        int approvedDesigns = await _db.DesignRevisions
            .Where(r => r.Status == RevisionStatus.Approved).CountAsync();

        var activity = await _db.RevisionStatusHistory
            .Include(h => h.ChangedBy).Include(h => h.Revision).ThenInclude(r => r.Design)
            .OrderByDescending(h => h.ChangedAt).Take(10)
            .Select(h => new RecentActivityDto
            {
                Type = h.ToStatus.ToString(),
                Description = $"{h.Revision.Design.DesignName} → {h.Revision.RevisionNumber} {h.ToStatus}",
                UserName = h.ChangedBy.FullName, Timestamp = h.ChangedAt
            }).ToListAsync();

        var myProjects = await projectQuery
            .Include(p => p.Designs)
            .OrderByDescending(p => p.CreatedAt).Take(6)
            .Select(p => new ProjectSummaryDto
            {
                Id = p.Id, ProjectName = p.ProjectName, ProjectCode = p.ProjectCode,
                DesignCount = p.Designs.Count(d => d.IsActive), Status = p.Status.ToString()
            }).ToListAsync();

        return View(new DashboardDto
        {
            TotalProjects = totalProjects, ActiveProjects = activeProjects,
            TotalDesigns = totalDesigns, PendingReviews = pendingReviews,
            ApprovedDesigns = approvedDesigns, RecentActivity = activity, MyProjects = myProjects
        });
    }

    public IActionResult Privacy() => View();

    [AllowAnonymous]
    public IActionResult Error() => View();
}
