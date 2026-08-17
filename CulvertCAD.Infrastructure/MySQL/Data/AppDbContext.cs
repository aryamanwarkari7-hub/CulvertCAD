// CulvertCAD.Infrastructure/MySQL/Data/AppDbContext.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using CulvertCAD.Core.Entities;
using CulvertCAD.Core.Enums;

namespace CulvertCAD.Infrastructure.MySQL.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<int>, int>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Organisation>          Organisations        => Set<Organisation>();
    public DbSet<Project>               Projects             => Set<Project>();
    public DbSet<ProjectMember>         ProjectMembers       => Set<ProjectMember>();
    public DbSet<PipeCatalog>           PipeCatalog          => Set<PipeCatalog>();
    public DbSet<CulvertDesign>         CulvertDesigns       => Set<CulvertDesign>();
    public DbSet<DesignRevision>        DesignRevisions      => Set<DesignRevision>();
    public DbSet<RevisionStatusHistory> RevisionStatusHistory => Set<RevisionStatusHistory>();
    public DbSet<RevisionComment>       RevisionComments     => Set<RevisionComment>();
    public DbSet<AuditLog>              AuditLogs            => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<ApplicationUser>().ToTable("AspNetUsers");
        b.Entity<IdentityRole<int>>().ToTable("AspNetRoles");
        b.Entity<IdentityUserRole<int>>().ToTable("AspNetUserRoles");
        b.Entity<IdentityUserClaim<int>>().ToTable("AspNetUserClaims");
        b.Entity<IdentityUserLogin<int>>().ToTable("AspNetUserLogins");
        b.Entity<IdentityUserToken<int>>().ToTable("AspNetUserTokens");
        b.Entity<IdentityRoleClaim<int>>().ToTable("AspNetRoleClaims");

        b.Entity<ApplicationUser>(e => {
            e.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            e.Property(x => x.EmployeeCode).HasMaxLength(50);
            e.Property(x => x.Designation).HasMaxLength(100);
        });

        b.Entity<Organisation>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(300).IsRequired();
        });

        b.Entity<Project>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.ProjectName).HasMaxLength(300).IsRequired();
            e.Property(x => x.ProjectCode).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.ProjectCode).IsUnique();
            e.Property(x => x.Status).HasConversion<string>();
            e.HasOne(x => x.Organisation).WithMany(o => o.Projects).HasForeignKey(x => x.OrganisationId);
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProjectMember>(e => {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
            e.Property(x => x.Role).HasConversion<string>();
            e.HasOne(x => x.Project).WithMany(p => p.Members).HasForeignKey(x => x.ProjectId);
            e.HasOne(x => x.User).WithMany(u => u.ProjectMemberships).HasForeignKey(x => x.UserId);
        });

        b.Entity<PipeCatalog>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.PipeClassCode).HasConversion<string>().HasMaxLength(10);
            e.HasIndex(x => new { x.PipeClassCode, x.DiameterMm }).IsUnique();
            e.Property(x => x.UltimateCrushingLoadKNperM).HasPrecision(8, 3);
        });

        b.Entity<CulvertDesign>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.DesignName).HasMaxLength(300).IsRequired();
            e.Property(x => x.CulvertType).HasConversion<string>();
            e.Property(x => x.HydroMethod).HasConversion<string>();
            e.Property(x => x.LoadClass).HasConversion<string>();
            e.Property(x => x.SoilUnitWeightKNm3).HasPrecision(6, 3);
            e.HasOne(x => x.Project).WithMany(p => p.Designs).HasForeignKey(x => x.ProjectId);
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<DesignRevision>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.RevisionNumber).HasMaxLength(10).IsRequired();
            e.Property(x => x.RevisionCode).HasMaxLength(5).IsRequired();
            e.Property(x => x.Status).HasConversion<string>();
            e.HasIndex(x => new { x.DesignId, x.RevisionNumber }).IsUnique();
            e.HasOne(x => x.Design).WithMany(d => d.Revisions).HasForeignKey(x => x.DesignId);
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CheckedBy).WithMany().HasForeignKey(x => x.CheckedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ApprovedBy).WithMany().HasForeignKey(x => x.ApprovedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<RevisionStatusHistory>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.FromStatus).HasConversion<string>();
            e.Property(x => x.ToStatus).HasConversion<string>();
            e.HasOne(x => x.Revision).WithMany(r => r.StatusHistory).HasForeignKey(x => x.RevisionId);
            e.HasOne(x => x.ChangedBy).WithMany().HasForeignKey(x => x.ChangedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<RevisionComment>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasConversion<string>();
            e.Property(x => x.Status).HasConversion<string>();
            e.HasOne(x => x.Revision).WithMany(r => r.Comments).HasForeignKey(x => x.RevisionId);
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ParentComment).WithMany(c => c.Replies).HasForeignKey(x => x.ParentCommentId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<AuditLog>(e => {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Timestamp);
            e.HasIndex(x => new { x.EntityType, x.EntityId });
        });

        SeedPipeCatalog(b);
    }

    private static void SeedPipeCatalog(ModelBuilder b)
    {
        var pipes = new List<PipeCatalog>
        {
            new(){Id=1, PipeClassCode=PipeClass.NP2, DiameterMm=300,  WallThicknessMm=38, UltimateCrushingLoadKNperM=17.8m, TestPressureHeadM=3.0m},
            new(){Id=2, PipeClassCode=PipeClass.NP2, DiameterMm=400,  WallThicknessMm=43, UltimateCrushingLoadKNperM=21.9m, TestPressureHeadM=3.0m},
            new(){Id=3, PipeClassCode=PipeClass.NP2, DiameterMm=500,  WallThicknessMm=47, UltimateCrushingLoadKNperM=25.0m, TestPressureHeadM=3.0m},
            new(){Id=4, PipeClassCode=PipeClass.NP2, DiameterMm=600,  WallThicknessMm=52, UltimateCrushingLoadKNperM=27.7m, TestPressureHeadM=3.0m},
            new(){Id=5, PipeClassCode=PipeClass.NP2, DiameterMm=700,  WallThicknessMm=57, UltimateCrushingLoadKNperM=30.4m, TestPressureHeadM=3.0m},
            new(){Id=6, PipeClassCode=PipeClass.NP2, DiameterMm=800,  WallThicknessMm=62, UltimateCrushingLoadKNperM=32.0m, TestPressureHeadM=3.0m},
            new(){Id=7, PipeClassCode=PipeClass.NP2, DiameterMm=900,  WallThicknessMm=67, UltimateCrushingLoadKNperM=33.7m, TestPressureHeadM=3.0m},
            new(){Id=8, PipeClassCode=PipeClass.NP2, DiameterMm=1000, WallThicknessMm=72, UltimateCrushingLoadKNperM=35.3m, TestPressureHeadM=3.0m},
            new(){Id=9,  PipeClassCode=PipeClass.NP3, DiameterMm=300,  WallThicknessMm=44, UltimateCrushingLoadKNperM=25.0m, TestPressureHeadM=6.0m},
            new(){Id=10, PipeClassCode=PipeClass.NP3, DiameterMm=400,  WallThicknessMm=50, UltimateCrushingLoadKNperM=31.3m, TestPressureHeadM=6.0m},
            new(){Id=11, PipeClassCode=PipeClass.NP3, DiameterMm=500,  WallThicknessMm=56, UltimateCrushingLoadKNperM=35.7m, TestPressureHeadM=6.0m},
            new(){Id=12, PipeClassCode=PipeClass.NP3, DiameterMm=600,  WallThicknessMm=62, UltimateCrushingLoadKNperM=39.6m, TestPressureHeadM=6.0m},
            new(){Id=13, PipeClassCode=PipeClass.NP3, DiameterMm=700,  WallThicknessMm=68, UltimateCrushingLoadKNperM=43.4m, TestPressureHeadM=6.0m},
            new(){Id=14, PipeClassCode=PipeClass.NP3, DiameterMm=800,  WallThicknessMm=74, UltimateCrushingLoadKNperM=45.7m, TestPressureHeadM=6.0m},
            new(){Id=15, PipeClassCode=PipeClass.NP3, DiameterMm=900,  WallThicknessMm=80, UltimateCrushingLoadKNperM=48.2m, TestPressureHeadM=6.0m},
            new(){Id=16, PipeClassCode=PipeClass.NP3, DiameterMm=1000, WallThicknessMm=86, UltimateCrushingLoadKNperM=50.4m, TestPressureHeadM=6.0m},
            new(){Id=17, PipeClassCode=PipeClass.NP4, DiameterMm=300,  WallThicknessMm=52, UltimateCrushingLoadKNperM=35.7m, TestPressureHeadM=9.0m},
            new(){Id=18, PipeClassCode=PipeClass.NP4, DiameterMm=400,  WallThicknessMm=60, UltimateCrushingLoadKNperM=44.7m, TestPressureHeadM=9.0m},
            new(){Id=19, PipeClassCode=PipeClass.NP4, DiameterMm=500,  WallThicknessMm=68, UltimateCrushingLoadKNperM=51.0m, TestPressureHeadM=9.0m},
            new(){Id=20, PipeClassCode=PipeClass.NP4, DiameterMm=600,  WallThicknessMm=76, UltimateCrushingLoadKNperM=56.6m, TestPressureHeadM=9.0m},
            new(){Id=21, PipeClassCode=PipeClass.NP4, DiameterMm=700,  WallThicknessMm=84, UltimateCrushingLoadKNperM=62.0m, TestPressureHeadM=9.0m},
            new(){Id=22, PipeClassCode=PipeClass.NP4, DiameterMm=800,  WallThicknessMm=92, UltimateCrushingLoadKNperM=65.3m, TestPressureHeadM=9.0m},
        };
        b.Entity<PipeCatalog>().HasData(pipes);
    }
}
