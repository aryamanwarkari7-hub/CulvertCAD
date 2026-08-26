using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IEngineeringInputValidationService
{
    IReadOnlyList<string> Validate(RevisionEngineeringInput input);
}
