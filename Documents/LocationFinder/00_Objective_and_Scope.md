# CulvertCAD â€” Culvert Location Finder Objective

## Objective
Use survey data and a prescribed road alignment to identify and map potential culvert locations along the fixed alignment.

## In Scope â€” Steps 1â€“5
1. Import survey data containing terrain points, contours and elevations.
2. Import the prescribed road alignment.
3. Analyse terrain along and around the alignment to identify drainage paths, valleys, low points and potential water crossings.
4. Detect potential culvert locations along the complete alignment.
5. Display the alignment, terrain/contours, elevations and suggested locations on a Leaflet map.

## Explicitly On Hold
- Manual adjustment of suggested locations.
- Engineer review or approval workflow.
- Passing confirmed locations into the existing culvert-design workflow.

## Boundaries
- The road alignment is supplied; CulvertCAD does not generate or optimize the road alignment.
- The existing culvert design functionality is to be preserved.
- A detected location is a candidate, not an automatically approved culvert.
- Candidate detection must record the terrain evidence/rationale used.
