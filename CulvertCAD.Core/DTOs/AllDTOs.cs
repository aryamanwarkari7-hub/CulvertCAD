// CulvertCAD.Core/DTOs/AllDTOs.cs
namespace CulvertCAD.Core.DTOs;

public class LoginDto
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public bool RememberMe { get; set; }
}

public class RegisterDto
{
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string EmployeeCode { get; set; } = "";
    public string Designation { get; set; } = "";
    public string Department { get; set; } = "";
    public List<string> Roles { get; set; } = new();
}

public class UserProfileDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? EmployeeCode { get; set; }
    public string? Designation { get; set; }
    public string? Department { get; set; }
    public bool IsActive { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public List<string> Roles { get; set; } = new();
}

public class ProjectDto
{
    public int Id { get; set; }
    public string ProjectName { get; set; } = "";
    public string ProjectCode { get; set; } = "";
    public string? ClientName { get; set; }
    public string? ConsultantName { get; set; }
    public string? Location { get; set; }
    public string? State { get; set; }
    public string? District { get; set; }
    public string? RoadName { get; set; }
    public string? ChainageFrom { get; set; }
    public string? ChainageTo { get; set; }
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string CreatedByName { get; set; } = "";
    public int DesignCount { get; set; }
    public bool HasSurveyData { get; set; }
    public bool HasAlignment { get; set; }
    public List<ProjectMemberDto> Members { get; set; } = new();
}

public class CreateProjectDto
{
    public string ProjectName { get; set; } = "";
    public string ProjectCode { get; set; } = "";
    public string? ClientName { get; set; }
    public string? ConsultantName { get; set; }
    public string? Location { get; set; }
    public string? State { get; set; }
    public string? District { get; set; }
    public string? RoadName { get; set; }
    public string? ChainageFrom { get; set; }
    public string? ChainageTo { get; set; }
}

public class ProjectMemberDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
}

public class AddMemberDto
{
    public int UserId { get; set; }
    public string Role { get; set; } = "Viewer";
}

public class CulvertDesignDto
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string ProjectName { get; set; } = "";
    public string DesignName { get; set; } = "";
    public string? DesignCode { get; set; }
    public string? CulvertLocation { get; set; }
    public string? Chainage { get; set; }
    public string CulvertType { get; set; } = "";
    public decimal? CatchmentAreaHa { get; set; }
    public decimal? RainfallIntensityMmHr { get; set; }
    public decimal? RunoffCoefficient { get; set; }
    public decimal? DesignDischargeQ { get; set; }
    public int ReturnPeriodYrs { get; set; }
    public string HydroMethod { get; set; } = "";
    public decimal? FillHeightM { get; set; }
    public decimal? RoadwayWidthM { get; set; }
    public decimal? SlopePercent { get; set; }
    public decimal SkewAngleDeg { get; set; }
    public string? SoilType { get; set; }
    public decimal SoilUnitWeightKNm3 { get; set; }
    public decimal? BearingCapacityKNm2 { get; set; }
    public string DesignStandard { get; set; } = "";
    public string LoadClass { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string CreatedByName { get; set; } = "";
    public int RevisionCount { get; set; }
    public string? LatestRevisionStatus { get; set; }
    public bool IsDesignSatisfactory { get; set; }
}

public class CreateDesignDto
{
    public string DesignName { get; set; } = "";
    public string? DesignCode { get; set; }
    public string? CulvertLocation { get; set; }
    public string? Chainage { get; set; }
    public string CulvertType { get; set; } = "SinglePipe";
    public decimal? CatchmentAreaHa { get; set; }
    public decimal? RainfallIntensityMmHr { get; set; }
    public decimal? RunoffCoefficient { get; set; }
    public decimal? DesignDischargeQ { get; set; }
    public int ReturnPeriodYrs { get; set; } = 50;
    public string HydroMethod { get; set; } = "Rational";
    public decimal? FillHeightM { get; set; }
    public decimal? RoadwayWidthM { get; set; }
    public decimal? SlopePercent { get; set; }
    public decimal SkewAngleDeg { get; set; }
    public string? SoilType { get; set; }
    public decimal SoilUnitWeightKNm3 { get; set; } = 18.5m;
    public decimal? BearingCapacityKNm2 { get; set; }
    public string DesignStandard { get; set; } = "IRC 89:1997";
    public string LoadClass { get; set; } = "IRC_ClassA";
    public string? ChangeDescription { get; set; } = "Initial Design (R0)";
}

public class RevisionDto
{
    public int Id { get; set; }
    public int DesignId { get; set; }
    public string RevisionNumber { get; set; } = "";
    public string RevisionCode { get; set; } = "";
    public string? RevisionPurpose { get; set; }
    public string? ChangeDescription { get; set; }
    public DateTime RevisionDate { get; set; }
    public string Status { get; set; } = "";
    public bool IsLatest { get; set; }
    public bool IsApproved { get; set; }
    public bool IsLocked { get; set; }
    public string CreatedByName { get; set; } = "";
    public string? CheckedByName { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public CalculationResultDto? Result { get; set; }
    public List<RevisionCommentDto> Comments { get; set; } = new();
    public List<RevisionStatusHistoryDto> StatusHistory { get; set; } = new();
}

public class RevisionCommentDto
{
    public int Id { get; set; }
    public string AuthorName { get; set; } = "";
    public string AuthorDesignation { get; set; } = "";
    public string CommentText { get; set; } = "";
    public string? FieldReference { get; set; }
    public string Type { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<RevisionCommentDto> Replies { get; set; } = new();
}

public class RevisionStatusHistoryDto
{
    public string? FromStatus { get; set; }
    public string ToStatus { get; set; } = "";
    public string ChangedByName { get; set; } = "";
    public string? Remarks { get; set; }
    public DateTime ChangedAt { get; set; }
}

public class WorkflowActionDto
{
    public string Remarks { get; set; } = "";
}

public class AddCommentDto
{
    public string CommentText { get; set; } = "";
    public string? FieldReference { get; set; }
    public string Type { get; set; } = "General";
    public int? ParentCommentId { get; set; }
}

public class CalculationResultDto
{
    public double CatchmentAreaHa { get; set; }
    public double RainfallIntensityMmHr { get; set; }
    public double RunoffCoefficient { get; set; }
    public double DesignDischargeQ { get; set; }

    public string DesignDischargeSource { get; set; } = "";

    public int SelectedDiameterMm { get; set; }
    public int NumberOfPipes { get; set; }
    public double QfullM3s { get; set; }
    public double QdesignM3s { get; set; }

    public double QfullTotalM3s { get; set; }
    public double QdesignTotalM3s { get; set; }
    public double VelocityFullFlowMs { get; set; }
    public double VelocityDesignMs { get; set; }
    public double HeadwaterDepthM { get; set; }
    public bool HydraulicAdequate { get; set; }

    public double EarthLoadKNm { get; set; }
    public double LiveLoadKNm { get; set; }
    public double TotalLoadKNm { get; set; }

    public string BeddingClass { get; set; } = "";
    public double BeddingFactor { get; set; }
    public double RequiredCrushKNm { get; set; }

    public string SelectedPipeClass { get; set; } = "";
    public int SelectedPipeDiaMm { get; set; }
    public double PipeCrushCapKNm { get; set; }
    public double FactorOfSafety { get; set; }
    public bool StructuralAdequate { get; set; }

    public bool IsDesignSatisfactory { get; set; }
    public DateTime CalculatedAt { get; set; }

    public List<CalcStepDto> HydraulicSteps { get; set; } = new();
    public List<CalcStepDto> StructuralSteps { get; set; } = new();
}

public class CalcStepDto
{
    public string Label { get; set; } = "";
    public string Formula { get; set; } = "";
    public string Result { get; set; } = "";
    public string Unit { get; set; } = "";
    public string Clause { get; set; } = "";
}

public class PipeCatalogDto
{
    public int Id { get; set; }
    public string PipeClass { get; set; } = "";
    public int DiameterMm { get; set; }
    public int WallThicknessMm { get; set; }
    public decimal? WeightPerMeterKg { get; set; }
    public decimal UltimateCrushKNm { get; set; }
    public decimal? TestPressureM { get; set; }
}

public class SurveyUploadDto
{
    public int ProjectId { get; set; }
    public string? Notes { get; set; }
}

public class SurveyPointDto
{
    public int PointNo { get; set; }
    public double Northing { get; set; }
    public double Easting { get; set; }
    public double RL { get; set; }
    public string Code { get; set; } = "";
    public string CodeType { get; set; } = "";
    public double? Chainage { get; set; }
}

public class SurveySummaryDto
{
    public int TotalPoints { get; set; }
    public int CentrelinePoints { get; set; }
    public int ExCdPoints { get; set; }
    public int BridgePoints { get; set; }
    public int TBMCount { get; set; }
    public double AlignmentLengthM { get; set; }
    public double MinRL { get; set; }
    public double MaxRL { get; set; }
    public int DetectedCulverts { get; set; }
}

public class SurveyDirectoryItemDto
{
    public int ProjectId { get; set; }
    public string ProjectCode { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string ProjectStatus { get; set; } = string.Empty;
    public string RoadName { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public bool HasSurvey { get; set; }

    // Survey document metadata (if imported)
    public string? SurveyId { get; set; }
    public string? FileName { get; set; }
    public DateTime? UploadedAt { get; set; }
    public int TotalPoints { get; set; }
    public string? CoordinateType { get; set; }
    public int? UtmZone { get; set; }
    public int DetectedCulvertsCount { get; set; }
    public int ConfirmedCulvertsCount { get; set; }
    public double AlignmentLengthM { get; set; }
    public bool HasAlignment { get; set; }
}

public class SurveyDirectoryViewModel
{
    public int TotalProjects { get; set; }
    public int SurveysCount { get; set; }
    public int TotalPointsAcrossAll { get; set; }
    public int TotalDetectedCulverts { get; set; }
    public int TotalConfirmedCulverts { get; set; }
    public List<SurveyDirectoryItemDto> Items { get; set; } = new();
}

public class DashboardDto
{
    public int TotalProjects { get; set; }
    public int ActiveProjects { get; set; }
    public List<ProjectSummaryDto> MyProjects { get; set; } = new();
}

public class ProjectSummaryDto
{
    public int Id { get; set; }
    public string ProjectName { get; set; } = "";
    public string ProjectCode { get; set; } = "";
    public string Status { get; set; } = "";
}

public class BOQItemDto
{
    public string ItemNo { get; set; } = "";
    public string Description { get; set; } = "";
    public string Unit { get; set; } = "";
    public double Quantity { get; set; }
    public decimal RateRs { get; set; }
    public decimal AmountRs { get; set; }
}

public class BOQReportDto
{
    public string ProjectName { get; set; } = "";
    public string ProjectCode { get; set; } = "";
    public DateTime GeneratedAt { get; set; }
    public List<BOQItemDto> Items { get; set; } = new();
    public decimal TotalAmountRs { get; set; }
}

public class CrossSectionDataDto
{
    public double DiameterMm { get; set; }
    public double WallThicknessMm { get; set; }
    public double TrenchWidthMm { get; set; }
    public double TrenchDepthMm { get; set; }
    public double BeddingDepthMm { get; set; }
    public double FillHeightMm { get; set; }
    public string BeddingClass { get; set; } = "";
    public int NumberOfPipes { get; set; }
    public double PipeSpacingMm { get; set; }
}

public class LongitudinalDataDto
{
    public double TotalLengthM { get; set; }
    public double InvertRLStart { get; set; }
    public double InvertRLEnd { get; set; }
    public double RoadRLStart { get; set; }
    public double RoadRLEnd { get; set; }
    public double PipeDiameterMm { get; set; }
    public double RoadwayWidthM { get; set; }
    public double WingwallAngle { get; set; }
}

public class AlignmentMapDataDto
{
    public List<MapPointDto> CentrelinePoints { get; set; } = new();
    public List<CulvertPinDto> CulvertPins { get; set; } = new();
}

public class MapPointDto
{
    public double Northing { get; set; }
    public double Easting { get; set; }
    public double RL { get; set; }
    public double Chainage { get; set; }
}

public class CulvertPinDto
{
    public string DesignCode { get; set; } = "";
    public string Chainage { get; set; } = "";
    public double Northing { get; set; }
    public double Easting { get; set; }
    public string Status { get; set; } = "";
    public bool IsOK { get; set; }
    public int DiameterMm { get; set; }
}