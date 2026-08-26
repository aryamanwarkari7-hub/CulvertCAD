namespace CulvertCAD.Application.Services;

public interface IHeadwaterCalculationService
{
    double CalculateHeadwater(double q, double diameterM, double entranceLossCoefficient = 0.5);
}
