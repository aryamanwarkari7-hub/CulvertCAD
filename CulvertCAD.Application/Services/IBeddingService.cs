namespace CulvertCAD.Application.Services;

public interface IBeddingService
{
    (string BeddingClass, double BeddingFactor) GetBedding();
}
