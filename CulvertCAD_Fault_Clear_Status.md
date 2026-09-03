# CulvertCAD — Fault Clear Status

> **Purpose:** This document contains **only faults from the original audit MD that have been cleared/rectified and verified**.
>
> The original audit MD remains the source of truth for the complete fault register. Any fault not listed here is **not considered cleared**.
>
> **Current source snapshot verified:** `CulvertCAD(5).zip`

---

## 1. P2 — Silent Engineering Defaults

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

An explicit engineering input validation boundary was introduced through `EngineeringInputValidationService`.

Required engineering inputs are validated before calculation, preventing missing inputs from silently entering the engineering calculation through defaults.

### Verification

Missing engineering input validation paths were tested and the project/test suite passed.

**Result: PASS**

### Cleared Conclusion

The original silent-default fault has been cleared at the calculation input boundary.

---

## 2. H2 — Hydrology Inputs Can Be Defaulted

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

Hydrology inputs are validated before `DesignCalculationService.CalculateAsync()` performs hydrology or hydraulic calculation.

Persistence fallbacks remaining in `BuildCalculationResultDocument()` are not used as engineering calculation inputs.

### Verification

Code-path tracing and validation tests confirmed that missing catchment area, rainfall intensity, and runoff coefficient are rejected before calculation.

**Result: PASS**

### Cleared Conclusion

The original H2 fault — silent defaulting of missing hydrology inputs during engineering calculation — is cleared.

---

## 3. H4 — Hydrology Calculation Embedded in the Design Orchestrator

**Original audit status:** CONFIRMED — ARCHITECTURAL

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

Hydrology calculation is separated behind:

```text
IHydrologyCalculationService
        ↓
HydrologyCalculationService
```

`DesignCalculationService` delegates hydrological discharge calculation to the dedicated service.

### Verification

Hydrology calculation tests passed.

**Result: PASS**

### Cleared Conclusion

The architectural separation of hydrology calculation from the design orchestrator has been completed.

> This clears the architectural H4 fault only. It does not mean all hydrological methods or hydrological engineering rules are complete.

---

## 4. H3 — Design Discharge Override Rule

**Original audit status:** CONFIRMED

**Current status:** **CLEARED — IMPLEMENTATION AND TRACEABILITY VERIFIED**

### Rectification

`DesignCalculationService` now treats `DesignDischargeOverrideQ` as authoritative when supplied.

The result also records the source through:

```text
DesignDischargeSource
```

with the calculation sheet exposing whether the discharge came from the engineer override or the selected hydrological method.

### Verification

The calculation path was traced from input through `DesignCalculationService` to the persisted/displayed result.

**Result: PASS**

### Cleared Conclusion

The override is authoritative and its source is traceable in the engineering result.

---

## 5. S2 — Structural Calculation Does Not Know Number of Pipes

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

`StructuralCalculationService` and `IStructuralCalculationService` now explicitly receive:

```text
H
Diameter
NumberOfPipes
LoadClass
SoilUnitWeight
```

### Verification

Structural calculation tests were updated and passed.

**Result: PASS**

### Cleared Conclusion

The structural calculation boundary now explicitly receives the pipe-count configuration.

---

## 6. SR1 — Structural Result and Hydraulic Result Can Represent Different Pipe Configurations

**Original audit status:** CONFIRMED — CRITICAL

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

Structural calculation now receives the same pipe-count configuration produced by hydraulic sizing.

This removes the specific structural/hydraulic configuration mismatch caused by the missing pipe-count input.

### Verification

Structural calculation tests passed.

**Result: PASS**

### Cleared Conclusion

The specific configuration mismatch caused by missing structural pipe-count input has been cleared.

---

## 7. PS2 — Pipe Selection Directly Coupled to Database Access

**Original audit status:** CONFIRMED — ARCHITECTURAL

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

Pipe selection is separated behind:

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

### Verification

Project build and tests passed after the separation.

**Result: PASS**

### Cleared Conclusion

The direct EF/database coupling of pipe-selection logic has been removed from the design calculation service.

---

## 8. P1 / PS1 — Hydraulic Diameter vs Selected Pipe Diameter

**Original audit status:** CONFIRMED — CRITICAL

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

A specific-diameter hydraulic calculation was introduced:

```text
CalculateHydraulicForDiameter(...)
```

The orchestration now recalculates hydraulic and structural results when structural pipe selection changes the diameter and performs a final convergence check.

If the final selected pipe does not converge with the hydraulic diameter, an explicit error is raised rather than returning inconsistent geometry.

### Verification

The diameter-change regression scenario was tested successfully.

**Result: PASS**

### Cleared Conclusion

The hydraulic and structural pipe-diameter configuration is now kept consistent through recalculation and final convergence checking.

---

## 9. HY1 — Multi-Pipe Hydraulic Capacity Semantics

**Original audit status:** CONFIRMED

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

Hydraulic results now explicitly distinguish per-pipe and total capacities:

```text
QfullM3s
QdesignM3s
QfullTotalM3s
QdesignTotalM3s
```

The calculation sheet labels the corresponding values explicitly.

### Verification

The hydraulic result model, orchestration, persistence mapping, and presentation paths were updated and the complete test suite passed.

**Result: PASS**

### Cleared Conclusion

Multi-pipe hydraulic capacity is now explicitly represented as both per-pipe and total barrel capacity.

---

## 10. HY3 — Hard-coded Diameter List vs PipeCatalog

**Original audit status:** CONFIRMED — ARCHITECTURAL / ENGINEERING-DATA ISSUE

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Original Fault

`HydraulicCalculationService` previously maintained its own hard-coded hydraulic diameter list.

### Rectification

Hydraulic diameter candidates are now obtained through:

```text
PipeCatalog
      ↓
IPipeCatalogRepository
      ↓
GetActiveDiametersAsync()
      ↓
HydraulicCalculationService
```

The repository returns active, distinct, ordered catalogue diameters.

### Verification

The complete project build and complete test suite were executed successfully.

**Result: PASS**

### Cleared Conclusion

The duplicated hard-coded hydraulic diameter source has been removed from the calculation service and replaced with active `PipeCatalog` data through `IPipeCatalogRepository`.

## 11. S4 — Soil Unit Weight Engineering Default

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

The engineering input validation boundary now requires `SoilUnitWeightKNm3` before the design calculation proceeds.

`DesignCalculationService` validates the engineering inputs before invoking the structural calculation and then explicitly passes the validated soil unit weight:

```csharp
double gamma = (double)input.SoilUnitWeightKNm3!.Value;

var str = _structuralCalculationService.CalculateStructural(
    H,
    hyd.DiameterMm,
    hyd.NPipes,
    input.LoadClass,
    gamma
);
```

Although `StructuralCalculationService` retains a method parameter default value of `18.5`, the normal design-calculation path cannot reach the structural calculation with a missing soil unit weight because the validation boundary rejects the missing input first.

### Verification

The engineering input validation path was traced and the project/test suite passed.

**Result: PASS**

### Cleared Conclusion

The original S4 silent soil-unit-weight default is cleared at the engineering input validation boundary.

## 12. TR2 — Calculation Trace Does Not Capture Final Engineering Decision

**Original audit status:** CONFIRMED — HIGH

**Current status:** **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED**

### Rectification

The existing calculation trace has been extended so that the final engineering decision is explicitly recorded.

The hydraulic trace now records the final hydraulic assessment:

```text
Hydraulic Result → PASS / FAIL
---

# Cleared Fault Summary

| Audit ID | Fault | Status |
| --- | --- | --- |
| **P2** | Silent engineering defaults | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **H2** | Hydrology inputs can be defaulted | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **H4** | Hydrology calculation embedded in design orchestrator | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **H3** | Design discharge override rule / traceability | **CLEARED — IMPLEMENTATION AND TRACEABILITY VERIFIED** |
| **S2** | Structural calculation does not know number of pipes | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **SR1** | Structural/hydraulic pipe configuration mismatch from missing pipe count | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **PS2** | Pipe selection directly coupled to database access | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **P1 / PS1** | Hydraulic diameter can differ from selected structural pipe diameter | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **HY1** | Multi-pipe hydraulic capacity semantics | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **HY3** | Hard-coded hydraulic diameter list separate from PipeCatalog | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **S4** | Soil unit weight engineering default | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |
| **TR2** | Calculation trace does not capture final engineering decision | **CLEARED — IMPLEMENTATION AND REGRESSION VERIFIED** |

---

## Rule for This Document

Only add a fault from the original audit MD here when its implementation and relevant verification have actually been completed.

All other audit faults remain in the original audit document and are **not cleared** until separately resolved and verified.

**Headwater findings HW1, HW2, HW3, HW5 and HW6 are therefore intentionally NOT listed here: they remain audit findings and have not been fixed.**
