using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Repositories;

namespace CulvertCAD.Application.Services;

public class PipeSelectionService : IPipeSelectionService
{
    private readonly IPipeCatalogRepository _pipeCatalogRepository;

    public PipeSelectionService(IPipeCatalogRepository pipeCatalogRepository)
    {
        _pipeCatalogRepository = pipeCatalogRepository;
    }

    public async Task<PipeCatalog?> SelectPipeAsync(double requiredCrush, int diameterMm)
    {
        var pipe = await _pipeCatalogRepository.GetSuitablePipeAsync(diameterMm, requiredCrush);

        if (pipe != null)
            return pipe;

        return await _pipeCatalogRepository.GetNextSuitablePipeAsync(diameterMm, requiredCrush);
    }
}
