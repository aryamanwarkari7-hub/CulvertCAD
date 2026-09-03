using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public interface IStructuralCalculationService
{
    StructuralResult CalculateStructural(
        double H,
        int diaMm,
        int numberOfPipes,
        LoadClass loadClass,
        double gammaSoil = 18.5
    );
}
