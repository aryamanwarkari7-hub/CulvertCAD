using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Repositories;

namespace CulvertCAD.Application.Services;

public class HydraulicCalculationService : IHydraulicCalculationService
{
    private readonly EngineeringCalculationSettings _settings;
    private readonly IHeadwaterCalculationService _headwaterCalculationService;
    private readonly IPipeCatalogRepository _pipeCatalogRepository;

    public HydraulicCalculationService(
        IHeadwaterCalculationService headwaterCalculationService,
        IPipeCatalogRepository pipeCatalogRepository,
        EngineeringCalculationSettings settings
    )
    {
        _headwaterCalculationService = headwaterCalculationService;
        _pipeCatalogRepository = pipeCatalogRepository;
        _settings = settings;
    }

    public async Task<HydraulicResult> CalculateHydraulic(
        HydraulicCalculationInputModel input,
        int nPipes = 1
    )
    {
        double Q = input.DischargeM3s;
        double S = input.SlopePercent / 100.0;
        double n = _settings.ManningN;

        double qPerPipe = Q / nPipes;
        var steps = new List<CalcStep>();

        var standardDiameters = await _pipeCatalogRepository.GetActiveDiametersAsync();

        foreach (int dMm in standardDiameters)
        {
            double D = dMm / 1000.0;
            double A_pipe = Math.PI * D * D / 4.0;
            double R = D / 4.0;

            double Qfull = (1.0 / n) * A_pipe * Math.Pow(R, 2.0 / 3.0) * Math.Pow(S, 0.5);

            double vFull = Qfull / A_pipe;
            double vDesign = qPerPipe / A_pipe;

            if (Qfull >= qPerPipe)
            {
                double HW = _headwaterCalculationService.CalculateHeadwater(input, D, nPipes);

                steps.AddRange(
                    BuildHydraulicSteps(Q, nPipes, D, A_pipe, R, Qfull, vFull, vDesign, HW, n, S)
                );

                return new HydraulicResult
                {
                    DiameterMm = dMm,
                    NPipes = nPipes,
                    Qfull = Math.Round(Qfull, 4),
                    Qdesign = Math.Round(Qfull, 4),
                    QfullTotal = Math.Round(Qfull * nPipes, 4),
                    QdesignTotal = Math.Round(Qfull * nPipes, 4),
                    VelocityFull = Math.Round(vFull, 3),
                    VelocityDesign = Math.Round(vDesign, 3),
                    HeadwaterDepth = Math.Round(HW, 3),
                    IsAdequate = true,
                    Steps = steps,
                };
            }
        }

        if (nPipes < 4)
            return await CalculateHydraulic(input, nPipes + 1);

        return new HydraulicResult { IsAdequate = false, Steps = steps };
    }

    private static List<CalcStep> BuildHydraulicSteps(
        double Q,
        int nPipes,
        double D,
        double A,
        double R,
        double Qf,
        double vf,
        double vd,
        double HW,
        double n,
        double S
    )
    {
        return new List<CalcStep>
        {
            new()
            {
                Label = "Design Discharge Q",
                Formula = "C × I × A / 360",
                Result = $"{Q:0.0000}",
                Unit = "m³/s",
                Clause = "Hydrology input/result",
            },
            new()
            {
                Label = "No. of Pipes",
                Formula = "trial",
                Result = $"{nPipes}",
                Unit = "nos",
                Clause = "",
            },
            new()
            {
                Label = "Selected Diameter",
                Formula = "Active pipe catalogue standard diameter",
                Result = $"Ø{D * 1000:0}",
                Unit = "mm",
                Clause = "IS 458:2021",
            },
            new()
            {
                Label = "Pipe Area A",
                Formula = "π/4 × D²",
                Result = $"{A:0.00000}",
                Unit = "m²",
                Clause = "",
            },
            new()
            {
                Label = "Hydraulic Radius R",
                Formula = "D/4",
                Result = $"{R:0.0000}",
                Unit = "m",
                Clause = "",
            },
            new()
            {
                Label = "Manning's n",
                Formula = "Configured engineering value",
                Result = $"{n}",
                Unit = "",
                Clause = "Engineering calculation setting",
            },
            new()
            {
                Label = "Full Bore Capacity Qfull (per pipe)",
                Formula = "(1/n) × A × R^(2/3) × S^(1/2)",
                Result = $"{Qf:0.0000}",
                Unit = "m³/s",
                Clause = "Manning equation",
            },
            new()
            {
                Label = "Hydraulic Capacity (per pipe)",
                Formula = "Qfull",
                Result = $"{Qf:0.0000}",
                Unit = "m³/s",
                Clause = "",
            },
            new()
            {
                Label = "Total Hydraulic Capacity",
                Formula = "Qfull × No. of Pipes",
                Result = $"{Qf * nPipes:0.0000}",
                Unit = "m³/s",
                Clause = "",
            },
            new()
            {
                Label = "Velocity at Full Flow",
                Formula = "Qfull / A",
                Result = $"{vf:0.000}",
                Unit = "m/s",
                Clause = "",
            },
            new()
            {
                Label = "Velocity at Design Flow",
                Formula = "Q/nPipes / A",
                Result = $"{vd:0.000}",
                Unit = "m/s",
                Clause = "",
            },
            new()
            {
                Label = "Headwater Depth HW",
                Formula = "Intermediate hydraulic result",
                Result = $"{HW:0.000}",
                Unit = "m",
                Clause = "",
            },
        };
    }

    public HydraulicResult CalculateHydraulicForDiameter(
        HydraulicCalculationInputModel input,
        int diameterMm,
        int nPipes = 1
    )
    {
        double Q = input.DischargeM3s;
        double S = input.SlopePercent / 100.0;
        double n = _settings.ManningN;
        double qPerPipe = Q / nPipes;
        double D = diameterMm / 1000.0;

        double A_pipe = Math.PI * D * D / 4.0;
        double R = D / 4.0;

        double Qfull = (1.0 / n) * A_pipe * Math.Pow(R, 2.0 / 3.0) * Math.Pow(S, 0.5);

        double vFull = Qfull / A_pipe;
        double vDesign = qPerPipe / A_pipe;

        double HW = _headwaterCalculationService.CalculateHeadwater(input, D, nPipes);

        bool adequate = Qfull >= qPerPipe;

        var steps = BuildHydraulicSteps(Q, nPipes, D, A_pipe, R, Qfull, vFull, vDesign, HW, n, S);

        return new HydraulicResult
        {
            DiameterMm = diameterMm,
            NPipes = nPipes,
            Qfull = Math.Round(Qfull, 4),
            Qdesign = Math.Round(Qfull, 4),
            QfullTotal = Math.Round(Qfull * nPipes, 4),
            QdesignTotal = Math.Round(Qfull * nPipes, 4),
            VelocityFull = Math.Round(vFull, 3),
            VelocityDesign = Math.Round(vDesign, 3),
            HeadwaterDepth = Math.Round(HW, 3),
            IsAdequate = adequate,
            Steps = steps,
        };
    }
}
