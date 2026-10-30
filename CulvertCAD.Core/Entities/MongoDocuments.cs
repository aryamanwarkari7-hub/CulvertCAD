// CulvertCAD.Core/Entities/MongoDocuments.cs
using CulvertCAD.Core.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace CulvertCAD.Core.Entities;

public class SurveyDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int ProjectId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public int UploadedBy { get; set; }

    // Coordinate system selected during import
    public string InputCoordinateType { get; set; } = "EastingNorthing";

    public string InputCrs { get; set; } = string.Empty;

    // Working coordinate system used by survey calculations
    public string WorkingCrs { get; set; } = string.Empty;

    public int? UTMZone { get; set; }

    public double MinNorthing { get; set; }
    public double MaxNorthing { get; set; }
    public double MinEasting { get; set; }
    public double MaxEasting { get; set; }
    public double MinRL { get; set; }
    public double MaxRL { get; set; }

    public List<SurveyPoint> Points { get; set; } = new();
    public List<DetectedCulvertLocation> DetectedCulverts { get; set; } = new();
    public List<TBMPoint> TBMs { get; set; } = new();

    public List<ChannelSequenceReview> ChannelSequenceReviews { get; set; } = new();
}

public class SurveyPoint
{
    public int PointNo { get; set; }
    public double Northing { get; set; }
    public double Easting { get; set; }
    public double RL { get; set; }
    public string Code { get; set; } = string.Empty;
    public SurveyCodeType CodeType { get; set; }
    public double? Chainage { get; set; }
}

public class TBMPoint
{
    public int PointNo { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Northing { get; set; }
    public double Easting { get; set; }
    public double RL { get; set; }
    public double? Chainage { get; set; }
}

public class DetectedCulvertLocation
{
    public int LocationIndex { get; set; }
    public double Chainage { get; set; }
    public double InvertRL { get; set; }
    public double RoadRL { get; set; }
    public double FillHeightM { get; set; }
    public double? BedSlopePct { get; set; }
    public double DistToAlignment { get; set; }
    public int SurveyPointCount { get; set; }
    public bool IsConfirmed { get; set; } // Review Status of the detected culvert location
    public bool IsManual { get; set; }
    public List<int> SurveyPointNos { get; set; } = new();
    public int? DesignId { get; set; }
}

public class AlignmentDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int ProjectId { get; set; }
    public string AlignmentName { get; set; } = string.Empty;
    public double TotalLengthM { get; set; }
    public string InputFormat { get; set; } = string.Empty;
    public string InputCrs { get; set; } = string.Empty;
    public string WorkingCrs { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
    public bool HasVerticalAlignment { get; set; }

    public List<AlignmentPoint> HorizontalPoints { get; set; } = new();
    public List<VerticalPoint> VerticalPoints { get; set; } = new();
}

public class AlignmentPoint
{
    public double Chainage { get; set; }
    public double Northing { get; set; }
    public double Easting { get; set; }
    public double? ExistingRL { get; set; }
}

public class VerticalPoint
{
    public double Chainage { get; set; }
    public double FormationRL { get; set; }
}

public class CalculationResultDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int DesignId { get; set; }
    public int RevisionId { get; set; }
    public DateTime CalculatedAt { get; set; } = DateTime.UtcNow;

    public double CatchmentAreaHa { get; set; }
    public double RainfallIntensityMmHr { get; set; }
    public double RunoffCoefficient { get; set; }
    public double DesignDischargeQ { get; set; }

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

    public double EarthLoadWeKNm { get; set; }
    public double LiveLoadWlKNm { get; set; }
    public double TotalLoadWtKNm { get; set; }
    public string BeddingClass { get; set; } = "ClassB";
    public double BeddingFactor { get; set; }
    public double RequiredCrushKNm { get; set; }
    public string SelectedPipeClass { get; set; } = string.Empty;
    public int SelectedPipeDiaMm { get; set; }
    public double PipeCrushCapKNm { get; set; }
    public double FactorOfSafety { get; set; }
    public bool StructuralAdequate { get; set; }
    public bool IsDesignSatisfactory { get; set; }

    public List<CalcStep> HydraulicSteps { get; set; } = new();
    public List<CalcStep> StructuralSteps { get; set; } = new();
    public Dictionary<string, object> InputSnapshot { get; set; } = new();
}

public class RevisionInputDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int DesignId { get; set; }
    public int RevisionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public RevisionEngineeringInput Input { get; set; } = new();
}

public class CalcStep
{
    public string Label { get; set; } = string.Empty;
    public string Formula { get; set; } = string.Empty;
    public string Result { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string Clause { get; set; } = string.Empty;
}

public class DrawingDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int DesignId { get; set; }
    public int RevisionId { get; set; }
    public string DrawingNumber { get; set; } = string.Empty;
    public string DrawingTitle { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public int GeneratedBy { get; set; }

    public List<DxfEntityRecord> Entities { get; set; } = new();
    public List<DrawingLayer> Layers { get; set; } = new();
    public TitleBlockData TitleBlock { get; set; } = new();

    public string? DxfBase64 { get; set; }
    public string? DxfFilePath { get; set; }
    public string? PdfFilePath { get; set; }
}

public class DxfEntityRecord
{
    public string Type { get; set; } = string.Empty;
    public string Layer { get; set; } = string.Empty;
    public Dictionary<string, object> Properties { get; set; } = new();
}

public class DrawingLayer
{
    public string Name { get; set; } = string.Empty;
    public int Color { get; set; }
    public string Linetype { get; set; } = "Continuous";
    public double Lineweight { get; set; } = 0.25;
}

public class TitleBlockData
{
    public string ProjectName { get; set; } = string.Empty;
    public string DrawingNumber { get; set; } = string.Empty;
    public string DrawingTitle { get; set; } = string.Empty;
    public string Scale { get; set; } = "1:50";
    public string RevisionCode { get; set; } = "00";
    public string DrawnBy { get; set; } = string.Empty;
    public string CheckedBy { get; set; } = string.Empty;
    public string ApprovedBy { get; set; } = string.Empty;
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string SheetSize { get; set; } = "A1";
}

public class BatchDesignRunDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int ProjectId { get; set; }
    public string SurveyDocId { get; set; } = string.Empty;
    public string RunStatus { get; set; } = "Queued";
    public int TotalCulverts { get; set; }
    public int DesignedCount { get; set; }
    public int FailedCount { get; set; }
    public string? TriggerReason { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int CreatedBy { get; set; }
    public List<BatchCulvertResult> Results { get; set; } = new();
}

public class BatchCulvertResult
{
    public int LocationIndex { get; set; }
    public string Chainage { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int? DesignId { get; set; }
    public int? RevisionId { get; set; }
}

// Save CULVERT SOLID VIEWER 

public class CulvertSolidDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public int ProjectId { get; set; }
    public int? RevisionId { get; set; }
    public int? LocationIndex { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ModelType { get; set; } = "3D_SOLID"; // "3D_SOLID", "2D_DXF", "3D_STL"
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public string SolidDataJson { get; set; } = string.Empty; // Complete geometry array
}