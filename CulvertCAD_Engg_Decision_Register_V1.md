# CulvertCAD — Engineering Decision Register

**Document status:** Engineering-basis phase master register  
**Date:** 07-09-2026  
**Purpose:** Convert the remaining open audit findings into explicit engineering decisions before any further engineering calculation code is changed.

> This register is derived from the reconciled Fault Audit and current architecture status. It is a decision/planning document, not an engineering standard and not an approval of any calculation method.

---

# 1. Governing Rule

No engineering calculation change should be made merely because the current implementation is considered incomplete.

For every open item:

```text
Current software behavior
        ↓
Engineering question
        ↓
Applicable standard / approved methodology
        ↓
Engineering decision
        ↓
Required inputs
        ↓
Formula / calculation procedure
        ↓
Acceptance criterion
        ↓
Software change
        ↓
Test / benchmark
        ↓
Audit status update
```

Until the engineering decision is established:

**DO NOT CHANGE THE CALCULATION CODE.**

---

# 2. Decision Status Definitions

| Status | Meaning |
| --- | --- |
| **OPEN — ENGINEERING DECISION** | The current software behavior is known, but the required engineering rule has not yet been established. |
| **OPEN — STANDARD / BASIS VERIFICATION** | A current value or criterion exists, but its authoritative basis must be verified. |
| **OPEN — METHODOLOGY** | The correct calculation approach has not yet been selected. |
| **OPEN — INPUT DEFINITION** | The required engineering inputs and their meaning must first be established. |
| **READY FOR IMPLEMENTATION** | Engineering decision is established and implementation requirements can be specified. |
| **IMPLEMENTED — VERIFY** | Code has been changed and requires regression/engineering verification. |
| **CLEARED** | Implementation and relevant verification are complete. |

---

# 3. Priority Engineering Decision Order

The recommended order is:

```text
1. Design-standard framework
        ↓
2. Hydrology / design discharge
        ↓
3. Hydraulic capacity and velocity
        ↓
4. Headwater / inlet / outlet control
        ↓
5. Structural loading
        ↓
6. Bedding / pipe capacity / FOS
        ↓
7. Soil / bearing / geotechnical
        ↓
8. Skew / roadway / geometry inputs
        ↓
9. Pipe-selection completeness
        ↓
10. Final PASS/FAIL scope
```

This order prevents later engineering decisions from being built on an unapproved upstream methodology.

---

# 4. Master Engineering Decision Register

| ID | Audit finding | Current behavior | Engineering decision required | Required evidence/source | Current status |
| --- | --- | --- | --- | --- | --- |
| P12 | Design standard does not drive calculation | `DesignStandard` is captured but does not determine the calculation methodology | Which design standard(s) govern circular pipe culvert hydrology, hydraulics, structural design, loading, and acceptance? | Approved project/design standard and applicable clauses | **OPEN — METHODOLOGY** |
| F-INPUT-03 | Return period not used by hydrology | Captured but not used to determine Q | How is return period converted into design rainfall/design discharge for the adopted hydrology method? | Approved hydrology method + standard/data source | **OPEN — METHODOLOGY** |
| P3 | Manning roughness | Configured `ManningN`, currently 0.013 | What Manning roughness value/basis applies to the pipe and flow condition? | Applicable standard/manufacturer/design basis | **OPEN — STANDARD / BASIS VERIFICATION** |
| P4 | 75% design-capacity criterion | Configured `DesignCapacityFactor`, currently 0.75 | Is 75% of full-bore capacity the approved design acceptance criterion? | Applicable hydraulic design standard | **OPEN — STANDARD / BASIS VERIFICATION** |
| HY2 | Velocity acceptance | Current adequacy uses `vFull` between 0.6 and 3.5 m/s | Which velocity is governing and what are the approved limits? | Applicable hydraulic standard | **OPEN — ENGINEERING DECISION** |
| P5 | Full-bore hydraulic model | Manning full-bore capacity model | Is full-bore capacity sufficient, or is partial-flow/control-based analysis required? | Approved culvert hydraulic methodology | **OPEN — METHODOLOGY** |
| HW1 | No barrel friction/length in headwater | Headwater does not include barrel friction | How should barrel friction/head loss be calculated? | Approved culvert hydraulic methodology | **OPEN — METHODOLOGY** |
| HW2 | No inlet/outlet control | No control-regime evaluation | How are inlet control, outlet control, and governing control determined? | Approved culvert hydraulic methodology | **OPEN — METHODOLOGY** |
| HW3 | Entrance loss coefficient | Simplified `Ke = 0.5` | How is entrance-loss coefficient selected from inlet geometry/configuration? | Applicable standard/inlet geometry tables | **OPEN — STANDARD / BASIS VERIFICATION** |
| HW5 | Headwater excluded from PASS/FAIL | Headwater is calculated but not a hydraulic acceptance criterion | What allowable headwater / upstream water level governs design acceptance? | Approved hydraulic/roadway criteria | **OPEN — ENGINEERING DECISION** |
| HW6 | Headwater semantics | Simplified result exposed as headwater depth | What exactly does the reported headwater represent and how should it be labelled? | Adopted hydraulic methodology | **OPEN — INPUT/RESULT DEFINITION** |
| P7 / S1 | Trench width | `Bd = D + TrenchWidthClearanceM`; current clearance 0.6 m | How should trench width be determined for one or multiple pipes? | Structural installation/loading methodology | **OPEN — ENGINEERING DECISION** |
| P8 / S5 | Structural Kμ | Configured `StructuralKmu`, currently 0.150 | What coefficient and structural load model are required? | Applicable structural pipe design standard | **OPEN — STANDARD / BASIS VERIFICATION** |
| LL1 | Invalid load class | Unsupported enum value can fall through to normal table | What load classes are valid and how must invalid values be rejected? | Approved load-class list / standard | **OPEN — INPUT DEFINITION** |
| LL2 | Live-load tables | Tables remain embedded in `LiveLoadService` | What is the authoritative source, scope, units, interpolation and configuration mechanism for live-load data? | Applicable loading standard | **OPEN — ENGINEERING-DATA BASIS** |
| LL3 | Fill-depth table limits | Out-of-range fill depth is clamped to an endpoint | Is extrapolation, clamping, or rejection required outside the approved table range? | Applicable loading standard | **OPEN — STANDARD / BASIS VERIFICATION** |
| P9 / B4 | Bedding | `BeddingClass = ClassB`, `BeddingFactor = 1.9`; accessed through `BeddingService` | Which bedding classes are supported and how is bedding factor selected from actual installation conditions? | Applicable structural/bedding standard | **OPEN — ENGINEERING DECISION** |
| B3 | Required crushing load | `RequiredCrush = TotalLoad / BeddingFactor` | Is this the approved bedding/crushing relationship and design equation? | Applicable structural pipe standard | **OPEN — STANDARD / BASIS VERIFICATION** |
| P10 / SR2 | Bearing capacity ignored | Input exists but does not affect structural verdict | Is a bearing/foundation check required, and what calculation governs it? | Geotechnical/structural design basis | **OPEN — ENGINEERING DECISION** |
| P11 / S3 | Soil type | Soil type captured but does not independently drive calculation | Which soil properties are required and how do they affect earth load/structural design? | Approved geotechnical methodology | **OPEN — ENGINEERING DECISION** |
| FOS1 | FOS / pipe crushing basis | Uses catalogue ultimate crushing load and bedding factor | What pipe capacity and design/FOS methodology is authoritative? | Applicable pipe structural standard/catalogue basis | **OPEN — STANDARD / BASIS VERIFICATION** |
| FOS2 | Bedding affects FOS | Bedding factor directly affects FOS | Is this treatment of bedding factor in FOS correct under the adopted standard? | Applicable structural standard | **OPEN — STANDARD / BASIS VERIFICATION** |
| FOS3 | Minimum FOS | Configured threshold currently 1.5 | What minimum FOS is required and under what design condition? | Applicable structural standard | **OPEN — STANDARD / BASIS VERIFICATION** |
| FOS4 | Overall verdict scope | Overall result combines hydraulic and structural pass | Which checks must be satisfied before the application may report overall PASS? | Approved project acceptance criteria | **OPEN — ENGINEERING DECISION** |
| SR3 | Structural result scope | Current structural result covers earth/live/total load, bedding, crushing and FOS | What constitutes a complete structural design result for the supported culvert scope? | Structural design methodology | **OPEN — ENGINEERING SCOPE** |
| PS4 | Pipe-selection completeness | Selection primarily uses diameter and required crushing load | What complete pipe specification/classification must drive final selection? | Pipe standard/catalogue/project requirements | **OPEN — ENGINEERING DECISION** |
| F-INPUT-01 | Roadway width | Captured/persisted and used outside core calculation | Does roadway width affect hydraulic, headwater, structural or freeboard acceptance? | Approved roadway/culvert design methodology | **OPEN — ENGINEERING DETERMINATION** |
| F-INPUT-02 | Skew angle | Captured/persisted but not used by core calculation | How should skew alter hydraulic length/geometry, inlet/outlet treatment, and/or structural design? | Approved skew/culvert methodology | **OPEN — METHODOLOGY** |
| TR1 | Engineering assumptions/configuration | Several values are now centralized in `EngineeringCalculationSettings` | How should engineering coefficients/configuration be controlled, versioned, sourced and traced to standards/clauses? | Engineering governance requirement | **OPEN — TRACEABILITY / GOVERNANCE** |

---

# 5. Group A — Design Standard

## P12 — Design Standard

### Current behavior

`DesignStandard` is captured but does not currently drive the calculation methodology.

### Decision required

Define:

1. Which design standard governs the project.
2. Which clauses govern hydrology.
3. Which clauses govern hydraulic sizing.
4. Which clauses govern headwater/freeboard.
5. Which clauses govern structural loading.
6. Which clauses govern pipe capacity/FOS.
7. Which clauses govern live loading.
8. Which clauses govern bedding.
9. Which clauses govern acceptance.

### Required decision output

```text
Design Standard
    ↓
Engineering domain
    ↓
Applicable clause
    ↓
Calculation method
    ↓
Input requirements
    ↓
Acceptance criterion
```

**Status:** OPEN — METHODOLOGY

---

# 6. Group B — Hydrology

## F-INPUT-03 — Return Period

### Current behavior

`ReturnPeriodYrs` is captured, persisted and mapped, but current hydrology does not use it to determine design discharge.

### Decision required

Determine:

```text
Return Period
      ↓
Rainfall intensity / flood frequency
      ↓
Runoff method
      ↓
Design Q
```

For Rational Method specifically, establish the approved relationship between return period and rainfall intensity.

**No code change until this relationship is approved.**

**Status:** OPEN — METHODOLOGY

---

# 7. Group C — Hydraulic Capacity

## P3 — Manning n

Determine:

- applicable roughness value,
- pipe material/type dependency,
- full-flow vs partial-flow treatment,
- whether value is fixed or catalogue/configuration driven,
- source/standard clause.

**Current configured value:** 0.013.

**Status:** OPEN — BASIS VERIFICATION

---

## P4 — Design Capacity Factor

Determine whether:

```text
Qdesign = 0.75 × Qfull
```

is actually the required engineering acceptance rule.

If not, determine the correct criterion.

**Current configured value:** 0.75.

**Status:** OPEN — BASIS VERIFICATION

---

## HY2 — Velocity

Current adequacy checks:

```text
0.6 ≤ vFull ≤ 3.5 m/s
```

The service separately calculates `vDesign`, but does not use it for adequacy.

### Decision required

Determine:

- governing velocity definition,
- minimum criterion,
- maximum criterion,
- whether limits depend on material, sediment, erosion, or flow condition,
- whether the criterion applies per pipe or total system.

**Status:** OPEN — ENGINEERING DECISION

---

# 8. Group D — Hydraulic Model

## P5 — Full-Bore Model

Determine whether the supported circular culvert design must include:

- full-bore flow,
- partial flow,
- normal depth,
- critical depth,
- energy equation,
- inlet control,
- outlet control,
- tailwater.

**Status:** OPEN — METHODOLOGY

---

# 9. Group E — Headwater

## HW1

Determine barrel head-loss components, including as applicable:

```text
Entrance loss
+
Friction loss
+
Exit loss
+
Other applicable losses
```

and required inputs such as:

- barrel length,
- slope,
- roughness,
- diameter,
- discharge,
- geometry.

**Status:** OPEN — METHODOLOGY

---

## HW2

Determine how the software identifies:

```text
Inlet control
        vs
Outlet control
        ↓
Governing headwater
```

Tailwater treatment must also be defined.

**Status:** OPEN — METHODOLOGY

---

## HW3

Determine the entrance-loss coefficient from the actual inlet configuration rather than assuming one universal coefficient.

**Status:** OPEN — BASIS VERIFICATION

---

## HW5

Determine the governing headwater acceptance criterion.

Potential decision structure:

```text
Calculated headwater
        ↓
Compare with allowable upstream water level / design criterion
        ↓
PASS / FAIL
```

The exact criterion must come from the approved design basis.

**Status:** OPEN — ENGINEERING DECISION

---

## HW6

Define precisely what the current/future result represents:

- headwater depth above invert,
- upstream water depth,
- headwater elevation,
- energy grade,
- or another defined hydraulic quantity.

**Status:** OPEN — RESULT DEFINITION

---

# 10. Group F — Structural Loading

## P7 / S1 — Trench Width

Determine how trench width is derived for:

- single pipe,
- multiple pipes,
- pipe spacing,
- installation conditions,
- construction requirements.

The current:

```text
Bd = D + configured clearance
```

should not be changed until the engineering basis is known.

**Status:** OPEN — ENGINEERING DECISION

---

## P8 / S5 — Kμ

Determine:

- applicable structural load model,
- coefficient definition,
- units,
- dependency on soil/install condition,
- applicable standard clause.

**Current configured value:** 0.150.

**Status:** OPEN — BASIS VERIFICATION

---

# 11. Group G — Live Load

## LL1

Define the complete valid `LoadClass` set and validation behavior.

Invalid values must not silently select a different engineering table.

**Status:** OPEN — INPUT DEFINITION

---

## LL2

Determine the authoritative live-load source and whether tables should be:

- configuration,
- engineering master data,
- standard-specific data,
- or another controlled source.

Also define:

- units,
- interpolation method,
- valid fill-depth range.

**Status:** OPEN — ENGINEERING-DATA BASIS

---

## LL3

Determine correct behavior when fill height lies outside the approved table range:

```text
Reject
OR
Interpolate
OR
Extrapolate
OR
Use approved limiting value
```

**Status:** OPEN — BASIS VERIFICATION

---

# 12. Group H — Bedding / Crushing

## P9 / B4

Determine:

- supported bedding classes,
- bedding-factor source,
- whether selection is an engineering input,
- whether Class B is an automatic default,
- relationship between actual installation and factor.

Current architecture has `BeddingService`, but engineering selection remains unresolved.

**Status:** OPEN — ENGINEERING DECISION

---

## B3

Verify the governing equation:

```text
Required crushing load =
Total field load / Bedding factor
```

against the adopted structural design standard.

**Status:** OPEN — BASIS VERIFICATION

---

# 13. Group I — Geotechnical / Structural

## P10 / SR2 — Bearing Capacity

Determine:

- whether bearing capacity must be checked,
- required bearing area,
- allowable/ultimate bearing treatment,
- factor of safety,
- foundation/bedding interaction,
- PASS/FAIL criterion.

**Status:** OPEN — ENGINEERING DECISION

---

## P11 / S3 — Soil Type

Define controlled soil properties required by the structural methodology.

Potential properties must not be assumed until the engineering basis identifies them.

**Status:** OPEN — ENGINEERING DECISION

---

# 14. Group J — Factor of Safety

## FOS1

Verify:

- pipe ultimate crushing capacity,
- catalogue capacity basis,
- bedding treatment,
- load combination,
- design vs ultimate values.

**Status:** OPEN — BASIS VERIFICATION

---

## FOS2

Verify whether bedding factor is correctly applied in the FOS calculation.

**Status:** OPEN — BASIS VERIFICATION

---

## FOS3

Verify the minimum FOS requirement.

Current configuration:

```text
StructuralFosMinimum = 1.5
```

**Status:** OPEN — BASIS VERIFICATION

---

## FOS4

Define exactly which checks are required before the system may report:

```text
OVERALL PASS
```

The final verdict must not imply checks that the engineering model does not actually perform.

**Status:** OPEN — ENGINEERING DECISION

---

# 15. Group K — Engineering Inputs

## F-INPUT-01 — Roadway Width

Determine whether roadway width affects:

- hydraulic acceptance,
- headwater,
- freeboard,
- overtopping,
- road geometry,
- structural loading,
- or only drawings/BOQ.

**Status:** OPEN — ENGINEERING DETERMINATION

---

## F-INPUT-02 — Skew Angle

Determine whether skew affects:

- hydraulic barrel length,
- effective geometry,
- inlet/outlet configuration,
- headwater,
- structural loading,
- pipe arrangement,
- or drawing geometry only.

**Status:** OPEN — METHODOLOGY

---

# 16. Group L — Pipe Selection

## PS4

Define the complete engineering selection specification.

At minimum, determine whether final selection must consider:

```text
Diameter
+
Pipe standard
+
Pipe class
+
Material
+
Structural capacity
+
Hydraulic suitability
+
Installation condition
+
Design standard
```

The exact list must be approved rather than assumed.

**Status:** OPEN — ENGINEERING DECISION

---

# 17. Group M — Structural Result Scope

## SR3

Define the minimum information that a structural result must expose.

Current result includes:

```text
Earth Load
Live Load
Total Load
Bedding
Required Crushing Load
Pipe Crushing Capacity
FOS
```

Determine whether it must additionally expose:

- bearing check,
- soil properties,
- load combinations,
- structural utilization,
- governing condition,
- standard/clause references.

**Status:** OPEN — ENGINEERING SCOPE

---

# 18. Group N — Traceability / Engineering Governance

## TR1

Current configuration centralizes several engineering assumptions.

That is an architectural improvement, but the engineering governance decision remains:

```text
Engineering value
    ↓
Source
    ↓
Standard
    ↓
Clause
    ↓
Effective date/version
    ↓
Configuration/master data
    ↓
Calculation trace
```

Determine how this information will be maintained and exposed to the engineer.

**Status:** OPEN — TRACEABILITY / GOVERNANCE

---

# 19. What We Must Produce for Each Decision

Before a decision is marked **READY FOR IMPLEMENTATION**, the engineering record should contain:

### A. Requirement

What the design must satisfy.

### B. Source

Standard/document/methodology and applicable clause where available.

### C. Formula

Exact equation or calculation procedure.

### D. Inputs

Every required input and unit.

### E. Assumptions

Any controlled assumptions.

### F. Acceptance

Exact PASS/FAIL criterion.

### G. Example

At least one hand-calculated or independently verified example.

### H. Software impact

Which:

- Model
- DTO
- Service
- Repository/configuration
- Controller
- View
- Report
- Trace
- Test

must change.

---

# 20. First Decision Package — Hydraulics

The first engineering decision package should answer these questions together:

```text
1. What design standard governs?

2. How is design Q established?

3. Is Rational Method applicable?

4. How does ReturnPeriodYrs affect Q?

5. What Manning n applies?

6. Is full-bore Manning sufficient?

7. What capacity criterion applies?

8. What velocity criterion applies?

9. How is partial flow treated?

10. How is headwater calculated?

11. How is inlet/outlet control determined?

12. How is tailwater treated?

13. What headwater is acceptable?

14. What hydraulic condition produces PASS?
```

Only after these are answered should the hydraulic calculation model be changed.

---

# 21. Current Engineering Phase Gate

The project is currently at:

```text
                 COMPLETE
Audit ────────────────────────────✓
Clear Status ─────────────────────✓
Architecture boundary work ───────✓
Tests/build baseline ─────────────✓

                 CURRENT
Engineering Decision Register ─────●

                 NOT STARTED
Engineering-approved methodology
Engineering calculation changes
Engineering regression verification
Final engineering approval
```

---

# 22. Immediate Next Step

**Do not modify C# yet.**

Start with the **First Decision Package — Hydraulics**.

The first concrete task is:

> **Establish the governing design standard and approved hydraulic methodology for circular pipe culverts, then resolve P12, F-INPUT-03, P3, P4, HY2 and P5 together before touching the hydraulic calculation code.**

Once that decision package is complete, the resulting engineering specification can be converted directly into a controlled Codex implementation prompt.
