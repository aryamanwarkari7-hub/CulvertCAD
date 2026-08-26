using CulvertCAD.Core.Entities;

namespace CulvertCAD.Infrastructure.MySQL.Repositories;

public interface IPipeCatalogRepository
{
    Task<PipeCatalog?> GetSuitablePipeAsync(int diameterMm, double requiredCrush);

    Task<PipeCatalog?> GetNextSuitablePipeAsync(int diameterMm, double requiredCrush);
}
