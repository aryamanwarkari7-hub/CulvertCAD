using CulvertCAD.Core.Enums;

namespace CulvertCAD.Application.Services;

public interface ILiveLoadService
{
    double GetLiveLoad(double fillHeightM, LoadClass loadClass);
}
