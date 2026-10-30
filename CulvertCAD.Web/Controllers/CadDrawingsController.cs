using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using netDxf;
using netDxf.Entities;

namespace CulvertCAD.Web.Controllers;

[Authorize]
public sealed class CadDrawingsController : Controller
{
    private const long MaxUploadBytes = 50_000_000;
    private const int MaxEntities = 100_000;

    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<IActionResult> Parse(IFormFile? cadFile)
    {
        if (cadFile is null || cadFile.Length == 0)
            return BadRequest(new { error = "Select a DXF file first." });

        if (!string.Equals(
                Path.GetExtension(cadFile.FileName),
                ".dxf",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                error = "Phase 1 supports DXF files only. DWG import will be added separately."
            });
        }

        if (cadFile.Length > MaxUploadBytes)
            return BadRequest(new { error = "The maximum upload size is 50 MB." });

        var tempPath = Path.Combine(
            Path.GetTempPath(),
            $"culvertcad-{Guid.NewGuid():N}.dxf");

        try
        {
            await using (var output = new FileStream(
                tempPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true))
            {
                await cadFile.CopyToAsync(output, HttpContext.RequestAborted);
            }

            var document = DxfDocument.Load(tempPath);
            var entities = document.Entities.All.ToList();

            if (entities.Count > MaxEntities)
            {
                return BadRequest(new
                {
                    error = $"The drawing contains {entities.Count:N0} entities. " +
                            $"The current limit is {MaxEntities:N0}."
                });
            }

            var paths = new List<CadPathDto>();
            var circles = new List<CadCircleDto>();
            var labels = new List<CadTextDto>();
            var skippedByType = new Dictionary<string, int>(
                StringComparer.OrdinalIgnoreCase);

            foreach (var entity in entities)
            {
                var layer = string.IsNullOrWhiteSpace(entity.Layer?.Name)
                    ? "0"
                    : entity.Layer.Name;

                switch (entity)
                {
                    case Line line:
                        paths.Add(new CadPathDto(
                            layer,
                            false,
                            new[]
                            {
                                new CadPointDto(line.StartPoint.X, line.StartPoint.Y),
                                new CadPointDto(line.EndPoint.X, line.EndPoint.Y)
                            }));
                        break;

                    case Polyline2D polyline:
                        if (polyline.Vertexes.Count >= 2)
                        {
                            paths.Add(new CadPathDto(
                                layer,
                                polyline.IsClosed,
                                polyline.Vertexes
                                    .Select(v => new CadPointDto(
                                        v.Position.X,
                                        v.Position.Y))
                                    .ToArray()));
                        }
                        break;

                    case Circle circle:
                        circles.Add(new CadCircleDto(
                            layer,
                            circle.Center.X,
                            circle.Center.Y,
                            circle.Radius));
                        break;

                    case Arc arc:
                        paths.Add(BuildArcPath(arc, layer));
                        break;

                    case netDxf.Entities.Point point:
                        // Render a point as a small cross in the viewer.
                        paths.Add(new CadPathDto(
                            layer,
                            false,
                            new[]
                            {
                                new CadPointDto(point.Position.X - 0.5, point.Position.Y),
                                new CadPointDto(point.Position.X + 0.5, point.Position.Y)
                            }));

                        paths.Add(new CadPathDto(
                            layer,
                            false,
                            new[]
                            {
                                new CadPointDto(point.Position.X, point.Position.Y - 0.5),
                                new CadPointDto(point.Position.X, point.Position.Y + 0.5)
                            }));
                        break;

                    case Text text:
                        labels.Add(new CadTextDto(
                            layer,
                            text.Value,
                            text.Position.X,
                            text.Position.Y,
                            text.Height,
                            text.Rotation));
                        break;

                    case MText mtext:
                        labels.Add(new CadTextDto(
                            layer,
                            mtext.Value,
                            mtext.Position.X,
                            mtext.Position.Y,
                            mtext.Height,
                            mtext.Rotation));
                        break;

                    default:
                        var typeName = entity.GetType().Name;
                        skippedByType[typeName] =
                            skippedByType.GetValueOrDefault(typeName) + 1;
                        break;
                }
            }

            var allPoints = paths
                .SelectMany(p => p.Points)
                .Concat(circles.SelectMany(c => new[]
                {
                    new CadPointDto(c.X - c.Radius, c.Y - c.Radius),
                    new CadPointDto(c.X + c.Radius, c.Y + c.Radius)
                }))
                .Concat(labels.Select(t => new CadPointDto(t.X, t.Y)))
                .Where(p => double.IsFinite(p.X) && double.IsFinite(p.Y))
                .ToList();

            if (allPoints.Count == 0)
            {
                return BadRequest(new
                {
                    error = "No supported drawable geometry was found in this DXF."
                });
            }

            var layerNames = paths.Select(p => p.Layer)
                .Concat(circles.Select(c => c.Layer))
                .Concat(labels.Select(t => t.Layer))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToArray();

            return Json(new CadDrawingDto(
                Path.GetFileName(cadFile.FileName),
                entities.Count,
                paths,
                circles,
                labels,
                layerNames,
                skippedByType,
                new CadBoundsDto(
                    allPoints.Min(p => p.X),
                    allPoints.Min(p => p.Y),
                    allPoints.Max(p => p.X),
                    allPoints.Max(p => p.Y))));
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499);
        }
        catch (Exception ex) when (
            ex is IOException ||
            ex is UnauthorizedAccessException ||
            ex is ArgumentException ||
            ex is InvalidOperationException ||
            ex is FormatException)
        {
            return BadRequest(new
            {
                error = "The DXF could not be read. Verify that it is a valid, supported DXF file."
            });
        }
        finally
        {
            try
            {
                if (System.IO.File.Exists(tempPath))
                    System.IO.File.Delete(tempPath);
            }
            catch (IOException)
            {
                // Temporary-file cleanup failure must not hide the import result.
            }
        }
    }

    private static CadPathDto BuildArcPath(Arc arc, string layer)
    {
        var start = arc.StartAngle * Math.PI / 180.0;
        var end = arc.EndAngle * Math.PI / 180.0;

        while (end <= start)
            end += Math.PI * 2.0;

        // Approximate the arc for display only. This does not modify the source DXF.
        var segmentCount = Math.Clamp(
            (int)Math.Ceiling((end - start) / (Math.PI / 36.0)),
            2,
            720);

        var points = Enumerable.Range(0, segmentCount + 1)
            .Select(i =>
            {
                var angle = start + (end - start) * i / segmentCount;

                return new CadPointDto(
                    arc.Center.X + arc.Radius * Math.Cos(angle),
                    arc.Center.Y + arc.Radius * Math.Sin(angle));
            })
            .ToArray();

        return new CadPathDto(layer, false, points);
    }
}

public sealed record CadPointDto(double X, double Y);

public sealed record CadPathDto(
    string Layer,
    bool Closed,
    IReadOnlyList<CadPointDto> Points);

public sealed record CadCircleDto(
    string Layer,
    double X,
    double Y,
    double Radius);

public sealed record CadTextDto(
    string Layer,
    string Value,
    double X,
    double Y,
    double Height,
    double Rotation);

public sealed record CadBoundsDto(
    double MinX,
    double MinY,
    double MaxX,
    double MaxY);

public sealed record CadDrawingDto(
    string FileName,
    int EntityCount,
    IReadOnlyList<CadPathDto> Paths,
    IReadOnlyList<CadCircleDto> Circles,
    IReadOnlyList<CadTextDto> Texts,
    IReadOnlyList<string> Layers,
    IReadOnlyDictionary<string, int> SkippedEntityTypes,
    CadBoundsDto Bounds);