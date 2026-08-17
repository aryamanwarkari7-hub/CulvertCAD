// CulvertCAD.Application/Services/SurveyImportService.cs
using System.Globalization;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public interface ISurveyImportService
{
    Task<SurveyDocument> ParseCsvAsync(Stream stream, string fileName, int projectId, int userId);
    void ComputeChainages(SurveyDocument survey);
    List<DetectedCulvertLocation> DetectCulvertLocations(SurveyDocument survey);
}

public class SurveyImportService : ISurveyImportService
{
    private static readonly Dictionary<string, SurveyCodeType> CodeMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["C"] = SurveyCodeType.Centreline, ["CL"] = SurveyCodeType.Centreline,
        ["L"] = SurveyCodeType.LeftEdge, ["l"] = SurveyCodeType.LeftEdge,
        ["R"] = SurveyCodeType.RightEdge, ["Re"] = SurveyCodeType.RightEdge, ["re"] = SurveyCodeType.RightEdge,
        ["Tr"] = SurveyCodeType.Tree, ["TR"] = SurveyCodeType.Tree,
        ["JR"] = SurveyCodeType.JunctionRoad, ["jr"] = SurveyCodeType.JunctionRoad,
        ["ex cd"] = SurveyCodeType.ExistingCulvert, ["EX CD"] = SurveyCodeType.ExistingCulvert, ["excd"] = SurveyCodeType.ExistingCulvert,
        ["Ep"] = SurveyCodeType.EdgePavement, ["EP"] = SurveyCodeType.EdgePavement,
        ["Dp"] = SurveyCodeType.Drain, ["DP"] = SurveyCodeType.Drain,
        ["Str"] = SurveyCodeType.Structure, ["STR"] = SurveyCodeType.Structure,
        ["FN"] = SurveyCodeType.Fence, ["fn"] = SurveyCodeType.Fence,
        ["Bridge"] = SurveyCodeType.Bridge, ["BRIDGE"] = SurveyCodeType.Bridge, ["bridge"] = SurveyCodeType.Bridge,
    };

    public async Task<SurveyDocument> ParseCsvAsync(Stream stream, string fileName, int projectId, int userId)
    {
        var points = new List<SurveyPoint>();
        var tbms   = new List<TBMPoint>();

        using var reader = new StreamReader(stream);
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(line)) continue;

            var parts = line.Split(',');
            if (parts.Length < 5) continue;

            if (!int.TryParse(parts[0].Trim(), out int ptNo)) continue;
            if (!double.TryParse(parts[1].Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out double northing)) continue;
            if (!double.TryParse(parts[2].Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out double easting))  continue;
            if (!double.TryParse(parts[3].Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out double rl))       continue;

            string code = parts[4].Trim().Trim('"');

            if (code.ToUpper().Contains("TBM"))
            {
                tbms.Add(new TBMPoint { PointNo = ptNo, Name = code, Northing = northing, Easting = easting, RL = rl });
                continue;
            }

            points.Add(new SurveyPoint { PointNo = ptNo, Northing = northing, Easting = easting, RL = rl, Code = code, CodeType = ClassifyCode(code) });
        }

        var doc = new SurveyDocument
        {
            ProjectId = projectId, FileName = fileName, UploadedAt = DateTime.UtcNow, UploadedBy = userId,
            TotalPoints = points.Count + tbms.Count, Points = points, TBMs = tbms,
            MinNorthing = points.Count > 0 ? points.Min(p => p.Northing) : 0,
            MaxNorthing = points.Count > 0 ? points.Max(p => p.Northing) : 0,
            MinEasting  = points.Count > 0 ? points.Min(p => p.Easting)  : 0,
            MaxEasting  = points.Count > 0 ? points.Max(p => p.Easting)  : 0,
            MinRL       = points.Count > 0 ? points.Min(p => p.RL)       : 0,
            MaxRL       = points.Count > 0 ? points.Max(p => p.RL)       : 0,
        };

        ComputeChainages(doc);
        doc.DetectedCulverts = DetectCulvertLocations(doc);
        return doc;
    }

    public void ComputeChainages(SurveyDocument survey)
    {
        var centreline = survey.Points.Where(p => p.CodeType == SurveyCodeType.Centreline).OrderBy(p => p.Northing).ToList();
        if (!centreline.Any()) return;

        double cumulative = 0;
        for (int i = 0; i < centreline.Count; i++)
        {
            if (i > 0)
            {
                double dN = centreline[i].Northing - centreline[i-1].Northing;
                double dE = centreline[i].Easting  - centreline[i-1].Easting;
                cumulative += Math.Sqrt(dN*dN + dE*dE);
            }
            centreline[i].Chainage = Math.Round(cumulative, 2);
        }

        foreach (var tbm in survey.TBMs)
            tbm.Chainage = FindNearestCentrelinePoint(centreline, tbm.Northing, tbm.Easting)?.Chainage;

        foreach (var pt in survey.Points.Where(p => p.CodeType == SurveyCodeType.ExistingCulvert))
            pt.Chainage = FindNearestCentrelinePoint(centreline, pt.Northing, pt.Easting)?.Chainage;
    }

    public List<DetectedCulvertLocation> DetectCulvertLocations(SurveyDocument survey)
    {
        var exCd = survey.Points.Where(p => p.CodeType == SurveyCodeType.ExistingCulvert).ToList();
        if (!exCd.Any()) return new();

        var centreline = survey.Points.Where(p => p.CodeType == SurveyCodeType.Centreline && p.Chainage.HasValue)
            .OrderBy(p => p.Chainage).ToList();

        var visited = new HashSet<int>();
        var locations = new List<DetectedCulvertLocation>();
        int idx = 0;

        foreach (var pt in exCd)
        {
            if (visited.Contains(pt.PointNo)) continue;

            var nearby = exCd.Where(p => !visited.Contains(p.PointNo) &&
                Math.Sqrt(Math.Pow(p.Northing-pt.Northing,2) + Math.Pow(p.Easting-pt.Easting,2)) < 25).ToList();
            foreach (var n in nearby) visited.Add(n.PointNo);

            double avgInvRL  = nearby.Average(p => p.RL);
            double centroidN = nearby.Average(p => p.Northing);
            double centroidE = nearby.Average(p => p.Easting);
            var    nearest   = FindNearestCentrelinePoint(centreline, centroidN, centroidE);
            double roadRL    = nearest?.RL ?? avgInvRL + 0.5;
            double chainage  = nearest?.Chainage ?? 0;
            double distToCL  = nearest != null ? Math.Sqrt(Math.Pow(nearest.Northing-centroidN,2) + Math.Pow(nearest.Easting-centroidE,2)) : 0;
            double bedSlope  = ComputeLocalSlope(centreline, chainage, 100);

            locations.Add(new DetectedCulvertLocation
            {
                LocationIndex    = ++idx,
                Chainage         = Math.Round(chainage, 1),
                InvertRL         = Math.Round(avgInvRL, 3),
                RoadRL           = Math.Round(roadRL, 3),
                FillHeightM      = Math.Round(Math.Max(roadRL - avgInvRL, 0.3), 3),
                BedSlopePct      = Math.Round(bedSlope, 3),
                DistToAlignment  = Math.Round(distToCL, 1),
                SurveyPointCount = nearby.Count,
                SurveyPointNos   = nearby.Select(p => p.PointNo).ToList(),
            });
        }

        return locations.OrderBy(l => l.Chainage).ToList();
    }

    private static SurveyPoint? FindNearestCentrelinePoint(IList<SurveyPoint> cl, double n, double e)
        => cl.MinBy(p => Math.Sqrt(Math.Pow(p.Northing-n,2) + Math.Pow(p.Easting-e,2)));

    private static double ComputeLocalSlope(IList<SurveyPoint> cl, double chainage, double rangeM)
    {
        var segment = cl.Where(p => p.Chainage >= chainage - rangeM && p.Chainage <= chainage + rangeM).OrderBy(p => p.Chainage).ToList();
        if (segment.Count < 2) return 0.5;
        double dRL = segment.Last().RL - segment.First().RL;
        double dCh = segment.Last().Chainage!.Value - segment.First().Chainage!.Value;
        return dCh > 0 ? Math.Round(Math.Abs(dRL / dCh * 100), 3) : 0.5;
    }

    private static SurveyCodeType ClassifyCode(string code)
    {
        if (CodeMap.TryGetValue(code, out var t)) return t;
        string upper = code.ToUpper();
        if (upper.Contains("TBM")) return SurveyCodeType.TBM;
        if (upper.Contains("BRIDGE")) return SurveyCodeType.Bridge;
        if (upper.Contains("EX")) return SurveyCodeType.ExistingCulvert;
        return SurveyCodeType.Other;
    }
}
