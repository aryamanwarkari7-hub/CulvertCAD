# CulvertCAD Engineering Decision Register v2

## Verified Engineering Basis and Decisions

**Date:** 2026-09-07  
**Scope:** Circular pipe culverts — engineering basis for the current CulvertCAD audit and future implementation.

---

## 1. Governing Standard / Design Basis

| Item | Decision | Status |
| --- | --- | --- |
| Primary governing guideline | IRC:SP:13-2022, *Guidelines for the Design of Small Bridges and Culverts (Second Revision)* | DECIDED |
| Supporting standards | Applicable IRC/IS standards shall be used where IRC:SP:13-2022 refers to them, including relevant loading, structural concrete, foundation and pipe-product standards. | DECIDED |
| Engineering values | Every configurable engineering assumption shall ultimately have source, clause/table, standard revision and rationale recorded. | DECIDED |

**Important:** Do not describe a current software assumption as an IRC requirement unless the applicable standard explicitly establishes it.

---

## 2. Hydrology

### 2.1 Return Period

| Item | Decision | Status |
| --- | --- | --- |
| Culvert design return period | **50 years** for culverts, based on IRC:SP:13-2022 Clause 3.9. | DECIDED |
| Small bridge return period | 100 years. | DECIDED |
| Software input | ReturnPeriodYrs must influence the design rainfall/design discharge process rather than merely being stored. | DECIDED |
| Current implementation | ReturnPeriodYrs is persisted and passed within RevisionEngineeringInput, but is not currently used by DesignCalculationService/HydrologyCalculationService to determine rainfall intensity or design discharge Q. | CONFIRMED GAP |
| Required implementation basis | An approved rainfall/IDF data source and methodology must be defined before ReturnPeriodYrs is connected to rainfall intensity and Q. | OPEN |

### 2.2 Hydrological Method

IRC:SP:13-2022 includes empirical approaches (Dicken, Ryve, Inglis) and the Rational approach.

| Item | Decision | Status |
| --- | --- | --- |
| Primary implemented method | Rational method may remain the currently supported software method. | DECIDED |
| Unsupported methods | Dicken/Ryve/Inglis may remain explicitly unsupported by the current product scope, with no silent fallback. | DECIDED |
| Standard interpretation | Do **not** claim that IRC:SP:13-2022 excludes these methods; it contains them. | DECIDED |
| Rational implementation | Future engineering correction must follow the IRC formulation/procedure, including rainfall intensity/time-of-concentration considerations and applicable coefficients/factors. | OPEN FOR IMPLEMENTATION |

**Current concern:** the existing `C × I × A / 360` implementation does not by itself demonstrate the complete IRC:SP:13-2022 rainfall/time-concentration procedure.

---

| Item | Decision | Status |

| --- | --- | --- |

| Manning n | Keep configurable through `EngineeringCalculationSettings`. | DECIDED |

| Current value 0.013 | Current `0.013` is not supported by the identified IRC:SP:13-2022 basis for cement-concrete circular pipes. | CONFIRMED — CURRENT VALUE NOT SUPPORTED |

| IRC:SP:13-2022 basis | Article 19.2.5 specifies `n = 0.015` for cement-concrete circular pipes in its stated friction-loss formulation. | VERIFIED |

| Final value | Adopt the applicable value only after reconciling it with the complete hydraulic methodology and actual pipe/material condition. | OPEN FOR IMPLEMENTATION |
---

## 4. Hydraulic Capacity

| Item | Decision | Status |
| --- | --- | --- |
| Full-flow model | Full-flow pipe capacity is a valid case and is addressed in IRC:SP:13-2022. | DECIDED |
| Current 75% capacity factor | Current `DesignCapacityFactor = 0.75` is not established as a universal requirement in IRC:SP:13-2022. | CONFIRMED — ASSUMED CRITERION NOT SUPPORTED |
| Future acceptance rule | Replace the 75% criterion with an approved hydraulic acceptance methodology based on design discharge, permissible heading-up, tailwater/control conditions and applicable hydraulic requirements. | OPEN FOR IMPLEMENTATION |
| Partial-flow / control | Current simplified full-flow approach does not constitute a complete culvert hydraulic model. | OPEN |

---

## 5. Velocity

| Item | Decision | Status |
| --- | --- | --- |
| Current limits | `0.6–3.5 m/s` are not established as universal culvert pass/fail limits in the reviewed IRC:SP:13-2022 material. | CONFIRMED — CURRENT CRITERION NOT ESTABLISHED |
| `vFull` vs `vDesign` | Current adequacy uses full-flow velocity while design velocity is calculated separately but is not used for adequacy. | CONFIRMED — METHODOLOGY OPEN |
| Final criterion | Establish the governing velocity condition from the approved hydraulic methodology, including applicable flow condition and erosion/scour considerations. | OPEN FOR ENGINEERING VERIFICATION |

**Do not change the current code solely on this decision register until the engineering criterion is approved.**

---

## 6. Headwater / Hydraulic Control

The current `HeadwaterCalculationService` is architecturally separated, but its engineering model remains incomplete.

| Fault | Decision | Status |
| --- | --- | --- |
| HW1 — No barrel friction/length | Final headwater/control methodology must include the applicable barrel friction/head-loss calculation using barrel length, hydraulic radius and roughness. IRC:SP:13-2022 Article 19.2 incorporates friction resistance in the full-flow pipe-culvert method. | CONFIRMED GAP — OPEN FOR IMPLEMENTATION |
| HW2 — No tailwater / hydraulic control evaluation | Final methodology must include the applicable tailwater/outlet condition and operating-head relationship. IRC:SP:13-2022 Article 19.2 requires tail-race HFL and defines operating head from upstream and downstream levels. | CONFIRMED GAP — OPEN FOR IMPLEMENTATION |
| HW3 — `Ke = 0.5` | Entrance coefficient must be based on the actual inlet configuration; it must not remain a universal unexplained constant. | OPEN |
| HW5 — Headwater acceptance | Headwater/heading-up must participate in the final hydraulic acceptance decision. The governing criterion must be based on the approved IRC hydraulic methodology and safe upstream level. | CONFIRMED GAP — OPEN FOR IMPLEMENTATION |
| HW6 — Simplified headwater result semantics | Define precisely whether the final output represents headwater depth, upstream water level, operating head

IRC:SP:13-2022 Article 19.2 provides an energy/head-loss based full-flow approach involving operating head, barrel length, diameter, area, hydraulic radius, entrance coefficient and friction coefficient.

---

## 7. Multiple Pipes

| Item | Decision | Status |
| --- | --- | --- |
| Number of pipes | Current system supports one to four pipes. | DECIDED |
| Hydraulic capacity | Per-pipe and total capacity must remain explicit. | CLEARED |
| Structural calculation | Number of pipes must remain consistently propagated into structural calculation. | CLEARED |
| Pipe spacing | Final geometry must comply with applicable standard/detail requirements. IRC:SP:13-2022 identifies minimum clear spacing for small multiple pipe culverts. | OPEN FOR IMPLEMENTATION |
| Trench width | Must account for the actual multi-pipe arrangement rather than relying on `D + 0.6 m` universally. | OPEN |

---

## 8. Trench / Structural Earth Pressure

| Item | Decision | Status |
| --- | --- | --- |
| Trench width formula | Current `D + 0.6 m` is a configurable assumption, not an approved universal formula. | OPEN |
| `Kμ = 0.150` | No universal basis was established in the reviewed material. | OPEN |
| Earth-load equation | Current calculation requires engineering verification against the selected structural/installation methodology. | OPEN |
| Structural configuration | Final structural calculation must reflect actual pipe arrangement, fill, bedding and installation conditions. | OPEN |

---

## 9. Live Load

IRC:SP:13-2022 Clause 13.2 establishes road loading requirements and refers to applicable IRC loading standards depending on road classification.

| Item | Decision | Status |
| --- | --- | --- |
| Load class | Must be explicitly validated; invalid classes must not silently fall back. | OPEN |
| Current embedded tables | Must be mapped to the applicable standard/source and controlled as engineering data. | OPEN |
| Fill-depth range | Do not silently clamp outside the validated engineering range. | OPEN |
| Road type / loading | Load class selection must reflect the applicable roadway classification and governing loading standard. | OPEN |

---

## 10. Bedding

| Item | Decision | Status |
| --- | --- | --- |
| Current bedding | `Class B`, factor `1.9` are configuration values. | DECIDED |
| Engineering basis | These values are not yet established as universal requirements from the reviewed sources. | OPEN |
| Final bedding | Must depend on actual installation/fill/site conditions and applicable pipe installation methodology. | OPEN |
| Bedding factor | Must have an approved source and calculation basis. | OPEN |

---

## 11. Pipe Strength / Crushing / FOS

| Item | Decision | Status |
| --- | --- | --- |
| Pipe ultimate crushing load | Must be tied to the actual pipe product/class/catalogue and applicable pipe standard. | DECIDED |
| IS pipe standard | Current pipe product basis must be checked against the applicable/current IS 458 requirements before final implementation. | OPEN |
| FOS formula | Current formula is internally coherent: pipe capacity × bedding factor / total field load. | DECIDED — INTERNAL CONSISTENCY |
| FOS minimum 1.5 | Not established as a universal requirement from the reviewed material. | OPEN |
| Bedding/FOS relationship | Requires engineering basis. | OPEN |
| Crushing equation | Requires structural/installation methodology verification. | OPEN |

---

## 12. Bearing Capacity / Foundation

| Item | Decision | Status |
| --- | --- | --- |
| Bearing capacity input | Must not be accepted as a meaningful engineering input unless it participates in an actual foundation/bearing check. | DECIDED |
| Foundation check | Bearing/foundation adequacy is required in the final structural scope where applicable. | OPEN |
| Soil properties | Soil type must map to actual engineering properties used by the relevant calculation. | OPEN |

---

## 13. Soil Type

| Item | Decision | Status |
| --- | --- | --- |
| Soil type input | Current soil type has insufficient influence on the calculation. | OPEN |
| Future implementation | Define the engineering properties derived from soil classification and where each property is used. | OPEN |

---

## 14. Roadway Width

IRC:SP:13-2022 states that culvert/bridge roadway width should correspond to the designed road formation width and account for future widening.

| Item | Decision | Status |
| --- | --- | --- |
| RoadwayWidthM | Engineering-relevant geometry input. | DECIDED |
| Hydraulic use | Do not automatically insert roadway width into hydraulic equations without an approved methodology. | DECIDED |
| Structural/drawing use | May affect culvert arrangement, road geometry and deliverables. | DECIDED |
| Calculation linkage | Exact calculation influence remains to be defined. | OPEN |

---

## 15. Skew Angle

IRC:SP:13-2022 addresses non-right-angle crossings and indicates that skew culverts/bridges or channel training should be considered.

| Item | Decision | Status |
| --- | --- | --- |
| SkewAngleDeg | Engineering-relevant input. | DECIDED |
| Current calculation | Current system stores the value but does not meaningfully use it in the core hydraulic/structural calculation. | OPEN |
| Future methodology | Define how skew affects hydraulic geometry, barrel length, inlet/outlet arrangement and structural configuration. | OPEN |

---

## 16. Design Standard Input

| Item | Decision | Status |
| --- | --- | --- |
| DesignStandard | Must eventually drive or constrain the engineering methodology. | OPEN |
| Current state | A stored standard selection alone is insufficient traceability. | DECIDED |
| Future requirement | Calculation trace should identify the governing standard/version and relevant clauses/data sources. | OPEN |

---

## 17. Pipe Selection

| Item | Decision | Status |
| --- | --- | --- |
| Catalogue | Active pipe diameters come from `IPipeCatalogRepository`. | CLEARED |
| Structural selection | `PipeSelectionService` is the application boundary for final pipe selection. | CLEARED |
| Selection criteria | Final selection should consider hydraulic adequacy, structural capacity, availability/catalogue constraints and applicable engineering rules. | OPEN |
| Convergence | Hydraulic and structural results must correspond to the same final pipe configuration. | CLEARED |

---

## 18. Overall PASS / FAIL

| Item | Decision | Status |
| --- | --- | --- |
| Hydraulic PASS | Must represent the approved hydraulic acceptance criteria, including headwater/control where applicable. | OPEN |
| Structural PASS | Must represent the approved structural/geotechnical scope. | OPEN |
| Overall PASS | Must clearly state which engineering checks are included. | OPEN |
| Current `Hydraulic Pass AND Structural Pass` | Internally understandable but potentially broader in appearance than the checks actually performed. | OPEN |

---

## 19. Traceability

| Item | Decision | Status |
| --- | --- | --- |
| Input validation | Already separated and verified. | CLEARED |
| Final discharge source | Override/design-discharge source is traceable. | CLEARED |
| Final pipe configuration | Trace must reflect final selected configuration. | CLEARED |
| Engineering assumptions | Source/clause/version/rationale must be captured. | OPEN |
| Final verdict | Trace must show the actual checks and governing decision. | OPEN |

---

# 20. Engineering Decisions — Summary

## DECIDED / VERIFIED

1. **Primary governing guideline:** IRC:SP:13-2022.
2. **Culvert return period:** 50 years.
3. **Rational hydrology:** acceptable as the currently supported method, but must follow the approved IRC formulation/procedure.
4. **Dicken/Ryve/Inglis:** may remain unsupported by current product scope; no silent fallback.
5.5. **Manning n:** configurable; `0.013` is not supported by the identified IRC:SP:13-2022 basis for cement-concrete circular pipes; Article 19.2.5 specifies `0.015` in its stated friction-loss formulation.
5. **75% hydraulic capacity factor:** not established as a universal IRC requirement.
6. **Velocity acceptance:** current `0.6–3.5 m/s` limits are not established as universal IRC requirements; the governing velocity criterion remains open.
7. **Full-flow pipe hydraulics:** valid engineering case, but current model is incomplete for final culvert hydraulic acceptance.
8. **Headwater:** final model requires barrel friction, inlet/control regime, tailwater and proper entrance-loss treatment.
9. **Roadway width:** engineering-relevant geometry, but must not be arbitrarily inserted into hydraulic equations.
10. **Skew angle:** engineering-relevant input; calculation methodology still required.
11. **Bearing capacity:** must participate in an actual engineering check if presented as a meaningful input.
12. **Pipe strength:** must be tied to actual pipe product/class and applicable standard.
13. **FOS 1.5:** not yet established as a universal requirement.
14. **Bedding Class B / 1.9:** configuration assumptions pending engineering basis.
15. **Kμ 0.150:** pending engineering basis.
16. **Engineering configuration values:** must eventually have source/clause/version/rationale.
17. **Current software architecture:** calculation service boundaries that have already been cleared should not be unnecessarily re-extracted.

---

# 21. Items Explicitly NOT Approved Yet

The following values/rules must **not** be presented as engineering-standard requirements until independently approved:

- Final Manning `n` value for all supported pipe/material conditions
- Hydraulic capacity factor `0.75`
- Velocity limits `0.6–3.5 m/s`
- Entrance coefficient `Ke = 0.5` as a universal value
- Trench width `D + 0.6 m` as a universal formula
- Structural `Kμ = 0.150`
- Bedding factor `1.9`
- Bedding Class B as a universal choice
- Structural FOS minimum `1.5`
- Current live-load tables without source mapping
- Silent endpoint clamping of live load
- Any implicit soil default or soil-property assumption

---

# 22. Implementation Rule

**Do not modify engineering calculation code merely because an audit item has been identified.**

For every open engineering item:

1. Establish the governing standard/method.
2. Identify the exact clause/table/equation where applicable.
3. Define required inputs.
4. Define calculation equations and units.
5. Define acceptance/pass-fail criteria.
6. Define traceability requirements.
7. Obtain/record engineering approval.
8. Only then modify the calculation implementation.
9. Add/update regression tests and engineering benchmark cases.
10. Update `CulvertCAD_Fault_Clear_Status.md` only after the change is implemented and verified.

---

## 23. Relationship to the Fault Audit

This register is the **engineering decision/basis companion** to:

- `CulvertCAD_Fault_Audit.md` — complete cumulative fault register.
- `CulvertCAD_Fault_Clear_Status.md` — only faults that have been rectified and verified.

An item being marked **DECIDED** here does not automatically mean the software fault is cleared.  
A fault is cleared only after implementation and verification are completed and recorded in the Clear Status document.
