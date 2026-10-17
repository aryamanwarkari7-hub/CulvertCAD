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
});

// ── Repositories ──────────────────────────────────────────────────────────────
builder.Services.AddScoped<ISurveyRepository, SurveyRepository>();
builder.Services.AddScoped<ICalcResultRepository, CalcResultRepository>();
builder.Services.AddScoped<IRevisionInputRepository, RevisionInputRepository>();
builder.Services.AddScoped<IDrawingRepository, DrawingRepository>();
builder.Services.AddScoped<IAlignmentRepository, AlignmentRepository>();
builder.Services.AddScoped<IBatchRunRepository, BatchRunRepository>();
builder.Services.AddScoped<IPipeCatalogRepository, PipeCatalogRepository>();
builder.Services.AddScoped<IRevisionRepository, RevisionRepository>();

// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<IHydrologyCalculationService, HydrologyCalculationService>();
builder.Services.AddScoped<IHeadwaterCalculationService, HeadwaterCalculationService>();
builder.Services.AddScoped<IHydraulicCalculationService, HydraulicCalculationService>();
builder.Services.AddScoped<IStructuralCalculationService, StructuralCalculationService>();
builder.Services.AddScoped<IPipeSelectionService, PipeSelectionService>();
builder.Services.AddScoped<IDesignCalculationService, DesignCalculationService>();
builder.Services.AddScoped<IFOSCalculationService, FOSCalculationService>();
builder.Services.AddScoped<ILiveLoadService, LiveLoadService>();
builder.Services.AddScoped<IBeddingService, BeddingService>();
builder.Services.AddScoped<IRevisionService, RevisionService>();
builder.Services.AddScoped<ISurveyImportService, SurveyImportService>();
builder.Services.AddScoped<IBOQService, BOQService>();
builder.Services.AddScoped<IDxfDrawingEngine, DxfDrawingEngine>();

builder.Services.AddScoped<IEngineeringInputValidationService, EngineeringInputValidationService>();

builder.Services.AddScoped<
    IChannelSequenceEvaluationService,
    ChannelSequenceEvaluationService>();

// ── MVC ───────────────────────────────────────────────────────────────────────
builder.Services.AddControllersWithViews();
builder.Services.AddHttpContextAccessor();

builder.Services.AddSingleton(
    builder
        .Configuration.GetSection("EngineeringCalculationSettings")
        .Get<EngineeringCalculationSettings>()
        ?? throw new InvalidOperationException(
            "EngineeringCalculationSettings configuration is missing."
        )
);

var app = builder.Build();

// ── Migrate & Seed ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var rm = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<int>>>();

    await db.Database.MigrateAsync();
    await SeedAsync(db, um, rm);
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
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