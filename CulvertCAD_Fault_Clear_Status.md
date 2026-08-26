# CulvertCAD — Fault Clear Status

> **Purpose:** This document contains **only faults from the original audit MD that have been cleared/rectified and verified**.
>
> The original audit MD remains the source of truth for the complete fault register. Any fault not listed here is **not considered cleared**.

---

## 1. P2 — Silent Engineering Defaults

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED**

### Original Fault

Important engineering inputs could be replaced by internal defaults when values were missing.

Affected inputs included:

- Runoff coefficient
- Rainfall intensity
- Catchment area
- Slope
- Fill height
- Soil unit weight

The problematic flow was:

```text
Missing input
    ↓
Internal default
    ↓
Calculation continues
```

### Rectification

An explicit engineering input validation boundary was introduced through:

```text
EngineeringInputValidationService
```

The calculation flow now validates required engineering inputs before calculation.

```text
RevisionEngineeringInput
        ↓
Engineering Input Validation
        ↓
Valid ─────────→ Calculation
        │
        └────────→ Invalid → Validation error
```

Missing required inputs are no longer silently accepted through calculation defaults.

### Verification

Regression tests were added for missing engineering inputs.

**Result: PASS**

### Cleared Conclusion

The original silent-default fault has been cleared at the calculation input boundary.

---

## 2. H2 — Hydrology Inputs Can Be Defaulted

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED**

### Original Fault

Hydrology calculation could continue with default values when required hydrology inputs were missing.

### Rectification

Hydrology inputs are now subject to the engineering input validation boundary.

The calculation service no longer relies on silent defaults for the validated required inputs.

### Verification

Validation tests cover missing:

- Catchment area
- Rainfall intensity
- Runoff coefficient

**Result: PASS**

### Cleared Conclusion

The original H2 default-input fault has been cleared through explicit validation.

---

## 3. H4 — Hydrology Calculation Embedded in the Design Orchestrator

**Original audit status:** CONFIRMED — ARCHITECTURAL

**Current status:** **CLEARED**

### Original Fault

Hydrological calculation responsibility was embedded in the larger design calculation flow.

### Rectification

Hydrology was extracted into:

```text
IHydrologyCalculationService
HydrologyCalculationService
```

`DesignCalculationService` now delegates hydrological discharge calculation to the dedicated service.

Current responsibility:

```text
DesignCalculationService
        ↓
IHydrologyCalculationService
        ↓
HydrologyCalculationService
```

The Rational Method calculation is implemented as:

```text
Q = C × I × A / 360
```

### Verification

Hydrology calculation tests were added and passed.

**Result: PASS**

### Cleared Conclusion

The architectural separation of hydrology calculation from the design orchestrator has been completed.

> This clears the **architectural H4 fault only**. It does not mean all hydrological methods or hydrological engineering rules are complete.

---

## 4. S2 — Structural Calculation Does Not Know Number of Pipes

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED**

### Original Fault

Hydraulic calculation contained pipe-count information, but structural calculation did not receive the number of pipes.

This created an incomplete representation of the final barrel configuration.

### Rectification

`StructuralCalculationService` and `IStructuralCalculationService` were updated to accept:

```text
H
Diameter
NumberOfPipes
LoadClass
SoilUnitWeight
```

The calculation call now follows:

```text
StructuralCalculationService
        ↓
CalculateStructural(
    H,
    diaMm,
    numberOfPipes,
    loadClass,
    gammaSoil
)
```

### Verification

Structural calculation tests were updated to pass the number-of-pipes parameter.

Build and tests passed.

**Result: PASS**

### Cleared Conclusion

The structural calculation boundary now explicitly receives the pipe-count configuration.

---

## 5. SR1 — Structural Result and Hydraulic Result Can Represent Different Pipe Configurations

**Original audit status:** CONFIRMED — CRITICAL

**Current status:** **CLEARED**

### Original Fault

The hydraulic result contained diameter and number-of-pipes information, while the structural calculation did not explicitly receive the pipe count.

Example of the previous inconsistency:

```text
Hydraulic:
    Ø600
    2 pipes

Structural:
    Ø600
    no pipe-count input
```

### Rectification

The structural calculation contract was updated to receive:

```text
NumberOfPipes
```

This makes the structural calculation aware of the same pipe-count configuration supplied by hydraulic sizing.

### Verification

The structural calculation tests were updated and passed.

**Result: PASS**

### Cleared Conclusion

The specific structural/hydraulic configuration mismatch caused by the missing pipe-count input has been cleared.

---

## 6. PS2 — Pipe Selection Directly Coupled to Database Access

**Original audit status:** CONFIRMED — ARCHITECTURAL

**Current status:** **CLEARED**

### Original Fault

Pipe selection was coupled directly to EF Core database access through the calculation service.

Previous conceptual flow:

```text
DesignCalculationService
        ↓
AppDbContext
        ↓
PipeCatalog
```

### Rectification

Pipe selection was extracted behind an application service and repository boundary:

```text
DesignCalculationService
        ↓
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

`DesignCalculationService` no longer directly accesses `AppDbContext` for pipe selection.

Repository and repository interface are kept together under:

```text
CulvertCAD.Infrastructure.MySQL.Repositories
```

### Verification

The project was rebuilt after the repository/service separation and the tests passed.

**Result: PASS**

### Cleared Conclusion

The direct EF/database coupling of pipe-selection logic has been removed from the design calculation service.

---

## 7. P1 / PS1 — Hydraulic Diameter vs Selected Pipe Diameter

**Original audit status:** CONFIRMED — CRITICAL

**Current status:** **IMPLEMENTATION CLEARED — REGRESSION VERIFIED FOR DIAMETER-CHANGE CASE**

### Original Fault

Hydraulic sizing could produce:

```text
Hydraulic → Ø600
```

while structural pipe selection could move to:

```text
Selected pipe → Ø700
```

without recalculating hydraulic results.

This could produce contradictory engineering geometry.

### Rectification

A specific-diameter hydraulic calculation was introduced:

```text
CalculateHydraulicForDiameter(...)
```

The design orchestration now performs:

```text
Hydraulic sizing
      ↓
Structural calculation
      ↓
Pipe selection
      ↓
Diameter changed?
      ↓ YES
Hydraulic recalculation using selected diameter
      ↓
Structural recalculation using selected diameter
      ↓
Final pipe-selection consistency check
```

If the final pipe selection does not converge to the hydraulic diameter, the calculation raises an explicit non-convergence error instead of silently returning inconsistent results.

### Verification

A regression test was added for the diameter-change scenario:

```text
Initial hydraulic diameter
        ↓
Initial pipe structurally inadequate
        ↓
Larger pipe selected
        ↓
Hydraulic recalculated for larger diameter
        ↓
Final hydraulic diameter = selected pipe diameter
```

**Result: PASS**

### Cleared Conclusion

The original P1/PS1 diameter-consistency behavior has been rectified and the normal diameter-change scenario is regression-tested.

The non-convergence safeguard must remain considered verified only after the complete test run containing that test is confirmed successful.

---

# Cleared Fault Summary

| Audit ID | Fault | Status |
|---|---|---|
| **P2** | Silent engineering defaults | **CLEARED** |
| **H2** | Hydrology inputs can be defaulted | **CLEARED** |
| **H4** | Hydrology calculation embedded in design orchestrator | **CLEARED** |
| **S2** | Structural calculation does not know number of pipes | **CLEARED** |
| **SR1** | Structural/hydraulic pipe configuration mismatch from missing pipe count | **CLEARED** |
| **PS2** | Pipe selection directly coupled to database access | **CLEARED** |
| **P1 / PS1** | Hydraulic diameter can differ from selected structural pipe diameter | **IMPLEMENTATION CLEARED; NORMAL REGRESSION VERIFIED** |

---

## Rule for This Document

Only add a fault from the original audit MD here when its implementation and relevant verification have actually been completed.

All other audit faults remain in the original audit document and are **not cleared** until separately resolved and verified.
