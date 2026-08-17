// CulvertCAD.Core/Entities/MySqlEntities.cs
using Microsoft.AspNetCore.Identity;
using CulvertCAD.Core.Enums;

namespace CulvertCAD.Core.Entities;

public class ApplicationUser : IdentityUser<int>
{
    public string  FullName           { get; set; } = string.Empty;
    public string? EmployeeCode       { get; set; }
    public string? Designation        { get; set; }
    public string? Department         { get; set; }
    public bool    IsActive           { get; set; } = true;
    public string? RefreshToken       { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public DateTime? LastLoginAt      { get; set; }
    public DateTime  CreatedAt        { get; set; } = DateTime.UtcNow;

    public ICollection<ProjectMember> ProjectMemberships { get; set; } = new List<ProjectMember>();
}

public class Organisation
{
    public int     Id        { get; set; }
    public string  Name      { get; set; } = string.Empty;
    public string? ShortName { get; set; }
    public string? Address   { get; set; }
    public string? City      { get; set; }
    public string? State     { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Project> Projects { get; set; } = new List<Project>();
}

public class Project
{
    public int     Id              { get; set; }
    public int     OrganisationId  { get; set; }
    public string  ProjectName     { get; set; } = string.Empty;
    public string  ProjectCode     { get; set; } = string.Empty;
    public string? ClientName      { get; set; }
    public string? ConsultantName  { get; set; }
    public string? Location        { get; set; }
    public string? State           { get; set; }
    public string? District        { get; set; }
    public string? RoadName        { get; set; }
    public string? ChainageFrom    { get; set; }
    public string? ChainageTo      { get; set; }
    public ProjectStatus Status    { get; set; } = ProjectStatus.Active;
    public int     CreatedByUserId { get; set; }
    public DateTime CreatedAt      { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt     { get; set; }

    public string? SurveyCollectionId    { get; set; }
    public string? AlignmentCollectionId { get; set; }

    public Organisation       Organisation { get; set; } = null!;
    public ApplicationUser    CreatedBy    { get; set; } = null!;
    public ICollection<ProjectMember> Members  { get; set; } = new List<ProjectMember>();
    public ICollection<CulvertDesign> Designs  { get; set; } = new List<CulvertDesign>();
}

public class ProjectMember
{
    public int               Id        { get; set; }
    public int               ProjectId { get; set; }
    public int               UserId    { get; set; }
    public ProjectMemberRole Role      { get; set; }
    public DateTime          JoinedAt  { get; set; } = DateTime.UtcNow;
    public Project           Project   { get; set; } = null!;
    public ApplicationUser   User      { get; set; } = null!;
}

public class PipeCatalog
{
    public int      Id                          { get; set; }
    public PipeClass PipeClassCode              { get; set; }
    public int      DiameterMm                  { get; set; }
    public int      WallThicknessMm             { get; set; }
    public int      EffectiveLengthMm           { get; set; } = 2500;
    public int?     InternalDiameterMm          { get; set; }
    public int?     ExternalDiameterMm          { get; set; }
    public decimal? WeightPerMeterKg            { get; set; }
    public decimal  UltimateCrushingLoadKNperM  { get; set; }
    public decimal? ThreeDayStrengthKNperM      { get; set; }
    public decimal? TestPressureHeadM           { get; set; }
    public bool     IsActive                    { get; set; } = true;
}

public class CulvertDesign
{
    public int     Id                     { get; set; }
    public int     ProjectId              { get; set; }
    public string  DesignName             { get; set; } = string.Empty;
    public string? DesignCode             { get; set; }
    public string? CulvertLocation        { get; set; }
    public string? Chainage               { get; set; }
    public CulvertType CulvertType        { get; set; } = CulvertType.SinglePipe;
    public decimal? CatchmentAreaHa       { get; set; }
    public decimal? RainfallIntensityMmHr { get; set; }
    public decimal? RunoffCoefficient     { get; set; }
    public decimal? DesignDischargeQ      { get; set; }
    public int      ReturnPeriodYrs       { get; set; } = 50;
    public HydrologicalMethod HydroMethod { get; set; } = HydrologicalMethod.Rational;
    public decimal? FillHeightM           { get; set; }
    public decimal? RoadwayWidthM         { get; set; }
    public decimal? SlopePercent          { get; set; }
    public decimal  SkewAngleDeg          { get; set; }
    public string?  SoilType              { get; set; }
    public decimal  SoilUnitWeightKNm3    { get; set; } = 18.5m;
    public decimal? BearingCapacityKNm2   { get; set; }
    public string   DesignStandard        { get; set; } = "IRC 89:1997";
    public LoadClass LoadClass            { get; set; } = LoadClass.IRC_ClassA;
    public bool     IsActive              { get; set; } = true;
    public int      CreatedByUserId       { get; set; }
    public DateTime CreatedAt             { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt            { get; set; }

    public string? ResultDocumentId  { get; set; }
    public string? DrawingDocumentId { get; set; }

    public Project         Project    { get; set; } = null!;
    public ApplicationUser CreatedBy  { get; set; } = null!;
    public ICollection<DesignRevision> Revisions { get; set; } = new List<DesignRevision>();
}

public class DesignRevision
{
    public int     Id                  { get; set; }
    public int     DesignId            { get; set; }
    public string  RevisionNumber      { get; set; } = "R0";
    public string  RevisionCode        { get; set; } = "00";
    public string? RevisionPurpose     { get; set; }
    public string? ChangeDescription   { get; set; }
    public DateTime RevisionDate       { get; set; }
    public RevisionStatus Status       { get; set; } = RevisionStatus.Draft;
    public int     CreatedByUserId     { get; set; }
    public int?    CheckedByUserId     { get; set; }
    public int?    ApprovedByUserId    { get; set; }
    public DateTime  CreatedAt         { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt       { get; set; }
    public DateTime? CheckedAt         { get; set; }
    public DateTime? ApprovedAt        { get; set; }
    public bool    IsLatest            { get; set; } = true;
    public bool    IsApproved          { get; set; } = false;
    public bool    IsLocked            { get; set; } = false;

    public string? InputSnapshotId  { get; set; }
    public string? ResultSnapshotId { get; set; }
    public string? DrawingId        { get; set; }

    public CulvertDesign   Design      { get; set; } = null!;
    public ApplicationUser CreatedBy   { get; set; } = null!;
    public ApplicationUser? CheckedBy  { get; set; }
    public ApplicationUser? ApprovedBy { get; set; }
    public ICollection<RevisionComment>       Comments      { get; set; } = new List<RevisionComment>();
    public ICollection<RevisionStatusHistory> StatusHistory { get; set; } = new List<RevisionStatusHistory>();
}

public class RevisionStatusHistory
{
    public long    Id              { get; set; }
    public int     RevisionId      { get; set; }
    public RevisionStatus? FromStatus { get; set; }
    public RevisionStatus  ToStatus   { get; set; }
    public int     ChangedByUserId { get; set; }
    public string? Remarks         { get; set; }
    public DateTime ChangedAt      { get; set; } = DateTime.UtcNow;
    public DesignRevision  Revision   { get; set; } = null!;
    public ApplicationUser ChangedBy  { get; set; } = null!;
}

public class RevisionComment
{
    public int     Id              { get; set; }
    public int     RevisionId      { get; set; }
    public int     AuthorId        { get; set; }
    public int?    ParentCommentId { get; set; }
    public string  CommentText     { get; set; } = string.Empty;
    public string? FieldReference  { get; set; }
    public CommentType   Type      { get; set; } = CommentType.General;
    public CommentStatus Status    { get; set; } = CommentStatus.Open;
    public DateTime CreatedAt      { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt    { get; set; }
    public int?    ResolvedByUserId { get; set; }
    public DesignRevision  Revision       { get; set; } = null!;
    public ApplicationUser Author         { get; set; } = null!;
    public RevisionComment? ParentComment { get; set; }
    public ICollection<RevisionComment> Replies { get; set; } = new List<RevisionComment>();
}

public class AuditLog
{
    public long    Id         { get; set; }
    public int?    UserId     { get; set; }
    public string? UserEmail  { get; set; }
    public string  Action     { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId   { get; set; }
    public string? OldValues  { get; set; }
    public string? NewValues  { get; set; }
    public string? IpAddress  { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
