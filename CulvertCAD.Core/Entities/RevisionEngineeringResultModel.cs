namespace CulvertCAD.Core.Entities;

public class RevisionEngineeringResultModel
{
    // Hydrology / Design Discharge
    public double DesignDischargeQ { get; set; }

    public string DesignDischargeSource { get; set; } = string.Empty;

    // Hydraulic Results
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

    // Structural Results
    public double EarthLoadWeKNm { get; set; }
    public double LiveLoadWlKNm { get; set; }
    public double TotalLoadWtKNm { get; set; }

    public string BeddingClass { get; set; } = string.Empty;
    public double BeddingFactor { get; set; }
    public double RequiredCrushKNm { get; set; }

    public string SelectedPipeClass { get; set; } = string.Empty;
    public int SelectedPipeDiaMm { get; set; }
    public double PipeCrushCapKNm { get; set; }
    public double FactorOfSafety { get; set; }
    public bool StructuralAdequate { get; set; }

    // Overall Design Result
    public bool IsDesignSatisfactory { get; set; }

    public List<CalcStep> HydraulicSteps { get; set; } = new();
    public List<CalcStep> StructuralSteps { get; set; } = new();
}
