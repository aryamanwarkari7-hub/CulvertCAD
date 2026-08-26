using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public class EngineeringInputValidationService : IEngineeringInputValidationService
{
    public IReadOnlyList<string> Validate(RevisionEngineeringInput input)
    {
        var errors = new List<string>();

        if (input.CatchmentAreaHa is null)
            errors.Add("Catchment area is required.");

        if (input.RainfallIntensityMmHr is null)
            errors.Add("Rainfall intensity is required.");

        if (input.RunoffCoefficient is null)
            errors.Add("Runoff coefficient is required.");

        if (input.SlopePercent is null)
            errors.Add("Slope is required.");

        if (input.FillHeightM is null)
            errors.Add("Fill height is required.");

        if (input.SoilUnitWeightKNm3 is null)
            errors.Add("Soil unit weight is required.");

        return errors;
    }
}
