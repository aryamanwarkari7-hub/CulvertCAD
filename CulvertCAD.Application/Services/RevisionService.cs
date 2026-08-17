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
}

public class RevisionService : IRevisionService
{
    private readonly AppDbContext _db;
    private readonly IDesignCalculationService _calc;
    private readonly ICalcResultRepository _calcRepo;

    public RevisionService(AppDbContext db, IDesignCalculationService calc, ICalcResultRepository calcRepo)
    { _db = db; _calc = calc; _calcRepo = calcRepo; }

    public async Task<DesignRevision> CreateRevisionAsync(CulvertDesign design, string? changeDesc, int userId)
    {
        var existing = await _db.DesignRevisions.Where(r => r.DesignId == design.Id).ToListAsync();
        int nextIdx = existing.Count;
        foreach (var r in existing.Where(r => r.IsLatest)) r.IsLatest = false;

        var calcResult = await _calc.CalculateAsync(design);

        var revision = new DesignRevision
        {
            DesignId         = design.Id,
            RevisionNumber   = $"R{nextIdx}",
            RevisionCode     = nextIdx.ToString("D2"),
            RevisionPurpose  = nextIdx == 0 ? "Issued for Design" : "Revised per Review",
            ChangeDescription = changeDesc ?? (nextIdx == 0 ? "Initial Design" : "Revision"),
            RevisionDate     = DateTime.UtcNow,
            Status           = RevisionStatus.Draft,
            CreatedByUserId  = userId,
            IsLatest         = true,
        };

        _db.DesignRevisions.Add(revision);
        await _db.SaveChangesAsync();

        calcResult.DesignId   = design.Id;
        calcResult.RevisionId = revision.Id;
        var savedId = await _calcRepo.InsertAsync(calcResult);
        revision.ResultSnapshotId = savedId;

        _db.RevisionStatusHistory.Add(new RevisionStatusHistory
        {
            RevisionId = revision.Id, ToStatus = RevisionStatus.Draft,
            ChangedByUserId = userId, Remarks = $"Revision {revision.RevisionNumber} created", ChangedAt = DateTime.UtcNow,
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
}
