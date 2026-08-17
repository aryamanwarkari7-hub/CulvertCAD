// CulvertCAD.Web/Controllers/AccountController.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.DTOs;

namespace CulvertCAD.Web.Controllers;

public class AccountController : Controller
{
    private readonly UserManager<ApplicationUser>  _um;
    private readonly SignInManager<ApplicationUser> _sm;

    public AccountController(UserManager<ApplicationUser> um, SignInManager<ApplicationUser> sm)
    { _um = um; _sm = sm; }

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
            UserName = model.Email, Email = model.Email, FullName = model.FullName,
            EmployeeCode = model.EmployeeCode, Designation = model.Designation,
            Department = model.Department, EmailConfirmed = true,
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
        var dtos  = new List<UserProfileDto>();
        foreach (var u in users.OrderBy(u => u.FullName))
        {
            var roles = await _um.GetRolesAsync(u);
            dtos.Add(new UserProfileDto
            {
                Id = u.Id, FullName = u.FullName, Email = u.Email!,
                EmployeeCode = u.EmployeeCode, Designation = u.Designation, Department = u.Department,
                IsActive = u.IsActive, LastLoginAt = u.LastLoginAt, Roles = roles.ToList(),
            });
        }
        return View(dtos);
    }

    [Authorize]
    public async Task<IActionResult> Profile()
    {
        var user = await _um.GetUserAsync(User);
        if (user == null) return RedirectToAction("Login");
        var roles = await _um.GetRolesAsync(user);
        return View(new UserProfileDto
        {
            Id = user.Id, FullName = user.FullName, Email = user.Email!,
            EmployeeCode = user.EmployeeCode, Designation = user.Designation, Department = user.Department,
            IsActive = user.IsActive, LastLoginAt = user.LastLoginAt, Roles = roles.ToList()
        });
    }
}
