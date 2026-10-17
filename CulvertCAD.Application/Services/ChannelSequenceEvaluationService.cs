using System;
using System.Collections.Generic;
using System.Linq;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;
using CulvertCAD.Application.Services;

using Microsoft.Extensions.Logging;

namespace CulvertCAD.Application.Services;

public class ChannelSequenceEvaluationService : IChannelSequenceEvaluationService
{
    private const double CoordinateToleranceM = 0.01;
    private const double GapMultiplier = 2.5;
    private const double SharpTurnAngleDegrees = 110.0;

    private readonly ILogger<ChannelSequenceEvaluationService> _logger;

    private readonly double _localSearchRadiusM;

    public ChannelSequenceEvaluationService(
    ILogger<ChannelSequenceEvaluationService> logger,
    double neighborDistanceFactor = 1.5,
    double localSearchRadiusM = 40.0)
    {
        _logger = logger;
        _localSearchRadiusM = localSearchRadiusM;
    }

    public ChannelSequenceEvaluationModel Evaluate(
    IList<SurveyPoint> points,
    int culvertLocationIndex,
    double culvertNorthing,
    double culvertEasting,
    bool sequenceConfirmed = false)
    {
        var result = new ChannelSequenceEvaluationModel
        {
            CulvertLocationIndex = culvertLocationIndex,
            Status = "InsufficientEvidence",
            Explanation = "The survey observations do not yet establish a reliable channel sequence."
        };

        var channelPoints = points
    .Where(p =>
        p.CodeType == SurveyCodeType.StreamBed ||
        string.Equals(p.Code, "JR", StringComparison.OrdinalIgnoreCase))
    .OrderBy(p => p.PointNo)
    .ToList();

        if (channelPoints.Count < 2)
        {
            result.Explanation =
                "At least two channel survey observations are required.";
            return result;
        }

        // Remove observations recorded at the same horizontal location.
        // Point number determines which duplicate observation is retained.
        var uniquePoints = new List<SurveyPoint>();

        foreach (var point in channelPoints)
        {
            bool isDuplicate = uniquePoints.Any(existing =>
                Distance(
                    existing.Northing,
                    existing.Easting,
                    point.Northing,
                    point.Easting) <= CoordinateToleranceM);

            if (isDuplicate)
            {
                result.HasDuplicateCoordinates = true;
                continue;
            }

            uniquePoints.Add(point);
        }

        if (uniquePoints.Count < 2)
        {
            result.Explanation =
                "Fewer than two distinct channel locations remain after duplicate removal.";
            return result;
        }

        // Point-number order is a candidate sequence, not proof of channel flow direction.
        result.PointNumbers = uniquePoints
            .Select(p => p.PointNo)
            .ToList();

        var segmentLengths = new List<double>();

        for (int i = 1; i < uniquePoints.Count; i++)
        {
            var previous = uniquePoints[i - 1];
            var current = uniquePoints[i];

            segmentLengths.Add(Distance(
                previous.Northing,
                previous.Easting,
                current.Northing,
                current.Easting));
        }

        // A segment much longer than the typical segment indicates a possible gap.
        double medianSegmentLength = Median(segmentLengths);

        _logger.LogInformation(
    "Channel diagnostic: Culvert={Culvert}, Points=[{Points}], " +
    "SegmentLengths=[{SegmentLengths}], MedianSegment={MedianSegment:F2}m",
    culvertLocationIndex,
    string.Join(", ", uniquePoints.Select(p => p.PointNo)),
    string.Join(", ", segmentLengths.Select(x => x.ToString("F2"))),
    medianSegmentLength);

        result.HasPossibleDiscontinuity = medianSegmentLength > 0 &&
            segmentLengths.Any(length =>
                length > medianSegmentLength * GapMultiplier);

        // Flag a sharp change in direction as a possible branch or ambiguity.
        // This is a screening rule, not proof that a physical branch exists.
        result.HasPossibleBranch = HasSharpTurn(uniquePoints);

        Console.WriteLine(
    $"Channel diagnostic: Culvert={culvertLocationIndex}, " +
    $"Points=[{string.Join(", ", uniquePoints.Select(p => p.PointNo))}], " +
    $"SegmentLengths=[{string.Join(", ", segmentLengths.Select(x => x.ToString("F2")))}], " +
    $"MedianSegment={medianSegmentLength:F2}m");

        if (result.HasPossibleBranch)
        {
            result.Status = "PossibleBranch";
            result.Explanation =
                "A sharp direction change was detected. Confirm the channel geometry before calculating a design slope.";
            return result;
        }

        if (result.HasPossibleDiscontinuity)
        {
            result.Status = "InsufficientEvidence";
            result.Explanation =
                "One or more consecutive point-number observations are separated by a possible gap. Confirm the sequence before calculating a design slope.";
            return result;
        }

        if (!sequenceConfirmed)
        {
            result.Status = "InsufficientEvidence";
            result.PathLengthM = null;
            result.SignedSlopePercent = null;
            result.Explanation =
                "The channel sequence has not been confirmed. " +
                "Confirm the surveyed channel path and flow direction " +
                "before calculating a design slope.";

            return result;
        }

        result.PathLengthM = segmentLengths.Sum();

        if (result.PathLengthM <= 0)
        {
            result.PathLengthM = null;
            result.Explanation =
                "A positive channel path length could not be established.";
            return result;
        }

        double elevationChange =
            uniquePoints[^1].RL - uniquePoints[0].RL;

        result.SignedSlopePercent =
            elevationChange / result.PathLengthM.Value * 100.0;

        result.Status = "PotentialSequence";
        result.Explanation =
            "A candidate sequence was formed in point-number order. Verify the survey sequence and flow direction before using the slope for engineering design.";

        return result;
    }

    private static bool HasSharpTurn(IReadOnlyList<SurveyPoint> points)
    {
        for (int i = 1; i < points.Count - 1; i++)
        {
            var previous = points[i - 1];
            var current = points[i];
            var next = points[i + 1];

            double incomingNorthing = current.Northing - previous.Northing;
            double incomingEasting = current.Easting - previous.Easting;
            double outgoingNorthing = next.Northing - current.Northing;
            double outgoingEasting = next.Easting - current.Easting;

            double incomingLength = Math.Sqrt(
                incomingNorthing * incomingNorthing +
                incomingEasting * incomingEasting);

            double outgoingLength = Math.Sqrt(
                outgoingNorthing * outgoingNorthing +
                outgoingEasting * outgoingEasting);

            if (incomingLength <= CoordinateToleranceM ||
                outgoingLength <= CoordinateToleranceM)
            {
                continue;
            }

            double dotProduct =
                incomingNorthing * outgoingNorthing +
                incomingEasting * outgoingEasting;

            double cosine = dotProduct /
                (incomingLength * outgoingLength);

            cosine = Math.Clamp(cosine, -1.0, 1.0);

            double angleDegrees =
                Math.Acos(cosine) * 180.0 / Math.PI;

            if (angleDegrees >= SharpTurnAngleDegrees)
            {
                return true;
            }
        }

        return false;
    }

    private static double Distance(
        double northing1,
        double easting1,
        double northing2,
        double easting2)
    {
        double northingDifference = northing2 - northing1;
        double eastingDifference = easting2 - easting1;

        return Math.Sqrt(
            northingDifference * northingDifference +
            eastingDifference * eastingDifference);
    }

    private static double Median(List<double> values)
    {
        if (values.Count == 0)
        {
            return 0;
        }

        var ordered = values.OrderBy(value => value).ToList();
        int middle = ordered.Count / 2;

        if (ordered.Count % 2 == 0)
        {
            return (ordered[middle - 1] + ordered[middle]) / 2.0;
        }

        return ordered[middle];
    }
}