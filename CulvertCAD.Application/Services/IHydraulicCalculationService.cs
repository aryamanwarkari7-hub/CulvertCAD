using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IHydraulicCalculationService
{
    Task<HydraulicResult> CalculateHydraulic(HydraulicCalculationInputModel input, int nPipes = 1);

    HydraulicResult CalculateHydraulicForDiameter(
        HydraulicCalculationInputModel input,
        int diameterMm,
        int nPipes = 1
    );
}
