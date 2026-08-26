using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public class HydraulicCalculationService : IHydraulicCalculationService
{
    private readonly IHeadwaterCalculationService _headwaterCalculationService;

    public HydraulicCalculationService(IHeadwaterCalculationService headwaterCalculationService)
    {
        _headwaterCalculationService = headwaterCalculationService;
    }

    private static readonly int[] StandardDiameters = { 300, 400, 500, 600, 700, 800, 900, 1000 };

    public HydraulicResult CalculateHydraulic(double Q, double slopePct, int nPipes = 1)
    {
        double S = Math.Max(slopePct / 100.0, 0.001);
        double n = 0.013;
        double qPerPipe = Q / nPipes;
        var steps = new List<CalcStep>();

        foreach (int dMm in StandardDiameters)
        {
            double D = dMm / 1000.0;
            double A_pipe = Math.PI * D * D / 4.0;
            double R = D / 4.0;
            double Qfull = (1.0 / n) * A_pipe * Math.Pow(R, 2.0 / 3.0) * Math.Pow(S, 0.5);

            double vFull = Qfull / A_pipe;
            double vDesign = qPerPipe / A_pipe;

            if (Qfull * 0.75 >= qPerPipe && vFull >= 0.6 && vFull <= 3.5)
            {
                double HW = _headwaterCalculationService.CalculateHeadwater(qPerPipe, D);

                steps.AddRange(
                    BuildHydraulicSteps(Q, nPipes, D, A_pipe, R, Qfull, vFull, vDesign, HW, n, S)
                );

                return new HydraulicResult
                {
                    DiameterMm = dMm,
                    NPipes = nPipes,
                    Qfull = Math.Round(Qfull, 4),
                    Qdesign = Math.Round(Qfull * 0.75, 4),
                    VelocityFull = Math.Round(vFull, 3),
                    VelocityDesign = Math.Round(vDesign, 3),
                    HeadwaterDepth = Math.Round(HW, 3),
                    IsAdequate = true,
                    Steps = steps,
                };
            }
        }

        if (nPipes < 4)
            return CalculateHydraulic(Q, slopePct, nPipes + 1);

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
                Formula = "concrete pipe",
                Result = $"{n}",
                Unit = "",
                Clause = "IS 783 Cl.7.1",
            },
            new()
            {
                Label = "Full Bore Capacity Qfull",
                Formula = "(1/n)×A×R^(2/3)×S^(1/2)",
                Result = $"{Qf:0.0000}",
                Unit = "m³/s",
                Clause = "IS 783",
            },
            new()
            {
                Label = "Design Capacity (75% Qfull)",
                Formula = "IRC 89 freeboard",
                Result = $"{Qf * 0.75:0.0000}",
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
        double n = 0.013;

        double qPerPipe = Q / nPipes;
        double D = diameterMm / 1000.0;

        double A_pipe = Math.PI * D * D / 4.0;
        double R = D / 4.0;

        double Qfull = (1.0 / n) * A_pipe * Math.Pow(R, 2.0 / 3.0) * Math.Pow(S, 0.5);

        double vFull = Qfull / A_pipe;
        double vDesign = qPerPipe / A_pipe;

        double HW = _headwaterCalculationService.CalculateHeadwater(qPerPipe, D);

        bool adequate = Qfull * 0.75 >= qPerPipe && vFull >= 0.6 && vFull <= 3.5;

        var steps = BuildHydraulicSteps(Q, nPipes, D, A_pipe, R, Qfull, vFull, vDesign, HW, n, S);

        return new HydraulicResult
        {
            DiameterMm = diameterMm,
            NPipes = nPipes,
            Qfull = Math.Round(Qfull, 4),
            Qdesign = Math.Round(Qfull * 0.75, 4),
            VelocityFull = Math.Round(vFull, 3),
            VelocityDesign = Math.Round(vDesign, 3),
            HeadwaterDepth = Math.Round(HW, 3),
            IsAdequate = adequate,
            Steps = steps,
        };
    }
}
