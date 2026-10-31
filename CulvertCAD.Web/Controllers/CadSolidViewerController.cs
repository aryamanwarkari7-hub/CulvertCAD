using CulvertCAD.Infrastructure.MySQL.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class CadSolidViewerController : Controller
{
    private readonly AppDbContext _db;

    public CadSolidViewerController(AppDbContext db)
    {
        _db = db;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Index([FromQuery] int? projectId, [FromQuery] string? modelType)
    {
        bool isAdmin = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");

        var projectQuery = _db.Projects.AsQueryable();
        if (!isAdmin)
        {
            projectQuery = projectQuery.Where(p => p.CreatedByUserId == CurrentUserId || p.Members.Any(m => m.UserId == CurrentUserId));
        }

        var projects = await projectQuery
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new { p.Id, p.ProjectCode, p.ProjectName })
            .ToListAsync();

        ViewBag.Projects = projects;
        ViewBag.SelectedProjectId = projectId ?? projects.FirstOrDefault()?.Id ?? 0;

        return View();
    }
}