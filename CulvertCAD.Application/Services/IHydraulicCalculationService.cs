using CulvertCAD.Application.Services;

public interface IHydraulicCalculationService
{
    Task<HydraulicResult> CalculateHydraulic(double Q, double slopePct, int nPipes = 1);

    HydraulicResult CalculateHydraulicForDiameter(
        double Q,
        double slopePct,
        int diameterMm,
        int nPipes = 1
    );
}
