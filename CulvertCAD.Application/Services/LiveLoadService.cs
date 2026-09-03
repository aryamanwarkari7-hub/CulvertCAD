using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public class LiveLoadService : ILiveLoadService
{
    private static readonly (double H, double Wl)[] LiveLoadTable =
    {
        (0.3, 22.0),
        (0.6, 18.5),
        (0.9, 14.5),
        (1.2, 11.0),
        (1.5, 8.5),
        (1.8, 6.5),
        (2.1, 5.0),
        (2.4, 4.0),
        (3.0, 2.5),
        (3.6, 2.0),
        (4.0, 1.5),
    };

    private static readonly (double H, double Wl)[] LiveLoadTable70R =
    {
        (0.3, 44.0),
        (0.6, 37.0),
        (0.9, 29.0),
        (1.2, 22.0),
        (1.5, 17.0),
        (1.8, 13.0),
        (2.1, 10.0),
        (2.4, 8.0),
        (3.0, 5.0),
        (3.6, 4.0),
        (4.0, 3.0),
    };

    public double GetLiveLoad(double fillHeightM, LoadClass loadClass)
    {
        var table = loadClass == LoadClass.IRC_70R ? LiveLoadTable70R : LiveLoadTable;

        if (fillHeightM <= table[0].H)
            return table[0].Wl;

        if (fillHeightM >= table[^1].H)
            return table[^1].Wl;

        for (int i = 0; i < table.Length - 1; i++)
        {
            var a = table[i];
            var b = table[i + 1];

            if (fillHeightM >= a.H && fillHeightM <= b.H)
            {
                double t = (fillHeightM - a.H) / (b.H - a.H);

                return a.Wl + t * (b.Wl - a.Wl);
            }
        }

        return table[^1].Wl;
    }
}
