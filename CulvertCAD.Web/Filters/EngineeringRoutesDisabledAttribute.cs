using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CulvertCAD.Web.Filters;

public sealed class EngineeringRoutesDisabledAttribute : ActionFilterAttribute
{
    public override Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        context.Result = new NotFoundResult();
        return Task.CompletedTask;
    }
}