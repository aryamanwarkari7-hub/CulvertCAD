namespace CulvertCAD.Core.Entities;

public class HydraulicCalculationInputModel
{
    public double DischargeM3s { get; set; }

    public double SlopePercent { get; set; }

    public double BarrelLengthM { get; set; }

    public double TailwaterLevelM { get; set; }

    public double ExitInvertLevelM { get; set; }

    public string? InletConfiguration { get; set; }

    public double PermissibleHeadwaterM { get; set; }
}
