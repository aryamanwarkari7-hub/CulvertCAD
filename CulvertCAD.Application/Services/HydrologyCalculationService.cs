using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public class HydrologyCalculationService : IHydrologyCalculationService
{
    public double CalculateRationalQ(double C, double I, double A) =>
        Math.Round(C * I * A / 360.0, 4);

    public double CalculateQ(HydrologicalMethod method, double C, double I, double A)
    {
        return method switch
        {
            HydrologicalMethod.Rational => CalculateRationalQ(C, I, A),

            _ => throw new ArgumentException(
                $"Hydrological method '{method}' is not currently supported."
            ),
        };
    }
}
