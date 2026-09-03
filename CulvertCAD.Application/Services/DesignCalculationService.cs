// CulvertCAD.Application/Services/DesignCalculationService.cs

using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IDesignCalculationService
{
    Task<RevisionEngineeringResultModel> CalculateAsync(RevisionEngineeringInput input);
}

public class DesignCalculationService : IDesignCalculationService
{
    private readonly IPipeSelectionService _pipeSelectionService;
    private readonly IHydrologyCalculationService _hydrologyCalculationService;
    private readonly IHydraulicCalculationService _hydraulicCalculationService;
    private readonly IStructuralCalculationService _structuralCalculationService;
    private readonly IFOSCalculationService _fosCalculationService;
    private readonly IEngineeringInputValidationService _inputValidationService;
    private readonly EngineeringCalculationSettings _settings;

    public DesignCalculationService(
        IHydrologyCalculationService hydrologyCalculationService,
        IHydraulicCalculationService hydraulicCalculationService,
        IStructuralCalculationService structuralCalculationService,
        IPipeSelectionService pipeSelectionService,
        IFOSCalculationService fosCalculationService,
        IEngineeringInputValidationService inputValidationService,
        EngineeringCalculationSettings settings
    )
    {
        _hydrologyCalculationService = hydrologyCalculationService;
        _hydraulicCalculationService = hydraulicCalculationService;
        _structuralCalculationService = structuralCalculationService;
        _pipeSelectionService = pipeSelectionService;
        _fosCalculationService = fosCalculationService;
        _inputValidationService = inputValidationService;
        _settings = settings;
    }

    public async Task<RevisionEngineeringResultModel> CalculateAsync(RevisionEngineeringInput input)
    {
        var validationErrors = _inputValidationService.Validate(input);

        if (validationErrors.Count > 0)
        {
            throw new ArgumentException(string.Join(" ", validationErrors));
        }

        bool isDesignDischargeOverride = input.DesignDischargeOverrideQ.HasValue;

        double Q = isDesignDischargeOverride
            ? (double)input.DesignDischargeOverrideQ!.Value
            : _hydrologyCalculationService.CalculateQ(
                input.HydroMethod,
                (double)input.RunoffCoefficient!.Value,
                (double)input.RainfallIntensityMmHr!.Value,
                (double)input.CatchmentAreaHa!.Value
            );

        double slope = (double)input.SlopePercent!.Value;
        double H = (double)input.FillHeightM!.Value;
        double gamma = (double)input.SoilUnitWeightKNm3!.Value;

        var hyd = await _hydraulicCalculationService.CalculateHydraulic(Q, slope);

        var str = _structuralCalculationService.CalculateStructural(
            H,
            hyd.DiameterMm,
            hyd.NPipes,
            input.LoadClass,
            gamma
        );

        var pipe = await _pipeSelectionService.SelectPipeAsync(
            str.RequiredCrushKNm,
            hyd.DiameterMm
        );

        if (pipe != null && pipe.DiameterMm != hyd.DiameterMm)
        {
            hyd = _hydraulicCalculationService.CalculateHydraulicForDiameter(
                Q,
                slope,
                pipe.DiameterMm,
                hyd.NPipes
            );

            str = _structuralCalculationService.CalculateStructural(
                H,
                pipe.DiameterMm,
                hyd.NPipes,
                input.LoadClass,
                gamma
            );
        }

        var finalPipe = await _pipeSelectionService.SelectPipeAsync(
            str.RequiredCrushKNm,
            hyd.DiameterMm
        );

        if (finalPipe != null && finalPipe.DiameterMm != hyd.DiameterMm)
        {
            throw new InvalidOperationException(
                "Hydraulic and structural pipe sizing did not converge to a single pipe diameter."
            );
        }

        pipe = finalPipe ?? pipe;

        double fos =
            pipe != null
                ? _fosCalculationService.CalculateFOS(
                    (double)pipe.UltimateCrushingLoadKNperM,
                    str.BeddingFactor,
                    str.TotalLoad
                )
                : 0;

        return BuildEngineeringResult(input, Q, isDesignDischargeOverride, hyd, str, pipe, fos);
    }

    private RevisionEngineeringResultModel BuildEngineeringResult(
        RevisionEngineeringInput input,
        double Q,
        bool isDesignDischargeOverride,
        HydraulicResult hyd,
        StructuralResult str,
        PipeCatalog? pipe,
        double fos
    )
    {
        return new RevisionEngineeringResultModel
        {
            DesignDischargeQ = Q,

            DesignDischargeSource = isDesignDischargeOverride
                ? "Engineer Override"
                : $"{input.HydroMethod} Method",

            SelectedDiameterMm = hyd.DiameterMm,
            NumberOfPipes = hyd.NPipes,

            QfullM3s = hyd.Qfull,
            QdesignM3s = hyd.Qdesign,
            QfullTotalM3s = hyd.QfullTotal,
            QdesignTotalM3s = hyd.QdesignTotal,

            VelocityFullFlowMs = hyd.VelocityFull,
            VelocityDesignMs = hyd.VelocityDesign,

            HeadwaterDepthM = hyd.HeadwaterDepth,

            HydraulicAdequate = hyd.IsAdequate,

            EarthLoadWeKNm = str.EarthLoad,
            LiveLoadWlKNm = str.LiveLoad,
            TotalLoadWtKNm = str.TotalLoad,

            BeddingClass = str.BeddingClass,
            BeddingFactor = str.BeddingFactor,
            RequiredCrushKNm = str.RequiredCrushKNm,

            HydraulicSteps = BuildHydraulicTrace(hyd),
            StructuralSteps = BuildStructuralTrace(str, pipe, fos),

            SelectedPipeClass =
                pipe != null ? $"IS 458 {pipe.PipeClassCode} Ø{pipe.DiameterMm}mm" : "Not found",

            SelectedPipeDiaMm = pipe?.DiameterMm ?? hyd.DiameterMm,

            PipeCrushCapKNm = pipe != null ? (double)pipe.UltimateCrushingLoadKNperM : 0,

            FactorOfSafety = Math.Round(fos, 3),

            StructuralAdequate = fos >= _settings.StructuralFosMinimum,

            IsDesignSatisfactory = hyd.IsAdequate && fos >= _settings.StructuralFosMinimum,
        };
    }

    private static List<CalcStep> BuildHydraulicTrace(HydraulicResult hyd)
    {
        var steps = new List<CalcStep>(hyd.Steps);

        steps.Add(
            new CalcStep
            {
                Label = "Hydraulic Result",
                Formula = "Final hydraulic assessment",
                Result = hyd.IsAdequate ? "PASS" : "FAIL",
                Unit = "",
                Clause = "",
            }
        );

        return steps;
    }

    private List<CalcStep> BuildStructuralTrace(StructuralResult str, PipeCatalog? pipe, double fos)
    {
        var steps = new List<CalcStep>(str.Steps);

        steps.Add(
            new CalcStep
            {
                Label = "Selected Pipe",
                Formula = "Final pipe selected from Pipe Catalog",
                Result =
                    pipe != null
                        ? $"IS 458 {pipe.PipeClassCode} Ø{pipe.DiameterMm}mm"
                        : "Not found",
                Unit = "",
                Clause = "",
            }
        );

        steps.Add(
            new CalcStep
            {
                Label = "Pipe Crushing Capacity",
                Formula = "Pipe Catalog ultimate crushing load",
                Result =
                    pipe != null ? $"{(double)pipe.UltimateCrushingLoadKNperM:0.000}" : "0.000",
                Unit = "kN/m",
                Clause = "",
            }
        );

        steps.Add(
            new CalcStep
            {
                Label = "Factor of Safety",
                Formula = "Pipe Crushing Capacity × Bedding Factor ÷ Total Load",
                Result = $"{fos:0.000}",
                Unit = "",
                Clause = "",
            }
        );

        steps.Add(
            new CalcStep
            {
                Label = "Structural Verdict",
                Formula = $"FOS ≥ {_settings.StructuralFosMinimum:0.###}",
                Result = fos >= _settings.StructuralFosMinimum ? "PASS" : "FAIL",
                Unit = "",
                Clause = "",
            }
        );

        return steps;
    }
}
