using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Repositories;
using CulvertCAD.Infrastructure.MySQL.Data;
using Microsoft.EntityFrameworkCore;

namespace CulvertCAD.Infrastructure.MySQL.Repositories;

public class RevisionRepository : IRevisionRepository
{
    private readonly AppDbContext _db;

    public RevisionRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<DesignRevision>> GetRevisionsByDesignIdAsync(int designId)
    {
        return await _db.DesignRevisions
            .Where(r => r.DesignId == designId)
            .ToListAsync();
    }

    public async Task<DesignRevision?> GetByIdAsync(int revisionId)
    {
        return await _db.DesignRevisions
            .FirstOrDefaultAsync(r => r.Id == revisionId);
    }

    public Task AddRevisionAsync(DesignRevision revision)
    {
        _db.DesignRevisions.Add(revision);
        return Task.CompletedTask;
    }

    public Task AddStatusHistoryAsync(RevisionStatusHistory history)
    {
        _db.RevisionStatusHistory.Add(history);
        return Task.CompletedTask;
    }

    public Task AddAuditLogAsync(AuditLog auditLog)
    {
        _db.AuditLogs.Add(auditLog);
        return Task.CompletedTask;
    }

    public Task AddCommentAsync(RevisionComment comment)
    {
        _db.RevisionComments.Add(comment);
        return Task.CompletedTask;
    }

    public async Task<RevisionComment?> GetCommentByIdAsync(int commentId)
    {
        return await _db.RevisionComments
            .FirstOrDefaultAsync(c => c.Id == commentId);
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
