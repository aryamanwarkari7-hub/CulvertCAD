// CulvertCAD.Application/Services/FOSCalculationService.cs

namespace CulvertCAD.Application.Services;

public class FOSCalculationService : IFOSCalculationService
{
    public double CalculateFOS(
        double pipeUltimateCrushingLoadKNm,
        double beddingFactor,
        double totalFieldLoadKNm
    )
    {
        if (totalFieldLoadKNm <= 0)
            return 0;

        return pipeUltimateCrushingLoadKNm * beddingFactor / totalFieldLoadKNm;
    }
}
