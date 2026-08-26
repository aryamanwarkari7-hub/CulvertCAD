using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public interface IHydrologyCalculationService
{
    double CalculateRationalQ(double C, double I, double A);

    double CalculateQ(HydrologicalMethod method, double C, double I, double A);
}
