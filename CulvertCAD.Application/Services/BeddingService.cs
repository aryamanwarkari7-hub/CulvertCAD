namespace CulvertCAD.Application.Services;

public class BeddingService : IBeddingService
{
    private readonly EngineeringCalculationSettings _settings;

    public BeddingService(EngineeringCalculationSettings settings)
    {
        _settings = settings;
    }

    public (string BeddingClass, double BeddingFactor) GetBedding()
    {
        return (_settings.BeddingClass, _settings.BeddingFactor);
    }
}
