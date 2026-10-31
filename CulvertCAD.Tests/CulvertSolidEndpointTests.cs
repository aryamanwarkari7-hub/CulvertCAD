using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Repositories;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Web.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CulvertCAD.Tests;

public class FakeCulvertSolidRepository : ICulvertSolidRepository
{
    public readonly Dictionary<string, CulvertSolidDocument> Storage = new();

    public Task<CulvertSolidDocument?> GetByProjectAsync(int projectId, string modelType = "3D_SOLID")
    {
        var key = $"{projectId}_{modelType}";
        Storage.TryGetValue(key, out var doc);
        return Task.FromResult(doc);
    }

    public Task<string> UpsertByProjectAsync(CulvertSolidDocument doc)
    {
        if (string.IsNullOrWhiteSpace(doc.Id))
            doc.Id = Guid.NewGuid().ToString("N");
        var key = $"{doc.ProjectId}_{doc.ModelType}";
        Storage[key] = doc;
        return Task.FromResult(doc.Id);
    }

    public Task<List<CulvertSolidDocument>> GetRecentSolidsAsync(IEnumerable<int> projectIds, int limit = 20)
    {
        var idSet = new HashSet<int>(projectIds);
        var result = Storage.Values
            .Where(x => idSet.Contains(x.ProjectId))
            .OrderByDescending(x => x.UploadedAt)
            .Take(limit)
            .ToList();
        return Task.FromResult(result);
    }
}

public class CulvertSolidEndpointTests
{
    private static (AppDbContext Db, FakeCulvertSolidRepository SolidRepo, SurveyController Controller) CreateTestFixture()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        // Seed a valid project
        db.Projects.Add(new Project
        {
            Id = 1,
            OrganisationId = 1,
            ProjectCode = "PRJ-TEST-001",
            ProjectName = "Highway Culvert Test Project"
        });
        db.SaveChanges();

        var solidRepo = new FakeCulvertSolidRepository();

        // Pass null! for dependencies not exercised by the solid endpoints
        var controller = new SurveyController(db, null!, null!, null!, solidRepo);

        return (db, solidRepo, controller);
    }

    [Fact]
    public async Task SaveCulvertSolid_WithNonExistentProject_ReturnsNotFound()
    {
        var (_, _, controller) = CreateTestFixture();
        var request = new SurveyController.SaveCulvertSolidRequest
        {
            ProjectId = 9999, // Does not exist
            FileName = "culvert.html",
            SolidDataJson = "{\"solids\":[]}"
        };

        var result = await controller.SaveCulvertSolid(request);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task SaveCulvertSolid_WithOversizedPayload_ReturnsBadRequest()
    {
        var (_, _, controller) = CreateTestFixture();
        // 16 MB dummy payload
        var oversizedJson = new string('x', 16 * 1024 * 1024);
        var request = new SurveyController.SaveCulvertSolidRequest
        {
            ProjectId = 1,
            FileName = "large.html",
            SolidDataJson = oversizedJson
        };

        var result = await controller.SaveCulvertSolid(request);

        var badReq = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badReq.Value);
    }

    [Fact]
    public async Task SaveCulvertSolid_WithEmptyOrZeroInputs_ReturnsBadRequest()
    {
        var (_, _, controller) = CreateTestFixture();

        var resultZeroId = await controller.SaveCulvertSolid(new SurveyController.SaveCulvertSolidRequest
        {
            ProjectId = 0,
            SolidDataJson = "{\"solids\":[]}"
        });
        Assert.IsType<BadRequestObjectResult>(resultZeroId);

        var resultEmptyJson = await controller.SaveCulvertSolid(new SurveyController.SaveCulvertSolidRequest
        {
            ProjectId = 1,
            SolidDataJson = "  "
        });
        Assert.IsType<BadRequestObjectResult>(resultEmptyJson);
    }

    [Fact]
    public async Task SaveCulvertSolid_WithValidInput_SavesToRepositoryAndReturnsSuccess()
    {
        var (_, solidRepo, controller) = CreateTestFixture();
        var request = new SurveyController.SaveCulvertSolidRequest
        {
            ProjectId = 1,
            FileName = "culvert_test.html",
            ModelType = "3D_SOLID",
            SolidDataJson = "{\"solids\":[{\"handle\":\"1\",\"layer\":\"Pipe\"}]}"
        };

        var result = await controller.SaveCulvertSolid(request);

        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.NotNull(jsonResult.Value);

        // Verify the document was upserted into the repository
        var saved = await solidRepo.GetByProjectAsync(1, "3D_SOLID");
        Assert.NotNull(saved);
        Assert.Equal("culvert_test.html", saved.FileName);
        Assert.Equal(1, saved.ProjectId);
        Assert.Contains("\"layer\":\"Pipe\"", saved.SolidDataJson);
    }

    [Fact]
    public async Task GetCulvertSolid_WithNonExistentProject_ReturnsNotFound()
    {
        var (_, _, controller) = CreateTestFixture();

        var result = await controller.GetCulvertSolid(9999);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GetCulvertSolid_WithValidProjectAndSavedModel_ReturnsContentResult()
    {
        var (_, solidRepo, controller) = CreateTestFixture();

        await solidRepo.UpsertByProjectAsync(new CulvertSolidDocument
        {
            ProjectId = 1,
            FileName = "active_model.html",
            ModelType = "3D_SOLID",
            SolidDataJson = "{\"solids\":[{\"layer\":\"BC\"}]}"
        });

        var result = await controller.GetCulvertSolid(1, "3D_SOLID");

        var contentResult = Assert.IsType<ContentResult>(result);
        Assert.Equal("application/json", contentResult.ContentType);
        Assert.Equal("{\"solids\":[{\"layer\":\"BC\"}]}", contentResult.Content);
    }
}