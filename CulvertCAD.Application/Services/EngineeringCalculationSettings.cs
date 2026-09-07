namespace CulvertCAD.Application.Services;

public class EngineeringCalculationSettings
{
    public double ManningN { get; set; }
    public double TrenchWidthClearanceM { get; set; }
    public double StructuralKmu { get; set; }
    public string BeddingClass { get; set; } = "ClassB";
    public double BeddingFactor { get; set; }
    public double StructuralFosMinimum { get; set; }
}
