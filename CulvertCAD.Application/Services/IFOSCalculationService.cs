namespace CulvertCAD.Application.Services;

public interface IFOSCalculationService
{
    double CalculateFOS(
        double pipeUltimateCrushingLoadKNm,
        double beddingFactor,
        double totalFieldLoadKNm
    );
}
