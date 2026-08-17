// CulvertCAD.Web/Controllers/ProjectsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Enums;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Infrastructure.MongoDB.Repositories;
using System.Security.Claims;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class ProjectsController : Controller
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _um;
    private readonly ISurveyRepository _surveyRepo;
    private readonly IAlignmentRepository _alignRepo;

    public ProjectsController(AppDbContext db, UserManager<ApplicationUser> um,
        ISurveyRepository surveyRepo, IAlignmentRepository alignRepo)
    { _db = db; _um = um; _surveyRepo = surveyRepo; _alignRepo = alignRepo; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IActionResult> Index()
    {
        var roles = await _um.GetRolesAsync(await _um.GetUserAsync(User) ?? new());
        bool isAdmin = roles.Contains("SuperAdmin") || roles.Contains("Admin");

        var query = _db.Projects
            .Include(p => p.CreatedBy)
            .Include(p => p.Members).ThenInclude(m => m.User)
            .Include(p => p.Designs.Where(d => d.IsActive))
            .AsQueryable();

        if (!isAdmin)
            query = query.Where(p => p.Members.Any(m => m.UserId == CurrentUserId));

        var projects = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();

        var dtos = projects.Select(p => new ProjectDto
        {
            Id = p.Id, ProjectName = p.ProjectName, ProjectCode = p.ProjectCode,
            ClientName = p.ClientName, ConsultantName = p.ConsultantName,
            Location = p.Location, State = p.State, District = p.District,
            RoadName = p.RoadName, ChainageFrom = p.ChainageFrom, ChainageTo = p.ChainageTo,
            Status = p.Status.ToString(), CreatedAt = p.CreatedAt,
            CreatedByName = p.CreatedBy?.FullName ?? "",
            DesignCount = p.Designs?.Count ?? 0,
            HasSurveyData = !string.IsNullOrEmpty(p.SurveyCollectionId),
            HasAlignment  = !string.IsNullOrEmpty(p.AlignmentCollectionId),
            Members = p.Members?.Select(m => new ProjectMemberDto
            {
                UserId = m.UserId, FullName = m.User?.FullName ?? "",
                Email = m.User?.Email ?? "", Role = m.Role.ToString()
            }).ToList() ?? new()
        }).ToList();

        return View(dtos);
    }

    public async Task<IActionResult> Details(int id)
    {
        var p = await _db.Projects
            .Include(x => x.CreatedBy)
            .Include(x => x.Members).ThenInclude(m => m.User)
            .Include(x => x.Designs.Where(d => d.IsActive)).ThenInclude(d => d.Revisions)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (p == null) return NotFound();

        var survey = await _surveyRepo.GetByProjectAsync(id);

        var dto = new ProjectDto
        {
            Id = p.Id, ProjectName = p.ProjectName, ProjectCode = p.ProjectCode,
            ClientName = p.ClientName, ConsultantName = p.ConsultantName,
            Location = p.Location, State = p.State, District = p.District,
            RoadName = p.RoadName, ChainageFrom = p.ChainageFrom, ChainageTo = p.ChainageTo,
            Status = p.Status.ToString(), CreatedAt = p.CreatedAt,
            CreatedByName = p.CreatedBy?.FullName ?? "",
            DesignCount = p.Designs?.Count ?? 0,
            HasSurveyData = survey != null,
            Members = p.Members?.Select(m => new ProjectMemberDto
            {
                UserId = m.UserId, FullName = m.User?.FullName ?? "",
                Email = m.User?.Email ?? "", Role = m.Role.ToString()
            }).ToList() ?? new()
        };

        ViewBag.Designs = p.Designs?.Select(d => new CulvertDesignDto
        {
            Id = d.Id, ProjectId = d.ProjectId, DesignName = d.DesignName,
            DesignCode = d.DesignCode, CulvertLocation = d.CulvertLocation,
            Chainage = d.Chainage, CulvertType = d.CulvertType.ToString(),
            DesignDischargeQ = d.DesignDischargeQ, CreatedAt = d.CreatedAt,
            RevisionCount = d.Revisions?.Count ?? 0,
            LatestRevisionStatus = d.Revisions?.OrderByDescending(r => r.CreatedAt)
                .FirstOrDefault()?.Status.ToString()
        }).ToList() ?? new();

        ViewBag.SurveySummary = survey == null ? null : new SurveySummaryDto
        {
            TotalPoints = survey.TotalPoints,
            CentrelinePoints = survey.Points.Count(p => p.CodeType == SurveyCodeType.Centreline),
            ExCdPoints  = survey.Points.Count(p => p.CodeType == SurveyCodeType.ExistingCulvert),
            BridgePoints = survey.Points.Count(p => p.CodeType == SurveyCodeType.Bridge),
            TBMCount    = survey.TBMs.Count,
            MinRL = survey.MinRL, MaxRL = survey.MaxRL,
            DetectedCulverts = survey.DetectedCulverts.Count
        };

        return View(dto);
    }

    [HttpGet]
    public IActionResult Create() => View(new CreateProjectDto());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateProjectDto model)
    {
        if (!ModelState.IsValid) return View(model);

        var org = await _db.Organisations.FirstOrDefaultAsync()
            ?? new Organisation { Name = "Default Organisation" };
        if (org.Id == 0) { _db.Organisations.Add(org); await _db.SaveChangesAsync(); }

        var project = new Project
        {
            OrganisationId = org.Id,
            ProjectName    = model.ProjectName,
            ProjectCode    = model.ProjectCode,
            ClientName     = model.ClientName,
            ConsultantName = model.ConsultantName,
            Location       = model.Location,
            State          = model.State,
            District       = model.District,
            RoadName       = model.RoadName,
            ChainageFrom   = model.ChainageFrom,
            ChainageTo     = model.ChainageTo,
            CreatedByUserId = CurrentUserId,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        _db.ProjectMembers.Add(new ProjectMember
        {
            ProjectId = project.Id, UserId = CurrentUserId,
            Role = ProjectMemberRole.ProjectManager
        });
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Project '{project.ProjectName}' created.";
        return RedirectToAction("Details", new { id = project.Id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddMember(int projectId, int userId, string role)
    {
        if (!Enum.TryParse<ProjectMemberRole>(role, out var roleEnum))
            return BadRequest("Invalid role.");

        _db.ProjectMembers.Add(new ProjectMember
            { ProjectId = projectId, UserId = userId, Role = roleEnum });
        await _db.SaveChangesAsync();

        return RedirectToAction("Details", new { id = projectId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RemoveMember(int projectId, int userId)
    {
        var m = await _db.ProjectMembers
            .FirstOrDefaultAsync(x => x.ProjectId == projectId && x.UserId == userId);
        if (m != null) { _db.ProjectMembers.Remove(m); await _db.SaveChangesAsync(); }
        return RedirectToAction("Details", new { id = projectId });
    }
}
