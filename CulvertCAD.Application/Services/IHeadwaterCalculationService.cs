using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IHeadwaterCalculationService
{
    double CalculateHeadwater(
        HydraulicCalculationInputModel input,
        double diameterM,
        int nPipes = 1
    );
}
