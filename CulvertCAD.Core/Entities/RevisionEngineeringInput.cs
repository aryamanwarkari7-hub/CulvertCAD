using CulvertCAD.Core.Enums;

namespace CulvertCAD.Core.Entities
{
    public class RevisionEngineeringInput
    {
        // Design context
        public CulvertType CulvertType { get; set; }
        public string? CulvertLocation { get; set; }
        public string? Chainage { get; set; }

        // Hydrology
        public decimal? CatchmentAreaHa { get; set; }
        public decimal? RainfallIntensityMmHr { get; set; }
        public decimal? RunoffCoefficient { get; set; }
        public decimal? DesignDischargeOverrideQ { get; set; }
        public int? ReturnPeriodYrs { get; set; }
        public HydrologicalMethod HydroMethod { get; set; }

        // Hydraulic / geometry
        public decimal? FillHeightM { get; set; }
        public decimal? RoadwayWidthM { get; set; }
        public decimal? SlopePercent { get; set; }
        public decimal? SkewAngleDeg { get; set; }

        // Structural / geotechnical
        public string? SoilType { get; set; }
        public decimal? SoilUnitWeightKNm3 { get; set; }
        public decimal? BearingCapacityKNm2 { get; set; }
        public LoadClass LoadClass { get; set; }

        // Design basis

        
        public string? DesignStandard { get; set; }
    }
}