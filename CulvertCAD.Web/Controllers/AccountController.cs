// CulvertCAD.Web/Controllers/AccountController.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Infrastructure.MySQL.Data;

namespace CulvertCAD.Web.Controllers;

public class AccountController : Controller
{
    private readonly UserManager<ApplicationUser> _um;
    private readonly SignInManager<ApplicationUser> _sm;
    private readonly AppDbContext _db;

    public AccountController(UserManager<ApplicationUser> um, SignInManager<ApplicationUser> sm, AppDbContext db)
    {
        _um = um;
        _sm = sm;
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Home");
        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginDto());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginDto model, string? returnUrl = null)
    {
        if (!ModelState.IsValid) return View(model);

        var user = await _um.FindByEmailAsync(model.Email);
        if (user == null || !user.IsActive)
        {
            ModelState.AddModelError("", "Invalid credentials or account inactive.");
            return View(model);
        }

        var result = await _sm.PasswordSignInAsync(user, model.Password, model.RememberMe, lockoutOnFailure: true);

        if (result.Succeeded)
        {
            user.LastLoginAt = DateTime.UtcNow;
            await _um.UpdateAsync(user);
            return LocalRedirect(string.IsNullOrEmpty(returnUrl) ? "/" : returnUrl);
        }
        if (result.IsLockedOut)
        {
            ModelState.AddModelError("", "Account locked. Try after 15 minutes.");
            return View(model);
        }

        ModelState.AddModelError("", "Invalid credentials.");
        return View(model);
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _sm.SignOutAsync();
        return RedirectToAction("Login");
    }

    [Authorize(Roles = "SuperAdmin,Admin")]
    [HttpGet]
    public IActionResult Register() => View(new RegisterDto());

    [Authorize(Roles = "SuperAdmin,Admin")]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterDto model)
    {
        if (!ModelState.IsValid) return View(model);

        var user = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            FullName = model.FullName,
            EmployeeCode = model.EmployeeCode,
            Designation = model.Designation,
            Department = model.Department,
            EmailConfirmed = true,
        };

        var result = await _um.CreateAsync(user, model.Password);
        if (result.Succeeded)
        {
            var role = Request.Form["role"].ToString();
            if (!string.IsNullOrEmpty(role))
                await _um.AddToRoleAsync(user, role);

            TempData["Success"] = $"User {model.FullName} created.";
            return RedirectToAction("Users");
        }

        foreach (var e in result.Errors) ModelState.AddModelError("", e.Description);
        return View(model);
    }

    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Users()
    {
        var users = _um.Users.ToList();
        var dtos = new List<UserProfileDto>();
        foreach (var u in users.OrderBy(u => u.FullName))
        {
            var roles = await _um.GetRolesAsync(u);
            dtos.Add(new UserProfileDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email!,
                EmployeeCode = u.EmployeeCode,
                Designation = u.Designation,
                Department = u.Department,
                IsActive = u.IsActive,
                LastLoginAt = u.LastLoginAt,
                Roles = roles.ToList(),
            });
        }
        return View(dtos);
    }

    [Authorize(Roles = "SuperAdmin,Admin")]
    [HttpGet]
    public async Task<IActionResult> EditUser(int id)
    {
        var user = await _um.FindByIdAsync(id.ToString());
        if (user == null) return NotFound();

        var roles = await _um.GetRolesAsync(user);
        var dto = new EditUserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? "",
            EmployeeCode = user.EmployeeCode,
            Designation = user.Designation,
            Department = user.Department,
            IsActive = user.IsActive,
            Role = roles.FirstOrDefault() ?? "Viewer"
        };

        return View(dto);
    }

    [Authorize(Roles = "SuperAdmin,Admin")]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditUser(int id, EditUserDto model)
    {
        if (id != model.Id) return BadRequest();

        var user = await _um.FindByIdAsync(id.ToString());
        if (user == null) return NotFound();

        if (!ModelState.IsValid) return View(model);

        var currentLoggedInUser = await _um.GetUserAsync(User);

        // Safeguard: Prevent self-deactivation
        if (currentLoggedInUser?.Id == id && !model.IsActive)
        {
            ModelState.AddModelError(nameof(model.IsActive), "You cannot deactivate your own account.");
            return View(model);
        }

        // Email uniqueness check
        if (!string.Equals(user.Email, model.Email, StringComparison.OrdinalIgnoreCase))
        {
            var existing = await _um.FindByEmailAsync(model.Email);
            if (existing != null && existing.Id != id)
            {
                ModelState.AddModelError(nameof(model.Email), "Email is already taken by another account.");
                return View(model);
            }
            user.Email = model.Email;
            user.UserName = model.Email;
        }

        user.FullName = model.FullName;
        user.EmployeeCode = model.EmployeeCode;
        user.Designation = model.Designation;
        user.Department = model.Department;
        user.IsActive = model.IsActive;

        // Optional password reset
        if (!string.IsNullOrWhiteSpace(model.NewPassword))
        {
            var removePass = await _um.RemovePasswordAsync(user);
            if (!removePass.Succeeded)
            {
                foreach (var err in removePass.Errors) ModelState.AddModelError("", err.Description);
                return View(model);
            }
            var addPass = await _um.AddPasswordAsync(user, model.NewPassword);
            if (!addPass.Succeeded)
            {
                foreach (var err in addPass.Errors) ModelState.AddModelError("", err.Description);
                return View(model);
            }
        }

        var updateResult = await _um.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            foreach (var err in updateResult.Errors) ModelState.AddModelError("", err.Description);
            return View(model);
        }

        // Role update
        if (!string.IsNullOrEmpty(model.Role))
        {
            var currentRoles = await _um.GetRolesAsync(user);

            // Safeguard: If current user is SuperAdmin editing themselves, keep SuperAdmin
            if (currentLoggedInUser?.Id == id && currentRoles.Contains("SuperAdmin") && model.Role != "SuperAdmin")
            {
                TempData["Warning"] = "User details updated, but you cannot remove the SuperAdmin role from your own account.";
                return RedirectToAction("Users");
            }

            if (!currentRoles.Contains(model.Role))
            {
                if (currentRoles.Any())
                    await _um.RemoveFromRolesAsync(user, currentRoles);
                await _um.AddToRoleAsync(user, model.Role);
            }
        }

        TempData["Success"] = $"User '{user.FullName}' updated successfully.";
        return RedirectToAction("Users");
    }

    [Authorize(Roles = "SuperAdmin,Admin")]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _um.FindByIdAsync(id.ToString());
        if (user == null) return NotFound();

        var currentLoggedInUser = await _um.GetUserAsync(User);
        if (currentLoggedInUser?.Id == id)
        {
            TempData["Error"] = "You cannot delete your own account.";
            return RedirectToAction("Users");
        }

        var roles = await _um.GetRolesAsync(user);
        if (roles.Contains("SuperAdmin"))
        {
            var superAdmins = await _um.GetUsersInRoleAsync("SuperAdmin");
            if (superAdmins.Count <= 1)
            {
                TempData["Error"] = "Cannot delete the last SuperAdmin user.";
                return RedirectToAction("Users");
            }
        }

        // Check foreign key dependencies (projects/designs created by user)
        bool hasProjects = await _db.Projects.AnyAsync(p => p.CreatedByUserId == id);
        if (hasProjects)
        {
            user.IsActive = false;
            await _um.UpdateAsync(user);
            TempData["Warning"] = $"User '{user.FullName}' has associated project records and cannot be permanently deleted. The account has been deactivated instead.";
            return RedirectToAction("Users");
        }

        // Remove project memberships
        var memberships = _db.ProjectMembers.Where(m => m.UserId == id);
        _db.ProjectMembers.RemoveRange(memberships);
        await _db.SaveChangesAsync();

        var result = await _um.DeleteAsync(user);
        if (result.Succeeded)
        {
            TempData["Success"] = $"User '{user.FullName}' was permanently deleted.";
        }
        else
        {
            TempData["Error"] = $"Failed to delete user: {string.Join(", ", result.Errors.Select(e => e.Description))}";
        }

        return RedirectToAction("Users");
    }

    [Authorize]
    public async Task<IActionResult> Profile()
    {
        var user = await _um.GetUserAsync(User);
        if (user == null) return RedirectToAction("Login");
        var roles = await _um.GetRolesAsync(user);
        return View(new UserProfileDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email!,
            EmployeeCode = user.EmployeeCode,
            Designation = user.Designation,
            Department = user.Department,
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt,
            Roles = roles.ToList()
        });
    }
}