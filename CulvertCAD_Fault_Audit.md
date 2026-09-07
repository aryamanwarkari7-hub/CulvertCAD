# CulvertCAD — DesignCalculationService Fault Audit

**Document status:** Reconciled current audit register  
**Date:** 07-09-2026  
**Basis:** Original fault audit + current source verification + cleared-status verification + architecture refactor completed to date

---

## 1. Purpose

This document is the reconciled fault register for the current CulvertCAD engineering calculation implementation.

It preserves the original audit findings while updating their status against the current source.

The purpose is to distinguish:

- faults that have been rectified and verified,
- faults that remain confirmed,
- issues requiring engineering-basis verification,
- issues that are architectural/data-boundary concerns,
- items that are not faults by themselves.

**Important:** A fault being architecturally cleared does not mean its underlying engineering methodology has been approved. Engineering-basis items remain open until the applicable standard/methodology has been established.

---

## 2. Working Rule

For every suspected fault:

1. Identify the exact code.
2. Trace actual current behavior.
3. Decide whether it is truly a fault.
4. Classify it as:
   - Cleared
   - Confirmed
   - Needs Engineering Verification
   - Not a Fault
5. Record impact.
6. Do not change engineering logic until the engineering basis is established.

The controlled sequence remains:

```text
Fault Audit
    ↓
Engineering-basis verification
    ↓
Architecture migration
    ↓
Controlled engineering fixes
    ↓
Testing
```

---

## 3. Current Architecture Verification

The Application layer has now been checked for direct Infrastructure dependencies.

Current result:

```text
CulvertCAD.Application
        ↓
CulvertCAD.Core abstractions/entities
        ↓
CulvertCAD.Infrastructure implementations
```

There are currently no direct `CulvertCAD.Infrastructure` references from the Application project.

The major calculation responsibilities are now separated as follows:

```text
DesignCalculationService
│
├── IHydrologyCalculationService
├── IHydraulicCalculationService
│   ├── IHeadwaterCalculationService
│   └── IPipeCatalogRepository
├── IStructuralCalculationService
│   ├── ILiveLoadService
│   └── IBeddingService
├── IPipeSelectionService
├── IFOSCalculationService
└── IEngineeringInputValidationService
```

`BeddingService` was extracted from `StructuralCalculationService` during the current architecture refactor.

Build and tests were verified after this extraction.

---

# 4. Reconciled Current Fault Register

## 4.1 Cleared / Rectified and Verified

| ID | Finding | Current status |
| --- | --- | --- |
| P1 / PS1 | Hydraulic diameter could differ from final structural pipe diameter | **CLEARED** |
| P2 | Silent engineering defaults | **CLEARED** |
| H1 | Hydrological method selection not honored | **CLEARED** |
| H2 | Hydrology inputs could be silently defaulted | **CLEARED** |
| H3 | Design discharge override traceability | **CLEARED** |
| H4 | Hydrology embedded in monolithic calculation service | **CLEARED** |
| HY1 | Multi-pipe capacity semantics unclear | **CLEARED** |
| HY3 | Hard-coded hydraulic diameter list | **CLEARED** |
| S2 | Structural calculation did not receive number of pipes | **CLEARED** |
| S4 | Soil unit-weight silently defaulted | **CLEARED** |
| PS2 | Pipe selection directly coupled to persistence | **CLEARED** |
| SR1 | Structural/hydraulic pipe configuration mismatch | **CLEARED** |
| TR2 | Final structural selection/verdict missing from trace | **CLEARED** |
| TR3 | Result DTO completeness | **CLEARED** |
| TR4 | Calculation result mapping completeness | **VERIFIED** |
| — | Bedding logic embedded in StructuralCalculationService | **CLEARED — BeddingService extracted** |

### P1 / PS1

The current workflow recalculates hydraulics if structural pipe selection changes the diameter and performs a final convergence check.

Current sequence:

```text
Hydraulic sizing
    ↓
Structural calculation
    ↓
Pipe selection
    ↓
Hydraulic recalculation if diameter changes
    ↓
Structural recalculation
    ↓
Final pipe selection
    ↓
Convergence check
```

Therefore the previous contradictory Ø600/Ø700 state is no longer the current implementation behavior.

### P2 / H2

Engineering input validation now occurs before the main calculation path. Missing required engineering inputs are rejected rather than allowing the normal calculation workflow to proceed with silent defaults.

### H1 / H4

Hydrology is separated behind:

```text
IHydrologyCalculationService
        ↓
HydrologyCalculationService
```

Rational hydrology is implemented. Unsupported hydrological methods are explicitly rejected rather than silently falling back to Rational.

### H3

`DesignDischargeOverrideQ`, when supplied, is authoritative.

When no override is supplied, the selected hydrological method is used.

The result stores the actual design discharge and identifies its source.

### HY1

Hydraulic results now distinguish:

```text
QfullM3s        = full capacity per pipe
QdesignM3s      = design capacity per pipe
QfullTotalM3s   = full capacity of all pipes
QdesignTotalM3s = design capacity of all pipes
```

### HY3

Hydraulic diameter candidates are now obtained from active `PipeCatalog` data through:

```text
IPipeCatalogRepository
```

rather than a hard-coded diameter list.

### S2 / SR1

Structural calculation now receives:

```text
NumberOfPipes
```

and the same hydraulic pipe-count configuration is propagated into structural calculation.

### PS2

Pipe selection is separated into:

```text
IPipeSelectionService
        ↓
PipeSelectionService
        ↓
IPipeCatalogRepository
        ↓
PipeCatalogRepository
        ↓
AppDbContext
```

### TR2

The calculation trace now includes final engineering-decision information including:

- selected pipe,
- pipe crushing capacity,
- factor of safety,
- structural verdict.

### Bedding architecture

The former bedding responsibility inside `StructuralCalculationService` has been extracted:

```text
StructuralCalculationService
        ↓
IBeddingService
        ↓
BeddingService
        ↓
EngineeringCalculationSettings
```

This is an architecture correction only. The current bedding values have not been changed.

---

# 5. Confirmed Open Engineering / Model Issues

## P3 — Manning Roughness

**Status:** CONFIRMED — CURRENT VALUE NOT SUPPORTED BY IDENTIFIED IRC BASIS

The hydraulic calculation uses configured Manning `n`, currently sourced from `EngineeringCalculationSettings`.

Current configuration includes:

```text
ManningN = 0.013
```

The architectural problem of embedding the value directly inside calculation code has been addressed.

IRC:SP:13-2022 Article 19.2.5 identifies `n = 0.015` for cement-concrete circular pipes in its stated friction-loss formulation. Therefore the current configured value `n = 0.013` is not supported by the identified IRC basis for that pipe condition.

**Required action:** Reconcile the applicable Manning roughness with the complete hydraulic methodology and actual pipe/material condition before implementing the final value.

---

## P4 — 75% Capacity Criterion

**Status:** CONFIRMED — ASSUMED 75% CRITERION NOT SUPPORTED

Current hydraulic adequacy uses:

```text
Design capacity = Qfull × DesignCapacityFactor
```

with current configuration:

```text
DesignCapacityFactor = 0.75
```

The value is configurable rather than embedded directly in the calculation.

IRC:SP:13-2022 does not establish a universal 75% full-flow capacity factor as the culvert acceptance criterion. The current `DesignCapacityFactor = 0.75` is therefore an application assumption.

**Required action:** Replace the 75% criterion with an approved hydraulic acceptance methodology based on the governing culvert hydraulic conditions
---

## P5 — Full-Bore Hydraulic Model

**Status:** CONFIRMED — HIGH / ENGINEERING MODEL GAP

The current hydraulic model uses:

```text
A = πD² / 4
R = D / 4
```

and Manning full-bore capacity.

It does not provide a complete partial-flow culvert analysis.

Missing/limited areas include:

- partial-flow depth,
- inlet control,
- outlet control,
- tailwater,
- complete critical/normal-depth treatment,
- complete energy-based hydraulic analysis.

**Required action:** Establish the adopted hydraulic methodology before redesigning this calculation.

---

## P6 — Simplified Headwater

**Status:** CONFIRMED — HIGH / ENGINEERING MODEL GAP

The current headwater calculation is:

```text
Hc = 0.5D

HW = Hc + Ke × V²/(2g)
```

It does not represent a complete culvert control analysis.

---

## P7 / S1 — Trench Width Assumption

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

Current structural calculation uses:

```text
Bd = D + TrenchWidthClearanceM
```

with current configuration:

```text
TrenchWidthClearanceM = 0.6 m
```

This is now configuration rather than an inline constant, but the engineering assumption remains.

The calculation does not derive trench geometry from:

- number of pipes,
- pipe spacing,
- actual pipe arrangement,
- installation condition,
- construction requirements.

**Required action:** Establish the engineering rule for trench width and multi-pipe arrangement.

---

## P8 / S5 — Structural Kμ

**Status:** CONFIRMED — ENGINEERING BASIS TO VERIFY

Current configuration contains:

```text
StructuralKmu = 0.150
```

The value is controlled through engineering configuration, but its applicable engineering basis remains to be verified.

---

## P9 / B4 — Bedding Class and Factor

**Status:** CONFIRMED — ENGINEERING BASIS TO VERIFY

Current configuration contains:

```text
BeddingClass  = ClassB
BeddingFactor = 1.9
```

Bedding access has now been separated through `IBeddingService` / `BeddingService`.

However, the engineering basis for automatically applying this bedding condition to every design remains open.

---

## P10 / SR2 — Bearing Capacity

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS REQUIRED

`BearingCapacityKNm2` is captured as an engineering input but is not currently used in the structural acceptance calculation.

Therefore the current structural verdict does not include a bearing/foundation check.

**Required action:** Establish and implement the applicable bearing/foundation methodology, or explicitly defer/remove the input until supported.

---

## P11 / S3 — Soil Type

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS REQUIRED

`SoilType` is captured, but the current structural calculation primarily uses the supplied soil unit weight.

Changing `SoilType` itself does not independently alter the current calculation.

**Required action:** Establish controlled soil properties and their effect on the adopted engineering calculations.

---

## P12 — Design Standard

**Status:** CONFIRMED — HIGH / ENGINEERING METHODOLOGY REQUIRED

`DesignStandard` is captured but does not currently drive the calculation methodology.

The application therefore does not yet provide a complete:

```text
Selected Standard
        ↓
Applicable Method
        ↓
Applicable Formula
        ↓
Applicable Clause
```

mapping.

**Required action:** Establish the authoritative design-standard mapping before implementing standard-dependent calculations.

---

# 6. Hydraulic Audit

## HY2 — Velocity Acceptance Criterion

**Status:** CONFIRMED — CURRENT VELOCITY CRITERION NOT ESTABLISHED

Current adequacy uses:

```text
vFull >= 0.6 m/s
vFull <= 3.5 m/s
```

The service also calculates:

```text
vDesign = qPerPipe / A
```

but does not use `vDesign` for adequacy.

No current repository engineering reference establishes whether the governing acceptance condition should use:

- full-flow velocity,
- design-flow velocity,
- or another standard-defined condition.

**Required action:** Establish the governing velocity acceptance criterion from the approved hydraulic methodology before changing the current code
---

# 7. Headwater Audit

## HW1 — No Barrel Friction / Length

**Status:** CONFIRMED — HIGH

`CalculateHeadwater()` currently receives:

- discharge,
- diameter,
- entrance-loss coefficient.

It does not receive or use:

- barrel length,
- pipe/barrel slope,
- Manning roughness,
- hydraulic radius,
- tailwater.

Therefore barrel friction/head loss cannot be represented.

IRC:SP:13-2022 Article 19.2 includes barrel friction in the full-flow pipe-culvert hydraulic method, with the operating head providing energy to overcome frictional resistance. The applicable friction treatment depends on barrel length, hydraulic radius and roughness.

**Required action:** Incorporate the applicable barrel friction/head-loss methodology into the final headwater/control calculation.

**Do NOT fix yet.**

---

## HW2 — No Tailwater / Hydraulic Control Evaluation

**Status:** CONFIRMED — HIGH

The current headwater calculation does not evaluate the downstream hydraulic condition.

There is no explicit input or calculation for:

- tail-race HFL / tailwater level,
- outlet hydraulic condition,
- operating head based on upstream and downstream levels,
- governing hydraulic control condition.

IRC:SP:13-2022 Article 19.2 requires the tail-race HFL to be known and defines the operating head for full-flow culvert analysis using the upstream water level and the higher of the tail-race water surface or outlet crown.

Therefore the current simplified headwater calculation cannot reproduce the governing downstream hydraulic condition required by the adopted methodology.

**Required action:** Establish the applicable tailwater/outlet and control methodology and incorporate it into the final hydraulic calculation.

**Do NOT fix yet.**

---

## HW3 — Universal Entrance-Loss Coefficient

**Status:** CONFIRMED — CURRENT DEFAULT NOT GENERALLY SUPPORTED

The current `HeadwaterCalculationService` uses a default entrance-loss coefficient of `Ke = 0.5`.

IRC:SP:13-2022 Article 19.2.5 states that `Ke` principally depends on the shape of the inlet and gives commonly used values including approximately `0.08` for bevelled/bell-mouthed entry and `0.505` for sharp-edged entry. The standard also notes that `Ke` is influenced by inlet size and wetted-surface roughness.

Therefore the current universal `Ke = 0.5` default cannot be treated as a generally applicable culvert inlet coefficient.

**Required action:** Determine `Ke` from the approved inlet configuration and applicable hydraulic methodology.

**Do NOT fix yet.**F

---

## HW5 — Headwater Does Not Participate in Hydraulic PASS/FAIL

**Status:** CONFIRMED — HIGH

The hydraulic calculation calculates and stores `HeadwaterDepthM`.

However, the current hydraulic adequacy decision does not use the calculated headwater/heading-up condition. The current verdict is based on the existing capacity and velocity criteria.

IRC:SP:13-2022 Article 19.2.1 establishes permissible heading-up at the inlet as a design safety criterion. The upstream water level must not rise above the predetermined safe level, considering risks such as road overtopping and property damage. Article 19.2.2 also requires the tail-race HFL, and Article 19.2.3 defines the operating head using the upstream level relative to the higher of the tailwater surface or outlet crown.

Therefore the application currently produces a headwater result without incorporating the governing headwater/heading-up condition into hydraulic acceptance.

**Required action:** Incorporate the approved headwater/heading-up acceptance methodology into the final hydraulic PASS/FAIL decision.

**Do NOT fix yet.**

---

# 27. Headwater Audit — HW6 — Result Semantics

**Status:** CONFIRMED — RESULT SEMANTICS ISSUE

The current headwater calculation exposes its result as:

```text
HeadwaterDepthM

---

# 8. Live Load Audit

## LL1 — Invalid Load Class Fallback

**Status:** CONFIRMED — HIGH

Current `LiveLoadService` selects the 70R table for `IRC_70R` and otherwise uses the normal table.

Therefore an unsupported/invalid load-class value can potentially fall through to the normal table unless validation prevents it.

**Required action:** Establish explicit supported load-class validation.

---

## LL2 — Live Load Tables Embedded in Service

**Status:** CONFIRMED — ARCHITECTURAL / ENGINEERING-DATA ISSUE

The normal and 70R tables remain embedded in `LiveLoadService`.

This mixes engineering data with calculation implementation.

The numerical basis of the tables must also be independently verified.

---

## LL3 — Out-of-range Fill Depth

**Status:** NEEDS ENGINEERING VERIFICATION — MEDIUM/HIGH

Current behavior clamps to the nearest table endpoint.

The engineering basis for this behavior must be verified against the applicable standard.

---

# 9. Bedding / Crushing Load

## B3 — Required Crushing Load Formula

**Status:** NEEDS ENGINEERING VERIFICATION

Current calculation:

```text
Required Crushing Load = Total Field Load / Bedding Factor
```

The implementation is internally consistent, but the engineering basis and applicable standard clause require verification.

---

# 10. Factor of Safety

## FOS1 — Selected Pipe Crushing Capacity

**Status:** VERIFIED BEHAVIOR — ENGINEERING BASIS OPEN

Current calculation uses the selected pipe catalogue ultimate crushing capacity and bedding factor.

Conceptually:

```text
FOS =
Pipe Ultimate Crushing Load × Bedding Factor
--------------------------------------------
Total Field Load
```

The implementation is internally coherent.

The engineering basis for pipe capacity, bedding factor, and design treatment remains open.

---

## FOS2 — FOS Depends on Bedding Factor

**Status:** CONFIRMED DEPENDENCY — ENGINEERING BASIS OPEN

Because FOS uses the bedding factor:

```text
Bedding Factor
      ↓
Required Crushing Load
      ↓
Factor of Safety
      ↓
Structural PASS/FAIL
```

The bedding-factor engineering basis therefore directly affects structural adequacy.

---

## FOS3 — Minimum FOS

**Status:** NEEDS ENGINEERING VERIFICATION — HIGH

Current configuration:

```text
StructuralFosMinimum = 1.5
```

The applicable design standard and required minimum factor of safety must be verified.

---

## FOS4 — Overall Design Verdict Scope

**Status:** CONFIRMED — SYSTEMIC

The overall verdict is effectively:

```text
Hydraulic Pass
AND
Structural Pass
```

The current structural/hydraulic models do not yet include all engineering checks that the overall verdict could be interpreted to represent, including:

- complete bearing/foundation verification,
- complete inlet/outlet control,
- complete headwater analysis,
- other open engineering checks.

The Boolean combination itself is not necessarily wrong; the issue is the scope implied by the final verdict.

---

# 11. Pipe Selection

## PS4 — Completeness of Pipe Specification

**Status:** NEEDS ENGINEERING VERIFICATION — MEDIUM/HIGH

Current pipe selection primarily considers:

- diameter,
- required crushing capacity,
- catalogue suitability.

A complete engineering rule may additionally require:

- pipe standard,
- pipe class,
- wall thickness,
- material,
- manufacturing/availability constraints,
- applicable design standard.

The required selection specification must be established before classifying this as a definite omission.

---

# 12. Structural Result Scope

## SR3 — Structural Result Incomplete Relative to Accepted Inputs

**Status:** CONFIRMED — HIGH

The structural result currently covers:

- earth load,
- live load,
- total field load,
- bedding,
- required crushing load,
- pipe crushing capacity,
- FOS.

But accepted structural/geotechnical inputs such as bearing capacity are not yet represented in the structural acceptance calculation.

This remains open until the engineering scope is defined.

---

# 13. Traceability

## TR1 — Engineering Assumptions / Configuration

**Status:** PARTIALLY RECTIFIED — ENGINEERING BASIS OPEN

Several assumptions that were previously embedded directly in calculation code are now represented through `EngineeringCalculationSettings`, including:

- Manning `n`,
- design capacity factor,
- trench-width clearance,
- structural `Kμ`,
- bedding class,
- bedding factor,
- minimum structural FOS.

Bedding access is additionally separated through `IBeddingService`.

However, central configuration does not by itself establish:

```text
Input
  ↓
Formula
  ↓
Coefficient
  ↓
Standard
  ↓
Clause
  ↓
Result
```

The engineering basis of the configured values remains open.

---

# 14. Engineering Input Audit

## F-INPUT-01 — Roadway Width

**Status:** RECLASSIFIED — ENGINEERING DETERMINATION REQUIRED

`RoadwayWidthM` is captured, persisted, and used outside the core calculation, including BOQ/drawing workflows.

It is not currently used by core hydrology, hydraulic, or structural calculations.

**Conclusion:** The original claim that the input is completely unused is no longer accurate.

**Required action:** Determine whether roadway width belongs in any core engineering calculation and establish the applicable methodology.

---

## F-INPUT-02 — Skew Angle

**Status:** CONFIRMED — HIGH / ENGINEERING METHODOLOGY REQUIRED

`SkewAngleDeg` is:

- captured,
- persisted,
- mapped,

but is not currently used by the hydraulic or structural calculation.

**Required action:** Establish the engineering treatment of skew before implementing it.

---

### F-INPUT-03 — ReturnPeriodYrs Not Used in Design Discharge Determination

**Status:** CONFIRMED GAP — OPEN / ENGINEERING DATA DEPENDENCY

**Finding:**  
`ReturnPeriodYrs` is captured in `RevisionEngineeringInput`, persisted with the revision input snapshot, and editable through the revision workflow. However, it is not used by `DesignCalculationService` or `HydrologyCalculationService` to determine design rainfall intensity or design discharge.

**Verified execution path:**

`ReturnPeriodYrs`
→ persisted in revision input  
→ passed within `RevisionEngineeringInput`  
→ NOT used to determine rainfall intensity  
→ NOT passed to `HydrologyCalculationService.CalculateQ()`  
→ therefore does not currently affect calculated `Q`.

**Engineering requirement:**  
For culvert design, the approved design return period must be connected to the appropriate rainfall/IDF data and methodology before determining design rainfall intensity and design discharge.

**Current engineering basis:**  
IRC:SP:13-2022 specifies a 50-year return period for culverts.

**Required future chain:**

`ReturnPeriodYrs`
→ approved rainfall/IDF source
→ design rainfall intensity
→ hydrology calculation
→ design discharge `Q`

**Implementation status:**  
No calculation change approved at this stage. The application currently has no identified rainfall/IDF data source from which return-period-specific rainfall intensity can be derived.

**Additional traceability finding:**  
`UpdateRevisionInputsAsync()` currently does not record changes to `ReturnPeriodYrs` in revision status-history remarks.

**Required action:**

1. Define and approve the rainfall/IDF data source and methodology.
2. Define how `ReturnPeriodYrs` determines design rainfall intensity.
3. Implement the approved methodology.
4. Add `ReturnPeriodYrs` change tracking to revision history.

---

# 15. Items Not Classified as Faults

| Item | Reason |
| --- | --- |
| S7 — Fill height passed as input | Consistent with current engineering input model |
| Hydraulic pipe-count retry itself | Selection strategy requires engineering/product verification |
| Live-load interpolation itself | Interpolation is not automatically incorrect; engineering basis requires verification |
| FOS formula itself | Current formula is internally coherent; engineering basis remains open |
| Existing calculation-service boundaries | Services inspected are sufficiently cohesive; further micro-service extraction would be premature |

---

# 16. Final Current Status Matrix

## Cleared

```text
P1 / PS1
P2
H1
H2
H3
H4
HY1
HY3
S2
S4
PS2
SR1
TR2
TR3
TR4
Bedding architecture extraction
```

## Confirmed / Open

```text
P5
P6
P7 / S1
P8 / S5
P9 / B4
P10 / SR2
P11 / S3
P12
LL1
LL2
HW1
HW2
HW3
HW5
HW6
SR3
FOS2
FOS4
F-INPUT-02
F-INPUT-03
```

## Needs Engineering Verification

F-INPUT-03

```text
P3
P4
HY2
LL3
B3
PS4
FOS1
FOS3
F-INPUT-01
TR1
```

---

# 17. Architecture Status

The architecture refactor should now be considered **sufficiently complete for the current calculation scope**.

Current target structure:

```text
DesignCalculationService
        │
        ├── HydrologyCalculationService
        ├── HydraulicCalculationService
        │       └── HeadwaterCalculationService
        │
        ├── StructuralCalculationService
        │       ├── LiveLoadService
        │       └── BeddingService
        │
        ├── PipeSelectionService
        ├── FOSCalculationService
        └── EngineeringInputValidationService
```

Persistence boundaries:

```text
Application
    ↓
Core repository interfaces
    ↓
Infrastructure repository implementations
```

No direct Application → Infrastructure dependency remains.

**No further service extraction should be performed solely for structural cleanliness unless a genuinely mixed responsibility is identified.**

---

# 18. Engineering-Basis Phase

The next phase should not be another broad refactor.

It should establish the engineering basis for the open items, especially:

1. Hydraulic design methodology
2. Headwater/control methodology
3. Velocity acceptance criterion
4. Manning roughness
5. Capacity criterion
6. Structural trench/load methodology
7. Bedding factors
8. Live-load tables and limits
9. Pipe crushing/FOS methodology
10. Bearing/foundation checks
11. Soil-property methodology
12. Skew treatment
13. Return-period/hydrology methodology
14. Design-standard mapping

Only after these are established should the corresponding code changes be made.

---

# 19. Audit Governance Rule

The audit determines what the software currently does.

The clear-status document records only items that have subsequently been rectified and regression-tested.

Engineering verification items must remain open until their engineering basis has been established.

Architecture improvements must not be interpreted as engineering approval.

---

# 20. Current Audit Conclusion

The first-pass audit and architecture exercise are complete enough to proceed to engineering-basis verification.

The application architecture has improved materially:

- calculation responsibilities are separated at appropriate boundaries,
- persistence is abstracted behind Core repository interfaces,
- Application has no direct Infrastructure dependency,
- hydraulic/structural configuration convergence is enforced,
- calculation traceability has been improved,
- engineering input validation is established,
- bedding has been extracted as an independent application service.

The remaining work is primarily **engineering methodology and acceptance criteria**, not further mechanical service extraction.
