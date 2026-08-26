using System;
using System.Threading.Tasks;
using CulvertCAD.Application.Services;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Infrastructure.MySQL.Repositories;
// CulvertCAD.Tests/DesignCalculationServiceTests.cs
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CulvertCAD.Tests;

public class DesignCalculationServiceTests
{
    private static AppDbContext GetInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        db.PipeCatalog.Add(
            new PipeCatalog
            {
                Id = 1,
                PipeClassCode = CulvertCAD.Core.Enums.PipeClass.NP2,
                DiameterMm = 600,
                WallThicknessMm = 52,
                UltimateCrushingLoadKNperM = 27.7m,
            }
        );
        db.SaveChanges();
        return db;
    }

    [Fact]
    public void CalculateRationalQ_StandardInputs_ReturnsExpectedDischarge()
    {
        // Q = C × I × A / 360
        var hydrology = new HydrologyCalculationService();
        double Q = hydrology.CalculateRationalQ(0.55, 80.0, 15.0);
        Assert.Equal(1.8333, Q, 3);
    }

    [Fact]
    public void CalculateHydraulic_AdequateSlope_ReturnsSatisfactoryDesign()
    {
        var db = GetInMemoryDb();
        var svc = new DesignCalculationService(
            new HydrologyCalculationService(),
            new HydraulicCalculationService(new HeadwaterCalculationService()),
            new StructuralCalculationService(),
            new PipeSelectionService(new PipeCatalogRepository(db)),
            new FOSCalculationService(),
            new EngineeringInputValidationService()
        );

        var result = new HydraulicCalculationService(
            new HeadwaterCalculationService()
        ).CalculateHydraulic(Q: 1.8333, slopePct: 1.5);

        Assert.True(result.IsAdequate);
        Assert.True(result.DiameterMm > 0);
        Assert.InRange(result.VelocityFull, 0.6, 3.5);
    }

    [Fact]
    public void CalculateHydraulic_VeryFlatSlope_RequiresMultiplePipesOrFails()
    {
        var db = GetInMemoryDb();
        var svc = new DesignCalculationService(
            new HydrologyCalculationService(),
            new HydraulicCalculationService(new HeadwaterCalculationService()),
            new StructuralCalculationService(),
            new PipeSelectionService(new PipeCatalogRepository(db)),
            new FOSCalculationService(),
            new EngineeringInputValidationService()
        );

        var result = new HydraulicCalculationService(
            new HeadwaterCalculationService()
        ).CalculateHydraulic(Q: 1.8333, slopePct: 0.1);

        // At 0.1% slope with this discharge, expect either failure or max pipes (4)
        Assert.True(!result.IsAdequate || result.NPipes == 4);
    }

    [Theory]
    [InlineData(0.3, 22.0)]
    [InlineData(0.6, 18.5)]
    [InlineData(1.5, 8.5)]
    public void GetLiveLoad_IRC_ClassA_MatchesIS783Table1(double H, double expectedWl)
    {
        var result = new StructuralCalculationService().CalculateStructural(
            H: H,
            diaMm: 600,
            numberOfPipes: 1,
            loadClass: "IRC_ClassA",
            gammaSoil: 18.5
        );

        Assert.Equal(expectedWl, result.LiveLoad, 1);
    }

    [Fact]
    public void CalculateStructural_TypicalFillHeight_ProducesPositiveLoads()
    {
        var db = GetInMemoryDb();

        var result = new StructuralCalculationService().CalculateStructural(
            H: 0.5,
            diaMm: 600,
            numberOfPipes: 1,
            loadClass: "IRC_ClassA",
            gammaSoil: 18.5
        );

        Assert.True(result.EarthLoad > 0);
        Assert.True(result.LiveLoad > 0);
        Assert.Equal(result.EarthLoad + result.LiveLoad, result.TotalLoad, 2);
        Assert.Equal(1.9, result.BeddingFactor);
    }

    [Fact]
    public async Task CalculateAsync_FullDesign_ReturnsCompleteResult()
    {
        var db = GetInMemoryDb();

        var svc = new DesignCalculationService(
            new HydrologyCalculationService(),
            new HydraulicCalculationService(new HeadwaterCalculationService()),
            new StructuralCalculationService(),
            new PipeSelectionService(new PipeCatalogRepository(db)),
            new FOSCalculationService(),
            new EngineeringInputValidationService()
        );

        var input = new RevisionEngineeringInput
        {
            CatchmentAreaHa = 15m,
            RainfallIntensityMmHr = 80m,
            RunoffCoefficient = 0.55m,

            FillHeightM = 0.5m,
            SlopePercent = 1.5m,

            SoilUnitWeightKNm3 = 18.5m,
            LoadClass = CulvertCAD.Core.Enums.LoadClass.IRC_ClassA,
        };

        var result = await svc.CalculateAsync(input);

        Assert.True(result.SelectedDiameterMm > 0);
        Assert.True(result.HydraulicAdequate);
    }

    [Fact]
    public async Task CalculateAsync_MissingEngineeringInputs_ThrowsValidationError()
    {
        var db = GetInMemoryDb();

        var svc = new DesignCalculationService(
            new HydrologyCalculationService(),
            new HydraulicCalculationService(new HeadwaterCalculationService()),
            new StructuralCalculationService(),
            new PipeSelectionService(new PipeCatalogRepository(db)),
            new FOSCalculationService(),
            new EngineeringInputValidationService()
        );

        var input = new RevisionEngineeringInput
        {
            LoadClass = CulvertCAD.Core.Enums.LoadClass.IRC_ClassA,
        };

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.CalculateAsync(input)
        );

        Assert.Contains("Catchment area is required.", exception.Message);
        Assert.Contains("Rainfall intensity is required.", exception.Message);
        Assert.Contains("Runoff coefficient is required.", exception.Message);
        Assert.Contains("Slope is required.", exception.Message);
        Assert.Contains("Fill height is required.", exception.Message);
        Assert.Contains("Soil unit weight is required.", exception.Message);
    }

    [Fact]
    public void Hydrology_UnsupportedMethod_Throws()
    {
        var service = new HydrologyCalculationService();

        Assert.Throws<ArgumentException>(() =>
            service.CalculateQ(HydrologicalMethod.Dicken, 0.55, 80.0, 15.0)
        );
    }

    [Fact]
    public async Task CalculateAsync_WhenPipeSelectionMovesToLargerDiameter_RecalculatesHydraulics()
    {
        var db = GetInMemoryDb();

        // Make the initially selected Ø600 pipe structurally inadequate.
        var pipe600 = await db.PipeCatalog.FindAsync(1);
        pipe600!.UltimateCrushingLoadKNperM = 10m;

        // Add an adequate larger Ø700 pipe.
        db.PipeCatalog.Add(
            new PipeCatalog
            {
                Id = 2,
                PipeClassCode = CulvertCAD.Core.Enums.PipeClass.NP2,
                DiameterMm = 700,
                WallThicknessMm = 60,
                UltimateCrushingLoadKNperM = 100m,
            }
        );

        await db.SaveChangesAsync();

        var svc = new DesignCalculationService(
            new HydrologyCalculationService(),
            new HydraulicCalculationService(new HeadwaterCalculationService()),
            new StructuralCalculationService(),
            new PipeSelectionService(new PipeCatalogRepository(db)),
            new FOSCalculationService(),
            new EngineeringInputValidationService()
        );

        var input = new RevisionEngineeringInput
        {
            DesignDischargeOverrideQ = 0.5m,

            CatchmentAreaHa = 15m,
            RainfallIntensityMmHr = 80m,
            RunoffCoefficient = 0.55m,

            FillHeightM = 0.5m,
            SlopePercent = 1.5m,

            SoilUnitWeightKNm3 = 18.5m,
            LoadClass = CulvertCAD.Core.Enums.LoadClass.IRC_ClassA,
        };

        var result = await svc.CalculateAsync(input);

        Assert.Equal(700, result.SelectedPipeDiaMm);
        Assert.Equal(700, result.SelectedDiameterMm);
    }

    [Fact]
    public async Task CalculateAsync_WhenFinalPipeSelectionDoesNotConverge_Throws()
    {
        var db = GetInMemoryDb();

        // Force the initial Ø600 pipe to be inadequate.
        var pipe600 = await db.PipeCatalog.FindAsync(1);
        pipe600!.UltimateCrushingLoadKNperM = 10m;

        // Ø700 is selected first, but also make it inadequate after
        // the recalculated structural load.
        db.PipeCatalog.Add(
            new PipeCatalog
            {
                Id = 2,
                PipeClassCode = CulvertCAD.Core.Enums.PipeClass.NP2,
                DiameterMm = 700,
                WallThicknessMm = 60,
                UltimateCrushingLoadKNperM = 16m,
            }
        );

        // Ø800 is the next available adequate pipe.
        db.PipeCatalog.Add(
            new PipeCatalog
            {
                Id = 3,
                PipeClassCode = CulvertCAD.Core.Enums.PipeClass.NP2,
                DiameterMm = 800,
                WallThicknessMm = 65,
                UltimateCrushingLoadKNperM = 100m,
            }
        );

        await db.SaveChangesAsync();

        var svc = new DesignCalculationService(
            new HydrologyCalculationService(),
            new HydraulicCalculationService(new HeadwaterCalculationService()),
            new StructuralCalculationService(),
            new PipeSelectionService(new PipeCatalogRepository(db)),
            new FOSCalculationService(),
            new EngineeringInputValidationService()
        );

        var input = new RevisionEngineeringInput
        {
            DesignDischargeOverrideQ = 0.5m,

            CatchmentAreaHa = 15m,
            RainfallIntensityMmHr = 80m,
            RunoffCoefficient = 0.55m,

            FillHeightM = 0.5m,
            SlopePercent = 1.5m,

            SoilUnitWeightKNm3 = 18.5m,
            LoadClass = CulvertCAD.Core.Enums.LoadClass.IRC_ClassA,
        };

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CalculateAsync(input)
        );

        Assert.Contains("did not converge", exception.Message, StringComparison.OrdinalIgnoreCase);
    }
}
