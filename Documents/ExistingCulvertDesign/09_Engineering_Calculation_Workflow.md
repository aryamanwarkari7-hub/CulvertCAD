# 34. Engineering Calculation Workflow

## 1. Purpose

This document connects the individual engineering concepts into one calculation sequence.

CulvertCAD should not treat hydrology, hydraulics, structural design, and geotechnical design as unrelated screens.

They form a dependency chain.

## 2. Overall Dependency

```text
SURVEY / SITE DATA
        ↓
HYDROLOGY
        ↓
DESIGN DISCHARGE
        ↓
HYDRAULIC DESIGN
        ↓
CULVERT CONFIGURATION
        ↓
STRUCTURAL DESIGN
        ↓
GEOTECHNICAL / FOUNDATION CHECK
        ↓
FINAL DESIGN
        ↓
BOQ + DRAWINGS + REPORT
```

## 3. Step 1 — Site and Survey

The system establishes:

- Culvert location
- Existing levels
- Road geometry
- Drainage path
- Relevant upstream/downstream information

## 4. Step 2 — Hydrology

The system determines the required design discharge:

```text
Catchment / rainfall / survey information
                ↓
          Hydrological method
                ↓
          Design discharge Q
```

## 5. Step 3 — Hydraulic Design

The proposed culvert is tested against Q.

```text
Design Q
   ↓
Pipe size / barrels / slope
   ↓
Manning / hydraulic calculations
   ↓
Capacity
   ↓
Depth / velocity
   ↓
Headwater / tailwater
   ↓
Hydraulic checks
```

If the arrangement fails:

```text
FAIL
 ↓
Modify culvert configuration
 ↓
Recalculate
```

## 6. Step 4 — Configuration

The engineer finalizes:

- Diameter
- Number of barrels
- Length
- Alignment
- Slope
- Inlet
- Outlet
- Structural components

## 7. Step 5 — Structural Design

Structural loads are determined.

```text
Cover
 +
Soil
 +
Traffic/live load
 +
Other applicable loads
 ↓
Structural demand
 ↓
Pipe/component capacity
 ↓
PASS / FAIL
```

The adopted buried-pipe methodology may include Marston-type load calculations.

## 8. Step 6 — Geotechnical / Foundation

The system checks the interaction with the ground.

```text
Foundation
   ↓
Bearing
   ↓
Stability
   ↓
Settlement where required
   ↓
PASS / FAIL
```

## 9. Step 7 — Overall Design Decision

All major engineering checks must pass.

```text
Hydraulic  → PASS
Structural → PASS
Ground     → PASS
      ↓
FINAL DESIGN → ACCEPTED
```

If any governing check fails:

```text
Any governing check → FAIL
             ↓
        Design revision
             ↓
         Recalculate
```

## 10. Calculation Traceability

A calculation should preserve:

```text
Input
  ↓
Method
  ↓
Intermediate values
  ↓
Calculated result
  ↓
Acceptance criterion
  ↓
PASS / FAIL
```

This is important for engineering review and revision control.

## 11. Revision

If an approved design is changed, the new calculation should not silently overwrite the previous engineering result.

Conceptually:

```text
R0
 ↓
Review
 ↓
Change required
 ↓
R1
 ↓
Recalculate
 ↓
Review
 ↓
Approved R1
```

This connects engineering calculations with CulvertCAD's revision-controlled workflow.

> **The calculation workflow is the backbone connecting the engineering disciplines and the software workflow.**
