// CulvertCAD.Application/Services/StructuralCalculationService.cs

using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public class StructuralCalculationService : IStructuralCalculationService
{
    private readonly EngineeringCalculationSettings _settings;
    private readonly ILiveLoadService _liveLoadService;
    private readonly IBeddingService _beddingService;

    public StructuralCalculationService(
        EngineeringCalculationSettings settings,
        ILiveLoadService liveLoadService,
        IBeddingService beddingService
    )
    {
        _settings = settings;
        _liveLoadService = liveLoadService;
        _beddingService = beddingService;
    }

    public StructuralResult CalculateStructural(
        double H,
        int diaMm,
        int numberOfPipes,
        LoadClass loadClass,
        double gammaSoil = 18.5
    )
    {
        double D = diaMm / 1000.0;
        double Bd = D + _settings.TrenchWidthClearanceM;
        double Kmu = _settings.StructuralKmu;

        double Cd = (1.0 - Math.Exp(-2.0 * Kmu * H / Bd)) / (2.0 * Kmu);

        double We = Cd * gammaSoil * Bd * Bd;

        double Wl = _liveLoadService.GetLiveLoad(H, loadClass);
        double Wt = We + Wl;

        var bedding = _beddingService.GetBedding();

        string beddingClass = bedding.BeddingClass;
        double Bf = bedding.BeddingFactor;

        double reqCrush = Wt / Bf;

        var steps = new List<CalcStep>
        {
            new()
            {
                Label = "Fill Height H",
                Formula = "Road RL - Invert RL",
                Result = $"{H:0.000}",
                Unit = "m",
                Clause = "",
            },
            new()
            {
                Label = "Trench Width Bd",
                Formula = $"D + {_settings.TrenchWidthClearanceM:0.###}",
                Result = $"{Bd:0.000}",
                Unit = "m",
                Clause = "IS 783 Cl.7.2",
            },
            new()
            {
                Label = "Load Coefficient Cd",
                Formula = "(1-e^(-2Kμ×H/Bd))/2Kμ",
                Result = $"{Cd:0.0000}",
                Unit = "",
                Clause = "IS 783 Cl.5.1",
            },
            new()
            {
                Label = "Earth Load We",
                Formula = "Cd × γ × Bd²",
                Result = $"{We:0.000}",
                Unit = "kN/m",
                Clause = "IS 783 Cl.5.1",
            },
            new()
            {
                Label = "Live Load Wl",
                Formula = "IS 783 Table 1",
                Result = $"{Wl:0.0}",
                Unit = "kN/m",
                Clause = "IS 783 Table 1",
            },
            new()
            {
                Label = "Total Field Load Wt",
                Formula = "We + Wl",
                Result = $"{Wt:0.000}",
                Unit = "kN/m",
                Clause = "IS 783 Cl.5",
            },
            new()
            {
                Label = "Bedding Class",
                Formula = "granular, 120° support",
                Result = "Class B",
                Unit = "",
                Clause = "IS 783 Cl.6",
            },
            new()
            {
                Label = "Bedding Factor Bf",
                Formula = "Class B",
                Result = $"{Bf:0.###}",
                Unit = "",
                Clause = "IS 783 Cl.6",
            },
            new()
            {
                Label = "Required Crushing Load",
                Formula = "Wt / Bf",
                Result = $"{reqCrush:0.000}",
                Unit = "kN/m",
                Clause = "IS 458:2003",
            },
        };

        return new StructuralResult
        {
            EarthLoad = Math.Round(We, 3),
            LiveLoad = Math.Round(Wl, 3),
            TotalLoad = Math.Round(Wt, 3),
            BeddingClass = beddingClass,
            BeddingFactor = Bf,
            RequiredCrushKNm = Math.Round(reqCrush, 3),
            Steps = steps,
        };
    }
}
