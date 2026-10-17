# 35. Engineering Outputs — Reports, BOQ and Drawings

## 1. Purpose

The engineering calculation is not the final product.

The final design must produce usable engineering deliverables.

The main outputs are:

- Engineering report
- BOQ
- Drawings
- Design data
- Revision information

## 2. Engineering Report

The report should communicate:

- Project information
- Survey/site information
- Design discharge
- Hydraulic inputs
- Hydraulic calculations
- Structural inputs
- Structural calculations
- Geotechnical assumptions/checks
- Final selected culvert
- PASS/FAIL results
- Design assumptions
- Standards/design basis

Conceptually:

```text
PROJECT
   ↓
SITE / SURVEY
   ↓
HYDROLOGY
   ↓
HYDRAULICS
   ↓
STRUCTURAL DESIGN
   ↓
GEOTECHNICAL CHECKS
   ↓
FINAL DESIGN
   ↓
ENGINEERING REPORT
```

## 3. BOQ

The **Bill of Quantities (BOQ)** converts the selected design into measurable work items.

Typical categories may include:

- Pipe supply
- Pipe laying
- Excavation
- Bedding
- Backfilling
- Concrete
- Reinforcement
- Headwalls
- Wingwalls
- Aprons
- Cutoff/protection works
- Other applicable items

The exact BOQ items depend on the final design.

## 4. BOQ Dependency

The BOQ should be generated from the approved design, not from manually re-entered values.

```text
APPROVED DESIGN
      ↓
Geometry
      ↓
Components
      ↓
Quantities
      ↓
BOQ
```

This reduces inconsistency between calculation and quantity documentation.

## 5. Drawings

The drawing should represent the approved engineering design.

Potential drawing content includes:

- Plan
- Longitudinal section
- Cross-section
- Pipe arrangement
- Inlet/outlet details
- Headwall
- Wingwalls
- Apron/protection
- Levels
- Dimensions
- Notes
- Material/reinforcement details where applicable

## 6. Drawing Dependency

```text
APPROVED DESIGN
      ↓
Geometry + components + levels
      ↓
Drawing generation
      ↓
DXF / CAD / 3D output
```

The drawing must use the same approved design data as the report and BOQ.

## 7. Consistency Requirement

A strong system should avoid this situation:

```text
Calculation → 1200 mm pipe
BOQ         → 1000 mm pipe
Drawing     → 1200 mm pipe
```

Instead:

```text
             APPROVED DESIGN
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
      REPORT       BOQ       DRAWING
```

All three should originate from the same approved revision.

## 8. Revision-Controlled Outputs

Each engineering output should be associated with the design revision.

```text
R0 → Draft
 ↓
R1 → Revised
 ↓
R2 → Approved
```

The approved report, BOQ, and drawings must correspond to the same approved revision.

## 9. Final Engineering Package

The complete package can conceptually be:

```text
APPROVED CULVERT DESIGN
        │
        ├── Engineering Report
        ├── BOQ
        ├── 2D Drawing / DXF
        ├── 3D Model where applicable
        └── Design / Revision Metadata
```

> **The final engineering output is the approved, traceable representation of the calculated culvert design.**
