using CulvertCAD.Core.Entities;

namespace CulvertCAD.Core.Repositories;

public interface ISurveyRepository
{
    Task<SurveyDocument?> GetByProjectAsync(int projectId);
    Task<SurveyDocument?> GetByIdAsync(string id);
    Task<string> InsertAsync(SurveyDocument doc);
    Task UpdateAsync(SurveyDocument doc);
    Task DeleteAsync(string id);
}

public interface ICalcResultRepository
{
    Task<CalculationResultDocument?> GetByRevisionAsync(int revisionId);
    Task<CalculationResultDocument?> GetByIdAsync(string id);
    Task<string> InsertAsync(CalculationResultDocument doc);
    Task UpdateAsync(CalculationResultDocument doc);
}

public interface IRevisionInputRepository
{
    Task<string> InsertAsync(RevisionInputDocument document);
    Task<RevisionInputDocument?> GetByIdAsync(string id);
    Task UpdateAsync(RevisionInputDocument document);
}

public interface IDrawingRepository
{
    Task<DrawingDocument?> GetByRevisionAsync(int revisionId);
    Task<DrawingDocument?> GetByIdAsync(string id);
    Task<string> InsertAsync(DrawingDocument doc);
    Task UpdateAsync(DrawingDocument doc);
    Task DeleteAsync(string id);
}

public interface IAlignmentRepository
{
    Task<AlignmentDocument?> GetByProjectAsync(int projectId);
    Task<string> InsertAsync(AlignmentDocument doc);
    Task UpdateAsync(AlignmentDocument doc);
}

public interface IBatchRunRepository
{
    Task<List<BatchDesignRunDocument>> GetByProjectAsync(int projectId);
    Task<BatchDesignRunDocument?> GetByIdAsync(string id);
    Task<string> InsertAsync(BatchDesignRunDocument doc);
    Task UpdateAsync(BatchDesignRunDocument doc);
}

public interface ICulvertSolidRepository
{
    Task<CulvertSolidDocument?> GetByProjectAsync(int projectId, string modelType = "3D_SOLID");
    Task<string> UpsertByProjectAsync(CulvertSolidDocument doc);
}
