// CulvertCAD.Application/Services/BOQService.cs
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IBOQService
{
    BOQReportDto GenerateBOQ(CulvertDesign design, CalculationResultDocument result);
}

public class BOQService : IBOQService
{
    private static readonly Dictionary<string, decimal> Rates = new()
    {
        ["EarthExcavation"] = 180m, ["GranularBedding"] = 1800m,
        ["Pipe_NP2_300"] = 2800m, ["Pipe_NP2_400"] = 3800m, ["Pipe_NP2_500"] = 5200m,
        ["Pipe_NP2_600"] = 7200m, ["Pipe_NP2_700"] = 9800m, ["Pipe_NP2_800"] = 13200m,
        ["Pipe_NP2_900"] = 17500m, ["Pipe_NP2_1000"] = 22800m,
        ["Pipe_NP3_300"] = 3600m, ["Pipe_NP3_400"] = 4900m, ["Pipe_NP3_500"] = 6800m,
        ["Pipe_NP3_600"] = 9400m, ["Pipe_NP3_700"] = 12700m, ["Pipe_NP3_800"] = 17200m,
        ["Pipe_NP3_900"] = 22800m, ["Pipe_NP3_1000"] = 29600m,
        ["RCC_Wingwall"] = 8500m, ["PCC_Apron"] = 4200m,
        ["BackfillCompact"] = 120m, ["Dismantling_ExCd"] = 2500m,
    };

    public BOQReportDto GenerateBOQ(CulvertDesign design, CalculationResultDocument result)
    {
        var items = new List<BOQItemDto>();
        int itemNo = 1;

        double D  = result.SelectedDiameterMm / 1000.0;
        double t  = GetWallThickness(result.SelectedDiameterMm, result.SelectedPipeClass) / 1000.0;
        double Bd = D + 0.6;
        double H  = (double)(design.FillHeightM ?? 0.5m);
        double L  = (double)(design.RoadwayWidthM ?? 7.5m) + 1.0;
        int    nP = result.NumberOfPipes;
        double Ww = 4.5;

        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = "Dismantling existing pipe culvert / CD structure", Unit = "No.", Quantity = 1, RateRs = Rates["Dismantling_ExCd"], AmountRs = Rates["Dismantling_ExCd"] });

        double excavVol = Bd * (H + D + t*2 + 0.15) * L;
        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = $"Earth excavation, depth {H+D:0.00}m, width {Bd:0.00}m (IS 783 Cl.7.2)", Unit = "m³", Quantity = Math.Round(excavVol,2), RateRs = Rates["EarthExcavation"], AmountRs = Math.Round(Rates["EarthExcavation"]*(decimal)excavVol,2) });

        double beddingVol = Bd * 0.15 * L * nP;
        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = "Granular bedding (IS 783 Class B, 120° support), 150mm thick", Unit = "m³", Quantity = Math.Round(beddingVol,2), RateRs = Rates["GranularBedding"], AmountRs = Math.Round(Rates["GranularBedding"]*(decimal)beddingVol,2) });

        string pipeKey = $"Pipe_{result.SelectedPipeClass.Split(' ').ElementAtOrDefault(2) ?? "NP2"}_{result.SelectedDiameterMm}";
        if (!Rates.TryGetValue(pipeKey, out decimal pipeRate)) pipeRate = Rates.Where(k=>k.Key.StartsWith("Pipe_NP2")).Last().Value;
        double pipeQty = L * nP + 0.5;
        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = $"Supplying and laying precast concrete pipes IS 458:2003 {result.SelectedPipeClass}, with rubber ring joints", Unit = "m", Quantity = Math.Round(pipeQty,1), RateRs = pipeRate, AmountRs = Math.Round(pipeRate*(decimal)pipeQty,2) });

        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = "RCC M20 wingwalls (2 per culvert)", Unit = "m³", Quantity = Math.Round(Ww*2,2), RateRs = Rates["RCC_Wingwall"], AmountRs = Math.Round(Rates["RCC_Wingwall"]*(decimal)(Ww*2),2) });

        double apronVol = 2.5 * 2.0 * 0.3;
        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = "PCC M15 inlet/outlet apron", Unit = "m³", Quantity = Math.Round(apronVol*2,2), RateRs = Rates["PCC_Apron"], AmountRs = Math.Round(Rates["PCC_Apron"]*(decimal)(apronVol*2),2) });

        double backfillVol = Math.Max(excavVol - beddingVol - (Math.PI*Math.Pow(D/2+t,2)*L*nP), 0);
        items.Add(new BOQItemDto { ItemNo = $"{itemNo++}", Description = "Selected granular backfill, compacted to 95% Proctor density", Unit = "m³", Quantity = Math.Round(backfillVol,2), RateRs = Rates["BackfillCompact"], AmountRs = Math.Round(Rates["BackfillCompact"]*(decimal)backfillVol,2) });

        return new BOQReportDto
        {
            ProjectName = design.Project?.ProjectName ?? "", ProjectCode = design.Project?.ProjectCode ?? "",
            GeneratedAt = DateTime.UtcNow, Items = items, TotalAmountRs = items.Sum(i => i.AmountRs),
        };
    }

    private static int GetWallThickness(int diaMm, string pipeClassStr)
    {
        bool isNP3 = pipeClassStr.Contains("NP3");
        return (diaMm, isNP3) switch
        {
            (300, true) => 44, (300, false) => 38, (400, true) => 50, (400, false) => 43,
            (500, true) => 56, (500, false) => 47, (600, true) => 62, (600, false) => 52,
            (700, true) => 68, (700, false) => 57, (800, true) => 74, (800, false) => 62,
            (900, true) => 80, (900, false) => 67, (1000, true) => 86, (1000, false) => 72,
            _ => 50
        };
    }
}
