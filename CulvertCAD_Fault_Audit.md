# CulvertCAD — DesignCalculationService Fault Audit
## Hydrology + Previously Confirmed Issues

Date: 24-08-2026

## Purpose

Record faults found during the controlled audit of the existing `DesignCalculationService`.

**Important:** This is an audit record. No calculation logic or architecture has been changed.

---

## 1. Problem 1 — Hydraulic Diameter vs Structural Pipe Diameter

**Status:** CONFIRMED — HIGH/CRITICAL CONSISTENCY ISSUE

Current flow:

```text
Design Q
  ↓
Hydraulic calculation → e.g. Ø600
  ↓
Structural pipe selection
  ↓
If Ø600 pipe is inadequate/unavailable → Ø700
```

The hydraulic calculation is not recalculated after the structural selection changes diameter.

Possible result:

```text
SelectedDiameterMm = 600
SelectedPipeDiaMm  = 700
```

Consequences:

- Hydraulics based on Ø600
- Structural pipe/FOS based on Ø700
- Calculation Sheet can use Ø600
- BOQ can use Ø600
- Drawing can use Ø600

This creates one revision with contradictory engineering geometry/results.

**Do not fix yet.**

---

## 2. Problem 2 — Silent Engineering Defaults

**Status:** CONFIRMED — HIGH

The calculation path can substitute internal/default values when important inputs are missing, including values such as:

- Runoff coefficient
- Rainfall intensity
- Catchment area
- Slope
- Fill height
- Soil unit weight

Problem:

```text
Missing input
  ↓
Internal default
  ↓
Calculation continues
```

Required eventual behavior:

```text
Missing/invalid input
  ↓
Validation error
  ↓
Calculation prevented
```

**Do not fix yet.**

---

## 3. Problem 3 — Hard-coded Manning Roughness

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

The hydraulic calculation uses:

```text
Manning n = 0.013
```

directly in calculation code.

Issue:
- Not controlled through engineering configuration/master data.
- Design basis must be verified before changing it.

---

## 4. Problem 4 — Hard-coded 75% Capacity Criterion

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

The hydraulic calculation uses:

```text
Design Capacity = Full Bore Capacity × 0.75
```

and applies the same 75% criterion for adequacy.

Issue:
- Engineering acceptance criterion is embedded as a constant.
- Its adopted standard/basis must be verified.

---

## 5. Problem 5 — Full-bore Hydraulic Model

**Status:** CONFIRMED — HIGH / ENGINEERING MODEL GAP

The hydraulic calculation uses full-bore geometry:

```text
A = πD² / 4
R = D / 4
```

It does not provide a complete partial-flow culvert analysis.

Limited/missing areas include:
- Partial-flow depth
- Inlet control
- Outlet control
- Tailwater
- Critical/normal depth treatment
- Complete energy-based hydraulic analysis

---

## 6. Problem 6 — Simplified Headwater Calculation

**Status:** CONFIRMED — HIGH

The current headwater calculation is simplified and does not represent a complete culvert control analysis.

Limited/missing factors include:
- Inlet control
- Outlet control
- Tailwater
- Barrel friction
- Entrance/exit losses
- Complete energy balance
- Road overtopping/freeboard checks

---

## 7. Problem 7 — Hard-coded Trench Width

**Status:** CONFIRMED — HIGH

Current structural calculation assumes:

```text
Trench Width = Pipe Diameter + 0.6 m
```

Issue:
- Trench geometry is an embedded assumption.
- It is not derived from explicit design/configuration data.
- It can become inconsistent with multiple pipes and actual drawing geometry.

---

## 8. Problem 8 — Hard-coded Structural Coefficient

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

The structural calculation uses:

```text
Kμ = 0.150
```

as an embedded constant.

The applicable formula/standard and coefficient must be verified before changing it.

---

## 9. Problem 9 — Hard-coded Bedding Class and Factor

**Status:** CONFIRMED — HIGH

Current calculation uses:

```text
Bedding Class = Class B
Bedding Factor = 1.9
```

for the calculation.

Issue:
- The same bedding assumption is effectively applied to every design.
- It is not currently a meaningful selection/configuration driven by installation conditions.

---

## 10. Problem 10 — Bearing Capacity Input Is Not Used

**Status:** CONFIRMED — HIGH

`BearingCapacityKNm2` exists as an engineering input but is not used by the current calculation path.

Risk:
- Engineer can enter a value and reasonably believe it has been checked when it has no effect on the result.

Later decision:
- Implement the relevant bearing/foundation calculation, or
- remove/defer the input until supported.

---

## 11. Problem 11 — Soil Type Is Not Used Meaningfully

**Status:** CONFIRMED — HIGH

`SoilType` exists in the input, but the structural calculation primarily uses the supplied soil unit weight.

Changing soil type itself does not independently alter the calculation.

Later decision:
- Establish controlled soil properties and how soil selection affects the applicable calculations.

---

## 12. Problem 12 — Design Standard Does Not Drive Calculation Method

**Status:** CONFIRMED — HIGH

`DesignStandard` exists in the input, but current formulas do not meaningfully switch methodology based on the selected standard.

Issue:

```text
Selected design standard
        ↓
Current calculation methodology
        ↓
Does not necessarily change
```

The authoritative design basis must eventually be established.

---

## 13. Problem H1 — Hydrological Method Selection Is Not Honored

**Status:** CONFIRMED — HIGH

The model supports hydrological method selection such as:

- Rational
- Dicken
- Ryve
- Inglis

But the current calculation actually performs the Rational Method calculation.

Conceptually:

```text
Selected HydroMethod
        ↓
Current implementation
        ↓
Q = C × I × A / 360
```

The selected alternative method does not currently produce its own calculation.

This is a direct engineering correctness issue.

---

## 14. Problem H2 — Hydrology Inputs Can Be Defaulted

**Status:** CONFIRMED — HIGH

Important hydrology values can receive defaults rather than causing calculation validation to fail.

Examples:
- Catchment area
- Rainfall intensity
- Runoff coefficient

Required eventual behavior:

```text
Missing/invalid hydrology input
        ↓
Validation error
        ↓
No calculation
```

---

## 15. Problem H3 — Design Discharge Override Rule

**Status:** NEEDS VERIFICATION — MEDIUM**

The system supports optional `DesignDischargeQ`.

The exact rule needs to be traced:

- Is override authoritative?
- Is the hydrological Q still calculated?
- Which Q enters hydraulics?
- What is stored for traceability?
- What appears in the Calculation Sheet?

Do not classify this as a formula fault until the complete flow is verified.

---

## 16. Problem H4 — Hydrology Embedded in DesignCalculationService

**Status:** CONFIRMED — ARCHITECTURAL**

The current `DesignCalculationService` contains hydrology logic.

Target later:

```text
IHydrologyCalculationService
HydrologyCalculationService
```

with `DesignCalculationService` acting as the orchestrator.

This is an architecture migration item, not an immediate formula change.

---

# Current Fault Register

| ID | Issue | Status |
|---|---|---|
| P1 | Hydraulic diameter vs structural pipe diameter | Confirmed |
| P2 | Silent engineering defaults | Confirmed |
| P3 | Hard-coded Manning n | Confirmed / basis verification |
| P4 | Hard-coded 75% capacity criterion | Confirmed / basis verification |
| P5 | Full-bore hydraulic model | Confirmed |
| P6 | Simplified headwater | Confirmed |
| P7 | Hard-coded trench width | Confirmed |
| P8 | Hard-coded structural coefficient | Confirmed / basis verification |
| P9 | Hard-coded bedding class/factor | Confirmed |
| P10 | Bearing capacity ignored | Confirmed |
| P11 | Soil type not meaningfully used | Confirmed |
| P12 | Design standard not driving calculation | Confirmed |
| H1 | HydroMethod not honored | Confirmed |
| H2 | Hydrology inputs can be defaulted | Confirmed |
| H3 | Design Q override rule | Needs verification |
| H4 | Hydrology embedded in monolithic service | Confirmed architectural |

---

# Working Rule

For each new suspected fault:

1. Identify exact code.
2. Trace actual behavior.
3. Decide whether it is truly a fault.
4. Classify it as:
   - Confirmed
   - Needs verification
   - Not a fault
5. Record impact.
6. Do not fix immediately.

Only after the audit:

```text
Fault Audit
    ↓
Engineering-basis verification
    ↓
Architecture migration
    ↓
Controlled fixes
    ↓
Testing
```

---

# Next Audit Target

**Hydraulic calculation only.**

Inspect:

- Pipe diameter trial
- Number-of-pipe trial
- Manning calculation
- Capacity
- Velocity
- Headwater
- Hydraulic PASS/FAIL

Do not modify code until this section is understood.


---

# 19. Hydraulic Audit — HY1 — Design Capacity for Multiple Pipes

**Status:** CONFIRMED — HIGH

The hydraulic calculation divides total design discharge by the number of pipes:

```text
qPerPipe = Q / NumberOfPipes
```

It then checks the 75% full-bore capacity per pipe:

```text
0.75 × Qfull ≥ qPerPipe
```

However, the stored `QdesignM3s` result is calculated as:

```text
QdesignM3s = 0.75 × Qfull
```

without multiplying by the number of pipes.

Therefore, for multiple pipes, `QdesignM3s` represents the design capacity of one pipe while `DesignDischargeQ` represents the total design discharge.

Example:

```text
Number of pipes = 2
Required total Q = 1.00 m³/s

Required per-pipe Q = 0.50 m³/s

Qfull per pipe = 0.80 m³/s

Stored Qdesign = 0.60 m³/s

Total design capacity under the same rule = 1.20 m³/s
```

## Problem

The result can mix:

```text
Total design discharge
        vs
Per-pipe design capacity
```

without clearly representing the total system capacity.

## Impact

This can cause confusion/inconsistency in:
- Calculation Sheet
- Engineering result DTO/document
- Reports
- Any downstream comparison of `DesignCapacityM3s` against total `DesignDischargeQ`

## Current conclusion

The hydraulic result model needs to clearly distinguish:
- capacity per pipe
- total capacity of all pipes

The correct engineering representation/formula must be confirmed before implementation.

**Do NOT fix yet.**

---

# 20. Hydraulic Audit — HY2 — Velocity Acceptance Criterion

**Status:** NEEDS ENGINEERING VERIFICATION — MEDIUM/HIGH

The current hydraulic adequacy condition uses full-flow velocity:

```text
vFull >= 0.6 m/s
vFull <= 3.5 m/s
```

The service also calculates design-flow velocity:

```text
vDesign = qPerPipe / A
```

but the acceptance condition does not use `vDesign`.

## Problem requiring verification

We need to establish which velocity should govern the adopted engineering acceptance criterion:

- velocity at full flow,
- velocity at design flow,
- or another standard-defined condition.

## Current conclusion

Do not classify this as a definite formula fault until the applicable engineering basis is verified.

**Do NOT fix yet.**

---

# 21. Hydraulic Audit — HY3 — Hard-coded Diameter List vs PipeCatalog

**Status:** CONFIRMED — ARCHITECTURAL / ENGINEERING-DATA ISSUE

The hydraulic calculation uses a hard-coded diameter list:

```text
300, 400, 500, 600, 700, 800, 900, 1000 mm
```

Separately, the application has `PipeCatalog` engineering data containing pipe information.

## Problem

There are two sources of pipe-size information:

```text
DesignCalculationService
    ↓
Hard-coded diameter list

PipeCatalog
    ↓
Database engineering data
```

These sources can diverge.

A valid pipe diameter in the engineering master data could potentially be excluded from hydraulic selection because it is absent from the hard-coded list.

## Current conclusion

Pipe diameter availability/selection should eventually be controlled through the appropriate engineering master-data boundary.

**Do NOT fix yet.**

---

# 22. Next Audit Target

The next single area to inspect is:

## Hydraulic Headwater / Control Calculation

Trace only:

- `CalculateHeadwater(...)`
- `Ke`
- `Hc`
- Velocity used in headwater
- Headwater result
- How headwater is consumed downstream

Determine:

1. Exactly what the current formula calculates.
2. What engineering assumptions are embedded.
3. Which values are hard-coded.
4. Whether the result is used consistently.
5. Which findings are confirmed faults vs items requiring engineering verification.

No code changes.


---

# 23. Headwater Audit — HW1 — No Barrel Friction/Length

**Status:** CONFIRMED — HIGH

`CalculateHeadwater()` receives only:
- discharge
- diameter
- entrance-loss coefficient

It does not receive or use:
- barrel length
- pipe/barrel slope
- Manning roughness
- hydraulic radius
- tailwater

Therefore barrel friction loss cannot be included.

**Do NOT fix yet.**

---

# 24. Headwater Audit — HW2 — No Inlet/Outlet Control Evaluation

**Status:** CONFIRMED — HIGH

The current method calculates a simplified expression but does not determine whether inlet control or outlet control governs.

There is no explicit evaluation of:
- inlet control
- outlet control
- tailwater condition
- governing control regime

**Do NOT fix yet.**

---

# 25. Headwater Audit — HW3 — Hard-coded Entrance Coefficient

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

The current headwater calculation uses:

```text
Ke = 0.5
```

The coefficient is not selected from actual inlet configuration or controlled engineering data.

The correct coefficient/design basis must be verified before implementation.

**Do NOT fix yet.**

---

# 26. Headwater Audit — HW5 — Headwater Does Not Participate in Hydraulic PASS/FAIL

**Status:** CONFIRMED — HIGH

The service calculates and stores `HeadwaterDepthM`.

However, the hydraulic adequacy condition is based on:
- full-bore capacity criterion
- full-flow velocity limits

The calculated headwater is not part of the hydraulic PASS/FAIL decision.

Therefore the system can display a headwater value without using it as a design acceptance criterion.

**Do NOT fix yet.**

---

# 27. Headwater Audit — HW6 — Result Semantics

**Status:** CONFIRMED — RESULT SEMANTICS ISSUE

The result is labelled:

```text
HeadwaterDepthM
```

and presented as "Headwater Depth".

The underlying calculation is a simplified expression rather than a complete culvert headwater/control analysis.

This creates a risk that the displayed result is interpreted as a full engineering headwater determination when it is not.

The eventual model should clearly distinguish a simplified/intermediate estimate from an authoritative headwater result.

**Do NOT fix yet.**

---

# 28. Next Audit Target

## Structural Calculation — `CalculateStructural()`

Inspect only the first structural section:

- Fill height `H`
- Pipe diameter `D`
- Trench width `Bd`
- Soil unit weight `γ`
- Load coefficient `Cd`
- Earth load
- Live load input into total load

Determine:
1. Exact current formulas.
2. Inputs actually used.
3. Hard-coded assumptions.
4. Inputs that are ignored.
5. Confirmed faults vs engineering-basis verification items.

Do not inspect or modify bedding/FOS/pipe selection yet.


---

# 29. Structural Audit — S1 — Hard-coded Trench Width

**Status:** CONFIRMED — HIGH

The structural calculation uses:

```text
Trench Width = Pipe Diameter + 0.6 m
```

The width is not derived from:
- Number of pipes
- Pipe spacing
- Actual pipe arrangement
- Installation condition
- Construction requirements

This assumption directly affects the structural earth-load calculation.

**Do NOT fix yet.**

---

# 30. Structural Audit — S2 — Structural Calculation Does Not Know Number of Pipes

**Status:** CONFIRMED — HIGH

The hydraulic calculation can select multiple pipes, but `CalculateStructural()` does not receive `NumberOfPipes`.

Therefore the structural load calculation does not explicitly represent the multi-pipe configuration selected by the hydraulic calculation.

Current conceptual flow:

```text
Hydraulic
  ↓
1–4 pipes possible
  ↓
Structural
  ↓
Receives diameter but not pipe count
```

This creates a mismatch between hydraulic configuration and structural configuration.

**Do NOT fix yet.**

---

# 31. Structural Audit — S3 — Soil Type Does Not Affect Calculation

**Status:** CONFIRMED — HIGH

`SoilType` exists as an engineering input, but the structural calculation uses the supplied soil unit weight rather than the selected soil type as a determining engineering configuration.

This reinforces existing fault **P11**.

**Do NOT fix yet.**

---

# 32. Structural Audit — S4 — Soil Unit Weight Can Be Silently Defaulted

**Status:** CONFIRMED — HIGH

If soil unit weight is missing, the current calculation path can use:

```text
18.5 kN/m³
```

This reinforces existing fault **P2 — Silent Engineering Defaults**.

**Do NOT fix yet.**

---

# 33. Structural Audit — S5 — Hard-coded Kμ

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

The structural calculation uses:

```text
Kμ = 0.150
```

directly inside the calculation.

This reinforces existing fault **P8**.

The applicable engineering basis must be verified before changing the value or formula.

**Do NOT fix yet.**

---

# 34. Structural Audit — S6 — Earth Load Depends Directly on Assumed Trench Width

**Status:** CONFIRMED — HIGH

The earth-load calculation uses the trench width:

```text
We = Cd × γ × Bd²
```

and `Bd` is currently:

```text
D + 0.6 m
```

Therefore the hard-coded trench-width assumption directly changes the calculated earth load.

This is part of **S1**, not a separate independent fault.

**Do NOT fix yet.**

---

# 35. Structural Audit — S7 — Fill Height Used as Supplied Input

**Status:** NOT A FAULT BY ITSELF

`FillHeightM` is supplied directly to the structural calculation and used as `H`.

This is consistent with the roadmap treating fill height as an engineering input.

No fault is recorded from this behavior alone.

---

# 36. Next Audit Target

## Structural Live Load Calculation

Inspect only:

- `CalculateLiveLoad(...)`
- Normal load table
- 70R load table
- Load-class selection
- Fill-depth selection
- Interpolation/clamping behavior
- Live load returned to `CalculateStructural()`

Determine:
1. Exact current behavior.
2. Hard-coded engineering assumptions.
3. Invalid-input/fallback behavior.
4. Confirmed faults vs engineering-basis verification items.

Do not inspect bedding, crushing load, FOS, or pipe selection yet.


---

# 37. Live Load Audit — LL1 — Invalid Load Class Silently Falls Back

**Status:** CONFIRMED — HIGH

Current selection logic effectively treats every load class that does not contain `70R` as the normal live-load table.

Therefore an invalid or unsupported load class can silently continue using the normal table instead of causing validation failure.

Example:

```text
Invalid LoadClass
      ↓
Not 70R
      ↓
Normal load table
      ↓
Calculation continues
```

This should eventually be handled by explicit validation and controlled loading-class configuration.

**Do NOT fix yet.**

---

# 38. Live Load Audit — LL2 — Live Load Tables Hard-coded in Calculation Service

**Status:** CONFIRMED — ARCHITECTURAL / ENGINEERING-DATA ISSUE

The normal and 70R live-load tables are embedded directly inside `DesignCalculationService`.

Problem:
- Engineering data is mixed with calculation logic.
- Values are difficult to centrally manage or update.
- The applicable standard/basis is not represented as controlled configuration.

This does not by itself prove that the numerical table values are incorrect.

The numerical basis must be verified separately.

**Do NOT fix yet.**

---

# 39. Live Load Audit — LL3 — Out-of-range Fill Depth Silently Clamped

**Status:** NEEDS ENGINEERING VERIFICATION — MEDIUM/HIGH

For fill depths outside the tabulated range, the current code returns the nearest table endpoint rather than rejecting, extrapolating, or explicitly flagging the condition.

Example:

```text
H below minimum
    ↓
Minimum table value

H above maximum
    ↓
Maximum table value
```

The engineering rule allowing this behavior must be verified against the applicable standard.

**Do NOT fix yet.**

---

# 40. Next Audit Target

## Bedding Calculation

Inspect only:

- Bedding class selection
- Bedding factor
- `RequiredCrush`
- How bedding values enter structural results

Do not inspect FOS or pipe selection yet.


---

# 41. Structural Audit — Factor of Safety and Final Structural Check

## FOS1 — Factor of Safety uses the selected pipe's ultimate crushing load

**Status:** CONFIRMED — BEHAVIOR, NOT YET A FORMULA FAULT

The current calculation uses the selected pipe catalogue item's ultimate crushing capacity and compares it with the calculated field load through the bedding factor.

Conceptually:

```text
FOS = Pipe Ultimate Crushing Load × Bedding Factor
      -----------------------------------------------
                 Total Field Load
```

The current implementation is internally consistent with its own selected inputs.

However, the engineering basis of the pipe ultimate capacity, bedding factor, and applicable design factor must be verified before declaring the formula compliant with the adopted standard.

**Do NOT fix yet.**

---

## FOS2 — FOS depends on the fixed bedding factor

**Status:** CONFIRMED — HIGH

Because the FOS calculation uses the bedding factor and the bedding factor is currently fixed at `1.9`, the FOS is directly affected by the hard-coded bedding assumption.

Therefore:

```text
Fixed Bedding Factor
        ↓
Required Crushing Load
        ↓
Factor of Safety
        ↓
Structural PASS/FAIL
```

This reinforces **P9/B2**.

**Do NOT fix yet.**

---

## FOS3 — Structural PASS/FAIL threshold is hard-coded

**Status:** CONFIRMED — HIGH / ENGINEERING BASIS TO VERIFY

The current structural adequacy condition uses a fixed factor-of-safety threshold:

```text
FOS >= 1.5
```

The threshold is embedded in the calculation logic.

The applicable design standard and required factor of safety must be verified before changing the value.

**Do NOT fix yet.**

---

## FOS4 — Overall verdict is dependent on the current simplified hydraulic and structural models

**Status:** CONFIRMED — SYSTEMIC

The overall verdict is effectively based on:

```text
Hydraulic Pass
AND
Structural Pass
```

The structural result can therefore be PASS while important engineering checks are not actually represented, such as:
- complete bearing/foundation check
- complete culvert control/headwater analysis
- complete inlet/outlet control
- other missing engineering checks identified in the audit

This does not mean the Boolean combination itself is wrong. The issue is that the verdict can appear more comprehensive than the underlying checks.

**Do NOT fix yet.**

---

# 42. Structural Audit — Pipe Selection

## PS1 — Pipe selection can change diameter after hydraulic sizing

**Status:** CONFIRMED — CRITICAL**

The hydraulic calculation can select a diameter based on hydraulic adequacy.

The structural pipe-selection process can then move to a larger standard diameter if the initially selected diameter has no adequate catalogue pipe.

Example:

```text
Hydraulic result → Ø600
        ↓
No adequate Ø600 catalogue pipe
        ↓
Pipe selection → Ø700
```

The hydraulic calculation is not rerun for Ø700.

This is the already confirmed **Problem 1**.

Potential contradictory state:

```text
Hydraulic values → Ø600
Selected pipe    → Ø700
FOS              → based on Ø700 pipe
Downstream design → may use Ø600
```

**Do NOT fix yet.**

---

## PS2 — Pipe selection is coupled directly to database access

**Status:** CONFIRMED — ARCHITECTURAL**

The calculation service directly accesses the EF database context to find the appropriate pipe catalogue record.

Therefore pipe-selection engineering logic is coupled to persistence implementation.

Target architecture later:

```text
StructuralCalculationService
        ↓
IPipeCatalogRepository
        ↓
PipeCatalogRepository
        ↓
Database
```

This should be refactored without changing selection behavior first.

**Do NOT fix yet.**

---

## PS3 — Pipe selection uses the hard-coded diameter list

**Status:** CONFIRMED — ARCHITECTURAL / ENGINEERING-DATA ISSUE

Pipe selection is constrained by the same hard-coded standard diameter list used by the hydraulic trial.

This duplicates engineering master data and can prevent valid catalogue configurations from being considered.

This reinforces **HY3**.

**Do NOT fix yet.**

---

## PS4 — Pipe selection is not based on a complete pipe specification

**Status:** NEEDS ENGINEERING VERIFICATION — MEDIUM/HIGH

The current selection primarily considers:
- diameter
- crushing capacity
- catalogue suitability

A complete engineering pipe selection may also require verification of:
- pipe standard
- pipe class
- wall thickness
- material
- manufacturing/availability constraints
- applicable design standard

The current implementation should be compared against the intended pipe-selection engineering rule before calling the omission a definite formula fault.

**Do NOT fix yet.**

---

# 43. Structural Audit — Structural Result Consistency

## SR1 — Structural result and hydraulic result can represent different pipe configurations

**Status:** CONFIRMED — CRITICAL**

The hydraulic result contains pipe diameter/number information.

The structural calculation receives diameter but not number of pipes.

Therefore:

```text
Hydraulic:
    Ø600
    2 pipes

Structural:
    Ø600
    no pipe-count input
```

The structural result therefore does not explicitly represent the same complete barrel configuration as the hydraulic design.

This reinforces **S2** and contributes to **Problem 1**.

**Do NOT fix yet.**

---

## SR2 — Bearing capacity is accepted but not part of structural verdict

**Status:** CONFIRMED — HIGH**

`BearingCapacityKNm2` is an input but is not used in the structural calculation.

Therefore the structural PASS/FAIL does not include bearing capacity.

This reinforces **P10**.

**Do NOT fix yet.**

---

## SR3 — Structural result does not represent all structural checks implied by the UI

**Status:** CONFIRMED — HIGH**

The current structural result focuses on:
- earth load
- live load
- total field load
- bedding
- required crushing load
- pipe crushing capacity
- FOS

But the UI/input model also contains structural/geotechnical information such as bearing capacity.

Because some accepted inputs do not participate in the calculation, the structural result is incomplete relative to the apparent input scope.

**Do NOT fix yet.**

---

# 44. Structural Audit — Traceability

## TR1 — Fixed structural assumptions are not represented as controlled engineering configuration

**Status:** CONFIRMED — HIGH**

The structural calculation embeds assumptions such as:

```text
Kμ
Bedding Class
Bedding Factor
FOS threshold
Trench width relationship
```

These are not centrally represented as standard/configuration data.

This makes it difficult to establish:

```text
Input
→ Formula
→ Coefficient
→ Standard
→ Result
```

for every important structural output.

**Do NOT fix yet.**

---

# 45. Engineering Input Audit

## F-INPUT-01 — Roadway Width Input Not Used in Calculation

**Status:** CONFIRMED — HIGH

`RoadwayWidthM` is accepted as an engineering input and is exposed in:

- Design Create
- Revision Edit

However, the current `DesignCalculationService` does not consume `RoadwayWidthM`.

Therefore:

```text
Engineer enters Roadway Width
        ↓
Revision input stores value
        ↓
Calculation
        ↓
Roadway Width has no effect

**Impact**

The engineer can enter a roadway width and reasonably expect it to participate in the design, but the current calculation does not use it.

Action

Determine the required engineering use of roadway width and integrate it into the appropriate calculation/check where applicable.

## F-INPUT-02 — Skew Angle Input Not Used in Calculation

**Status:** CONFIRMED — HIGH

`SkewAngleDeg` is accepted as an engineering input and is exposed in Revision Edit.

However, the current `DesignCalculationService` does not consume `SkewAngleDeg`.

Therefore:

```text
Engineer enters Skew Angle
        ↓
Revision input stores value
        ↓
Calculation
        ↓
Skew Angle has no effect

Impact

The input is presented as an engineering design parameter but currently has no effect on calculated results.

Action

Determine the required engineering treatment of skew and integrate it into the appropriate hydraulic/structural/geometric calculation where applicable.

## F-INPUT-03 — Return Period Input Not Used in Calculation

**Status:** CONFIRMED — HIGH

`ReturnPeriodYrs` is accepted as a hydrological engineering input but is not consumed by the current `DesignCalculationService`.

Therefore:

```text
Engineer enters Return Period
        ↓
Revision input stores value
        ↓
Calculation
        ↓
Return Period has no effect

Impact

The engineer can enter a return period and reasonably expect it to influence the hydrological design basis, but the current calculation does not use it.

Action

Determine how return period should control the adopted hydrological design basis and integrate it into the appropriate hydrological calculation.


# 46. Final DesignCalculationService Audit — Current Responsibility Map

The current service effectively combines:

```text
Input conversion
    ↓
Hydrology
    ↓
Hydraulic sizing
    ↓
Hydraulic capacity
    ↓
Velocity
    ↓
Headwater
    ↓
Structural earth load
    ↓
Live load
    ↓
Bedding
    ↓
Required crushing load
    ↓
Pipe catalogue selection
    ↓
Factor of Safety
    ↓
Hydraulic PASS/FAIL
    ↓
Structural PASS/FAIL
    ↓
Overall PASS/FAIL
    ↓
Calculation trace
    ↓
Database access
```

This confirms that the service is carrying several responsibilities that should eventually be separated.

---

# 47. Complete Current Fault Register

## Critical / High

| ID | Fault | Status |
|---|---|---|
| P1 | Hydraulic diameter can differ from structurally selected pipe diameter | Confirmed — Critical |
| P2 | Silent engineering defaults | Confirmed — High |
| P3 | Manning `n` hard-coded | Confirmed — High / basis verification |
| P4 | 75% capacity criterion hard-coded | Confirmed — High / basis verification |
| P5 | Full-bore/simplified hydraulic model | Confirmed — High |
| P6 | Simplified headwater model | Confirmed — High |
| P7 | Hard-coded trench width | Confirmed — High |
| P8 | Hard-coded structural `Kμ` | Confirmed — High / basis verification |
| P9 | Hard-coded bedding class/factor | Confirmed — High / basis verification |
| P10 | Bearing capacity input ignored | Confirmed — High |
| P11 | Soil type not meaningfully used | Confirmed — High |
| P12 | Design standard does not drive calculation | Confirmed — High |
| F-INPUT-01 | Roadway Width input is captured but not used by calculation | Confirmed — High |
| F-INPUT-02 | Skew Angle input is captured but not used by calculation | Confirmed — High |
| F-INPUT-03 | Return Period input is captured but not used by calculation | Confirmed — High |
| H1 | Hydrological method selection not honored | Confirmed — High |
| H2 | Hydrology inputs can be defaulted | Confirmed — High |
| HY1 | Stored design capacity can represent per-pipe capacity for multi-pipe designs | Confirmed — High |
| HY3 | Hard-coded diameter list separate from PipeCatalog | Confirmed — Architecture/Data |
| HW1 | No barrel friction/length in headwater | Confirmed — High |
| HW2 | No inlet/outlet control evaluation | Confirmed — High |
| HW3 | Hard-coded `Ke = 0.5` | Confirmed — High / basis verification |
| HW5 | Headwater does not participate in hydraulic PASS/FAIL | Confirmed — High |
| HW6 | Headwater result semantics overstate simplified calculation | Confirmed — Result semantics |
| S2 | Structural calculation does not know number of pipes | Confirmed — High |
| LL1 | Invalid load class silently falls back to normal table | Confirmed — High |
| LL2 | Live-load tables embedded in calculation service | Confirmed — Architecture/Data |
| B4 | Bedding selection is fixed to Class B / factor 1.9 rather than being controlled by engineering configuration | Confirmed — High / basis verification |
| FOS3 | FOS threshold hard-coded at 1.5 | Confirmed — High / basis verification |
| PS1 | Pipe selection can change diameter after hydraulic sizing | Confirmed — Critical |
| PS2 | Pipe selection directly coupled to EF database | Confirmed — Architecture |
| SR2 | Bearing capacity not part of structural verdict | Confirmed — High |
| SR3 | Structural result incomplete relative to accepted structural inputs | Confirmed — High |
| TR1 | Structural assumptions not controlled engineering configuration | Confirmed — High |
| TR2 | Calculation trace does not capture final structural selection and verdict | Confirmed — High |

---

## Needs Engineering Verification

| ID | Issue |
|---|---|
| H3 | Design discharge override rule |
| HY2 | Whether velocity acceptance should use full-flow or design-flow velocity |
| LL3 | Out-of-range live-load table behavior |
| B3 | Exact engineering basis for required crushing-load formula |
| PS4 | Completeness of pipe-selection specification |

---

## Not Classified as Faults

| Item | Reason |
|---|---|
| S7 | Fill height being passed as an input is consistent with the current input model |
| Hydraulic pipe-count retry itself | Selection strategy requires engineering/product verification |
| Live-load interpolation itself | Numerical interpolation is not automatically wrong; standard basis needs verification |
| FOS formula itself | Current formula is internally coherent; engineering basis still needs verification |

---

# 48. Calculation Traceability Audit

## TR2 — Calculation Trace Does Not Capture Final Structural Selection and Verdict

**Status:** CONFIRMED — HIGH

The current `DesignCalculationService` records a useful hydraulic and structural calculation trace through `CalcStep`.

The hydraulic trace records:

- Design discharge
- Number of pipes
- Selected hydraulic diameter
- Pipe area
- Hydraulic radius
- Manning's `n`
- Full-bore capacity
- Design capacity
- Full-flow velocity
- Design-flow velocity
- Headwater depth

The structural trace records:

- Fill height
- Trench width
- Load coefficient
- Earth load
- Live load
- Total load
- Bedding class
- Bedding factor
- Required crushing load

However, the final structural selection and verdict are calculated outside these trace lists.

The following important engineering operations are therefore not represented as explicit `CalcStep` records:

- Pipe catalogue selection
- Selected pipe diameter
- Selected pipe class
- Pipe crushing capacity
- Factor of Safety calculation
- Structural adequacy threshold/verdict
- Overall design satisfactory verdict

Therefore the current traceability chain is incomplete:

```text
Input
    ↓
Hydraulic calculation
    ↓
Structural load calculation
    ↓
Required crushing load
    ↓
[TRACE ENDS]
    ↓
Pipe catalogue selection
    ↓
Pipe crushing capacity
    ↓
Factor of Safety
    ↓
Structural PASS/FAIL
    ↓
Overall PASS/FAIL 

# 49. Result DTO Completeness Audit

## TR3 — Persisted Calculation Results Not Fully Exposed Through Revision Result DTO

**Status:** RESOLVED — DTO UPDATED

`CalculationResultDocument` stores several engineering values that are calculated and persisted but were not previously exposed through `CalculationResultDto`.

The affected fields are:

```text
CatchmentAreaHa
RainfallIntensityMmHr
RunoffCoefficient
DesignDischargeQ
QdesignM3s
SelectedPipeDiaMm


```md
# 50. Calculation Result Mapping Audit

## TR4 — Calculation Result Mapping Completeness

**Status:** VERIFIED

The complete result mapping has been checked across:

```text
RevisionEngineeringResultModel
        ↓
BuildCalculationResultDocument()
        ↓
CalculationResultDocument
        ↓
MapRevisionToDto()
        ↓
CalculationResultDto


## Needs engineering verification

| ID | Issue |
|---|---|
| H3 | Design discharge override rule |
| HY2 | Whether velocity acceptance should use full-flow or design-flow velocity |
| LL3 | Out-of-range live-load table behavior |
| B3 | Exact engineering basis for required crushing-load formula |
| PS4 | Completeness of pipe-selection specification |

## Not classified as faults

| Item | Reason |
|---|---|
| S7 | Fill height being passed as an input is consistent with the current input model |
| Hydraulic pipe-count retry itself | Selection strategy requires engineering/product verification |
| Live-load interpolation itself | Numerical interpolation is not automatically wrong; standard basis needs verification |
| FOS formula itself | Current formula is internally coherent; engineering basis still needs verification |

---

# 51. Audit Status

The major sections of `DesignCalculationService` have now been audited at a first-pass level:

```text
Hydrology        ✓
Hydraulic        ✓
Headwater        ✓
Structural Load  ✓
Live Load        ✓
Bedding          ✓
FOS              ✓
Pipe Selection   ✓
Result/Trace     ✓
```

The audit is now sufficiently detailed to begin the next architectural exercise:

**map each responsibility/fault to the target C# service boundary before changing code.**

No engineering correction or destructive refactoring has been performed.
