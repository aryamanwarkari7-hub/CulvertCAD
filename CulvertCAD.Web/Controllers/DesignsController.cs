// CulvertCAD.Web/Controllers/DesignsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Enums;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Infrastructure.MongoDB.Repositories;
using CulvertCAD.Application.Services;
using System.Security.Claims;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class DesignsController : Controller
{
    private readonly AppDbContext _db;
    private readonly IRevisionService _revSvc;
    private readonly ICalcResultRepository _calcRepo;

    public DesignsController(AppDbContext db, IRevisionService revSvc, ICalcResultRepository calcRepo)
    { _db = db; _revSvc = revSvc; _calcRepo = calcRepo; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Create(int projectId)
    {
        var project = await _db.Projects.FindAsync(projectId);
        if (project == null) return NotFound();
        ViewBag.ProjectId = projectId;
        ViewBag.ProjectName = project.ProjectName;
        return View(new CreateDesignDto());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(int projectId, CreateDesignDto model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.ProjectId = projectId;
            return View(model);
        }

        var design = new CulvertDesign
        {
            ProjectId       = projectId,
            DesignName      = model.DesignName,
            DesignCode      = model.DesignCode,
            CulvertLocation = model.CulvertLocation,
            Chainage        = model.Chainage,
            CulvertType     = Enum.Parse<CulvertType>(model.CulvertType),
            CatchmentAreaHa = model.CatchmentAreaHa,
            RainfallIntensityMmHr = model.RainfallIntensityMmHr,
            RunoffCoefficient = model.RunoffCoefficient,
            DesignDischargeQ  = model.DesignDischargeQ,
            ReturnPeriodYrs   = model.ReturnPeriodYrs,
            HydroMethod       = Enum.Parse<HydrologicalMethod>(model.HydroMethod),
            FillHeightM       = model.FillHeightM,
            RoadwayWidthM     = model.RoadwayWidthM,
            SlopePercent      = model.SlopePercent,
            SkewAngleDeg      = model.SkewAngleDeg,
            SoilType          = model.SoilType,
            SoilUnitWeightKNm3 = model.SoilUnitWeightKNm3,
            BearingCapacityKNm2 = model.BearingCapacityKNm2,
            DesignStandard    = model.DesignStandard,
            LoadClass         = Enum.Parse<LoadClass>(model.LoadClass),
            CreatedByUserId   = CurrentUserId,
        };

        _db.CulvertDesigns.Add(design);
        await _db.SaveChangesAsync();

        var revision = await _revSvc.CreateRevisionAsync(design, model.ChangeDescription, CurrentUserId);

        TempData["Success"] = $"Design created with revision {revision.RevisionNumber}.";
        return RedirectToAction("Details", new { id = design.Id });
    }

    public async Task<IActionResult> Details(int id)
    {
        var d = await _db.CulvertDesigns
            .Include(x => x.CreatedBy)
            .Include(x => x.Project)
            .Include(x => x.Revisions).ThenInclude(r => r.CreatedBy)
            .Include(x => x.Revisions).ThenInclude(r => r.CheckedBy)
            .Include(x => x.Revisions).ThenInclude(r => r.ApprovedBy)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (d == null) return NotFound();

        var dto = new CulvertDesignDto
        {
            Id = d.Id, ProjectId = d.ProjectId, ProjectName = d.Project?.ProjectName ?? "",
            DesignName = d.DesignName, DesignCode = d.DesignCode,
            CulvertLocation = d.CulvertLocation, Chainage = d.Chainage,
            CulvertType = d.CulvertType.ToString(),
            CatchmentAreaHa = d.CatchmentAreaHa, RainfallIntensityMmHr = d.RainfallIntensityMmHr,
            RunoffCoefficient = d.RunoffCoefficient,
            DesignDischargeQ = d.DesignDischargeQ,
            ReturnPeriodYrs = d.ReturnPeriodYrs, HydroMethod = d.HydroMethod.ToString(),
            FillHeightM = d.FillHeightM, RoadwayWidthM = d.RoadwayWidthM,
            SlopePercent = d.SlopePercent, SoilType = d.SoilType,
            SoilUnitWeightKNm3 = d.SoilUnitWeightKNm3, DesignStandard = d.DesignStandard,
            LoadClass = d.LoadClass.ToString(), CreatedAt = d.CreatedAt,
            CreatedByName = d.CreatedBy?.FullName ?? "",
            RevisionCount = d.Revisions?.Count ?? 0
        };

        var revisions = new List<RevisionDto>();
        foreach (var r in d.Revisions?.OrderBy(r => r.RevisionCode) ?? System.Linq.Enumerable.Empty<DesignRevision>())
        {
            var calc = await _calcRepo.GetByRevisionAsync(r.Id);
            revisions.Add(MapRevisionToDto(r, calc));
        }

        ViewBag.Revisions = revisions;
        ViewBag.LatestRevision = revisions.FirstOrDefault(r => r.IsLatest);

        return View(dto);
    }

    private static RevisionDto MapRevisionToDto(DesignRevision r, CalculationResultDocument? calc) => new()
    {
        Id = r.Id, DesignId = r.DesignId, RevisionNumber = r.RevisionNumber,
        RevisionCode = r.RevisionCode, RevisionPurpose = r.RevisionPurpose,
        ChangeDescription = r.ChangeDescription, RevisionDate = r.RevisionDate,
        Status = r.Status.ToString(), IsLatest = r.IsLatest, IsApproved = r.IsApproved,
        IsLocked = r.IsLocked, CreatedByName = r.CreatedBy?.FullName ?? "",
        CheckedByName = r.CheckedBy?.FullName, ApprovedByName = r.ApprovedBy?.FullName,
        CreatedAt = r.CreatedAt, SubmittedAt = r.SubmittedAt, ApprovedAt = r.ApprovedAt,
        Result = calc == null ? null : new CalculationResultDto
        {
            CatchmentAreaHa = calc.CatchmentAreaHa,
            RainfallIntensityMmHr = calc.RainfallIntensityMmHr,
            RunoffCoefficient = calc.RunoffCoefficient,
            DesignDischargeQ = calc.DesignDischargeQ,

            SelectedDiameterMm = calc.SelectedDiameterMm,
            NumberOfPipes = calc.NumberOfPipes,
            QfullM3s = calc.QfullM3s,
            QdesignM3s = calc.QdesignM3s,
            VelocityFullFlowMs = calc.VelocityFullFlowMs,
            VelocityDesignMs = calc.VelocityDesignMs,
            HeadwaterDepthM = calc.HeadwaterDepthM,
            HydraulicAdequate = calc.HydraulicAdequate,

            EarthLoadKNm = calc.EarthLoadWeKNm,
            LiveLoadKNm = calc.LiveLoadWlKNm,
            TotalLoadKNm = calc.TotalLoadWtKNm,

            BeddingClass = calc.BeddingClass,
            BeddingFactor = calc.BeddingFactor,
            RequiredCrushKNm = calc.RequiredCrushKNm,

            SelectedPipeClass = calc.SelectedPipeClass,
            SelectedPipeDiaMm = calc.SelectedPipeDiaMm,
            PipeCrushCapKNm = calc.PipeCrushCapKNm,
            FactorOfSafety = calc.FactorOfSafety,
            StructuralAdequate = calc.StructuralAdequate,
            IsDesignSatisfactory = calc.IsDesignSatisfactory,

            CalculatedAt = calc.CalculatedAt,

            HydraulicSteps = calc.HydraulicSteps.Select(s => new CalcStepDto
            {
                Label = s.Label,
                Formula = s.Formula,
                Result = s.Result,
                Unit = s.Unit,
                Clause = s.Clause
            }).ToList(),

            StructuralSteps = calc.StructuralSteps.Select(s => new CalcStepDto
            {
                Label = s.Label,
                Formula = s.Formula,
                Result = s.Result,
                Unit = s.Unit,
                Clause = s.Clause
            }).ToList()
        }
    };
}


// ============================================================
// CulvertCAD.Web/Controllers/RevisionsController.cs
// ============================================================

[Authorize]
public class RevisionsController : Controller
{
    private readonly AppDbContext _db;
    private readonly IRevisionService _revSvc;
    private readonly ICalcResultRepository _calcRepo;
    private readonly IRevisionInputRepository _revisionInputRepo;

    public RevisionsController(
    AppDbContext db,
    IRevisionService revSvc,
    ICalcResultRepository calcRepo,
    IRevisionInputRepository revisionInputRepo)
    {
        _db = db;
        _revSvc = revSvc;
        _calcRepo = calcRepo;
        _revisionInputRepo = revisionInputRepo;
    }
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IActionResult> Details(int id)
    {
        var r = await _db.DesignRevisions
            .Include(x => x.CreatedBy).Include(x => x.CheckedBy).Include(x => x.ApprovedBy)
            .Include(x => x.Design)
            .Include(x => x.Comments).ThenInclude(c => c.Author)
            .Include(x => x.Comments).ThenInclude(c => c.Replies)
            .Include(x => x.StatusHistory).ThenInclude(h => h.ChangedBy)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (r == null) return NotFound();

        var calc = await _calcRepo.GetByRevisionAsync(id);

        var dto = new RevisionDto
        {
            Id = r.Id, DesignId = r.DesignId, RevisionNumber = r.RevisionNumber,
            RevisionCode = r.RevisionCode, RevisionPurpose = r.RevisionPurpose,
            ChangeDescription = r.ChangeDescription, RevisionDate = r.RevisionDate,
            Status = r.Status.ToString(), IsLatest = r.IsLatest, IsApproved = r.IsApproved,
            IsLocked = r.IsLocked, CreatedByName = r.CreatedBy?.FullName ?? "",
            CheckedByName = r.CheckedBy?.FullName, ApprovedByName = r.ApprovedBy?.FullName,
            CreatedAt = r.CreatedAt, SubmittedAt = r.SubmittedAt, ApprovedAt = r.ApprovedAt,
            Comments = r.Comments?.Where(c => c.ParentCommentId == null).Select(c => new RevisionCommentDto
            {
                Id = c.Id, AuthorName = c.Author?.FullName ?? "",
                AuthorDesignation = c.Author?.Designation ?? "", CommentText = c.CommentText,
                FieldReference = c.FieldReference, Type = c.Type.ToString(),
                Status = c.Status.ToString(), CreatedAt = c.CreatedAt,
                Replies = c.Replies?.Select(rep => new RevisionCommentDto
                {
                    Id = rep.Id, AuthorName = rep.Author?.FullName ?? "",
                    CommentText = rep.CommentText, CreatedAt = rep.CreatedAt
                }).ToList() ?? new()
            }).ToList() ?? new(),
            StatusHistory = r.StatusHistory?.OrderBy(h => h.ChangedAt).Select(h => new RevisionStatusHistoryDto
            {
                FromStatus = h.FromStatus?.ToString(), ToStatus = h.ToStatus.ToString(),
                ChangedByName = h.ChangedBy?.FullName ?? "", Remarks = h.Remarks, ChangedAt = h.ChangedAt
            }).ToList() ?? new()
        };

        if (calc != null)
        {
            dto.Result = new CalculationResultDto
            {
                SelectedDiameterMm = calc.SelectedDiameterMm, NumberOfPipes = calc.NumberOfPipes,
                QfullM3s = calc.QfullM3s, VelocityFullFlowMs = calc.VelocityFullFlowMs,
                VelocityDesignMs = calc.VelocityDesignMs, HeadwaterDepthM = calc.HeadwaterDepthM,
                HydraulicAdequate = calc.HydraulicAdequate, EarthLoadKNm = calc.EarthLoadWeKNm,
                LiveLoadKNm = calc.LiveLoadWlKNm, TotalLoadKNm = calc.TotalLoadWtKNm,
                BeddingClass = calc.BeddingClass, BeddingFactor = calc.BeddingFactor,
                RequiredCrushKNm = calc.RequiredCrushKNm, SelectedPipeClass = calc.SelectedPipeClass,
                PipeCrushCapKNm = calc.PipeCrushCapKNm, FactorOfSafety = calc.FactorOfSafety,
                StructuralAdequate = calc.StructuralAdequate, IsDesignSatisfactory = calc.IsDesignSatisfactory,
                CalculatedAt = calc.CalculatedAt,
                HydraulicSteps = calc.HydraulicSteps.Select(s => new CalcStepDto
                    { Label=s.Label, Formula=s.Formula, Result=s.Result, Unit=s.Unit, Clause=s.Clause }).ToList(),
                StructuralSteps = calc.StructuralSteps.Select(s => new CalcStepDto
                    { Label=s.Label, Formula=s.Formula, Result=s.Result, Unit=s.Unit, Clause=s.Clause }).ToList(),
            };
        }

        ViewBag.DesignId = r.DesignId;
        return View(dto);
    }


    #region Edit Inputs
    [HttpGet]
    public async Task<IActionResult> EditInputs(int id)
    {
        var revision = await _db.DesignRevisions
            .FirstOrDefaultAsync(r => r.Id == id);

        if (revision == null)
            return NotFound();

        if (revision.IsLocked)
            return BadRequest("Approved revision cannot be edited.");

        if (revision.Status != RevisionStatus.Draft)
            return BadRequest("Only a Draft revision can be edited.");

        /*
         * Existing revisions created before the input-snapshot
         * mechanism was added may not have an InputSnapshotId.
         *
         * Repair the missing snapshot from the current design.
         */
        if (string.IsNullOrWhiteSpace(revision.InputSnapshotId))
        {
            var design = await _db.CulvertDesigns
                .FirstOrDefaultAsync(d => d.Id == revision.DesignId);

            if (design == null)
                return NotFound("Design not found.");

            var input = new RevisionEngineeringInput
            {
                
                CulvertType = design.CulvertType,
                CulvertLocation = design.CulvertLocation,
                Chainage = design.Chainage,

                CatchmentAreaHa = design.CatchmentAreaHa,
                RainfallIntensityMmHr = design.RainfallIntensityMmHr,
                RunoffCoefficient = design.RunoffCoefficient,
                DesignDischargeOverrideQ = design.DesignDischargeQ,
                ReturnPeriodYrs = design.ReturnPeriodYrs,
                HydroMethod = design.HydroMethod,

                FillHeightM = design.FillHeightM,
                RoadwayWidthM = design.RoadwayWidthM,
                SlopePercent = design.SlopePercent,
                SkewAngleDeg = design.SkewAngleDeg,

                SoilType = design.SoilType,
                SoilUnitWeightKNm3 = design.SoilUnitWeightKNm3,
                BearingCapacityKNm2 = design.BearingCapacityKNm2,
                LoadClass = design.LoadClass,

                DesignStandard = design.DesignStandard
            };

            var document = new RevisionInputDocument
            {
                DesignId = design.Id,
                RevisionId = revision.Id,
                CreatedAt = DateTime.UtcNow,
                Input = input
            };

            var snapshotId = await _revisionInputRepo
                .InsertAsync(document);

            revision.InputSnapshotId = snapshotId;

            await _db.SaveChangesAsync();

            ViewBag.RevisionId = revision.Id;
            ViewBag.RevisionNumber = revision.RevisionNumber;

            return View(input);
        }

        /*
         * Normal path for revisions that already have
         * an input snapshot.
         */
        var existingDocument = await _revisionInputRepo
            .GetByIdAsync(revision.InputSnapshotId);

        if (existingDocument == null)
            return NotFound("Revision input snapshot not found.");

        ViewBag.RevisionId = revision.Id;
        ViewBag.RevisionNumber = revision.RevisionNumber;

        return View(existingDocument.Input);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditInputs(int id,RevisionEngineeringInput input)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.RevisionId = id;

            var revision = await _db.DesignRevisions
                .FirstOrDefaultAsync(r => r.Id == id);

            if (revision == null)
                return NotFound();

            ViewBag.RevisionNumber = revision.RevisionNumber;

            return View(input);
        }

        try
        {
            

            await _revSvc.UpdateRevisionInputsAsync(
                id,
                input,
                CurrentUserId);

            TempData["Success"] =
                $"Revision {id} inputs saved and recalculated.";

            return RedirectToAction(
                "Details",
                new { id });
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);

            ViewBag.RevisionId = id;

            var revision = await _db.DesignRevisions
                .FirstOrDefaultAsync(r => r.Id == id);

            if (revision == null)
                return NotFound();

            ViewBag.RevisionNumber = revision.RevisionNumber;

            return View(input);
        }
    }

    #endregion



    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Submit(int id, string remarks)
    {
        await _revSvc.TransitionAsync(id, RevisionStatus.Submitted, CurrentUserId, remarks);
        TempData["Success"] = "Revision submitted for review.";
        return RedirectToAction("Details", new { id });
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin,CheckingEngineer")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StartReview(int id, string remarks)
    {
        await _revSvc.TransitionAsync(id, RevisionStatus.UnderReview, CurrentUserId, remarks);
        TempData["Success"] = "Review started.";
        return RedirectToAction("Details", new { id });
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Approve(int id, string remarks)
    {
        await _revSvc.TransitionAsync(id, RevisionStatus.Approved, CurrentUserId, remarks);
        TempData["Success"] = "Revision approved and locked.";
        return RedirectToAction("Details", new { id });
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin,CheckingEngineer")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RequestChanges(int id, string remarks)
    {
        await _revSvc.TransitionAsync(id, RevisionStatus.RevisionRequired, CurrentUserId, remarks);
        TempData["Success"] = "Revision returned for changes.";
        return RedirectToAction("Details", new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StartRevision(int id, string remarks)
    {
        await _revSvc.TransitionAsync(
            id,
            RevisionStatus.Draft,
            CurrentUserId,
            string.IsNullOrWhiteSpace(remarks)
                ? "Revision returned to draft for further changes."
                : remarks);

        TempData["Success"] = "Revision returned to Draft for editing.";

        return RedirectToAction("Details", new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddComment(int id, string commentText, string? fieldReference, string type = "General")
    {
        await _revSvc.AddCommentAsync(id, commentText, fieldReference,
            Enum.Parse<CommentType>(type), CurrentUserId);
        return RedirectToAction("Details", new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResolveComment(int commentId, int revisionId)
    {
        await _revSvc.ResolveCommentAsync(commentId, CurrentUserId);
        return RedirectToAction("Details", new { id = revisionId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateNewRevision(int designId, string changeDescription)
    {
        var design = await _db.CulvertDesigns.FindAsync(designId);
        if (design == null) return NotFound();

        var revision = await _revSvc.CreateRevisionAsync(design, changeDescription, CurrentUserId);
        TempData["Success"] = $"Revision {revision.RevisionNumber} created.";
        return RedirectToAction("Details", new { id = revision.Id });
    }
}
