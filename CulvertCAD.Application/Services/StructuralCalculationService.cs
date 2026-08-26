// CulvertCAD.Application/Services/StructuralCalculationService.cs

using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public class StructuralCalculationService : IStructuralCalculationService
{
    private static readonly (double H, double Wl)[] LiveLoadTable =
    {
        (0.3, 22.0),
        (0.6, 18.5),
        (0.9, 14.5),
        (1.2, 11.0),
        (1.5, 8.5),
        (1.8, 6.5),
        (2.1, 5.0),
        (2.4, 4.0),
        (3.0, 2.5),
        (3.6, 2.0),
        (4.0, 1.5),
    };

    public StructuralResult CalculateStructural(
        double H,
        int diaMm,
        int numberOfPipes,
        string loadClass,
        double gammaSoil = 18.5
    )
    {
        double D = diaMm / 1000.0;
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
                Formula = "D + 0.6",
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
                Result = "1.9",
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

    private static double GetLiveLoad(double H, string loadClass)
    {
        var table = loadClass.Contains("70R") ? LiveLoadTable70R : LiveLoadTable;

        if (H <= table[0].H)
            return table[0].Wl;

        if (H >= table[^1].H)
            return table[^1].Wl;

        for (int i = 0; i < table.Length - 1; i++)
        {
            var a = table[i];
            var b = table[i + 1];

            if (H >= a.H && H <= b.H)
            {
                double t = (H - a.H) / (b.H - a.H);

                return a.Wl + t * (b.Wl - a.Wl);
            }
        }

        return table[^1].Wl;
    }

    private static readonly (double H, double Wl)[] LiveLoadTable70R =
    {
        (0.3, 44.0),
        (0.6, 37.0),
        (0.9, 29.0),
        (1.2, 22.0),
        (1.5, 17.0),
        (1.8, 13.0),
        (2.1, 10.0),
        (2.4, 8.0),
        (3.0, 5.0),
        (3.6, 4.0),
        (4.0, 3.0),
    };
}
