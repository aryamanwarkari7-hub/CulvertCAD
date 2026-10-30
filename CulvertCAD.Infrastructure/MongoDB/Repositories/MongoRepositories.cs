// CulvertCAD.Infrastructure/MongoDB/Repositories/MongoRepositories.cs
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Repositories;
using MongoDB.Driver;

namespace CulvertCAD.Infrastructure.MongoDB.Repositories;

public class MongoDbContext
{
    private readonly IMongoDatabase _db;

    public MongoDbContext(IMongoClient client, string dbName) => _db = client.GetDatabase(dbName);

    public IMongoCollection<SurveyDocument> Surveys => _db.GetCollection<SurveyDocument>("surveys");
    public IMongoCollection<CalculationResultDocument> CalcResults =>
        _db.GetCollection<CalculationResultDocument>("calc_results");
    public IMongoCollection<RevisionInputDocument> RevisionInputs =>
        _db.GetCollection<RevisionInputDocument>("revision_inputs");
    public IMongoCollection<DrawingDocument> Drawings =>
        _db.GetCollection<DrawingDocument>("drawings");
    public IMongoCollection<AlignmentDocument> Alignments =>
        _db.GetCollection<AlignmentDocument>("alignments");
    public IMongoCollection<BatchDesignRunDocument> BatchRuns =>
        _db.GetCollection<BatchDesignRunDocument>("batch_runs");
    public IMongoCollection<CulvertSolidDocument> CulvertSolids =>
        _db.GetCollection<CulvertSolidDocument>("culvert_solids");
}

public class SurveyRepository : ISurveyRepository
{
    private readonly MongoDbContext _ctx;

    public SurveyRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<SurveyDocument?> GetByProjectAsync(int projectId) =>
        await _ctx
            .Surveys.Find(s => s.ProjectId == projectId)
            .SortByDescending(s => s.UploadedAt)
            .FirstOrDefaultAsync();

    public async Task<SurveyDocument?> GetByIdAsync(string id) =>
        await _ctx.Surveys.Find(s => s.Id == id).FirstOrDefaultAsync();

    public async Task<string> InsertAsync(SurveyDocument doc)
    {
        await _ctx.Surveys.InsertOneAsync(doc);
        return doc.Id;
    }

    public async Task UpdateAsync(SurveyDocument doc) =>
        await _ctx.Surveys.ReplaceOneAsync(s => s.Id == doc.Id, doc);

    public async Task DeleteAsync(string id) => await _ctx.Surveys.DeleteOneAsync(s => s.Id == id);
}

public class CalcResultRepository : ICalcResultRepository
{
    private readonly MongoDbContext _ctx;

    public CalcResultRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<CalculationResultDocument?> GetByRevisionAsync(int revisionId) =>
        await _ctx
            .CalcResults.Find(r => r.RevisionId == revisionId)
            .SortByDescending(r => r.CalculatedAt)
            .FirstOrDefaultAsync();

    public async Task<CalculationResultDocument?> GetByIdAsync(string id) =>
        await _ctx.CalcResults.Find(r => r.Id == id).FirstOrDefaultAsync();

    public async Task<string> InsertAsync(CalculationResultDocument doc)
    {
        await _ctx.CalcResults.InsertOneAsync(doc);
        return doc.Id;
    }

    public async Task UpdateAsync(CalculationResultDocument doc) =>
        await _ctx.CalcResults.ReplaceOneAsync(r => r.Id == doc.Id, doc);
}

public class RevisionInputRepository : IRevisionInputRepository
{
    private readonly MongoDbContext _ctx;

    public RevisionInputRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<string> InsertAsync(RevisionInputDocument document)
    {
        await _ctx.RevisionInputs.InsertOneAsync(document);
        return document.Id;
    }

    public async Task<RevisionInputDocument?> GetByIdAsync(string id) =>
        await _ctx.RevisionInputs.Find(r => r.Id == id).FirstOrDefaultAsync();

    public async Task UpdateAsync(RevisionInputDocument document) =>
        await _ctx.RevisionInputs.ReplaceOneAsync(r => r.Id == document.Id, document);
}

public class DrawingRepository : IDrawingRepository
{
    private readonly MongoDbContext _ctx;

    public DrawingRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<DrawingDocument?> GetByRevisionAsync(int revisionId) =>
        await _ctx.Drawings.Find(d => d.RevisionId == revisionId).FirstOrDefaultAsync();

    public async Task<DrawingDocument?> GetByIdAsync(string id) =>
        await _ctx.Drawings.Find(d => d.Id == id).FirstOrDefaultAsync();

    public async Task<string> InsertAsync(DrawingDocument doc)
    {
        await _ctx.Drawings.InsertOneAsync(doc);
        return doc.Id;
    }

    public async Task UpdateAsync(DrawingDocument doc) =>
        await _ctx.Drawings.ReplaceOneAsync(d => d.Id == doc.Id, doc);

    public async Task DeleteAsync(string id) => await _ctx.Drawings.DeleteOneAsync(d => d.Id == id);
}

public class AlignmentRepository : IAlignmentRepository
{
    private readonly MongoDbContext _ctx;

    public AlignmentRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<AlignmentDocument?> GetByProjectAsync(int projectId) =>
        await _ctx
            .Alignments.Find(a => a.ProjectId == projectId)
            .SortByDescending(a => a.ImportedAt)
            .FirstOrDefaultAsync();

    public async Task<string> InsertAsync(AlignmentDocument doc)
    {
        await _ctx.Alignments.InsertOneAsync(doc);
        return doc.Id;
    }

    public async Task UpdateAsync(AlignmentDocument doc) =>
        await _ctx.Alignments.ReplaceOneAsync(a => a.Id == doc.Id, doc);
}

public class BatchRunRepository : IBatchRunRepository
{
    private readonly MongoDbContext _ctx;

    public BatchRunRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<List<BatchDesignRunDocument>> GetByProjectAsync(int projectId) =>
        await _ctx
            .BatchRuns.Find(b => b.ProjectId == projectId)
            .SortByDescending(b => b.StartedAt)
            .ToListAsync();

    public async Task<BatchDesignRunDocument?> GetByIdAsync(string id) =>
        await _ctx.BatchRuns.Find(b => b.Id == id).FirstOrDefaultAsync();

    public async Task<string> InsertAsync(BatchDesignRunDocument doc)
    {
        await _ctx.BatchRuns.InsertOneAsync(doc);
        return doc.Id;
    }

    public async Task UpdateAsync(BatchDesignRunDocument doc) =>
        await _ctx.BatchRuns.ReplaceOneAsync(b => b.Id == doc.Id, doc);
}

public class CulvertSolidRepository : ICulvertSolidRepository
{
    private readonly MongoDbContext _ctx;

    public CulvertSolidRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<CulvertSolidDocument?> GetByProjectAsync(int projectId, string modelType = "3D_SOLID") =>
        await _ctx.CulvertSolids
            .Find(s => s.ProjectId == projectId && s.ModelType == modelType)
            .SortByDescending(s => s.UploadedAt)
            .FirstOrDefaultAsync();

    public async Task<string> UpsertByProjectAsync(CulvertSolidDocument doc)
    {
        var filter = Builders<CulvertSolidDocument>.Filter.And(
            Builders<CulvertSolidDocument>.Filter.Eq(s => s.ProjectId, doc.ProjectId),
            Builders<CulvertSolidDocument>.Filter.Eq(s => s.ModelType, doc.ModelType)
        );

        var options = new ReplaceOptions { IsUpsert = true };
        await _ctx.CulvertSolids.ReplaceOneAsync(filter, doc, options);
        return doc.Id;
    }
}
