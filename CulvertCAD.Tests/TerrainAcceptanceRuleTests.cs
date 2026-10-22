using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;

namespace CulvertCAD.Tests;

public class TerrainAcceptanceRuleTests
{
    [Theory]
    [InlineData(1.0)]
    [InlineData(10.0)]
    [InlineData(100.0)]
    public void TriangleMetrics_AreConsistentAcrossCoordinateScales(
        double scale)
    {
        var a = new Point2D(0, 0);
        var b = new Point2D(3, 0);
        var c = new Point2D(0, 4);

        var original = MeasureTriangle(a, b, c, 3.0);

        var scaled = MeasureTriangle(
            Scale(a, scale),
            Scale(b, scale),
            Scale(c, scale),
            3.0 * scale);

        Assert.Equal(
            original.Circumradius / original.LocalSpacing,
            scaled.Circumradius / scaled.LocalSpacing,
            10);

        Assert.Equal(
            original.LongestEdge / original.LocalSpacing,
            scaled.LongestEdge / scaled.LocalSpacing,
            10);
    }

    [Fact]
    public void RightTriangle_HasExpectedCircumradiusAndLongestEdge()
    {
        var metrics = MeasureTriangle(
            new Point2D(0, 0),
            new Point2D(3, 0),
            new Point2D(0, 4),
            3.0);

        Assert.Equal(2.5, metrics.Circumradius, 10);
        Assert.Equal(5.0, metrics.LongestEdge, 10);
    }

    [Fact]
    public void FixedCircumradiusLimit_IsSensitiveToCoordinateScale()
    {
        const double fixedLimitMetres = 15.5;

        Assert.True(10.0 <= fixedLimitMetres);
        Assert.False(20.0 <= fixedLimitMetres);
    }

    [Fact]
    public void LocalSpacing_UniformGrid_ReturnsExpectedNearestDistances()
    {
        var points = new[]
        {
            new Point2D(0, 0),
            new Point2D(1, 0),
            new Point2D(0, 1),
            new Point2D(1, 1)
        };

        var spacing = EstimateLocalSpacing(points);

        Assert.Equal(4, spacing.Length);

        foreach (var distance in spacing)
            Assert.Equal(1.0, distance, 10);
    }

    [Fact]
    public void LocalSpacing_MixedDensity_ReflectsEachPointNeighbourhood()
    {
        var points = new[]
        {
            new Point2D(0, 0),
            new Point2D(1, 0),
            new Point2D(0, 1),
            new Point2D(10, 0),
            new Point2D(20, 0)
        };

        var spacing = EstimateLocalSpacing(points);

        Assert.Equal(1.0, spacing[0], 10);
        Assert.Equal(1.0, spacing[1], 10);
        Assert.Equal(1.0, spacing[2], 10);

        Assert.Equal(9.0, spacing[3], 10);
        Assert.Equal(10.0, spacing[4], 10);
    }

    [Fact]
    public void LocalSpacing_DuplicateCoordinates_IgnoresZeroDistance()
    {
        var points = new[]
        {
            new Point2D(0, 0),
            new Point2D(0, 0),
            new Point2D(2, 0)
        };

        var spacing = EstimateLocalSpacing(points);

        Assert.Equal(2.0, spacing[0], 10);
        Assert.Equal(2.0, spacing[1], 10);
        Assert.Equal(2.0, spacing[2], 10);
    }

    [Fact]
    public void LocalSpacing_FewerThanTwoPoints_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            EstimateLocalSpacing(new[]
            {
                new Point2D(0, 0)
            }));
    }

    [Fact]
    public void LocalSpacing_AllCoordinatesDuplicated_Throws()
    {
        var points = new[]
        {
            new Point2D(5, 5),
            new Point2D(5, 5),
            new Point2D(5, 5)
        };

        Assert.Throws<ArgumentException>(() =>
            EstimateLocalSpacing(points));
    }

    [Fact]
    public void LocalSpacing_NonFiniteCoordinate_Throws()
    {
        var points = new[]
        {
            new Point2D(0, 0),
            new Point2D(double.NaN, 1)
        };

        Assert.Throws<ArgumentException>(() =>
            EstimateLocalSpacing(points));
    }

    private static double[] EstimateLocalSpacing(
        IReadOnlyList<Point2D> points)
    {
        ArgumentNullException.ThrowIfNull(points);

        if (points.Count < 2)
            throw new ArgumentException(
                "At least two points are required.",
                nameof(points));

        if (points.Any(p =>
            !double.IsFinite(p.X) ||
            !double.IsFinite(p.Y)))
        {
            throw new ArgumentException(
                "Coordinates must be finite.",
                nameof(points));
        }

        var result = new double[points.Count];

        for (var i = 0; i < points.Count; i++)
        {
            var nearestDistance = double.PositiveInfinity;

            for (var j = 0; j < points.Count; j++)
            {
                if (i == j)
                    continue;

                var dx = points[i].X - points[j].X;
                var dy = points[i].Y - points[j].Y;
                var distance = Math.Sqrt(dx * dx + dy * dy);

                if (distance > 0 && distance < nearestDistance)
                    nearestDistance = distance;
            }

            if (!double.IsFinite(nearestDistance))
                throw new ArgumentException(
                    $"Point at index {i} has no distinct-coordinate neighbour.",
                    nameof(points));

            result[i] = nearestDistance;
        }

        return result;
    }

    private static TriangleMetrics MeasureTriangle(
        Point2D a,
        Point2D b,
        Point2D c,
        double localSpacing)
    {
        var ab = Distance(a, b);
        var bc = Distance(b, c);
        var ca = Distance(c, a);

        var twiceArea = Math.Abs(
            (b.X - a.X) * (c.Y - a.Y) -
            (b.Y - a.Y) * (c.X - a.X));

        if (twiceArea <= 0)
            throw new ArgumentException(
                "Triangle vertices must not be collinear.");

        if (!double.IsFinite(localSpacing) || localSpacing <= 0)
            throw new ArgumentOutOfRangeException(
                nameof(localSpacing));

        return new TriangleMetrics(
            ab * bc * ca / (2.0 * twiceArea),
            Math.Max(ab, Math.Max(bc, ca)),
            localSpacing);
    }

    private static double Distance(Point2D a, Point2D b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    private static Point2D Scale(Point2D point, double factor) =>
        new(point.X * factor, point.Y * factor);

    private sealed record Point2D(double X, double Y);

    private sealed record TriangleMetrics(
        double Circumradius,
        double LongestEdge,
        double LocalSpacing);

    [Fact]
    public void InternalGap_SpanningEdge_IsLargerThanLocalSpacing()
    {
        // Two groups of regularly spaced points separated by a gap.
        var points = new[]
        {
            new Point2D(0, 0),
            new Point2D(1, 0),
            new Point2D(0, 1),

            new Point2D(10, 0),
            new Point2D(11, 0),
            new Point2D(10, 1)
        };

        var spacing = EstimateLocalSpacing(points);

        // The nearest-neighbour distances within each group are 1 m.
        Assert.Equal(1.0, spacing[0], 10);
        Assert.Equal(1.0, spacing[1], 10);
        Assert.Equal(1.0, spacing[2], 10);
        Assert.Equal(1.0, spacing[3], 10);
        Assert.Equal(1.0, spacing[4], 10);
        Assert.Equal(1.0, spacing[5], 10);

        // A hypothetical edge bridging the groups spans 9 m.
        var bridgingEdge = Distance(points[1], points[3]);

        Assert.Equal(9.0, bridgingEdge, 10);
        Assert.True(bridgingEdge / spacing[1] > 1.0);
    }

    [Fact]
    public void InternalGap_SpanningTriangle_HasLargeNormalisedEdge()
    {
        var a = new Point2D(1, 0);
        var b = new Point2D(10, 0);
        var c = new Point2D(10, 1);

        var localSpacing = 1.0;
        var metrics = MeasureTriangle(a, b, c, localSpacing);

        var expectedLongestEdge = Math.Sqrt(82.0);

        Assert.Equal(expectedLongestEdge, metrics.LongestEdge, 10);
        Assert.Equal(
            expectedLongestEdge,
            metrics.LongestEdge / metrics.LocalSpacing,
            10);
    }

    [Fact]
    public void InternalGap_LargeSpanRequiresFurtherEvaluation()
    {
        var localSpacing = 1.0;
        var spanningEdge = 9.0;

        var normalisedEdge = spanningEdge / localSpacing;

        // This is a diagnostic trigger, not a final terrain
        // acceptance threshold.
        var requiresFurtherEvaluation = normalisedEdge > 1.0;

        Assert.True(requiresFurtherEvaluation);
    }

    [Fact]
    public void Delaunator_InternalGap_IdentifiesSpanningTriangles()
    {
        var results = RunDelaunatorGapExperiment();

        Assert.Equal(3, results.Length);

        foreach (var result in results)

        {
            Assert.Equal(4, result.WithinPatchCount);
            Assert.Equal(4, result.WithinPatchLongestEdges.Length);

            Assert.True(result.SpanningTriangleCount >= 2);
            Assert.Equal(
                result.SpanningTriangleCount,
                result.SpanningLongestEdges.Length);

            foreach (var edge in result.WithinPatchLongestEdges)
                Assert.Equal(Math.Sqrt(2.0), edge, 5);

            foreach (var edge in result.SpanningLongestEdges)
                Assert.True(
                    edge > 6.0,
                    $"Expected a long gap-spanning edge, but found {edge:F3} m.");
        }

        Assert.All(results, result =>
            Assert.True(result.TriangleCount > 0));
    }

    private static GapExperimentResult[] RunDelaunatorGapExperiment()
    {
        var repositoryRoot = FindRepositoryRoot();

        var libraryPath = Path.Combine(
            repositoryRoot,
            "CulvertCAD.Web",
            "wwwroot",
            "lib",
            "delaunator",
            "delaunator.min.js");

        Assert.True(
            File.Exists(libraryPath),
            $"Delaunator library not found: {libraryPath}");

        const string script = """
        const Delaunator = require(
            './CulvertCAD.Web/wwwroot/lib/delaunator/delaunator.min.js'
        );

        const basePoints = [
            [0, 0], [1, 0], [0, 1], [1, 1],
            [10, 0], [11, 0], [10, 1], [11, 1]
        ];

        function runTransform(angle, offsetX, offsetY) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const points = basePoints.map(([x, y]) => [
                x * cos - y * sin + offsetX,
                x * sin + y * cos + offsetY
            ]);

            const mesh = Delaunator.from(
                points,
                p => p[0],
                p => p[1]
            );

            const withinPatch = [];
            const spanning = [];

            function distance(a, b) {
                return Math.hypot(
                    a[0] - b[0],
                    a[1] - b[1]
                );
            }

            for (let i = 0; i < mesh.triangles.length; i += 3) {
                const ids = Array.from(
                    mesh.triangles.slice(i, i + 3)
                );

                const trianglePoints = ids.map(id => points[id]);

                const edges = [
                    distance(trianglePoints[0], trianglePoints[1]),
                    distance(trianglePoints[1], trianglePoints[2]),
                    distance(trianglePoints[2], trianglePoints[0])
                ];

                const longestEdge = Math.max(...edges);
                const hasLeftPoint = ids.some(id => id < 4);
                const hasRightPoint = ids.some(id => id >= 4);

                if (hasLeftPoint && hasRightPoint) {
                    spanning.push(longestEdge);
                } else {
                    withinPatch.push(longestEdge);
                }
            }

            return {
                triangleCount: mesh.triangles.length / 3,
                withinPatchCount: withinPatch.length,
                spanningTriangleCount: spanning.length,
                withinPatchLongestEdges: withinPatch.sort((a, b) => a - b),
                spanningLongestEdges: spanning.sort((a, b) => a - b)
            };
        }

        const results = [
            runTransform(0, 0, 0),
            runTransform(0, 100, -50),
            runTransform(Math.PI / 4, 100, -50)
        ];

        process.stdout.write(JSON.stringify(results));
        """;

        var startInfo = new ProcessStartInfo
        {
            FileName = "node",
            WorkingDirectory = repositoryRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("-e");
        startInfo.ArgumentList.Add(script);

        using var process = new Process
        {
            StartInfo = startInfo
        };

        try
        {
            process.Start();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                "Could not start Node.js. Ensure node is installed and " +
                "available on PATH. Delaunator integration test could not run.",
                ex);
        }

        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();

        if (!process.WaitForExit(15000))
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException(
                "Delaunator integration experiment exceeded 15 seconds.");
        }

        Task.WaitAll(stdoutTask, stderrTask);

        Assert.True(
            process.ExitCode == 0,
            $"Node.js experiment failed.{Environment.NewLine}" +
            stderrTask.Result);

        using var document = JsonDocument.Parse(stdoutTask.Result);

        return document.RootElement
            .EnumerateArray()
            .Select(item => new GapExperimentResult(
                item.GetProperty("triangleCount").GetInt32(),
                item.GetProperty("withinPatchCount").GetInt32(),
                item.GetProperty("spanningTriangleCount").GetInt32(),
                item.GetProperty("withinPatchLongestEdges")
                    .EnumerateArray()
                    .Select(value => value.GetDouble())
                    .ToArray(),
                item.GetProperty("spanningLongestEdges")
                    .EnumerateArray()
                    .Select(value => value.GetDouble())
                    .ToArray()))
            .ToArray();
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            var libraryPath = Path.Combine(
                directory.FullName,
                "CulvertCAD.Web",
                "wwwroot",
                "lib",
                "delaunator",
                "delaunator.min.js");

            var testProjectPath = Path.Combine(
                directory.FullName,
                "CulvertCAD.Tests",
                "CulvertCAD.Tests.csproj");

            if (File.Exists(libraryPath) &&
                File.Exists(testProjectPath))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException(
            "Could not locate the CulvertCAD repository root from " +
            AppContext.BaseDirectory);
    }

    private sealed record GapExperimentResult(
        int TriangleCount,
        int WithinPatchCount,
        int SpanningTriangleCount,
        double[] WithinPatchLongestEdges,
        double[] SpanningLongestEdges);

    [Fact]
    public void Delaunator_InternalGap_ReportsTriangleAdjacency()
    {
        var result = RunDelaunatorAdjacencyExperiment();

        Assert.Equal(6, result.Length);

        foreach (var item in result)
        {
            Console.WriteLine(
                $"{item.Name}: triangles={item.TriangleCount}, " +
                $"median={item.ReferenceMedianEdge:F3}, " +
                $"limit={item.LongEdgeLimit:F3}, " +
                $"flagged={item.LongEdgeTriangleCount}, " +
                $"components={item.LongEdgeConnectedComponentCount}, " +
                $"hull-flagged={item.HullLongEdgeCount}, " +
                $"interior-flagged={item.InteriorLongEdgeCount}");
        }

        // The internal-gap fixture should contain both ordinary
        // triangles and triangles spanning the gap.
        var gap = result.Single(r => r.Name == "internalGap");

        Assert.True(gap.TriangleCount > 0);
        Assert.True(gap.TriangleAdjacencyCount > 0);
        Assert.True(gap.LongEdgeTriangleCount > 0);
        Assert.True(gap.LongEdgeConnectedComponentCount > 0);

        // The uniformly sparse fixture should not be classified as
        // suspicious merely because its absolute edges are longer.
        var sparse = result.Single(r => r.Name == "uniformlySparse");

        Assert.True(sparse.TriangleCount > 0);
        Assert.Equal(0, sparse.LongEdgeTriangleCount);
    }

    private static AdjacencyExperimentResult[]
        RunDelaunatorAdjacencyExperiment()
    {
        var repositoryRoot = FindRepositoryRoot();

        const string script = """
        const Delaunator = require(
            './CulvertCAD.Web/wwwroot/lib/delaunator/delaunator.min.js'
        );

        const cases = {
            internalGap: [
                [0,0],[1,0],[0,1],[1,1],
                [10,0],[11,0],[10,1],[11,1]
            ],

            uniformlySparse: [
                [0,0],[5,0],[0,5],[5,5]
            ],

            internalGapWithSurroundingPoints: [
                [0,0],[1,0],[2,0],[3,0],[7,0],[8,0],[9,0],[10,0],
                [0,1],[1,1],[2,1],[3,1],[7,1],[8,1],[9,1],[10,1],
                [0,2],[1,2],[2,2],[3,2],[7,2],[8,2],[9,2],[10,2],
                [0,3],[1,3],[2,3],[3,3],[7,3],[8,3],[9,3],[10,3]
            ],

            graduallyChangingSpacing: [
            [0,0],[1,0],[2,0],[4,0],[7,0],[11,0],
            [0,1],[1,1],[2,1],[4,1],[7,1],[11,1],
            [0,2],[1,2],[2,2],[4,2],[7,2],[11,2]
            ],

            irregularSpacingWithInternalGap: [
            // Left side: gradually increasing spacing
            [0,0], [1,0], [2.2,0], [3.7,0],
            [0,1], [1,1], [2.2,1], [3.7,1],
            [0,2], [1,2], [2.2,2], [3.7,2],
            [0,3], [1,3], [2.2,3], [3.7,3],

            // Right side: irregular spacing after the internal gap
            [8,0], [9.2,0], [10.7,0],
            [8,1], [9.2,1], [10.7,1],
            [8,2], [9.2,2], [10.7,2],
            [8,3], [9.2,3], [10.7,3]
            ],

                    irregularDensityWithoutGap: [
            // Dense area
            [0,0], [1,0], [0,1], [1,1],
            [0,2], [1,2], [0,3], [1,3],

            // Transition area: gradually wider spacing
            [2.5,0], [2.5,1], [2.5,2], [2.5,3],
            [4.5,0], [4.5,1], [4.5,2], [4.5,3],

            // Sparse area, still connected with no deliberately removed region
            [7,0], [7,1], [7,2], [7,3],
            [10,0], [10,1], [10,2], [10,3]
            ],
        };

        function distance(a, b) {
            return Math.hypot(a[0] - b[0], a[1] - b[1]);
        }

        function analyse(name, points) {
            const mesh = Delaunator.from(points, p => p[0], p => p[1]);
            const triangleCount = mesh.triangles.length / 3;
            const adjacency = Array.from(
                { length: triangleCount },
                () => new Set()
            );
            const longestEdges = [];
            const hullEdgeCounts = [];

            for (let t = 0; t < triangleCount; t++) {
                const offset = t * 3;
                const ids = [
                    mesh.triangles[offset],
                    mesh.triangles[offset + 1],
                    mesh.triangles[offset + 2]
                ];

                const p = ids.map(id => points[id]);

                longestEdges[t] = Math.max(
                    distance(p[0], p[1]),
                    distance(p[1], p[2]),
                    distance(p[2], p[0])
                );

                        let hullEdges = 0;

                  for (let e = offset; e < offset + 3; e++) {
                      if (mesh.halfedges[e] < 0)
                          hullEdges++;
                  }

                  hullEdgeCounts[t] = hullEdges;

                for (let e = offset; e < offset + 3; e++) {
                    const opposite = mesh.halfedges[e];

                    // -1 means this edge is on the convex hull.
                    if (opposite < 0) continue;

                    const otherTriangle = Math.floor(opposite / 3);
                    if (otherTriangle === t) continue;

                    adjacency[t].add(otherTriangle);
                    adjacency[otherTriangle].add(t);
                }
            }

            // Diagnostic-only threshold. This is a fixture threshold,
            // not a proposed engineering acceptance value.
            // One data-derived reference calculation for every dataset.
        // The multiplier is exploratory, not an engineering threshold.
        const sortedEdges = [...longestEdges].sort((a, b) => a - b);

        const middle = Math.floor(sortedEdges.length / 2);

        const referenceMedian = sortedEdges.length % 2
            ? sortedEdges[middle]
            : (sortedEdges[middle - 1] + sortedEdges[middle]) / 2;

        const longEdgeLimit = referenceMedian * 2.5;

        const isLong = longestEdges.map(
            edge => edge > longEdgeLimit
        );

            let components = 0;
            const visited = new Set();

            for (let t = 0; t < triangleCount; t++) {
                if (!isLong[t] || visited.has(t)) continue;

                components++;
                const stack = [t];
                visited.add(t);

                while (stack.length) {
                    const current = stack.pop();

                    for (const neighbour of adjacency[current]) {
                        if (isLong[neighbour] && !visited.has(neighbour)) {
                            visited.add(neighbour);
                            stack.push(neighbour);
                        }
                    }
                }
            }

            let adjacencyCount = 0;
            for (const neighbours of adjacency)
                adjacencyCount += neighbours.size;
            adjacencyCount /= 2;

                    const hullLongEdgeCount = isLong.filter(
            (isLongEdge, index) =>
                isLongEdge && hullEdgeCounts[index] > 0
        ).length;

        const interiorLongEdgeCount = isLong.filter(
            (isLongEdge, index) =>
                isLongEdge && hullEdgeCounts[index] === 0
        ).length;

            return {
            name,
            triangleCount,
            triangleAdjacencyCount: adjacencyCount,
            referenceMedianEdge: +referenceMedian.toFixed(3),
            longEdgeLimit: +longEdgeLimit.toFixed(3),
            longEdgeTriangleCount: isLong.filter(Boolean).length,
            longEdgeConnectedComponentCount: components,
            hullLongEdgeCount,
            interiorLongEdgeCount,
            longestEdges: longestEdges.map(x => +x.toFixed(3))
        };
        }

        const results = Object.entries(cases).map(([name, points]) =>
            analyse(name, points)
        );

        process.stdout.write(JSON.stringify(results));
        """;

        var startInfo = new ProcessStartInfo
        {
            FileName = "node",
            WorkingDirectory = repositoryRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("-e");
        startInfo.ArgumentList.Add(script);

        using var process = new Process { StartInfo = startInfo };

        try
        {
            process.Start();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                "Could not start Node.js for the Delaunator adjacency experiment.",
                ex);
        }

        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();

        if (!process.WaitForExit(15000))
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException(
                "Delaunator adjacency experiment exceeded 15 seconds.");
        }

        Task.WaitAll(stdoutTask, stderrTask);

        Assert.True(
            process.ExitCode == 0,
            $"Node.js experiment failed: {stderrTask.Result}");

        using var document = JsonDocument.Parse(stdoutTask.Result);

        return document.RootElement
            .EnumerateArray()
            .Select(item => new AdjacencyExperimentResult(
            item.GetProperty("name").GetString()!,
            item.GetProperty("triangleCount").GetInt32(),
            item.GetProperty("triangleAdjacencyCount").GetInt32(),
            item.GetProperty("referenceMedianEdge").GetDouble(),
            item.GetProperty("longEdgeLimit").GetDouble(),
            item.GetProperty("longEdgeTriangleCount").GetInt32(),
            item.GetProperty("longEdgeConnectedComponentCount").GetInt32(),
            item.GetProperty("hullLongEdgeCount").GetInt32(),
            item.GetProperty("interiorLongEdgeCount").GetInt32()))
            .ToArray();
    }

    private sealed record AdjacencyExperimentResult(
        string Name,
        int TriangleCount,
        int TriangleAdjacencyCount,
        double ReferenceMedianEdge,
        double LongEdgeLimit,
        int LongEdgeTriangleCount,
        int LongEdgeConnectedComponentCount,
        int HullLongEdgeCount,
        int InteriorLongEdgeCount);
}