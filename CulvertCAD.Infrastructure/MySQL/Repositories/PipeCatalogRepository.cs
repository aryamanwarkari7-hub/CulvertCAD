using CulvertCAD.Core.Entities;
using CulvertCAD.Infrastructure.MySQL.Data;
using Microsoft.EntityFrameworkCore;

namespace CulvertCAD.Infrastructure.MySQL.Repositories;

public class PipeCatalogRepository : IPipeCatalogRepository
{
    private readonly AppDbContext _db;

    public PipeCatalogRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PipeCatalog?> GetSuitablePipeAsync(int diameterMm, double requiredCrush)
    {
        return await _db
            .PipeCatalog.Where(p =>
                p.IsActive
                && p.DiameterMm == diameterMm
                && (double)p.UltimateCrushingLoadKNperM >= requiredCrush
            )
            .OrderBy(p => p.UltimateCrushingLoadKNperM)
            .FirstOrDefaultAsync();
    }

    public async Task<PipeCatalog?> GetNextSuitablePipeAsync(int diameterMm, double requiredCrush)
    {
        return await _db
            .PipeCatalog.Where(p =>
                p.IsActive
                && p.DiameterMm > diameterMm
                && (double)p.UltimateCrushingLoadKNperM >= requiredCrush
            )
            .OrderBy(p => p.DiameterMm)
            .ThenBy(p => p.UltimateCrushingLoadKNperM)
            .FirstOrDefaultAsync();
    }
}
