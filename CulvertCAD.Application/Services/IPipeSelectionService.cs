using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IPipeSelectionService
{
    Task<PipeCatalog?> SelectPipeAsync(double requiredCrush, int diameterMm);
}
