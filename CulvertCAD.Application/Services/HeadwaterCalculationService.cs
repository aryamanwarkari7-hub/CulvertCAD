using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public class HeadwaterCalculationService : IHeadwaterCalculationService
{
    public double CalculateHeadwater(
        HydraulicCalculationInputModel input,
        double diameterM,
        int nPipes = 1
    )
    {
        double qPerPipe = input.DischargeM3s / nPipes;

        double area = Math.PI * diameterM * diameterM / 4.0;

        double velocity = qPerPipe / area;

        // Temporary structural calculation boundary.
        // Final IRC-based headwater/control methodology will be implemented
        // after the hydraulic input and inlet-loss basis are fully defined.
        double criticalDepth = 0.5 * diameterM;

        return criticalDepth;
    }
}
