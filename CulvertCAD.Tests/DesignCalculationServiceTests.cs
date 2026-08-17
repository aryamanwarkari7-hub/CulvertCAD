using System;
using System.Threading.Tasks;
// CulvertCAD.Tests/DesignCalculationServiceTests.cs
using Microsoft.EntityFrameworkCore;
using Xunit;
using CulvertCAD.Application.Services;
using CulvertCAD.Core.Entities;
using CulvertCAD.Infrastructure.MySQL.Data;

namespace CulvertCAD.Tests;

public class DesignCalculationServiceTests
{
    private static AppDbContext GetInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        db.PipeCatalog.Add(new PipeCatalog
        {
            Id = 1, PipeClassCode = CulvertCAD.Core.Enums.PipeClass.NP2,
            DiameterMm = 600, WallThicknessMm = 52, UltimateCrushingLoadKNperM = 27.7m
        });
        db.SaveChanges();
        return db;
    }

    [Fact]
    public void CalculateRationalQ_StandardInputs_ReturnsExpectedDischarge()
    {
        // Q = C × I × A / 360
        double Q = DesignCalculationService.CalculateRationalQ(0.55, 80.0, 15.0);
        Assert.Equal(1.8333, Q, 3);
    }

    [Fact]
    public void CalculateHydraulic_AdequateSlope_ReturnsSatisfactoryDesign()
    {
        var db = GetInMemoryDb();
        var svc = new DesignCalculationService(db);

        var result = svc.CalculateHydraulic(Q: 1.8333, slopePct: 1.5);

        Assert.True(result.IsAdequate);
        Assert.True(result.DiameterMm > 0);
        Assert.InRange(result.VelocityFull, 0.6, 3.5);
    }

    [Fact]
    public void CalculateHydraulic_VeryFlatSlope_RequiresMultiplePipesOrFails()
    {
        var db = GetInMemoryDb();
        var svc = new DesignCalculationService(db);

        var result = svc.CalculateHydraulic(Q: 2.9333, slopePct: 0.1);

        // At 0.1% slope with this discharge, expect either failure or max pipes (4)
        Assert.True(!result.IsAdequate || result.NPipes == 4);
    }

    [Theory]
    [InlineData(0.3, 22.0)]
    [InlineData(0.6, 18.5)]
    [InlineData(1.5, 8.5)]
    public void GetLiveLoad_IRC_ClassA_MatchesIS783Table1(double H, double expectedWl)
    {
        double wl = DesignCalculationService.GetLiveLoad(H, "IRC_ClassA");
        Assert.Equal(expectedWl, wl, 1);
    }

    [Fact]
    public void CalculateStructural_TypicalFillHeight_ProducesPositiveLoads()
    {
        var db = GetInMemoryDb();
        var svc = new DesignCalculationService(db);

        var result = svc.CalculateStructural(H: 0.5, diaMm: 600, loadClass: "IRC_ClassA", gammaSoil: 18.5);

        Assert.True(result.EarthLoad > 0);
        Assert.True(result.LiveLoad > 0);
        Assert.Equal(result.EarthLoad + result.LiveLoad, result.TotalLoad, 2);
        Assert.Equal(1.9, result.BeddingFactor);
    }

    [Fact]
    public async Task CalculateAsync_FullDesign_ReturnsCompleteResult()
    {
        var db = GetInMemoryDb();
        var svc = new DesignCalculationService(db);

        var design = new CulvertDesign
        {
            Id = 1, DesignName = "Test Culvert",
            CatchmentAreaHa = 15m, RainfallIntensityMmHr = 80m, RunoffCoefficient = 0.55m,
            FillHeightM = 0.5m, SlopePercent = 1.5m, SoilUnitWeightKNm3 = 18.5m,
            LoadClass = CulvertCAD.Core.Enums.LoadClass.IRC_ClassA
        };

        var result = await svc.CalculateAsync(design);

        Assert.True(result.SelectedDiameterMm > 0);
        Assert.True(result.HydraulicAdequate);
        Assert.NotEmpty(result.HydraulicSteps);
        Assert.NotEmpty(result.StructuralSteps);
    }
}
