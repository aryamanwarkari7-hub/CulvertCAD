# CulvertCAD — Architecture Responsibility & Service Boundary Map

## Purpose

This document defines the target architectural responsibility boundaries for the engineering calculation system identified during the `AUDIT.md` review.

This is an architecture-planning document.

No calculation logic, engineering formula, database schema, or existing service has been changed as part of this document.

The purpose is to establish:

```text
Current Responsibility
        ↓
Audit Finding
        ↓
Engineering Responsibility
        ↓
Target Service Boundary
        ↓
Required Inputs
        ↓
Required Outputs
        ↓
Engineering Configuration / Data Dependency
```

The architecture must be agreed before implementation begins.

---

# 1. Current Architecture — DesignCalculationService

The current `DesignCalculationService` combines multiple engineering and technical responsibilities.

Current conceptual flow:

```text
RevisionEngineeringInput
        ↓
Input conversion / defaults
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
        ↓
RevisionEngineeringResultModel
```

The current service therefore combines:

- Engineering calculations
- Engineering assumptions
- Engineering master data
- Validation/default handling
- Pipe selection
- Database access
- Result construction
- Calculation trace generation
- Final engineering verdict

This is the primary architectural reason for the service-boundary exercise.

---

# 2. Target Architecture — High Level

The target architecture should separate orchestration from individual engineering responsibilities.

Conceptual target:

```text
                         RevisionEngineeringInput
                                  │
                                  ▼
                     DesignCalculationService
                            ORCHESTRATOR
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                       │                        │
          ▼                       ▼                        ▼
HydrologyCalculation     HydraulicCalculation       StructuralCalculation
      Service                  Service                    Service
          │                       │                        │
          │                       ▼                        ├── Live Load
          │                HeadwaterCalculation             │
          │                     Service                     ├── Bedding
          │                                                │
          │                                                └── Pipe Selection
          │
          ▼
Engineering Configuration / Master Data
```

Supporting responsibilities:

```text
Engineering Configuration
        │
        ├── Hydrological methods
        ├── Manning roughness
        ├── Hydraulic acceptance criteria
        ├── Structural coefficients
        ├── Bedding classes/factors
        ├── Live-load tables
        ├── FOS requirements
        └── Other controlled engineering assumptions

Engineering Master Data
        │
        ├── Pipe catalogue
        ├── Pipe sizes
        ├── Pipe classes
        ├── Material/specification
        └── Other selectable engineering data
```

Persistence remains outside engineering calculation logic:

```text
Calculation Service
        ↓
Repository / Data Access Boundary
        ↓
EF Core / Database
```

---

# 3. Core Orchestrator

## 3.1 DesignCalculationService

### Responsibility

`DesignCalculationService` should become the **orchestrator**, not the owner of every engineering formula.

Its responsibility should be to:

1. Receive validated engineering input.
2. Coordinate the required calculation services.
3. Pass outputs from one engineering stage to the next.
4. Combine the engineering results.
5. Build the final `RevisionEngineeringResultModel`.
6. Coordinate the calculation trace.
7. Produce the overall design result.

It should not directly own:

- Hydrological formulas
- Hydraulic formulas
- Headwater formulas
- Structural load formulas
- Live-load tables
- Bedding configuration
- Pipe catalogue database queries
- Hard-coded engineering coefficients

### Target flow

```text
RevisionEngineeringInput
        ↓
DesignCalculationService
        │
        ├── HydrologyCalculationService
        │
        ├── HydraulicCalculationService
        │
        ├── HeadwaterCalculationService
        │
        └── StructuralCalculationService
                │
                ├── LiveLoadService
                ├── BeddingService
                └── PipeSelectionService
        │
        ▼
RevisionEngineeringResultModel
```

---

# 4. Hydrology Responsibility

## 4.1 HydrologyCalculationService

### Responsibility

Own hydrological discharge calculation.

It should determine design discharge according to the selected hydrological method.

Supported methods identified during the audit include:

```text
Rational
Dicken
Ryve
Inglis
```

The actual engineering formulas and applicable standards must be established during engineering-basis verification.

### Inputs

Potential inputs include:

```text
CatchmentAreaHa
RainfallIntensityMmHr
RunoffCoefficient
ReturnPeriodYrs
HydrologicalMethod
DesignDischargeOverrideQ
```

### Outputs

At minimum:

```text
DesignDischargeQ
Hydrological method actually used
Hydrological calculation trace
```

### Important rules

The service must not silently substitute engineering defaults for missing mandatory inputs.

The override behavior identified as `H3` must be explicitly defined before implementation.

Target:

```text
Missing/invalid input
        ↓
Validation
        ↓
Calculation prevented
```

Not:

```text
Missing input
        ↓
Silent default
        ↓
Calculation continues
```

### Audit mapping

| Fault | Responsibility |
|---|---|
| P2 | Input validation/default policy |
| H1 | HydrologyCalculationService |
| H2 | Input validation |
| H3 | HydrologyCalculationService / engineering rule |
| H4 | HydrologyCalculationService |

---

# 5. Hydraulic Calculation Responsibility

## 5.1 HydraulicCalculationService

### Responsibility

Own hydraulic sizing and hydraulic performance calculations.

This includes:

- Diameter trial
- Number-of-pipe trial
- Pipe area
- Hydraulic radius
- Manning calculation
- Full-bore capacity
- Design-flow capacity
- Full-flow velocity
- Design-flow velocity
- Hydraulic adequacy

### Inputs

Potential inputs:

```text
DesignDischargeQ
Pipe diameter candidates
Number-of-pipe candidates
Manning n
Hydraulic acceptance criteria
```

### Outputs

At minimum:

```text
SelectedDiameterMm
NumberOfPipes
QfullM3s
QdesignM3s
VelocityFullFlowMs
VelocityDesignMs
HydraulicAdequate
Hydraulic calculation trace
```

### Important architectural rule

Hydraulic diameter and final selected structural pipe diameter must not become two independent engineering geometries.

The target architecture must establish one authoritative final design configuration.

The `P1 / PS1` issue must therefore be resolved as part of the design flow.

### Audit mapping

| Fault | Responsibility |
|---|---|
| P1 | Hydraulic/Structural orchestration |
| P3 | Engineering configuration |
| P4 | Engineering configuration |
| P5 | HydraulicCalculationService |
| HY1 | HydraulicCalculationService |
| HY2 | Engineering verification + HydraulicCalculationService |
| HY3 | Pipe master data / HydraulicCalculationService |

---

# 6. Headwater Responsibility

## 6.1 HeadwaterCalculationService

### Responsibility

Own culvert headwater/control analysis.

The current simplified headwater calculation must not automatically become the final target implementation.

The target responsibility must eventually support the engineering basis established during verification.

Potential responsibilities include:

- Inlet control
- Outlet control
- Tailwater
- Barrel friction
- Entrance losses
- Exit losses
- Energy relationships
- Governing control condition
- Headwater result
- Freeboard/overtopping checks where applicable

### Inputs

Potential inputs:

```text
DesignDischargeQ
Pipe diameter
Number of pipes
Barrel length
Pipe/barrel slope
Roughness
Entrance configuration
Exit configuration
Tailwater
Road geometry
```

### Outputs

Potential outputs:

```text
HeadwaterDepthM
GoverningControl
HeadwaterAdequate
Headwater calculation trace
```

### Audit mapping

| Fault | Responsibility |
|---|---|
| P6 | HeadwaterCalculationService |
| HW1 | HeadwaterCalculationService |
| HW2 | HeadwaterCalculationService |
| HW3 | Engineering configuration |
| HW5 | Hydraulic orchestration |
| HW6 | Result semantics |

---

# 7. Structural Calculation Responsibility

## 7.1 StructuralCalculationService

### Responsibility

Own structural load and pipe structural adequacy calculations.

Potential responsibilities:

- Earth load
- Live load integration
- Total field load
- Required crushing load
- Pipe structural adequacy
- Factor of Safety
- Structural PASS/FAIL

### Inputs

Potential inputs:

```text
FillHeightM
Pipe diameter
NumberOfPipes
Pipe spacing/configuration
Soil properties
Soil unit weight
Load class
Bedding configuration
Pipe specification
Structural coefficients
```

### Outputs

At minimum:

```text
EarthLoadWeKNm
LiveLoadWlKNm
TotalLoadWtKNm
BeddingClass
BeddingFactor
RequiredCrushKNm
SelectedPipeClass
SelectedPipeDiaMm
PipeCrushCapKNm
FactorOfSafety
StructuralAdequate
Structural calculation trace
```

### Audit mapping

| Fault | Responsibility |
|---|---|
| P7 | StructuralCalculationService + engineering configuration |
| P8 | Engineering configuration |
| P9 | Bedding responsibility/configuration |
| P10 | StructuralCalculationService / geotechnical calculation |
| P11 | Soil property configuration |
| S2 | StructuralCalculationService |
| S3 | Soil property configuration |
| S4 | Input validation |
| S5 | Engineering configuration |
| S6 | StructuralCalculationService |
| SR1 | StructuralCalculationService |
| SR2 | StructuralCalculationService |
| SR3 | StructuralCalculationService |
| FOS3 | Engineering configuration |

---

# 8. Live Load Responsibility

## 8.1 LiveLoadService

### Responsibility

Own live-load engineering data and calculation.

It should not contain live-load tables directly inside the main orchestration/calculation service.

Responsibilities include:

- Load-class validation
- Selection of applicable load table
- Fill-depth handling
- Interpolation
- Out-of-range handling
- Live-load calculation
- Live-load calculation trace

### Inputs

```text
FillHeightM
LoadClass
Applicable live-load configuration
```

### Outputs

```text
LiveLoadWlKNm
Selected load class
Interpolation information
Calculation trace
```

### Audit mapping

| Fault | Responsibility |
|---|---|
| LL1 | LiveLoadService + validation |
| LL2 | Engineering master/configuration |
| LL3 | Engineering verification |

---

# 9. Bedding Responsibility

## 9.1 BeddingService

### Responsibility

Own bedding-class selection and bedding-factor determination.

The current implementation records:

```text
Bedding Class = Class B
Bedding Factor = 1.9
Clause = IS 783 Cl.6
```

The issue is not absence of trace.

The issue is that the current selection is hard-coded.

### Inputs

Potential inputs:

```text
Installation condition
Bedding class
Pipe configuration
Applicable standard
Engineering configuration
```

### Outputs

```text
BeddingClass
BeddingFactor
Bedding selection trace
```

### Current engineering basis

Current implementation:

```text
Class B
Bf = 1.9
IS 783 Cl.6
```

This remains subject to engineering verification.

### Audit mapping

| Fault | Responsibility |
|---|---|
| P9 | BeddingService / engineering configuration |
| B3 | Structural calculation basis verification |
| B4 | BeddingService / engineering configuration |
| TR1 | Engineering configuration |

---

# 10. Pipe Selection Responsibility

## 10.1 PipeSelectionService

### Responsibility

Own selection of the actual pipe from engineering master data.

Selection should eventually consider the complete engineering specification established during verification.

Potential criteria:

```text
Diameter
Pipe class
Wall thickness
Ultimate crushing capacity
Material
Pipe standard
Design standard
Availability/product constraints
```

### Inputs

```text
RequiredCrushKNm
Hydraulic diameter/configuration
Pipe specification requirements
Pipe catalogue
```

### Outputs

```text
SelectedPipe
SelectedPipeClass
SelectedPipeDiaMm
PipeCrushCapKNm
Selection trace
```

### Persistence boundary

The service should not directly depend on EF Core `ApplicationDbContext`.

Target:

```text
PipeSelectionService
        ↓
IPipeCatalogRepository
        ↓
PipeCatalogRepository
        ↓
ApplicationDbContext
        ↓
Database
```

### Audit mapping

| Fault | Responsibility |
|---|---|
| PS1 | Design orchestration / PipeSelectionService |
| PS2 | Repository boundary |
| PS3 | Pipe master data |
| PS4 | Engineering verification |
| HY3 | Pipe master data |

---

# 11. Engineering Configuration Boundary

## 11.1 Engineering Configuration

Engineering assumptions must not remain scattered as constants throughout calculation code.

Potential controlled configuration includes:

```text
Manning n
Hydraulic capacity criterion
Velocity limits
Kμ
Bedding classes
Bedding factors
FOS threshold
Entrance coefficients
Live-load tables
Hydrological method parameters
Other standard-specific coefficients
```

The exact values must not be changed merely because they are being moved.

First:

```text
Current value
    ↓
Engineering basis verification
    ↓
Approved value/configuration
```

Only then:

```text
Configuration / Master Data
    ↓
Calculation Service
```

### Audit mapping

| Fault | Target boundary |
|---|---|
| P3 | Hydraulic engineering configuration |
| P4 | Hydraulic engineering configuration |
| P8 | Structural engineering configuration |
| P9 | Bedding engineering configuration |
| HW3 | Headwater engineering configuration |
| FOS3 | Structural engineering configuration |
| TR1 | Engineering configuration |

---

# 12. Engineering Master Data Boundary

Engineering master data is different from calculation configuration.

### Master data includes

```text
Pipe catalogue
Pipe diameter
Pipe class
Wall thickness
Ultimate crushing capacity
Pipe material/specification
Other selectable engineering products
```

Target:

```text
Engineering Master Data
        ↓
Repository
        ↓
Calculation Service
```

The calculation service should consume master data rather than maintain duplicate hard-coded lists.

---

# 13. Validation Responsibility

Validation should be separated from silent calculation defaults.

## Target responsibility

A validation boundary should determine whether the input is sufficiently complete and valid before engineering calculation begins.

Potential validation areas:

```text
Catchment area
Rainfall intensity
Runoff coefficient
Design discharge override
Return period
Slope
Fill height
Soil unit weight
Bearing capacity
Load class
Hydrological method
Roadway width
Skew angle
Other mandatory engineering inputs
```

The exact mandatory/optional rules must be established from engineering requirements.

### Target flow

```text
RevisionEngineeringInput
        ↓
Engineering Input Validation
        ↓
Valid
   ┌────┴────┐
   │         │
  Yes        No
   │         │
   ▼         ▼
Calculation  Validation Result
```

---

# 14. Calculation Trace Responsibility

## 14.1 Calculation Trace

The current service already records many useful calculation steps.

The target architecture should preserve that capability.

The trace should eventually cover the complete engineering chain:

```text
Input
    ↓
Hydrology
    ↓
Hydraulic sizing
    ↓
Capacity
    ↓
Velocity
    ↓
Headwater
    ↓
Structural loads
    ↓
Bedding
    ↓
Required crushing load
    ↓
Pipe selection
    ↓
Pipe capacity
    ↓
Factor of Safety
    ↓
Hydraulic adequacy
    ↓
Structural adequacy
    ↓
Overall adequacy
```

Current gap:

```text
Required Crushing Load
        ↓
[TRACE GAP]
        ↓
Pipe Selection
        ↓
FOS
        ↓
Structural Verdict
```

This is recorded as `TR2`.

No implementation change is proposed yet.

---

# 15. Result Construction Responsibility

The final result should remain a clear engineering result model.

Current:

```text
RevisionEngineeringResultModel
```

This should remain the central result contract between calculation orchestration and downstream persistence/reporting.

It should contain:

```text
Hydrology results
Hydraulic results
Headwater results
Structural results
Pipe selection results
Verdicts
Calculation trace
```

The result model should not contain database-specific implementation details.

---

# 16. Persistence Responsibility

Calculation services should not directly own persistence implementation.

Current concern:

```text
DesignCalculationService
        ↓
ApplicationDbContext
```

Target:

```text
Calculation Service
        ↓
Repository / Data Boundary
        ↓
Infrastructure
        ↓
Database
```

This applies particularly to:

```text
Pipe catalogue
Engineering master data
Other calculation-supporting persisted data
```

The calculation layer should depend on an abstraction rather than EF Core directly.

---

# 17. Fault → Responsibility → Target Boundary Map

| Audit ID | Current Responsibility | Target Responsibility | Target Boundary |
|---|---|---|---|
| P1 | Hydraulic + structural selection | Unified final design configuration | Design orchestrator |
| P2 | Silent defaults | Engineering input validation | Validation boundary |
| P3 | Manning `n` constant | Controlled hydraulic configuration | Engineering Configuration |
| P4 | 75% capacity constant | Controlled hydraulic criterion | Engineering Configuration |
| P5 | Simplified hydraulic model | Hydraulic engineering model | HydraulicCalculationService |
| P6 | Simplified headwater | Culvert control analysis | HeadwaterCalculationService |
| P7 | Trench width assumption | Controlled structural geometry | StructuralCalculationService + Configuration |
| P8 | `Kμ` constant | Controlled structural coefficient | Engineering Configuration |
| P9 | Bedding constant | Controlled bedding selection | BeddingService |
| P10 | Bearing capacity ignored | Structural/geotechnical check | StructuralCalculationService |
| P11 | Soil type unused | Controlled soil properties | Soil/Engineering Configuration |
| P12 | Standard ignored | Standard-driven methodology | Engineering Configuration + Calculation Services |
| F-INPUT-01 | Roadway width ignored | Defined engineering use | Relevant calculation service |
| F-INPUT-02 | Skew ignored | Defined skew treatment | Hydraulic/geometry responsibility |
| F-INPUT-03 | Return period ignored | Hydrological design basis | HydrologyCalculationService |
| H1 | Rational calculation only | Method-specific hydrology | HydrologyCalculationService |
| H2 | Defaulted hydrology inputs | Explicit validation | Validation boundary |
| H3 | Override behavior unclear | Explicit hydrological rule | HydrologyCalculationService |
| H4 | Hydrology in monolith | Separate hydrology service | HydrologyCalculationService |
| HY1 | Per-pipe result semantics | Per-pipe + total capacity | HydraulicCalculationService |
| HY3 | Hard-coded diameter list | Pipe master data | Pipe master-data boundary |
| HW1 | No barrel friction | Complete headwater model | HeadwaterCalculationService |
| HW2 | No control evaluation | Inlet/outlet control | HeadwaterCalculationService |
| HW3 | `Ke` constant | Controlled inlet configuration | Engineering Configuration |
| HW5 | Headwater excluded from verdict | Hydraulic acceptance orchestration | DesignCalculationService |
| HW6 | Ambiguous result semantics | Explicit result semantics | HeadwaterCalculationService |
| S2 | Structural lacks pipe count | Full configuration input | StructuralCalculationService |
| LL1 | Invalid class fallback | Explicit validation | LiveLoadService |
| LL2 | Tables in calculation service | Engineering data boundary | LiveLoadService / Configuration |
| B4 | Bedding hard-coded | Controlled bedding selection | BeddingService |
| FOS3 | FOS threshold constant | Controlled structural criterion | Engineering Configuration |
| PS1 | Pipe selection changes diameter | Unified design selection | Design orchestrator |
| PS2 | EF access in calculation | Repository boundary | IPipeCatalogRepository |
| SR2 | Bearing capacity excluded | Structural/geotechnical check | StructuralCalculationService |
| SR3 | Structural result incomplete | Complete structural responsibility | StructuralCalculationService |
| TR1 | Assumptions embedded in code | Controlled engineering configuration | Engineering Configuration |
| TR2 | Final stages absent from trace | Complete calculation trace | Result/Trace responsibility |

---

# 18. Proposed C# Service Boundary

The proposed target application layer is:

```text
CulvertCAD.Application
│
├── Services
│   │
│   ├── DesignCalculationService
│   │
│   ├── HydrologyCalculationService
│   │
│   ├── HydraulicCalculationService
│   │
│   ├── HeadwaterCalculationService
│   │
│   ├── StructuralCalculationService
│   │
│   ├── LiveLoadService
│   │
│   ├── BeddingService
│   │
│   └── PipeSelectionService
│
└── Interfaces
    │
    ├── IDesignCalculationService
    ├── IHydrologyCalculationService
    ├── IHydraulicCalculationService
    ├── IHeadwaterCalculationService
    ├── IStructuralCalculationService
    ├── ILiveLoadService
    ├── IBeddingService
    └── IPipeSelectionService
```

Repository abstractions should remain separate:

```text
CulvertCAD.Application
│
└── Interfaces
    │
    └── IPipeCatalogRepository
```

Infrastructure implementation:

```text
CulvertCAD.Infrastructure
│
└── Repositories
    │
    └── PipeCatalogRepository
```

---

# 19. Proposed Dependency Direction

The target dependency direction should be:

```text
Web
 ↓
Application
 ↓
Core
```

and:

```text
Infrastructure
 ↓
Application abstractions
 ↓
Core
```

Engineering calculation services should not depend directly on:

```text
EF Core
ApplicationDbContext
MongoDB
ASP.NET MVC
Controllers
Views
```

Persistence-specific implementation belongs in Infrastructure.

---

# 20. Orchestration Flow

The intended future calculation flow is:

```text
RevisionEngineeringInput
        ↓
Input Validation
        ↓
HydrologyCalculationService
        ↓
DesignDischargeQ
        ↓
HydraulicCalculationService
        ↓
Hydraulic Configuration
        ↓
Hydraulic Configuration Result
        ↓
HeadwaterCalculationService
        ↓
Headwater Result
        ↓
StructuralCalculationService
        │
        ├── LiveLoadService
        │
        ├── BeddingService
        │
        └── PipeSelectionService
        ↓
Structural Result
        ↓
DesignCalculationService
        ↓
Hydraulic + Structural + Headwater Verdict
        ↓
RevisionEngineeringResultModel
```

The exact sequencing must be finalized after engineering rules are verified.

---

# 21. Important Architecture Rule — Do Not Split Services Mechanically

The target services must not be created merely by moving methods into separate files.

Each service must have:

- One clear engineering responsibility.
- Explicit inputs.
- Explicit outputs.
- Clear ownership of engineering assumptions.
- No unnecessary database dependency.
- Testable calculation behavior.
- Traceability of its engineering result.

Bad refactoring:

```text
DesignCalculationService
    ↓
5 classes containing copied methods
```

Target:

```text
One engineering responsibility
        ↓
One clear boundary
        ↓
Explicit contract
```

---

# 22. Important Architecture Rule — Preserve Existing Behavior First

The first implementation stage must separate responsibilities **without simultaneously changing engineering formulas**.

Target migration sequence:

```text
Current calculation
        ↓
Extract responsibility
        ↓
Preserve current behavior
        ↓
Unit tests
        ↓
Verify identical results
        ↓
Move next responsibility
```

Only after the architecture is stable should engineering corrections be introduced.

---

# 23. Engineering Correction Sequence

After service boundaries are implemented and tested:

```text
Architecture extraction
        ↓
Regression testing
        ↓
Engineering-basis verification
        ↓
Controlled configuration
        ↓
Formula/model corrections
        ↓
Input validation corrections
        ↓
Result/trace improvements
        ↓
End-to-end engineering verification
```

This prevents architecture refactoring and engineering correction from becoming one uncontrolled change.

---

# 24. Items Requiring Engineering Decision Before Implementation

The following must not be decided by software architecture alone:

```text
H3   Design discharge override rule
P3   Manning n basis
P4   75% capacity criterion
P8   Kμ basis
P9/B4 Bedding class/factor basis
HW3  Entrance coefficient
HY2  Velocity acceptance basis
LL3  Live-load out-of-range behavior
B3   Required crushing-load formula/basis
FOS3 FOS threshold
PS4  Complete pipe-selection specification
P12  Standard-driven calculation methodology
```

These require engineering/standard verification.

---

# 25. Architecture Decision Status

| Area | Status |
|---|---|
| Current responsibilities identified | COMPLETE |
| Major service boundaries identified | COMPLETE |
| Fault-to-responsibility mapping | COMPLETE |
| Database boundary identified | COMPLETE |
| Engineering configuration boundary identified | COMPLETE |
| Master-data boundary identified | COMPLETE |
| Result boundary identified | COMPLETE |
| Traceability boundary identified | COMPLETE |
| Engineering-basis decisions | PENDING |
| C# implementation | NOT STARTED |
| Formula correction | NOT STARTED |

---

# 26. Target Architecture Summary

The target architecture is:

```text
                         Web
                          │
                          ▼
              DesignCalculationService
                    Orchestrator
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        ▼                 ▼                  ▼
   Hydrology         Hydraulic          Structural
   Calculation       Calculation        Calculation
     Service            Service            Service
        │                 │                  │
        │                 ▼                  ├── LiveLoadService
        │            Headwater               │
        │            Calculation             ├── BeddingService
        │               Service              │
        │                                    └── PipeSelectionService
        │                                             │
        │                                             ▼
        │                                   IPipeCatalogRepository
        │                                             │
        │                                             ▼
        │                                         Database
        │
        └────────────── Engineering
                       Configuration
                       / Master Data
```

Final result:

```text
Engineering Services
        ↓
DesignCalculationService
        ↓
RevisionEngineeringResultModel
        ↓
Persistence / Reporting / DTO
```

The architecture separates:

```text
Engineering calculation
        ≠
Engineering configuration
        ≠
Engineering master data
        ≠
Persistence
        ≠
Web/UI
```

No existing calculation behavior is changed by this document.

**Next step:** review this boundary map and identify any service boundary that should be merged, split, renamed, or kept inside the orchestrator before implementation begins.
