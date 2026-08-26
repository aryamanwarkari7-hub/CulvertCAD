// CulvertCAD.Application/Services/RevisionService.cs
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Infrastructure.MongoDB.Repositories;

namespace CulvertCAD.Application.Services;

public interface IRevisionService
{
    Task<DesignRevision> CreateRevisionAsync(CulvertDesign design, string? changeDesc, int userId);
    Task TransitionAsync(int revisionId, RevisionStatus newStatus, int userId, string remarks);
    Task<bool> CanTransitionAsync(int revisionId, RevisionStatus to, int userId, IList<string> roles);
    Task AddCommentAsync(int revisionId, string text, string? fieldRef, CommentType type, int userId);
    Task ResolveCommentAsync(int commentId, int userId);
    Task UpdateRevisionInputsAsync(int revisionId,RevisionEngineeringInput input,int userId);
}

public class RevisionService : IRevisionService
{
    private readonly AppDbContext _db;
    private readonly IDesignCalculationService _calc;
    private readonly ICalcResultRepository _calcRepo;

    private readonly IRevisionInputRepository _revisionInputRepo;

    public RevisionService(AppDbContext db, 
        IDesignCalculationService calc, 
        ICalcResultRepository calcRepo,
        IRevisionInputRepository revisionInputRepo)
    { _db = db;
        _calc = calc;
        _calcRepo = calcRepo;
        _revisionInputRepo = revisionInputRepo;
    }

    public async Task<DesignRevision> CreateRevisionAsync(
    CulvertDesign design,
    string? changeDesc,
    int userId)
    {
        var existing = await _db.DesignRevisions
            .Where(r => r.DesignId == design.Id)
            .ToListAsync();

        int nextIdx = existing.Count;

        foreach (var r in existing.Where(r => r.IsLatest))
        {
            r.IsLatest = false;
        }

        // Create the revision first so we have its database ID.
        var revision = new DesignRevision
        {
            DesignId = design.Id,
            RevisionNumber = $"R{nextIdx}",
            RevisionCode = nextIdx.ToString("D2"),
            RevisionPurpose = nextIdx == 0
                ? "Issued for Design"
                : "Revised per Review",
            ChangeDescription = changeDesc ??
                                (nextIdx == 0
                                    ? "Initial Design"
                                    : "Revision"),
            RevisionDate = DateTime.UtcNow,
            Status = RevisionStatus.Draft,
            CreatedByUserId = userId,
            IsLatest = true
        };

        _db.DesignRevisions.Add(revision);
        await _db.SaveChangesAsync();

        // Capture the engineering inputs used by this revision.
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

        var inputDocument = new RevisionInputDocument
        {
            DesignId = design.Id,
            RevisionId = revision.Id,
            CreatedAt = DateTime.UtcNow,
            Input = input
        };

        var inputSnapshotId = await _revisionInputRepo.InsertAsync(inputDocument);

        revision.InputSnapshotId = inputSnapshotId;

        // Keep the existing calculation behaviour for this step.
        var engineeringResult = await _calc.CalculateAsync(input);

        var calcResult = BuildCalculationResultDocument(
    engineeringResult,
    input,
    revision.DesignId,
    revision.Id);

        var resultSnapshotId = await _calcRepo.InsertAsync(calcResult);

        revision.ResultSnapshotId = resultSnapshotId;

        _db.RevisionStatusHistory.Add(new RevisionStatusHistory
        {
            RevisionId = revision.Id,
            ToStatus = RevisionStatus.Draft,
            ChangedByUserId = userId,
            Remarks = $"Revision {revision.RevisionNumber} created",
            ChangedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return revision;
    }
    public async Task TransitionAsync(int revisionId, RevisionStatus newStatus, int userId, string remarks)
    {
        var rev = await _db.DesignRevisions.FindAsync(revisionId)
            ?? throw new KeyNotFoundException($"Revision {revisionId} not found.");

        if (rev.IsLocked)
            throw new InvalidOperationException("Revision is locked (approved) and cannot be changed.");

        var fromStatus = rev.Status;
        rev.Status = newStatus;

        switch (newStatus)
        {
            case RevisionStatus.Submitted:   rev.SubmittedAt = DateTime.UtcNow; break;
            case RevisionStatus.UnderReview: rev.CheckedByUserId = userId; rev.CheckedAt = DateTime.UtcNow; break;
            case RevisionStatus.Approved:
                rev.ApprovedByUserId = userId; rev.ApprovedAt = DateTime.UtcNow;
                rev.IsApproved = true; rev.IsLocked = true; break;
            case RevisionStatus.Superseded: rev.IsLatest = false; break;
        }

        _db.RevisionStatusHistory.Add(new RevisionStatusHistory
        {
            RevisionId = revisionId, FromStatus = fromStatus, ToStatus = newStatus,
            ChangedByUserId = userId, Remarks = remarks, ChangedAt = DateTime.UtcNow,
        });

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId, Action = $"Revision {rev.RevisionNumber} → {newStatus}",
            EntityType = "DesignRevision", EntityId = revisionId.ToString(),
            OldValues = fromStatus.ToString(), NewValues = newStatus.ToString(), Timestamp = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync();
    }

    public async Task<bool> CanTransitionAsync(int revisionId, RevisionStatus to, int userId, IList<string> roles)
    {
        var rev = await _db.DesignRevisions.FindAsync(revisionId);
        if (rev == null || rev.IsLocked) return false;

        bool isAdmin   = roles.Contains("SuperAdmin") || roles.Contains("Admin");
        bool isChecker = roles.Contains("CheckingEngineer") || isAdmin;
        bool isAuthor  = rev.CreatedByUserId == userId;

        return (rev.Status, to) switch
        {
            (RevisionStatus.Draft,            RevisionStatus.Submitted)        => isAuthor,
            (RevisionStatus.Submitted,        RevisionStatus.UnderReview)      => isChecker,
            (RevisionStatus.UnderReview,      RevisionStatus.Approved)         => isAdmin,
            (RevisionStatus.UnderReview,      RevisionStatus.RevisionRequired) => isChecker,
            (RevisionStatus.RevisionRequired, RevisionStatus.Draft)            => true,
            _ => false
        };
    }

    public async Task AddCommentAsync(int revisionId, string text, string? fieldRef, CommentType type, int userId)
    {
        _db.RevisionComments.Add(new RevisionComment
        {
            RevisionId = revisionId, AuthorId = userId, CommentText = text,
            FieldReference = fieldRef, Type = type, CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    public async Task ResolveCommentAsync(int commentId, int userId)
    {
        var c = await _db.RevisionComments.FindAsync(commentId) ?? throw new KeyNotFoundException("Comment not found.");
        c.Status = CommentStatus.Resolved;
        c.ResolvedAt = DateTime.UtcNow;
        c.ResolvedByUserId = userId;
        await _db.SaveChangesAsync();
    }

    public async Task UpdateRevisionInputsAsync(
    int revisionId,
    RevisionEngineeringInput input,
    int userId)
    {
        var revision = await _db.DesignRevisions
            .FirstOrDefaultAsync(r => r.Id == revisionId);

        if (revision == null)
            throw new KeyNotFoundException(
                $"Revision {revisionId} not found.");

        if (revision.IsLocked)
            throw new InvalidOperationException(
                "Approved revision cannot be edited.");

        if (revision.Status != RevisionStatus.Draft)
            throw new InvalidOperationException(
                "Only a Draft revision can be edited.");

        if (string.IsNullOrWhiteSpace(revision.InputSnapshotId))
            throw new InvalidOperationException(
                "Revision input snapshot was not found.");

        var document = await _revisionInputRepo
    .GetByIdAsync(revision.InputSnapshotId);

        if (document == null)
            throw new InvalidOperationException(
                "Revision input snapshot was not found.");

        var oldInput = document.Input;

       

        // Capture important changes before replacing the snapshot.
        var changes = new List<string>();

        if (oldInput.FillHeightM != input.FillHeightM)
        {
            changes.Add(
                $"Fill Height: {oldInput.FillHeightM:0.000} m → {input.FillHeightM:0.000} m");
        }

        if (oldInput.CatchmentAreaHa != input.CatchmentAreaHa)
        {
            changes.Add(
                $"Catchment Area: {oldInput.CatchmentAreaHa:0.###} ha → {input.CatchmentAreaHa:0.###} ha");
        }

        if (oldInput.RainfallIntensityMmHr != input.RainfallIntensityMmHr)
        {
            changes.Add(
                $"Rainfall Intensity: {oldInput.RainfallIntensityMmHr:0.###} mm/hr → {input.RainfallIntensityMmHr:0.###} mm/hr");
        }

        if (oldInput.RunoffCoefficient != input.RunoffCoefficient)
        {
            changes.Add(
                $"Runoff Coefficient: {oldInput.RunoffCoefficient:0.###} → {input.RunoffCoefficient:0.###}");
        }

        if (oldInput.SlopePercent != input.SlopePercent)
        {
            changes.Add(
                $"Slope: {oldInput.SlopePercent:0.###}% → {input.SlopePercent:0.###}%");
        }

        if (oldInput.SoilUnitWeightKNm3 != input.SoilUnitWeightKNm3)
        {
            changes.Add(
                $"Soil Unit Weight: {oldInput.SoilUnitWeightKNm3:0.###} kN/m³ → {input.SoilUnitWeightKNm3:0.###} kN/m³");
        }

        if (oldInput.BearingCapacityKNm2 != input.BearingCapacityKNm2)
        {
            changes.Add(
                $"Bearing Capacity: {oldInput.BearingCapacityKNm2:0.###} kN/m² → {input.BearingCapacityKNm2:0.###} kN/m²");
        }

        // Replace the MongoDB input snapshot.
        document.Input = input;

        await _revisionInputRepo.UpdateAsync(document);

        var engineeringResult = await _calc.CalculateAsync(input);

        var calcResult = BuildCalculationResultDocument(
    engineeringResult,
    input,
    revision.DesignId,
    revision.Id);

        var existingResult = await _calcRepo
            .GetByRevisionAsync(revision.Id);

        if (existingResult != null)
        {
            calcResult.Id = existingResult.Id;

            await _calcRepo.UpdateAsync(calcResult);

            revision.ResultSnapshotId = existingResult.Id;
        }
        else
        {
            var resultSnapshotId =
                await _calcRepo.InsertAsync(calcResult);

            revision.ResultSnapshotId = resultSnapshotId;
        }

        if (changes.Count > 0)
        {
            _db.RevisionStatusHistory.Add(new RevisionStatusHistory
            {
                RevisionId = revision.Id,
                FromStatus = revision.Status,
                ToStatus = revision.Status,
                ChangedByUserId = userId,
                Remarks =
                    $"Revision {revision.RevisionNumber} inputs updated and calculation recalculated. " +
                    string.Join("; ", changes),
                ChangedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
    }

    private static CalculationResultDocument BuildCalculationResultDocument(
    RevisionEngineeringResultModel result,
    RevisionEngineeringInput input,
    int designId,
    int revisionId)
    {
        return new CalculationResultDocument
        {
            DesignId = designId,
            RevisionId = revisionId,
            CalculatedAt = DateTime.UtcNow,

            CatchmentAreaHa = (double)(input.CatchmentAreaHa ?? 0),
            RainfallIntensityMmHr = (double)(input.RainfallIntensityMmHr ?? 80),
            RunoffCoefficient = (double)(input.RunoffCoefficient ?? 0.55m),

            DesignDischargeQ = result.DesignDischargeQ,

            SelectedDiameterMm = result.SelectedDiameterMm,
            NumberOfPipes = result.NumberOfPipes,

            QfullM3s = result.QfullM3s,
            QdesignM3s = result.QdesignM3s,

            VelocityFullFlowMs = result.VelocityFullFlowMs,
            VelocityDesignMs = result.VelocityDesignMs,

            HeadwaterDepthM = result.HeadwaterDepthM,
            HydraulicAdequate = result.HydraulicAdequate,

            EarthLoadWeKNm = result.EarthLoadWeKNm,
            LiveLoadWlKNm = result.LiveLoadWlKNm,
            TotalLoadWtKNm = result.TotalLoadWtKNm,

            BeddingClass = result.BeddingClass,
            BeddingFactor = result.BeddingFactor,
            RequiredCrushKNm = result.RequiredCrushKNm,

            SelectedPipeClass = result.SelectedPipeClass,
            SelectedPipeDiaMm = result.SelectedPipeDiaMm,
            PipeCrushCapKNm = result.PipeCrushCapKNm,

            FactorOfSafety = result.FactorOfSafety,
            StructuralAdequate = result.StructuralAdequate,
            IsDesignSatisfactory = result.IsDesignSatisfactory,

            HydraulicSteps = result.HydraulicSteps,
            StructuralSteps = result.StructuralSteps
        };
    }
}
