# CULVERTCAD — MASTER DESIGN SPECIFICATION (MDS)

**Application:** CulvertCAD  
**Engineering Scope:** Circular Pipe Culvert Design  
**Primary Governing Standard:** IRC:SP:13-2022  
**Revision:** MDS-V1.0  
**Status:** Master Engineering Specification / Implementation Baseline  
**Date:** 07 September 2026

---

## 1. Purpose

CulvertCAD shall provide a traceable engineering workflow for circular pipe culvert design, covering controlled engineering inputs, validation, hydrology, hydraulic sizing/control, headwater, structural loading, pipe selection, final hydraulic/structural verdicts, calculation traceability, reports, and drawings.

A calculation executing successfully shall not by itself be treated as an engineering PASS.

---

## 2. Governing Engineering Basis

### Primary Standard
**IRC:SP:13-2022 — Guidelines for the Design of Small Bridges and Culverts, Second Revision.**

### Supporting Standards
Applicable supporting standards shall be used where relevant, including applicable IRC loading/design standards, IRC:112 where applicable, IS 458:2021 for precast concrete pipes with/without reinforcement, IS 783 and other applicable installation/laying standards, and applicable geotechnical/foundation standards.

### Standard Mapping
The selected design standard shall ultimately control methodology, coefficients, acceptance criteria, loading provisions, pipe/product requirements, and reference clauses/tables.

Until another methodology is actually implemented and verified, **IRC:SP:13-2022 is the only supported design methodology.**

---

## 3. Design Return Period

### Culverts
**50 years**, based on IRC:SP:13-2022 Clause 3.9.

### Small Bridges
**100 years.**

### Software requirement
The design record shall preserve:

**Return Period → rainfall/IDF basis → rainfall intensity → hydrological method → design discharge.**

Return period shall not remain a passive unused input.

---

## 4. Hydrology

### Supported Method
The Rational Method is supported:

`Q = C × I × A / 360`

where Q = design discharge, C = runoff coefficient, I = rainfall intensity, and A = catchment area.

Units shall be controlled.

### Required Inputs
Unless an approved alternative exists:
- catchment area;
- rainfall intensity;
- runoff coefficient;
- return period;
- hydrological method.

Missing engineering inputs shall not be silently replaced with engineering defaults.

### Rainfall / IDF
Rainfall intensity shall correspond to the approved return-period rainfall/IDF source. The application shall preserve the rainfall source/reference.

### Engineer Q Override
An engineer-entered design-discharge override may be supported. When used, the system shall preserve calculated hydrological Q, override Q, final authoritative Q, override status/source, and calculation trace.

---

## 5. Hydraulic Design

Hydraulic sizing and acceptance shall consider, as applicable:
- design discharge;
- number of pipes;
- pipe diameter;
- flow condition;
- inlet condition;
- outlet condition;
- tailwater;
- barrel friction;
- entrance loss;
- operating head;
- permissible heading-up;
- applicable velocity/scour requirements.

The current 75% full-flow capacity rule shall not govern final acceptance.

---

## 6. Circular Pipe Geometry

For full-flow circular pipe conditions:

`A = πD² / 4`

`R = D / 4`

where A is flow area, D is hydraulic diameter and R is hydraulic radius.

These are geometry relationships, not a complete culvert control methodology.

---

## 7. Manning Roughness

Manning `n` shall be controlled through engineering configuration.

For the currently supported cement-concrete circular pipe condition:

**n = 0.015**

is the identified IRC:SP:13-2022 Article 19.2.5 basis in its stated friction-loss formulation.

The value shall remain configurable for future documented pipe/material conditions.

The current application value `0.013` shall not be retained as the governing cement-concrete value without an applicable documented basis.

---

## 8. Hydraulic Capacity Acceptance

The existing:

`Qdesign = Qfull × 0.75`

criterion shall be removed.

Hydraulic acceptance shall instead be based on the approved culvert methodology, including as applicable:
- design discharge;
- hydraulic control;
- operating head;
- headwater/heading-up;
- tailwater;
- inlet losses;
- barrel friction;
- applicable hydraulic/scour requirements.

---

## 9. Velocity

The current universal:

`0.6 m/s ≤ velocity ≤ 3.5 m/s`

criterion shall not be used as a universal IRC PASS/FAIL rule.

Velocity shall remain an engineering result.

The system shall retain both full-flow and design-flow velocity where calculated, with the represented flow condition clearly identified.

Any velocity acceptance requirement shall come from the approved methodology and applicable erosion/scour considerations.

---

## 10. Headwater and Hydraulic Control

### Barrel friction
The final full-flow methodology shall include applicable barrel friction using barrel length, hydraulic radius, Manning roughness, and the applicable friction-loss relationship.

### Tailwater / outlet condition
The model shall support upstream water level, tailwater/tail-race HFL, outlet crown, operating head, and governing hydraulic control condition.

### Operating head
For applicable full-flow analysis, operating head shall follow the adopted IRC methodology using upstream water level relative to the governing downstream level.

### Entrance loss
`Ke` shall be determined from the actual inlet configuration. It shall not be a universal `Ke = 0.5` default for every culvert.

### Headwater acceptance
Headwater/heading-up shall participate in hydraulic PASS/FAIL. The calculated upstream condition shall be checked against the approved safe/permissible upstream level.

---

## 11. Headwater Result Semantics

The final result model shall distinguish, where applicable:
- headwater elevation;
- headwater depth;
- upstream water level;
- tailwater elevation;
- operating head;
- critical depth;
- governing control condition.

A simplified intermediate calculation shall not be presented as an authoritative engineering headwater result.

---

## 12. Multiple Pipes

Where equal flow distribution is applicable:

`qPerPipe = Q / N`

The same authoritative pipe count shall propagate through hydraulic calculation, structural loading, pipe selection, final result, and drawing.

---

## 13. Pipe Diameter and Catalogue

Pipe diameters shall come from controlled `PipeCatalog` engineering data.

The application shall not maintain competing hard-coded diameter lists.

The catalogue shall provide applicable product information required for engineering selection.

---

## 14. Structural Design Inputs

Structural calculation shall use the actual installation/design configuration, including as applicable:
- fill height;
- pipe diameter;
- number of pipes;
- pipe spacing;
- trench width;
- soil unit weight/properties;
- live load;
- bedding condition;
- pipe properties;
- bearing capacity;
- applicable installation condition.

---

## 15. Trench Width

The current universal:

`Trench Width = D + 0.6 m`

shall be removed.

Trench width shall be an actual engineering installation geometry value determined from pipe diameter, number of pipes, spacing, construction clearance, applicable installation standard, and project requirements.

---

## 16. Earth Load / Kμ

The current universal `Kμ = 0.150` shall not be retained as an unexplained constant.

The earth-load methodology shall determine the applicable coefficient from the approved structural/installation methodology and relevant soil/installation parameters.

The trace shall preserve:

**soil/installation condition → method → coefficient → earth load.**

No unsupported replacement constant shall be invented.

---

## 17. Bedding

Bedding shall be selected from controlled engineering configuration.

The current universal Class B / factor 1.9 shall not be assumed for every design.

The final workflow shall be:

**installation condition → bedding class → applicable bedding factor → required pipe capacity.**

---

## 18. Bearing Capacity / Foundation

Where applicable, bearing/foundation adequacy shall be checked.

At minimum:

`Applied foundation pressure ≤ allowable bearing capacity`

If required bearing information is missing, the system shall not claim complete structural PASS.

No silent bearing-capacity default is permitted.

---

## 19. Soil

Soil type shall be a meaningful controlled engineering classification.

It shall map to required engineering properties such as unit weight, applicable earth-load parameters, installation characteristics, and other properties required by the adopted methodology.

Engineer-supplied values may override controlled values only with explicit traceability.

---

## 20. Live Load

Live-load data shall be controlled engineering data rather than hard-coded calculation-service tables.

Each applicable table/configuration shall preserve:
- load class;
- fill-depth range;
- load value;
- unit;
- source;
- standard;
- revision.

Invalid load class shall cause validation failure.

Out-of-range conditions shall not be silently extrapolated or clamped unless the approved methodology explicitly permits it.

---

## 21. Required Crushing Load and Pipe Capacity

Required crushing load shall follow the approved structural/product methodology.

Pipe product capacity shall come from controlled pipe/product data.

The application shall not invent an unsupported generic pipe-capacity formula.

For supported precast concrete pipe products, the applicable product standard shall be used, currently **IS 458:2021**.

---

## 22. Factor of Safety

FOS shall be calculated from the applicable structural/product methodology.

The application shall not hard-code `FOS = 1.5` as a universal requirement without an identified engineering basis.

The applicable FOS/acceptance criterion shall be controlled configuration with value, meaning, source, standard, clause/table, and revision.

---

## 23. Pipe Selection

Pipe selection shall consider, as applicable:
- hydraulic requirement;
- number of pipes;
- diameter;
- pipe class;
- material;
- structural capacity;
- required crushing capacity;
- product standard;
- FOS/acceptance requirement.

One authoritative final pipe configuration shall be returned.

---

## 24. Hydraulic–Structural Convergence

Final design shall converge on one authoritative selected configuration:

**Hydraulic requirement → pipe candidate → structural check → final selected pipe → hydraulic re-check → final convergence.**

A diameter used for the final structural result shall not differ silently from the diameter used for the final hydraulic result.

---

## 25. Roadway Width

Roadway width shall be an actual engineering input.

It shall be used consistently in applicable design geometry, roadway/formation assessment, and drawing/report output.

The application shall not insert roadway width into equations where it has no engineering role.

---

## 26. Skew

Skew shall not remain decorative metadata.

The final system shall retain the actual skew, use it in applicable geometry, represent the resulting arrangement in drawings, and explicitly document any hydraulic/structural treatment.

No unsupported hydraulic skew correction factor shall be invented.

---

## 27. Calculation Traceability

Every significant engineering result shall be traceable:

**Input → Method → Formula → Coefficient → Standard/Clause → Intermediate Result → Final Result → Acceptance Criterion → PASS/FAIL**

Traceability shall identify input, calculated value, engineering method, standard, clause/table where applicable, configuration, override status, and final decision.

The trace must reach the final pipe selection and final engineering verdict.

---

## 28. Revision Integrity

Each revision shall preserve the engineering state used to produce its result.

At minimum, where applicable:
- engineering inputs;
- return period;
- rainfall intensity/source;
- hydrological method;
- calculated Q;
- override Q;
- hydraulic configuration;
- structural configuration;
- pipe selection;
- engineering configuration snapshot;
- calculation results;
- calculation trace;
- review/status history.

Return-period changes must be represented in revision history.

---

## 29. Final Result Model

### Hydraulic
- design discharge;
- number of pipes;
- selected diameter;
- full-flow capacity;
- design-flow capacity where applicable;
- velocity with flow condition;
- headwater elevation/depth;
- tailwater;
- operating head;
- hydraulic losses;
- hydraulic verdict.

### Structural
- earth load;
- live load;
- total load;
- bedding;
- required crushing load;
- pipe capacity;
- FOS;
- bearing pressure;
- allowable bearing capacity;
- structural verdict.

### Final
- selected pipe;
- pipe class;
- diameter;
- number of pipes;
- hydraulic verdict;
- structural verdict;
- applicable foundation verdict;
- overall engineering verdict.

---

## 30. Engineering PASS/FAIL

### Hydraulic PASS
Only when all applicable approved hydraulic acceptance conditions are satisfied.

### Structural PASS
Only when all applicable structural/product/foundation conditions are satisfied.

### Overall PASS
Only when hydraulic PASS, structural PASS, applicable foundation/geotechnical checks PASS, final pipe selection is valid, mandatory engineering inputs are valid, and calculation has converged.

---

## 31. Engineering Configuration

Engineering assumptions shall be centrally controlled.

Controlled items shall include, as applicable:
- governing standard;
- standard revision;
- return period;
- Manning `n`;
- hydraulic acceptance methodology;
- velocity criteria where applicable;
- entrance-loss coefficients;
- hydraulic control methodology;
- structural coefficients;
- earth-load parameters;
- bedding classes/factors;
- live-load tables;
- FOS/acceptance criteria;
- soil properties;
- pipe product requirements;
- pipe catalogue.

Every controlled engineering value shall preserve:

**Value + Unit + Source + Standard + Clause/Table + Revision + Rationale**

Engineering assumptions shall not be scattered through calculation code.

---

## 32. Validation

Before calculation, validate:
- mandatory inputs;
- numerical ranges;
- physical validity;
- culvert configuration;
- pipe count;
- pipe diameter;
- fill height;
- roadway width;
- skew;
- hydrology inputs;
- rainfall intensity;
- runoff coefficient;
- return period;
- loading class;
- soil configuration;
- bearing capacity where required;
- design standard;
- hydraulic geometry;
- slope;
- pipe configuration.

Invalid engineering input shall block calculation and produce a clear validation message.

---

## 33. Unsupported Methods

If a method is not implemented:
1. identify it as unsupported;
2. prevent its use;
3. do not silently substitute another method;
4. do not claim that IRC prohibits it unless that prohibition has been verified.

---

## 34. Drawing and Report Consistency

Reports and drawings shall use the same authoritative engineering result used for calculation.

They shall reflect, where applicable:
- selected diameter;
- number of pipes;
- spacing;
- length;
- trench width;
- bedding;
- fill;
- roadway width;
- levels;
- slope;
- skew;
- applicable structural/hydraulic results.

No report/drawing component shall independently invent engineering defaults.

---

## 35. Engineering Governance

The controlled workflow is:

**Code Audit → Engineering Basis → MDS Decision → Implementation → Testing → Engineering Verification → Fault Clear Status**

A fault shall be marked cleared only after:
- engineering basis established;
- implementation completed;
- calculation verified;
- trace/result verified.

Architecture extraction alone does not clear an engineering fault.

---

## 36. Implementation Rules

1. Do not modify engineering formulas merely to make existing tests pass.
2. Do not replace unsupported constants with new unsupported constants.
3. Do not silently default missing engineering inputs.
4. Do not claim standards compliance without traceable standard/method mapping.
5. Keep engineering configuration separate from calculation logic.
6. Keep the final engineering result authoritative across calculation, reports and drawings.
7. Preserve revision-level calculation state.
8. Update the Fault Audit as implementation progresses.
9. Update `CulvertCAD_Fault_Clear_Status.md` only after implementation and verification.
10. Maintain this document as the single **Master Design Specification**.

---

## 37. Master Status

**MDS:** Master / Authoritative  
**Engineering baseline:** Established  
**Primary standard:** IRC:SP:13-2022  
**Implementation:** Not yet completed  
**Engineering verification:** To follow implementation  
**Code changes:** Must follow this MDS

---

## 38. Core Design Principle

CulvertCAD shall not merely calculate numbers.

It shall produce a:

**validated → standards-based → traceable → converged → reviewable engineering design decision.**
