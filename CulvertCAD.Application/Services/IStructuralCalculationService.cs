namespace CulvertCAD.Application.Services;

public interface IStructuralCalculationService
{
    StructuralResult CalculateStructural(
        double H,
        int diaMm,
        int numberOfPipes,
        string loadClass,
        double gammaSoil = 18.5
    );
}
