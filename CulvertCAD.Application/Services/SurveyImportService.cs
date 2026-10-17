// CulvertCAD.Application/Services/SurveyImportService.cs
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;
using Serilog.Parsing;
using System.Globalization;

namespace CulvertCAD.Application.Services;

public interface ISurveyImportService
{
    Task<SurveyDocument> ParseCsvAsync(
    Stream stream,
    string fileName,
    int projectId,
    int userId,
    string coordinateType,
    int? utmZone);

    void ComputeChainages(SurveyDocument survey, AlignmentDocument alignment);

    List<DetectedCulvertLocation> DetectCulvertLocations(
        SurveyDocument survey,
        AlignmentDocument alignment);
}

public class SurveyImportService : ISurveyImportService
{
    private static readonly Dictionary<string, SurveyCodeType> CodeMap =
    new(StringComparer.OrdinalIgnoreCase)
    {
        ["C"] = SurveyCodeType.Centreline,
        ["CL"] = SurveyCodeType.Centreline,

        ["L"] = SurveyCodeType.LeftEdge,

        ["R"] = SurveyCodeType.RightEdge,

        ["Tr"] = SurveyCodeType.Trench,

        ["JR"] = SurveyCodeType.StreamBed,

        ["ex cd"] = SurveyCodeType.ExistingCulvert,
        ["excd"] = SurveyCodeType.ExistingCulvert,

        ["Re"] = SurveyCodeType.ReturnWall,

        ["Ep"] = SurveyCodeType.EdgePavement,

        ["Dp"] = SurveyCodeType.Drain,

        ["Str"] = SurveyCodeType.Structure,

        ["FN"] = SurveyCodeType.Fence,

        ["Bridge"] = SurveyCodeType.Bridge
    };

    public async Task<SurveyDocument> ParseCsvAsync(
    Stream stream,
    string fileName,
    int projectId,
    int userId,
    string coordinateType,
    int? utmZone)
    {
        bool isGrid = coordinateType == "EastingNorthing";
        bool isLatLong = coordinateType == "LatitudeLongitude";

        if (!isGrid && !isLatLong)
            throw new InvalidDataException("Invalid coordinate type.");

        if (isGrid && (utmZone == null || utmZone < 42 || utmZone > 47))
            throw new InvalidDataException("Select a valid UTM zone from 42 to 47.");

        var points = new List<SurveyPoint>();
        var tbms = new List<TBMPoint>();

        // Grid input uses the zone selected by the user.
        // Geographic input derives a working UTM zone from its first valid point.
        int? workingZone = isGrid ? utmZone : null;

        using var reader = new StreamReader(stream);

        int lineNumber = 0;

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            lineNumber++;

            if (string.IsNullOrWhiteSpace(line))
                continue;

            var parts = line.Split(',');

            if (parts.Length < 4)
                continue;

            if (!int.TryParse(
                    parts[0].Trim().Trim('"'),
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out int pointNo))
            {
                // Header rows, such as "Sr. No.", are skipped.
                continue;
            }

            if (!double.TryParse(
                    parts[1].Trim().Trim('"'),
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out double coordinate1)
                ||
                !double.TryParse(
                    parts[2].Trim().Trim('"'),
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out double coordinate2)
                ||
                !double.TryParse(
                    parts[3].Trim().Trim('"'),
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out double rl))
            {
                throw new InvalidDataException(
                    $"Invalid numeric coordinate or elevation at CSV line {lineNumber}.");
            }

            double northing;
            double easting;

            if (isGrid)
            {
                // Agreed grid CSV order: PointNo, Northing, Easting, RL, Code.
                northing = coordinate1;
                easting = coordinate2;
            }
            else
            {
                // Geographic CSV order: PointNo, Latitude, Longitude, RL, Code.
                double latitude = coordinate1;
                double longitude = coordinate2;

                if (latitude < -90 || latitude > 90 ||
                    longitude < -180 || longitude > 180)
                {
                    throw new InvalidDataException(
                        $"Invalid latitude or longitude at CSV line {lineNumber}.");
                }

                int pointZone = GetUtmZone(longitude);

                if (pointZone < 42 || pointZone > 47)
                {
                    throw new InvalidDataException(
                        $"The coordinate at CSV line {lineNumber} falls outside " +
                        "the configured India UTM zones 42–47.");
                }

                workingZone ??= pointZone;

                // All geographic points are converted into one working UTM zone.
                (easting, northing) = ConvertLatLongToUtm(
                    latitude,
                    longitude,
                    workingZone.Value);
            }

            string code = parts.Length >= 5
                ? parts[4].Trim().Trim('"')
                : string.Empty;

            if (code.Contains("TBM", StringComparison.OrdinalIgnoreCase))
            {
                tbms.Add(new TBMPoint
                {
                    PointNo = pointNo,
                    Name = code,
                    Northing = northing,
                    Easting = easting,
                    RL = rl
                });

                continue;
            }

            points.Add(new SurveyPoint
            {
                PointNo = pointNo,
                Northing = northing,
                Easting = easting,
                RL = rl,
                Code = code,
                CodeType = ClassifyCode(code)
            });
        }

        if (points.Count == 0 && tbms.Count == 0)
        {
            throw new InvalidDataException(
                "No valid survey points were found. Check the CSV column order and values.");
        }

        if (workingZone == null)
        {
            throw new InvalidDataException(
                "A working UTM zone could not be determined from the input coordinates.");
        }

        string workingCrs = $"EPSG:{32600 + workingZone.Value}";

        var doc = new SurveyDocument
        {
            ProjectId = projectId,
            FileName = fileName,
            UploadedAt = DateTime.UtcNow,
            UploadedBy = userId,

            InputCoordinateType = coordinateType,
            InputCrs = isLatLong
                ? "EPSG:4326"
                : workingCrs,
            WorkingCrs = workingCrs,
            UTMZone = workingZone.Value,

            TotalPoints = points.Count + tbms.Count,
            Points = points,
            TBMs = tbms,

            MinNorthing = points.Count > 0 ? points.Min(p => p.Northing) : 0,
            MaxNorthing = points.Count > 0 ? points.Max(p => p.Northing) : 0,
            MinEasting = points.Count > 0 ? points.Min(p => p.Easting) : 0,
            MaxEasting = points.Count > 0 ? points.Max(p => p.Easting) : 0,
            MinRL = points.Count > 0 ? points.Min(p => p.RL) : 0,
            MaxRL = points.Count > 0 ? points.Max(p => p.RL) : 0
        };

        return doc;
    }

    private static int GetUtmZone(double longitude)
    {
        return (int)Math.Floor((longitude + 180.0) / 6.0) + 1;
    }

    private static (double Easting, double Northing) ConvertLatLongToUtm(
        double latitude,
        double longitude,
        int zone)
    {
        const double a = 6378137.0;
        const double eccentricitySquared = 0.0066943799901413165;
        const double scaleFactor = 0.9996;

        double latRad = latitude * Math.PI / 180.0;
        double lonRad = longitude * Math.PI / 180.0;

        double centralMeridian = (zone - 1) * 6 - 180 + 3;
        double centralMeridianRad = centralMeridian * Math.PI / 180.0;

        double ep2 = eccentricitySquared /
                     (1.0 - eccentricitySquared);

        double sinLat = Math.Sin(latRad);
        double cosLat = Math.Cos(latRad);
        double tanLat = Math.Tan(latRad);

        double n = a / Math.Sqrt(
            1.0 - eccentricitySquared * sinLat * sinLat);

        double t = tanLat * tanLat;
        double c = ep2 * cosLat * cosLat;
        double aa = cosLat * (lonRad - centralMeridianRad);

        double e2 = eccentricitySquared;
        double e4 = e2 * e2;
        double e6 = e4 * e2;

        double m = a *
            ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latRad
            - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024)
                * Math.Sin(2 * latRad)
            + (15 * e4 / 256 + 45 * e6 / 1024)
                * Math.Sin(4 * latRad)
            - (35 * e6 / 3072) * Math.Sin(6 * latRad));

        double easting = scaleFactor * n *
            (aa
            + (1 - t + c) * Math.Pow(aa, 3) / 6
            + (5 - 18 * t + t * t + 72 * c - 58 * ep2)
                * Math.Pow(aa, 5) / 120)
            + 500000.0;

        double northing = scaleFactor *
            (m + n * tanLat *
                (aa * aa / 2
                + (5 - t + 9 * c + 4 * c * c)
                    * Math.Pow(aa, 4) / 24
                + (61 - 58 * t + t * t + 600 * c - 330 * ep2)
                    * Math.Pow(aa, 6) / 720));

        // India-only workflow: northern hemisphere, so no false northing.
        return (easting, northing);
    }

    public void ComputeChainages(
    SurveyDocument survey,
    AlignmentDocument alignment)
    {
        var alignmentPoints = alignment.HorizontalPoints
            .OrderBy(p => p.Chainage)
            .ToList();

        if (alignmentPoints.Count < 2)
            throw new InvalidOperationException(
                "The imported alignment must contain at least two points.");

        // Project a coordinate onto the nearest alignment segment.
        double? FindAlignmentChainage(double northing, double easting)
        {
            double bestDistanceSquared = double.MaxValue;
            double? bestChainage = null;

            for (int i = 0; i < alignmentPoints.Count - 1; i++)
            {
                var a = alignmentPoints[i];
                var b = alignmentPoints[i + 1];

                double dx = b.Easting - a.Easting;
                double dy = b.Northing - a.Northing;
                double lengthSquared = dx * dx + dy * dy;

                if (lengthSquared < 1e-12)
                    continue;

                double t = (
                    (easting - a.Easting) * dx +
                    (northing - a.Northing) * dy
                ) / lengthSquared;

                // Restrict projection to this segment.
                t = Math.Clamp(t, 0.0, 1.0);

                double projectedEasting = a.Easting + t * dx;
                double projectedNorthing = a.Northing + t * dy;

                double offsetE = easting - projectedEasting;
                double offsetN = northing - projectedNorthing;
                double distanceSquared =
                    offsetE * offsetE + offsetN * offsetN;

                if (distanceSquared < bestDistanceSquared)
                {
                    bestDistanceSquared = distanceSquared;
                    bestChainage = a.Chainage +
                        t * (b.Chainage - a.Chainage);
                }
            }

            return bestChainage;
        }

        // Assign DXF-based chainages to CSV centreline points.
        foreach (var point in survey.Points.Where(
                     p => p.CodeType == SurveyCodeType.Centreline))
        {
            point.Chainage = FindAlignmentChainage(
                point.Northing,
                point.Easting);
        }

        // Assign DXF-based chainages to stream/channel bed points.
        foreach (var point in survey.Points.Where(
                     p => p.CodeType == SurveyCodeType.StreamBed))
        {
            point.Chainage = FindAlignmentChainage(
                point.Northing,
                point.Easting);
        }

        // Assign DXF-based chainages to TBMs.
        foreach (var tbm in survey.TBMs)
        {
            tbm.Chainage = FindAlignmentChainage(
                tbm.Northing,
                tbm.Easting);
        }

        // Assign DXF-based chainages to existing culvert points.
        foreach (var point in survey.Points.Where(
                     p => p.CodeType == SurveyCodeType.ExistingCulvert))
        {
            point.Chainage = FindAlignmentChainage(
                point.Northing,
                point.Easting);
        }

        var streamBedPoints = survey.Points
    .Where(p => p.CodeType == SurveyCodeType.StreamBed)
    .ToList();

        Serilog.Log.Information(
            "StreamBed diagnostic: Total={Total}, WithChainage={WithChainage}, WithoutChainage={WithoutChainage}",
            streamBedPoints.Count,
            streamBedPoints.Count(p => p.Chainage.HasValue),
            streamBedPoints.Count(p => !p.Chainage.HasValue));
    }



    public List<DetectedCulvertLocation> DetectCulvertLocations(
        SurveyDocument survey,
        AlignmentDocument alignment)
    {
        var exCd = survey.Points
            .Where(p => p.CodeType == SurveyCodeType.ExistingCulvert)
            .ToList();

        if (!exCd.Any())
            return new();

        var centreline = survey.Points
            .Where(p => p.CodeType == SurveyCodeType.Centreline && p.Chainage.HasValue)
            .OrderBy(p => p.Chainage)
            .ToList();

        var visited = new HashSet<int>();
        var locations = new List<DetectedCulvertLocation>();
        int idx = 0;

        foreach (var pt in exCd)
        {
            if (!visited.Add(pt.PointNo))
                continue;

            // Group points within 25 m of this fixed reference point.
            var nearby = new List<SurveyPoint> { pt };

            foreach (var candidate in exCd)
            {
                if (visited.Contains(candidate.PointNo))
                    continue;

                double distance = Math.Sqrt(
                    Math.Pow(candidate.Northing - pt.Northing, 2) +
                    Math.Pow(candidate.Easting - pt.Easting, 2));

                if (distance <= 25)
                {
                    nearby.Add(candidate);
                    visited.Add(candidate.PointNo);
                }
            }

            double avgInvRL = nearby.Average(p => p.RL);
            double centroidN = nearby.Average(p => p.Northing);
            double centroidE = nearby.Average(p => p.Easting);

            var nearest = FindNearestCentrelinePoint(
                centreline, centroidN, centroidE);

            double roadRL = nearest?.RL ?? avgInvRL + 0.5;
            double chainage = nearest?.Chainage ?? 0;

            double distToCL = nearest != null
                ? Math.Sqrt(
                    Math.Pow(nearest.Northing - centroidN, 2) +
                    Math.Pow(nearest.Easting - centroidE, 2))
                : 0;

            Serilog.Log.Warning("TEST: Updated DetectCulvertLocations code is running.");

            var nearbyStreamPoints = survey.Points
    .Where(p => p.CodeType == SurveyCodeType.StreamBed &&
                p.Chainage.HasValue &&
                p.Chainage.Value >= chainage - 100 &&
                p.Chainage.Value <= chainage + 100)
    .OrderBy(p => p.Chainage!.Value)
    .ToList();

            Serilog.Log.Information(
                "Culvert {Index} at chainage {Chainage:F1}: " +
                "{StreamPointCount} JR points within +/-100 m. " +
                "Points: [{PointNos}]",
                idx + 1,
                chainage,
                nearbyStreamPoints.Count,
                string.Join(", ", nearbyStreamPoints.Select(p =>
                    $"{p.PointNo} (Ch={p.Chainage:F1}, RL={p.RL:F3})")));

            var nearestStreamPoints = survey.Points
    .Where(p => p.CodeType == SurveyCodeType.StreamBed)
    .Select(p => new
    {
        Point = p,
        Distance = Math.Sqrt(
            Math.Pow(p.Northing - centroidN, 2) +
            Math.Pow(p.Easting - centroidE, 2))
    })
    .OrderBy(x => x.Distance)
    .Take(3)
    .ToList();

            Serilog.Log.Information(
                "Culvert {Index}: Nearest JR points by XY distance: {Points}",
                idx + 1,
                string.Join("; ", nearestStreamPoints.Select(x =>
                    $"P{x.Point.PointNo}: Distance={x.Distance:F2}m, " +
                    $"Ch={x.Point.Chainage:F1}, RL={x.Point.RL:F3}")));

            double? bedSlope = ComputeLocalSlope(
    survey.Points
        .Where(p => p.CodeType == SurveyCodeType.StreamBed && p.Chainage.HasValue)
        .ToList(),
    chainage,
    100);

            Serilog.Log.Information(
                "Culvert candidate {Index}: Chainage={Chainage:F1}, Points=[{PointNos}], Coordinates=[{Coordinates}]",
                idx + 1,
                chainage,
                string.Join(", ", nearby.Select(p => p.PointNo)),
                string.Join("; ", nearby.Select(p =>
                    $"P{p.PointNo}: N={p.Northing:F3}, E={p.Easting:F3}, RL={p.RL:F3}")));

            locations.Add(new DetectedCulvertLocation
            {
                LocationIndex = ++idx,
                Chainage = Math.Round(chainage, 1),
                InvertRL = Math.Round(avgInvRL, 3),
                RoadRL = Math.Round(roadRL, 3),
                FillHeightM = Math.Round(Math.Max(roadRL - avgInvRL, 0.3), 3),
                BedSlopePct = bedSlope.HasValue
                        ? Math.Round(bedSlope.Value, 3)
                        : null,
                DistToAlignment = Math.Round(distToCL, 1),
                SurveyPointCount = nearby.Count,
                SurveyPointNos = nearby.Select(p => p.PointNo).ToList(),
            });
        }

        return locations.OrderBy(l => l.Chainage).ToList();
    }

    private static SurveyPoint? FindNearestCentrelinePoint(IList<SurveyPoint> cl, double n, double e)
        => cl.MinBy(p => Math.Sqrt(Math.Pow(p.Northing - n, 2) + Math.Pow(p.Easting - e, 2)));

    private static double? ComputeLocalSlope(
    IList<SurveyPoint> points,
    double chainage,
    double rangeM)
    {
        var segment = points
            .Where(p => p.Chainage.HasValue &&
                        p.Chainage.Value >= chainage - rangeM &&
                        p.Chainage.Value <= chainage + rangeM)
            .OrderBy(p => p.Chainage!.Value)
            .ToList();

        if (segment.Count < 2)
            return null;

        double dRL = segment.Last().RL - segment.First().RL;

        double dCh = segment.Last().Chainage!.Value
                   - segment.First().Chainage!.Value;

        if (dCh <= 0)
            return null;

        return Math.Round(Math.Abs(dRL / dCh * 100), 3);
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