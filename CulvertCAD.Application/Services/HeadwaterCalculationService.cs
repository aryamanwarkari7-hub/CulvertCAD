namespace CulvertCAD.Application.Services;

public class HeadwaterCalculationService : IHeadwaterCalculationService
{
    public double CalculateHeadwater(
        double q,
        double diameterM,
        double entranceLossCoefficient = 0.5
    )
    {
        double Hc = 0.5 * diameterM;
        double area = Math.PI * diameterM * diameterM / 4.0;
        double velocity = q / area;

        return Hc + entranceLossCoefficient * velocity * velocity / (2 * 9.81);
    }
}
