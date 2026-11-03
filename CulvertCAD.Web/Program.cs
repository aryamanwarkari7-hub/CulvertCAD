// CulvertCAD.Web/Program.cs
using CulvertCAD.Application.Services;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Repositories;
using CulvertCAD.Infrastructure.Drawing;
using CulvertCAD.Infrastructure.MongoDB.Repositories;
using CulvertCAD.Infrastructure.MySQL.Data;
using CulvertCAD.Infrastructure.MySQL.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using Serilog;

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/culvertcad-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// ── MySQL (EF Core) ───────────────────────────────────────────────────────────
var mysqlConn = builder.Configuration.GetConnectionString("MySQL");
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(
        mysqlConn,
        ServerVersion.AutoDetect(mysqlConn),
        mysql => mysql.MigrationsAssembly("CulvertCAD.Infrastructure")
    )
);

// ── MongoDB ───────────────────────────────────────────────────────────────────
var mongoConn = builder.Configuration.GetConnectionString("MongoDB");
var mongoDbName = builder.Configuration["MongoDbName"] ?? "CulvertCAD_Documents";
builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoConn));
builder.Services.AddSingleton(sp => new MongoDbContext(
    sp.GetRequiredService<IMongoClient>(),
    mongoDbName
));

// ── Identity ──────────────────────────────────────────────────────────────────
builder
    .Services.AddIdentity<ApplicationUser, IdentityRole<int>>(opt =>
    {
        opt.Password.RequiredLength = 8;
        opt.Password.RequireDigit = true;
        opt.Password.RequireUppercase = true;
        opt.Password.RequireNonAlphanumeric = false;
        opt.Lockout.MaxFailedAccessAttempts = 5;
        opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        opt.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(opt =>
{
    opt.LoginPath = "/Account/Login";
    opt.LogoutPath = "/Account/Logout";
    opt.AccessDeniedPath = "/Account/AccessDenied";
    opt.ExpireTimeSpan = TimeSpan.FromHours(8);
    opt.SlidingExpiration = true;
    opt.Cookie.HttpOnly = true;
    opt.Cookie.SameSite = SameSiteMode.Lax;
    opt.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// ── Repositories ──────────────────────────────────────────────────────────────
builder.Services.AddScoped<ISurveyRepository, SurveyRepository>();
builder.Services.AddScoped<IAlignmentRepository, AlignmentRepository>();
builder.Services.AddScoped<ICulvertSolidRepository, CulvertSolidRepository>();

// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<ISurveyImportService, SurveyImportService>();
builder.Services.AddScoped<
    IChannelSequenceEvaluationService,
    ChannelSequenceEvaluationService>();

// ── MVC ───────────────────────────────────────────────────────────────────────
builder.Services.AddControllersWithViews();
builder.Services.AddHttpContextAccessor();

// ── Rate Limiting (DoS Protection) ───────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Heavy CAD & Survey processing policy (30 requests per minute per IP)
    options.AddPolicy("HeavyCadOps", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
});

var app = builder.Build();

// ── Migrate & Seed ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var rm = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<int>>>();

    await db.Database.MigrateAsync();
    if (app.Environment.IsDevelopment())
    {
        await SeedAsync(db, um, rm);
    }
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
// 1. Re-execute 404, 403, 500 errors through the branded Error page
app.UseStatusCodePagesWithReExecute("/Home/Error/{0}");
// 2. Global OWASP Security Headers Middleware
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Frame-Options", "SAMEORIGIN");                    // Blocks clickjacking in iframes
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");                // Blocks MIME-sniffing exploits
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");// Blocks leaking sensitive URLs
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");                // Activates browser XSS filters
    await next();
});

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

// ── SEEDER ────────────────────────────────────────────────────────────────────
static async Task SeedAsync(
    AppDbContext db,
    UserManager<ApplicationUser> um,
    RoleManager<IdentityRole<int>> rm
)
{
    string[] roles = { "SuperAdmin", "Admin", "DesignEngineer", "CheckingEngineer", "Viewer" };
    foreach (var role in roles)
        if (!await rm.RoleExistsAsync(role))
            await rm.CreateAsync(new IdentityRole<int>(role));

    if (!db.Organisations.Any())
    {
        db.Organisations.Add(
            new Organisation { Name = "Default Organisation", ShortName = "DEFAULT" }
        );
        await db.SaveChangesAsync();
    }

    if (await um.FindByEmailAsync("admin@culvertcad.in") == null)
    {
        var admin = new ApplicationUser
        {
            UserName = "admin@culvertcad.in",
            Email = "admin@culvertcad.in",
            FullName = "System Administrator",
            EmployeeCode = "EMP001",
            Designation = "Senior Engineer",
            Department = "Design",
            EmailConfirmed = true,
            IsActive = true,
        };
        var r = await um.CreateAsync(admin, "Admin@123");
        if (r.Succeeded)
            await um.AddToRoleAsync(admin, "SuperAdmin");
    }
}