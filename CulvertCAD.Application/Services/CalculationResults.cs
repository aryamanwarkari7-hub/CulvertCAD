using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public class HydraulicResult
{
    public int DiameterMm { get; set; }

    public double HeadwaterDepth { get; set; }

    public bool IsAdequate { get; set; }

    public int NPipes { get; set; } = 1;

    public double Qdesign { get; set; }

    public double Qfull { get; set; }

    public List<CalcStep> Steps { get; set; } = new();

    public double VelocityDesign { get; set; }

    public double VelocityFull { get; set; }
}

public class StructuralResult
{
    public string BeddingClass { get; set; } = "ClassB";

    public double BeddingFactor { get; set; }

    public double EarthLoad { get; set; }

    public double LiveLoad { get; set; }

    public double RequiredCrushKNm { get; set; }

    public List<CalcStep> Steps { get; set; } = new();

    public double TotalLoad { get; set; }
}
