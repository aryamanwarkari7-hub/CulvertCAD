using CulvertCAD.Core.Entities;
using CulvertCAD.Infrastructure.MySQL.Repositories;

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

    public async Task<HydraulicResult> CalculateHydraulic(double Q, double slopePct, int nPipes = 1)
    {
        double S = Math.Max(slopePct / 100.0, 0.001);
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

            if (Qfull * _settings.DesignCapacityFactor >= qPerPipe && vFull >= 0.6 && vFull <= 3.5)
            {
                double HW = _headwaterCalculationService.CalculateHeadwater(qPerPipe, D);

                steps.AddRange(
                    BuildHydraulicSteps(
                        Q,
                        nPipes,
                        D,
                        A_pipe,
                        R,
                        Qfull,
                        vFull,
                        vDesign,
                        HW,
                        n,
                        S,
                        _settings.DesignCapacityFactor
                    )
                );

                return new HydraulicResult
                {
                    DiameterMm = dMm,
                    NPipes = nPipes,
                    Qfull = Math.Round(Qfull, 4),
                    Qdesign = Math.Round(Qfull * _settings.DesignCapacityFactor, 4),
                    QfullTotal = Math.Round(Qfull * nPipes, 4),
                    QdesignTotal = Math.Round(Qfull * _settings.DesignCapacityFactor * nPipes, 4),
                    VelocityFull = Math.Round(vFull, 3),
                    VelocityDesign = Math.Round(vDesign, 3),
                    HeadwaterDepth = Math.Round(HW, 3),
                    IsAdequate = true,
                    Steps = steps,
                };
            }
        }

        if (nPipes < 4)
            return await CalculateHydraulic(Q, slopePct, nPipes + 1);

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
        double S,
        double designCapacityFactor
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
                Clause = "IS SP 13 Cl.4",
            },
            new()
            {
                Label = "No. of Pipes",
                Formula = "trial",
                Result = $"{nPipes}",
                Unit = "nos",
                Clause = "IRC 89 Cl.4.4",
            },
            new()
            {
                Label = "Selected Diameter",
                Formula = "IS 458 standard",
                Result = $"Ø{D * 1000:0}",
                Unit = "mm",
                Clause = "IS 458:2003",
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
                Formula = "configured engineering value",
                Result = $"{n}",
                Unit = "",
                Clause = "IS 783 Cl.7.1",
            },
            new()
            {
                Label = "Full Bore Capacity Qfull (per pipe)",
                Formula = "(1/n)×A×R^(2/3)×S^(1/2)",
                Result = $"{Qf:0.0000}",
                Unit = "m³/s",
                Clause = "IS 783",
            },
            new()
            {
                Label = $"Design Capacity ({designCapacityFactor:P0} Qfull, per pipe)",
                Formula = "Design capacity factor × Qfull",
                Result = $"{Qf * designCapacityFactor:0.0000}",
                Unit = "m³/s",
                Clause = "IRC 89 Cl.4.4",
            },
            new()
            {
                Label = "Total Design Capacity",
                Formula = $"{designCapacityFactor:P0} × Qfull × No. of Pipes",
                Result = $"{Qf * designCapacityFactor * nPipes:0.0000}",
                Unit = "m³/s",
                Clause = "IRC 89 Cl.4.4",
            },
            new()
            {
                Label = "Velocity at Full Flow",
                Formula = "Qfull / A",
                Result = $"{vf:0.000}",
                Unit = "m/s",
                Clause = "IRC 89 Cl.4.3",
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
                Formula = "0.5D + Ke×V²/2g",
                Result = $"{HW:0.000}",
                Unit = "m",
                Clause = "IS 783",
            },
        };
    }

    public HydraulicResult CalculateHydraulicForDiameter(
        double Q,
        double slopePct,
        int diameterMm,
        int nPipes = 1
    )
    {
        double S = Math.Max(slopePct / 100.0, 0.001);
        double n = _settings.ManningN;

        double qPerPipe = Q / nPipes;
        double D = diameterMm / 1000.0;

        double A_pipe = Math.PI * D * D / 4.0;
        double R = D / 4.0;

        double Qfull = (1.0 / n) * A_pipe * Math.Pow(R, 2.0 / 3.0) * Math.Pow(S, 0.5);

        double vFull = Qfull / A_pipe;
        double vDesign = qPerPipe / A_pipe;

        double HW = _headwaterCalculationService.CalculateHeadwater(qPerPipe, D);

        bool adequate =
            Qfull * _settings.DesignCapacityFactor >= qPerPipe && vFull >= 0.6 && vFull <= 3.5;

        var steps = BuildHydraulicSteps(
            Q,
            nPipes,
            D,
            A_pipe,
            R,
            Qfull,
            vFull,
            vDesign,
            HW,
            n,
            S,
            _settings.DesignCapacityFactor
        );

        return new HydraulicResult
        {
            DiameterMm = diameterMm,
            NPipes = nPipes,
            Qfull = Math.Round(Qfull, 4),
            Qdesign = Math.Round(Qfull * _settings.DesignCapacityFactor, 4),
            QfullTotal = Math.Round(Qfull * nPipes, 4),
            QdesignTotal = Math.Round(Qfull * _settings.DesignCapacityFactor * nPipes, 4),
            VelocityFull = Math.Round(vFull, 3),
            VelocityDesign = Math.Round(vDesign, 3),
            HeadwaterDepth = Math.Round(HW, 3),
            IsAdequate = adequate,
            Steps = steps,
        };
    }
}
