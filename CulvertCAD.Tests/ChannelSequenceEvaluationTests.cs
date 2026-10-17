using CulvertCAD.Application.Services;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;
using System;
using System.Collections.Generic;
using Xunit;

namespace CulvertCAD.Tests;

public class ChannelSequenceEvaluationTests
{
    private readonly ChannelSequenceEvaluationService _service =
    new Microsoft.Extensions.Logging.Abstractions.NullLogger<ChannelSequenceEvaluationService>() is var logger
        ? new ChannelSequenceEvaluationService(logger)
        : throw new InvalidOperationException();

    [Fact]
    public void Evaluate_WhenFewerThanTwoStreamBedPoints_ReturnsInsufficientEvidence()
    {
        var points = new List<SurveyPoint>
        {
            CreatePoint(1, 100, 200, 50, 10)
        };

        var result = _service.Evaluate(points, 18, 100, 200);

        Assert.Equal(18, result.CulvertLocationIndex);
        Assert.Equal("InsufficientEvidence", result.Status);
        Assert.Null(result.SignedSlopePercent);
    }

    [Fact]
    public void Evaluate_WithTwoDistinctPoints_CalculatesSignedSlope()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 200, 100, 10),
        CreatePoint(2, 100, 210, 101, 20)
    };

        var result = _service.Evaluate(
            points, 18, 100, 200,
            sequenceConfirmed: true);

        Assert.Equal("PotentialSequence", result.Status);
        Assert.Equal(10, result.PathLengthM);
        Assert.Equal(10, result.SignedSlopePercent);
        Assert.Equal(new[] { 1, 2 }, result.PointNumbers);
    }

    [Fact]
    public void Evaluate_WithDescendingElevation_PreservesNegativeSlope()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 200, 101, 10),
        CreatePoint(2, 100, 210, 100, 20)
    };

        var result = _service.Evaluate(
            points, 18, 100, 200,
            sequenceConfirmed: true);

        Assert.Equal(-10, result.SignedSlopePercent);
    }

    [Fact]
    public void Evaluate_WithDuplicateCoordinates_FlagsDuplicates()
    {
        var points = new List<SurveyPoint>
        {
            CreatePoint(1, 100, 200, 100, 10),
            CreatePoint(2, 100, 200, 100, 11),
            CreatePoint(3, 100, 210, 101, 20)
        };

        var result = _service.Evaluate(points, 18, 100, 200);

        Assert.True(result.HasDuplicateCoordinates);
    }

    [Fact]
    public void Evaluate_Candidate18SurveyPoints_FlagsDuplicatesAndAmbiguity()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(3645, 2228262.155, 376671.514, 685.898, 7744.7),
        CreatePoint(3646, 2228263.228, 376673.174, 685.911, 7746.2),
        CreatePoint(3647, 2228264.580, 376676.844, 685.990, 7748.6),
        CreatePoint(3648, 2228264.699, 376681.212, 686.252, 7750.0),
        CreatePoint(3649, 2228264.087, 376686.274, 686.394, 7750.9),
        CreatePoint(3650, 2228263.440, 376691.378, 686.525, 7751.8),
        CreatePoint(3651, 2228262.516, 376699.480, 686.890, 7753.4),
        CreatePoint(3654, 2228273.762, 376686.570, 686.614, 7760.3),
        CreatePoint(3652, 2228269.886, 376701.750, 686.808, 7761.1),
        CreatePoint(3653, 2228269.886, 376701.750, 686.808, 7761.1)
    };

        // Approximate centroid of the four existing-culvert survey observations.
        double culvertNorthing = 2228258.043;
        double culvertEasting = 376665.307;

        var result = _service.Evaluate(
            points,
            18,
            culvertNorthing,
            culvertEasting);

        Assert.Equal("InsufficientEvidence", result.Status);
        Assert.True(result.HasDuplicateCoordinates);
        Assert.False(result.HasPossibleBranch);
        Assert.True(result.HasPossibleDiscontinuity);
        Assert.NotNull(result.Explanation);
    }

    [Fact]
    public void Evaluate_TwoDistinctChannelPoints_CalculatesSignedSlopeCorrectly()
    {
        // Arrange
        var points = new List<SurveyPoint>
    {
        new()
        {
            PointNo = 1001,
            Northing = 1000.0,
            Easting = 1000.0,
            RL = 100.0,
            Code = "JR",
            CodeType = SurveyCodeType.StreamBed
        },
        new()
        {
            PointNo = 1002,
            Northing = 1010.0,
            Easting = 1000.0,
            RL = 99.0,
            Code = "JR",
            CodeType = SurveyCodeType.StreamBed
        }
    };

        var service = new ChannelSequenceEvaluationService(
    Microsoft.Extensions.Logging.Abstractions.NullLogger<ChannelSequenceEvaluationService>.Instance);

        // Act
        var result = service.Evaluate(
    points,
    culvertLocationIndex: 1,
    culvertNorthing: 1000.0,
    culvertEasting: 1000.0,
    sequenceConfirmed: true);

        // Assert
        Assert.Equal("PotentialSequence", result.Status);
        Assert.Equal(10.0, result.PathLengthM!.Value, 3);
        Assert.Equal(-10.0, result.SignedSlopePercent!.Value, 3);
    }

    private static SurveyPoint CreatePoint(
        int pointNo,
        double northing,
        double easting,
        double rl,
        double chainage)
    {
        return new SurveyPoint
        {
            PointNo = pointNo,
            Northing = northing,
            Easting = easting,
            RL = rl,
            Code = "SB",
            CodeType = SurveyCodeType.StreamBed,
            Chainage = chainage
        };
    }

    [Fact]
    public void Evaluate_WithSpatialBranch_FlagsPossibleBranch()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 200, 100, 10),
        CreatePoint(2, 100, 210, 100, 20),
        CreatePoint(3, 100, 220, 100, 30),
        CreatePoint(4, 110, 210, 100, 21)
    };

        var result = _service.Evaluate(points, 18, 100, 200);

        Assert.Equal("PossibleBranch", result.Status);
        Assert.True(result.HasPossibleBranch);
    }

    [Fact]
    public void Evaluate_DisconnectedPointGroups_FlagsDiscontinuity()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 100, 10, 0),
        CreatePoint(2, 100, 101, 9, 1),
        CreatePoint(3, 100, 120, 8, 2),
        CreatePoint(4, 100, 121, 7, 3)
    };

        var result = _service.Evaluate(points, 18, 100, 100);

        Assert.Equal("InsufficientEvidence", result.Status);
        Assert.True(result.HasPossibleDiscontinuity);
    }

    [Fact]
    public void Evaluate_ThreeStraightChannelPoints_ReturnsCorrectLengthAndSlope()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 100, 10, 0),
        CreatePoint(2, 100, 105, 9.5, 5),
        CreatePoint(3, 100, 110, 9, 10)
    };

        var result = _service.Evaluate(
            points, 18, 100, 100,
            sequenceConfirmed: true);

        Assert.Equal("PotentialSequence", result.Status);
        Assert.Equal(10.0, result.PathLengthM);
        Assert.Equal(-10.0, result.SignedSlopePercent);
        Assert.Equal(new[] { 1, 2, 3 }, result.PointNumbers);
    }

    [Fact]
    public void Evaluate_WithMissingChainage_UsesSpatialGeometry()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 100, 10, 0),
        new SurveyPoint
        {
            PointNo = 2,
            Northing = 100,
            Easting = 101,
            RL = 9,
            Code = "SB",
            CodeType = SurveyCodeType.StreamBed,
            Chainage = null
        }
    };

        var result = _service.Evaluate(
            points, 18, 100, 100,
            sequenceConfirmed: true);

        Assert.Equal("PotentialSequence", result.Status);
        Assert.NotNull(result.SignedSlopePercent);
    }

    [Fact]
    public void Evaluate_WithDuplicateChainage_UsesSpatialGeometry()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 100, 10, 5),
        CreatePoint(2, 100, 101, 9, 5)
    };

        var result = _service.Evaluate(
            points, 18, 100, 100,
            sequenceConfirmed: true);

        Assert.Equal("PotentialSequence", result.Status);
        Assert.NotNull(result.SignedSlopePercent);
    }

    [Fact]
    public void Evaluate_WhenSequenceIsNotConfirmed_ReturnsNoUsableSlope()
    {
        var points = new List<SurveyPoint>
    {
        CreatePoint(1, 100, 200, 100, 10),
        CreatePoint(2, 100, 210, 99, 20)
    };

        var result = _service.Evaluate(points, 18, 100, 200);

        Assert.Equal("InsufficientEvidence", result.Status);
        Assert.Null(result.PathLengthM);
        Assert.Null(result.SignedSlopePercent);
    }
}