using CulvertCAD.Core.Repositories;
// CulvertCAD.Web/Controllers/ProjectsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Enums;
using CulvertCAD.Infrastructure.MySQL.Data;

using System.Security.Claims;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class ProjectsController : Controller
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _um;
    private readonly ISurveyRepository _surveyRepo;
    private readonly IAlignmentRepository _alignmentRepo;

    public ProjectsController(AppDbContext db, UserManager<ApplicationUser> um,
        ISurveyRepository surveyRepo, IAlignmentRepository alignRepo)
    { _db = db; _um = um; _surveyRepo = surveyRepo; _alignmentRepo = alignRepo; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public async Task<IActionResult> Index()
    {
        var roles = await _um.GetRolesAsync(await _um.GetUserAsync(User) ?? new());
        bool isAdmin = roles.Contains("SuperAdmin") || roles.Contains("Admin");

        var query = _db.Projects
    .Include(p => p.CreatedBy)
    .Include(p => p.Members).ThenInclude(m => m.User)
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

            HasSurveyData = survey != null,
            Members = p.Members?.Select(m => new ProjectMemberDto
            {
                UserId = m.UserId, FullName = m.User?.FullName ?? "",
                Email = m.User?.Email ?? "", Role = m.Role.ToString()
            }).ToList() ?? new()
        };




        var alignment = survey == null
            ? null
            : await _alignmentRepo.GetByProjectAsync(id);

        ViewBag.SurveySummary = survey == null ? null : new SurveySummaryDto
        {
            TotalPoints = survey.TotalPoints,
            CentrelinePoints = survey.Points.Count(p => p.CodeType == SurveyCodeType.Centreline),
            ExCdPoints = survey.Points.Count(p => p.CodeType == SurveyCodeType.ExistingCulvert),
            BridgePoints = survey.Points.Count(p => p.CodeType == SurveyCodeType.Bridge),
            TBMCount = survey.TBMs.Count,
            MinRL = survey.MinRL,
            MaxRL = survey.MaxRL,
            DetectedCulverts = survey.DetectedCulverts.Count,
            AlignmentLengthM = alignment?.TotalLengthM ?? 0
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

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var p = await _db.Projects.FindAsync(id);
        if (p == null) return NotFound();

        bool isAdmin = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");
        if (!isAdmin && p.CreatedByUserId != CurrentUserId && !await _db.ProjectMembers.AnyAsync(m => m.ProjectId == id && m.UserId == CurrentUserId))
        {
            return Forbid();
        }

        var dto = new EditProjectDto
        {
            Id = p.Id,
            ProjectName = p.ProjectName,
            ProjectCode = p.ProjectCode,
            ClientName = p.ClientName,
            ConsultantName = p.ConsultantName,
            Location = p.Location,
            State = p.State,
            District = p.District,
            RoadName = p.RoadName,
            ChainageFrom = p.ChainageFrom,
            ChainageTo = p.ChainageTo,
            Status = p.Status
        };

        return View(dto);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, EditProjectDto model)
    {
        if (id != model.Id) return BadRequest("Project ID mismatch.");
        if (!ModelState.IsValid) return View(model);

        var p = await _db.Projects.FindAsync(id);
        if (p == null) return NotFound();

        bool isAdmin = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");
        if (!isAdmin && p.CreatedByUserId != CurrentUserId && !await _db.ProjectMembers.AnyAsync(m => m.ProjectId == id && m.UserId == CurrentUserId))
        {
            return Forbid();
        }

        p.ProjectName = model.ProjectName;
        p.ProjectCode = model.ProjectCode;
        p.ClientName = model.ClientName;
        p.ConsultantName = model.ConsultantName;
        p.Location = model.Location;
        p.State = model.State;
        p.District = model.District;
        p.RoadName = model.RoadName;
        p.ChainageFrom = model.ChainageFrom;
        p.ChainageTo = model.ChainageTo;
        p.Status = model.Status;
        p.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        TempData["Success"] = $"Project '{p.ProjectName}' updated successfully.";
        return RedirectToAction("Details", new { id = p.Id });
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



