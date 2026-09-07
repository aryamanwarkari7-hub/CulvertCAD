using CulvertCAD.Core.Entities;

namespace CulvertCAD.Core.Repositories;

public interface IRevisionRepository
{
    Task<List<DesignRevision>> GetRevisionsByDesignIdAsync(int designId);

    Task<DesignRevision?> GetByIdAsync(int revisionId);

    Task AddRevisionAsync(DesignRevision revision);

    Task AddStatusHistoryAsync(RevisionStatusHistory history);

    Task AddAuditLogAsync(AuditLog auditLog);

    Task AddCommentAsync(RevisionComment comment);

    Task<RevisionComment?> GetCommentByIdAsync(int commentId);

    Task SaveChangesAsync();
}
