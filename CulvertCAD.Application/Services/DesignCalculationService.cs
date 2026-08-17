// CulvertCAD.Application/Services/DesignCalculationService.cs
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Entities;
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Infrastructure.MySQL.Data;

namespace CulvertCAD.Application.Services;

public interface IDesignCalculationService
{
    Task<CalculationResultDocument> CalculateAsync(CulvertDesign design);
    HydraulicResult CalculateHydraulic(double Q, double slopePct, int nPipes = 1);
    StructuralResult CalculateStructural(double H, int diaMm, string loadClass, double gammaSoil = 18.5);
}

public class DesignCalculationService : IDesignCalculationService
{
    private readonly AppDbContext _db;
    private static readonly int[] StandardDiameters = { 300, 400, 500, 600, 700, 800, 900, 1000 };

    public DesignCalculationService(AppDbContext db) => _db = db;

    public async Task<CalculationResultDocument> CalculateAsync(CulvertDesign design)
    {
        double Q = design.DesignDischargeQ.HasValue
            ? (double)design.DesignDischargeQ.Value
            : CalculateRationalQ((double)(design.RunoffCoefficient ?? 0.55m),
                                  (double)(design.RainfallIntensityMmHr ?? 80m),
                                  (double)(design.CatchmentAreaHa ?? 10m));

        double slope  = (double)(design.SlopePercent ?? 0.5m);
        double H      = (double)(design.FillHeightM ?? 0.5m);
        double gamma  = (double)design.SoilUnitWeightKNm3;
        string lc     = design.LoadClass.ToString();

        var hyd = CalculateHydraulic(Q, slope);
        var str = CalculateStructural(H, hyd.DiameterMm, lc, gamma);
        var pipe = await SelectPipeAsync(str.RequiredCrushKNm, hyd.DiameterMm);

        double fos = pipe != null
            ? (double)pipe.UltimateCrushingLoadKNperM * str.BeddingFactor / str.TotalLoad
            : 0;

        return new CalculationResultDocument
        {
            DesignId              = design.Id,
            CalculatedAt          = DateTime.UtcNow,
            CatchmentAreaHa       = (double)(design.CatchmentAreaHa ?? 0),
            RainfallIntensityMmHr = (double)(design.RainfallIntensityMmHr ?? 80),
            RunoffCoefficient     = (double)(design.RunoffCoefficient ?? 0.55m),
            DesignDischargeQ      = Q,
            SelectedDiameterMm   = hyd.DiameterMm,
            NumberOfPipes        = hyd.NPipes,
            QfullM3s             = hyd.Qfull,
            QdesignM3s           = hyd.Qdesign,
            VelocityFullFlowMs   = hyd.VelocityFull,
            VelocityDesignMs     = hyd.VelocityDesign,
            HeadwaterDepthM      = hyd.HeadwaterDepth,
            HydraulicAdequate    = hyd.IsAdequate,
            EarthLoadWeKNm       = str.EarthLoad,
            LiveLoadWlKNm        = str.LiveLoad,
            TotalLoadWtKNm       = str.TotalLoad,
            BeddingClass         = str.BeddingClass,
            BeddingFactor        = str.BeddingFactor,
            RequiredCrushKNm     = str.RequiredCrushKNm,
            SelectedPipeClass    = pipe != null ? $"IS 458 {pipe.PipeClassCode} Ø{pipe.DiameterMm}mm" : "Not found",
            SelectedPipeDiaMm    = pipe?.DiameterMm ?? hyd.DiameterMm,
            PipeCrushCapKNm      = pipe != null ? (double)pipe.UltimateCrushingLoadKNperM : 0,
            FactorOfSafety       = Math.Round(fos, 3),
            StructuralAdequate   = fos >= 1.5,
            IsDesignSatisfactory = hyd.IsAdequate && fos >= 1.5,
            HydraulicSteps       = hyd.Steps,
            StructuralSteps      = str.Steps,
        };
    }

    public static double CalculateRationalQ(double C, double I, double A)
        => Math.Round(C * I * A / 360.0, 4);

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
            double vFull  = Qfull / A_pipe;
            double vDesign = qPerPipe / A_pipe;

            if (Qfull * 0.75 >= qPerPipe && vFull >= 0.6 && vFull <= 3.5)
            {
                double HW = CalculateHeadwater(qPerPipe, D);
                steps.AddRange(BuildHydraulicSteps(Q, nPipes, D, A_pipe, R, Qfull, vFull, vDesign, HW, n, S));

                return new HydraulicResult
                {
                    DiameterMm    = dMm, NPipes = nPipes,
                    Qfull         = Math.Round(Qfull, 4),
                    Qdesign       = Math.Round(Qfull * 0.75, 4),
                    VelocityFull  = Math.Round(vFull, 3),
                    VelocityDesign = Math.Round(vDesign, 3),
                    HeadwaterDepth = Math.Round(HW, 3),
                    IsAdequate    = true, Steps = steps,
                };
            }
        }

        if (nPipes < 4) return CalculateHydraulic(Q, slopePct, nPipes + 1);
        return new HydraulicResult { IsAdequate = false, Steps = steps };
    }

    private static double CalculateHeadwater(double q, double D, double Ke = 0.5)
    {
        double Hc = 0.5 * D;
        double v  = q / (Math.PI * D * D / 4.0);
        return Hc + Ke * v * v / (2 * 9.81);
    }

    private static List<CalcStep> BuildHydraulicSteps(double Q, int nPipes, double D, double A, double R,
        double Qf, double vf, double vd, double HW, double n, double S)
    {
        return new List<CalcStep>
        {
            new(){ Label="Design Discharge Q",          Formula="C × I × A / 360",         Result=$"{Q:0.0000}",  Unit="m³/s",  Clause="IS SP 13 Cl.4"},
            new(){ Label="No. of Pipes",                Formula="trial",                    Result=$"{nPipes}",   Unit="nos",   Clause="IRC 89 Cl.4.4"},
            new(){ Label="Selected Diameter",           Formula="IS 458 standard",          Result=$"Ø{D*1000:0}",Unit="mm",    Clause="IS 458:2003"},
            new(){ Label="Pipe Area A",                 Formula="π/4 × D²",                 Result=$"{A:0.00000}", Unit="m²",   Clause=""},
            new(){ Label="Hydraulic Radius R",           Formula="D/4",                      Result=$"{R:0.0000}",  Unit="m",    Clause=""},
            new(){ Label="Manning's n",                 Formula="concrete pipe",            Result=$"{n}",         Unit="",     Clause="IS 783 Cl.7.1"},
            new(){ Label="Full Bore Capacity Qfull",     Formula="(1/n)×A×R^(2/3)×S^(1/2)",  Result=$"{Qf:0.0000}", Unit="m³/s", Clause="IS 783"},
            new(){ Label="Design Capacity (75% Qfull)",  Formula="IRC 89 freeboard",         Result=$"{Qf*0.75:0.0000}", Unit="m³/s", Clause="IRC 89 Cl.4.4"},
            new(){ Label="Velocity at Full Flow",        Formula="Qfull / A",                Result=$"{vf:0.000}",  Unit="m/s",  Clause="IRC 89 Cl.4.3"},
            new(){ Label="Velocity at Design Flow",      Formula="Q/nPipes / A",             Result=$"{vd:0.000}",  Unit="m/s",  Clause=""},
            new(){ Label="Headwater Depth HW",           Formula="0.5D + Ke×V²/2g",          Result=$"{HW:0.000}",  Unit="m",    Clause="IS 783"},
        };
    }

    public StructuralResult CalculateStructural(double H, int diaMm, string loadClass, double gammaSoil = 18.5)
    {
        double D  = diaMm / 1000.0;
        double Bd = D + 0.6;
        double Kmu = 0.150;
        double Cd = (1.0 - Math.Exp(-2.0 * Kmu * H / Bd)) / (2.0 * Kmu);
        double We = Cd * gammaSoil * Bd * Bd;

        double Wl = GetLiveLoad(H, loadClass);
        double Wt = We + Wl;

        const string beddingClass = "ClassB";
        const double Bf = 1.9;
        double reqCrush = Wt / Bf;

        var steps = new List<CalcStep>
        {
            new(){ Label="Fill Height H",          Formula="Road RL - Invert RL",     Result=$"{H:0.000}",       Unit="m",     Clause=""},
            new(){ Label="Trench Width Bd",        Formula="D + 0.6",                 Result=$"{Bd:0.000}",      Unit="m",     Clause="IS 783 Cl.7.2"},
            new(){ Label="Load Coefficient Cd",    Formula="(1-e^(-2Kμ×H/Bd))/2Kμ",   Result=$"{Cd:0.0000}",    Unit="",      Clause="IS 783 Cl.5.1"},
            new(){ Label="Earth Load We",          Formula="Cd × γ × Bd²",            Result=$"{We:0.000}",      Unit="kN/m",  Clause="IS 783 Cl.5.1"},
            new(){ Label="Live Load Wl",           Formula="IS 783 Table 1",          Result=$"{Wl:0.0}",        Unit="kN/m",  Clause="IS 783 Table 1"},
            new(){ Label="Total Field Load Wt",    Formula="We + Wl",                 Result=$"{Wt:0.000}",      Unit="kN/m",  Clause="IS 783 Cl.5"},
            new(){ Label="Bedding Class",          Formula="granular, 120° support",  Result="Class B",          Unit="",      Clause="IS 783 Cl.6"},
            new(){ Label="Bedding Factor Bf",      Formula="Class B",                 Result="1.9",              Unit="",      Clause="IS 783 Cl.6"},
            new(){ Label="Required Crushing Load", Formula="Wt / Bf",                Result=$"{reqCrush:0.000}", Unit="kN/m", Clause="IS 458:2003"},
        };

        return new StructuralResult
        {
            EarthLoad        = Math.Round(We, 3),
            LiveLoad         = Math.Round(Wl, 3),
            TotalLoad        = Math.Round(Wt, 3),
            BeddingClass     = beddingClass,
            BeddingFactor    = Bf,
            RequiredCrushKNm = Math.Round(reqCrush, 3),
            Steps            = steps,
        };
    }

    private static readonly (double H, double Wl)[] LiveLoadTable =
    {
        (0.3, 22.0), (0.6, 18.5), (0.9, 14.5), (1.2, 11.0),
        (1.5, 8.5),  (1.8, 6.5),  (2.1, 5.0),  (2.4, 4.0),
        (3.0, 2.5),  (3.6, 2.0),  (4.0, 1.5)
    };

    private static readonly (double H, double Wl)[] LiveLoadTable70R =
    {
        (0.3, 28.0), (0.6, 22.0), (0.9, 17.5), (1.2, 13.5),
        (1.5, 10.5), (2.0, 7.5),  (3.0, 4.0),  (4.0, 2.5)
    };

    public static double GetLiveLoad(double H, string loadClass)
    {
        var table = loadClass.Contains("70R") ? LiveLoadTable70R : LiveLoadTable;
        for (int i = 0; i < table.Length - 1; i++)
        {
            if (H >= table[i].H && H <= table[i + 1].H)
            {
                double t = (H - table[i].H) / (table[i + 1].H - table[i].H);
                return Math.Round(table[i].Wl + t * (table[i + 1].Wl - table[i].Wl), 2);
            }
        }
        return H < table[0].H ? table[0].Wl : table[^1].Wl;
    }

    private async Task<PipeCatalog?> SelectPipeAsync(double requiredCrush, int diamMm)
    {
        var pipe = await _db.PipeCatalog
            .Where(p => p.IsActive && p.DiameterMm == diamMm && (double)p.UltimateCrushingLoadKNperM >= requiredCrush)
            .OrderBy(p => p.UltimateCrushingLoadKNperM)
            .FirstOrDefaultAsync();

        if (pipe != null) return pipe;

        var nextDia = StandardDiameters.FirstOrDefault(d => d > diamMm);
        if (nextDia == 0) return null;

        return await _db.PipeCatalog
            .Where(p => p.IsActive && p.DiameterMm == nextDia && (double)p.UltimateCrushingLoadKNperM >= requiredCrush)
            .OrderBy(p => p.UltimateCrushingLoadKNperM)
            .FirstOrDefaultAsync();
    }
}

public class HydraulicResult
{
    public int    DiameterMm     { get; set; }
    public int    NPipes         { get; set; } = 1;
    public double Qfull          { get; set; }
    public double Qdesign        { get; set; }
    public double VelocityFull   { get; set; }
    public double VelocityDesign { get; set; }
    public double HeadwaterDepth { get; set; }
    public bool   IsAdequate     { get; set; }
    public List<CalcStep> Steps  { get; set; } = new();
}

public class StructuralResult
{
    public double EarthLoad        { get; set; }
    public double LiveLoad         { get; set; }
    public double TotalLoad        { get; set; }
    public string BeddingClass     { get; set; } = "ClassB";
    public double BeddingFactor    { get; set; }
    public double RequiredCrushKNm { get; set; }
    public List<CalcStep> Steps    { get; set; } = new();
}
