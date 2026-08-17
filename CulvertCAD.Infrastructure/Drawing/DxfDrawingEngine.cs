// CulvertCAD.Infrastructure/Drawing/DxfDrawingEngine.cs
using netDxf;
using netDxf.Entities;
using netDxf.Tables;
using netDxf.Header;
using netDxf.Units;
using CulvertCAD.Core.DTOs;
using CulvertCAD.Core.Entities;

namespace CulvertCAD.Infrastructure.Drawing;

public interface IDxfDrawingEngine
{
    byte[] GenerateCrossSection(CrossSectionDataDto data, TitleBlockData title);
    byte[] GenerateLongitudinalSection(LongitudinalDataDto data, TitleBlockData title);
    byte[] GenerateCompositeCulvertDrawing(CrossSectionDataDto xs, LongitudinalDataDto ls, TitleBlockData title);
}

public class DxfDrawingEngine : IDxfDrawingEngine
{
    private static Layer CreateLayer(string name, AciColor color, Lineweight lw = Lineweight.Default)
        => new(name) { Color = color, Lineweight = lw };

    private static readonly Layer LayerOutline    = CreateLayer("CULVERT-OUTLINE", AciColor.LightGray,  Lineweight.W50);
    private static readonly Layer LayerCentreline = CreateLayer("CL",              AciColor.Red,    Lineweight.W18);
    private static readonly Layer LayerDimension  = CreateLayer("DIMENSION",       AciColor.Yellow, Lineweight.W18);
    private static readonly Layer LayerHatch      = CreateLayer("BEDDING-HATCH",   AciColor.Cyan,   Lineweight.W13);
    private static readonly Layer LayerRoad       = CreateLayer("ROAD-FILL",       AciColor.DarkGray,   Lineweight.W35);
    private static readonly Layer LayerText       = CreateLayer("TEXT-ANNOTATION", AciColor.Green,  Lineweight.W18);
    private static readonly Layer LayerTitleBlock = CreateLayer("TITLE-BLOCK",     AciColor.LightGray,  Lineweight.W70);
    private static readonly Layer LayerDimLine    = CreateLayer("DIMENSION-LINE",  AciColor.Yellow, Lineweight.W13);

    public byte[] GenerateCrossSection(CrossSectionDataDto data, TitleBlockData title)
    {
        var doc = CreateDocument();

        double D = data.DiameterMm, t = data.WallThicknessMm, Bd = data.TrenchWidthMm;
        double td = data.TrenchDepthMm, bd = data.BeddingDepthMm, fH = data.FillHeightMm;
        double pipeY = bd, extRad = D / 2 + t;

        double totalPipeWidth = data.NumberOfPipes * D + (data.NumberOfPipes - 1) * 100;
        double startX = -totalPipeWidth / 2 - t;

        for (int i = 0; i < data.NumberOfPipes; i++)
        {
            double cx = startX + i * (D + 100) + D / 2 + t;
            doc.Entities.Add(new Circle(new Vector3(cx, pipeY, 0), extRad) { Layer = LayerOutline });
            doc.Entities.Add(new Circle(new Vector3(cx, pipeY, 0), D / 2)   { Layer = LayerOutline });
            doc.Entities.Add(new Line(new Vector3(cx - D, pipeY, 0), new Vector3(cx + D, pipeY, 0)) { Layer = LayerCentreline });
            doc.Entities.Add(new Line(new Vector3(cx, pipeY - D, 0), new Vector3(cx, pipeY + D, 0)) { Layer = LayerCentreline });
        }

        double trenchL = -Bd / 2, trenchR = Bd / 2, trenchB = -bd, trenchT = trenchB + td;

        var trenchPoly = new Polyline2D(new[]
        {
            new Polyline2DVertex(trenchL, trenchB), new Polyline2DVertex(trenchR, trenchB),
            new Polyline2DVertex(trenchR, trenchT), new Polyline2DVertex(trenchL, trenchT),
        }) { IsClosed = true, Layer = LayerOutline };
        doc.Entities.Add(trenchPoly);

        double roadTop = trenchT + fH, roadHalfW = Bd / 2 + 500;
        var roadPoly = new Polyline2D(new[]
        {
            new Polyline2DVertex(-roadHalfW, trenchT), new Polyline2DVertex(roadHalfW, trenchT),
            new Polyline2DVertex(roadHalfW, roadTop),  new Polyline2DVertex(-roadHalfW, roadTop),
        }) { IsClosed = true, Layer = LayerRoad };
        doc.Entities.Add(roadPoly);

        doc.Entities.Add(new Line(new Vector3(-roadHalfW, roadTop, 0), new Vector3(roadHalfW, roadTop, 0)) { Layer = LayerOutline, Lineweight = Lineweight.W70 });

        AddDimension(doc, $"Ø{D:0}mm", new Vector2(-D/2, pipeY + extRad + 200), new Vector2(D/2, pipeY + extRad + 200));
        AddDimension(doc, $"Bd={Bd:0}mm", new Vector2(trenchL, trenchB - 300), new Vector2(trenchR, trenchB - 300));
        AddDimension(doc, $"H={data.FillHeightMm/1000:0.000}m", new Vector2(roadHalfW + 200, trenchT), new Vector2(roadHalfW + 200, roadTop));

        AddText(doc, $"IS 783 {data.BeddingClass} Bedding", new Vector2(trenchL - 1200, trenchB + bd / 2));
        AddText(doc, $"Wall thickness: {t:0}mm", new Vector2(trenchR + 200, pipeY + 50));
        AddText(doc, "Granular bedding material (IS 783 Cl.6)", new Vector2(-Bd/4, trenchB + 50));
        AddText(doc, "Compacted earth fill", new Vector2(-200, trenchT + fH / 2));
        AddText(doc, "Road surface", new Vector2(-300, roadTop + 150));

        DrawCrossSection_TitleBlock(doc, title);
        DrawISNotes(doc, data, new Vector2(trenchL - 500, trenchB - 800));

        return SaveToBytes(doc);
    }

    public byte[] GenerateLongitudinalSection(LongitudinalDataDto data, TitleBlockData title)
    {
        var doc = CreateDocument();
        double pipeLen = data.TotalLengthM * 1000, D = data.PipeDiameterMm;
        double invStart = data.InvertRLStart * 1000, invEnd = data.InvertRLEnd * 1000;

        doc.Entities.Add(new Line(new Vector3(0, data.RoadRLStart*1000, 0), new Vector3(pipeLen, data.RoadRLEnd*1000, 0)) { Layer = LayerRoad, Lineweight = Lineweight.W70 });
        doc.Entities.Add(new Line(new Vector3(0, invStart, 0), new Vector3(pipeLen, invEnd, 0)) { Layer = LayerOutline });
        doc.Entities.Add(new Line(new Vector3(0, invStart+D, 0), new Vector3(pipeLen, invEnd+D, 0)) { Layer = LayerOutline });
        doc.Entities.Add(new Line(new Vector3(0, invStart-200, 0), new Vector3(0, invStart+D+200, 0)) { Layer = LayerOutline, Lineweight = Lineweight.W70 });
        doc.Entities.Add(new Line(new Vector3(pipeLen, invEnd-200, 0), new Vector3(pipeLen, invEnd+D+200, 0)) { Layer = LayerOutline, Lineweight = Lineweight.W70 });
        doc.Entities.Add(new Line(new Vector3(0, invStart+D/2, 0), new Vector3(pipeLen, invEnd+D/2, 0)) { Layer = LayerCentreline });
        doc.Entities.Add(new Line(new Vector3(0, invStart-150, 0), new Vector3(pipeLen, invEnd-150, 0)) { Layer = LayerHatch });

        double dimY = Math.Max(data.RoadRLStart, data.RoadRLEnd) * 1000 + 1000;
        AddDimension(doc, $"Pipe length L = {data.TotalLengthM:0.0}m", new Vector2(0, dimY), new Vector2(pipeLen, dimY));
        AddDimension(doc, $"Ø{D:0}mm", new Vector2(pipeLen + 500, invEnd), new Vector2(pipeLen + 500, invEnd + D));

        AddText(doc, $"Invert RL = {data.InvertRLStart:0.000}m", new Vector2(-1500, invStart));
        AddText(doc, $"Invert RL = {data.InvertRLEnd:0.000}m", new Vector2(pipeLen + 300, invEnd));
        double slopePct = Math.Abs(data.InvertRLEnd-data.InvertRLStart)/data.TotalLengthM*100;
        AddText(doc, $"Slope S = {slopePct:0.000}%", new Vector2(pipeLen/2-500, invStart+D/2+300));

        DrawLong_TitleBlock(doc, title);
        return SaveToBytes(doc);
    }

    public byte[] GenerateCompositeCulvertDrawing(CrossSectionDataDto xs, LongitudinalDataDto ls, TitleBlockData title)
    {
        var doc = CreateDocument();
        AddText(doc, "COMPOSITE DRAWING — see separate L-Section and Cross-Section sheets", new Vector2(0, 0));
        AddText(doc, $"Project: {title.ProjectName}", new Vector2(0, -500));
        AddText(doc, $"Drawing: {title.DrawingNumber} Rev {title.RevisionCode}", new Vector2(0, -1000));
        return SaveToBytes(doc);
    }

    private static DxfDocument CreateDocument()
    {
        var doc = new DxfDocument(new HeaderVariables { LtScale = 1.0 });
        doc.DrawingVariables.InsUnits = DrawingUnits.Millimeters;
        foreach (var layer in new[] { LayerOutline, LayerCentreline, LayerDimension, LayerHatch, LayerRoad, LayerText, LayerTitleBlock, LayerDimLine })
            if (!doc.Layers.Contains(layer.Name)) doc.Layers.Add(layer);
        return doc;
    }

    private static void AddText(DxfDocument doc, string text, Vector2 position, double height = 250)
        => doc.Entities.Add(new Text(text, new Vector3(position.X, position.Y, 0), height) { Layer = LayerText });

    private static void AddDimension(DxfDocument doc, string text, Vector2 p1, Vector2 p2)
    {
        double midX = (p1.X+p2.X)/2, midY = (p1.Y+p2.Y)/2;
        doc.Entities.Add(new Line(new Vector3(p1.X,p1.Y,0), new Vector3(p2.X,p2.Y,0)) { Layer = LayerDimLine });
        AddText(doc, text, new Vector2(midX - text.Length*60, midY + 150), 200);
    }

    private static void DrawCrossSection_TitleBlock(DxfDocument doc, TitleBlockData title)
    {
        double x0 = 20000, y0 = -3000;
        AddText(doc, $"PROJECT: {title.ProjectName}", new Vector2(x0, y0+1200), 300);
        AddText(doc, $"DRG NO: {title.DrawingNumber}", new Vector2(x0, y0+800), 250);
        AddText(doc, "TITLE: Cross-Section of Pipe Culvert", new Vector2(x0, y0+500), 250);
        AddText(doc, $"SCALE: {title.Scale}", new Vector2(x0, y0+200), 220);
        AddText(doc, $"REV: {title.RevisionCode}", new Vector2(x0+3000, y0+200), 220);
        AddText(doc, $"DATE: {title.Date:dd/MM/yyyy}", new Vector2(x0+5000, y0+200), 220);
        AddText(doc, $"DRAWN: {title.DrawnBy}", new Vector2(x0, y0-100), 200);
        AddText(doc, $"CHECKED: {title.CheckedBy}", new Vector2(x0+3000, y0-100), 200);
        AddText(doc, $"APPD: {title.ApprovedBy}", new Vector2(x0+6000, y0-100), 200);
        AddText(doc, "IS 783:1985 | IS 458:2003 | IRC 89:1997", new Vector2(x0, y0-400), 180);
    }

    private static void DrawLong_TitleBlock(DxfDocument doc, TitleBlockData title)
    {
        double x0 = 0, y0 = -5000;
        AddText(doc, $"PROJECT: {title.ProjectName}", new Vector2(x0, y0+1200), 300);
        AddText(doc, $"DRG NO: {title.DrawingNumber}", new Vector2(x0, y0+800), 250);
        AddText(doc, "TITLE: Longitudinal Section of Pipe Culvert", new Vector2(x0, y0+500), 250);
        AddText(doc, $"REV: {title.RevisionCode} | DATE: {title.Date:dd/MM/yyyy}", new Vector2(x0, y0+200), 220);
        AddText(doc, $"DRAWN: {title.DrawnBy} | CHK: {title.CheckedBy} | APPD: {title.ApprovedBy}", new Vector2(x0, y0-100), 200);
    }

    private static void DrawISNotes(DxfDocument doc, CrossSectionDataDto data, Vector2 origin)
    {
        var notes = new[]
        {
            "NOTES:", "1. All dimensions in mm unless noted.",
            $"2. Pipe: IS 458:2003 Class {data.BeddingClass}.",
            "3. Bedding: IS 783 Cl.6 — granular material, 120° support.",
            "4. Trench width Bd = D + 600mm (IS 783 Cl.7.2).",
            "5. Loading: IRC Class A — IS 783 Table 1.",
            "6. Design std: IRC 89:1997.",
        };
        for (int i = 0; i < notes.Length; i++)
            AddText(doc, notes[i], new Vector2(origin.X, origin.Y - i*350), 200);
    }

    private static byte[] SaveToBytes(DxfDocument doc)
    {
        using var ms = new MemoryStream();
        doc.Save(ms);
        return ms.ToArray();
    }
}
