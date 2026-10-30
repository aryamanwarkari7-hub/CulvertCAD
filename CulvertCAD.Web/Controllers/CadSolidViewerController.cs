
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public class CadSolidViewerController : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }
}
