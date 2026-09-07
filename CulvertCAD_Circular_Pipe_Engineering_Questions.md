# CULVERT CAD — Circular Pipe Culvert Engineering Design-Basis Questions

## Purpose

This document is a decision checklist for establishing the engineering basis of the
current CULVERT CAD circular-pipe culvert system before implementation changes are made.

**Scope:** Circular single-pipe and multiple-pipe culverts only.

**Out of scope for now:** Box and Arch hydraulic design.

**Rule:** Do not implement an engineering formula, coefficient, acceptance criterion,
default, or new input merely because it seems reasonable. Each item should have an
approved engineering basis or be explicitly marked as an engineering decision still
requiring confirmation.

---

# 1. Governing Design Standards

1. What is the primary governing Indian standard/code for the culvert hydraulic design?
2. Which edition/year of that standard is applicable?
3. Which standard governs concrete pipe product requirements and pipe classes?
4. Which standard governs structural design/loading of the culvert?
5. Which standard governs bedding, laying and installation?
6. Which standard governs hydrology/design flood determination?
7. Is FHWA HDS-5 to be used as a hydraulic methodology/reference, or only as supporting guidance?
8. If two standards give different requirements, which has precedence?
9. Should the selected design basis be stored against each design/revision?
10. How should the software identify the exact standard edition used for a calculation?

**Decision:** ______________________________________

---

# 2. Design Discharge / Hydrology

1. Is the Rational Method the only hydrological method currently approved for this application?
2. If Dickens, Ryve and Inglis are retained, when are they applicable?
3. How is the design return period selected?
4. Should Return Period actually affect the calculated discharge?
5. Who is authorized to enter a Design Discharge Override?
6. Does an override require a reason/source/reference?
7. Should the software preserve both calculated Q and overridden Q?
8. What rainfall intensity source/basis should be recorded?
9. What allowable range should exist for:
   - Catchment Area?
   - Rainfall Intensity?
   - Runoff Coefficient?
10. Are there catchment-size limits for use of the Rational Method?
11. Should the hydrology result include a traceable calculation basis/reference?

**Decision:** ______________________________________

---

# 3. Circular-Pipe Scope

1. Should CULVERT CAD explicitly allow only `SinglePipe` and `MultiplePipe`
   designs for calculation?
2. What should happen if the user selects `Box`?
3. What should happen if the user selects `Arch`?
4. Should unsupported types be rejected at validation time?
5. Should unsupported types be prevented from reaching drawing/report generation?
6. What is the maximum number of parallel circular pipes supported?
7. Is the current maximum of four pipes acceptable?
8. Should the number of pipes be calculated automatically, selected by the engineer,
   or both?

**Decision:** ______________________________________

---

# 4. Pipe Selection

1. What is the governing pipe diameter selection criterion?
2. Is the current active PipeCatalog authoritative?
3. Which pipe catalogue standard/edition applies?
4. Should diameter selection consider hydraulic capacity only initially?
5. Should structural capacity be part of the primary selection loop?
6. How should hydraulic and structural sizing interact?
7. What happens if no catalogue pipe satisfies both hydraulic and structural requirements?
8. Should the software try a larger diameter automatically?
9. Should the engineer be allowed to select a diameter manually?
10. If manual selection is allowed, how is it validated?

**Decision:** ______________________________________

---

# 5. Barrel Geometry

## Barrel Length

1. What exactly constitutes culvert barrel length?
2. Is it measured along the culvert centreline/flow path?
3. Where does the length originate?
4. Is it entered by the engineer or derived from surveyed/design geometry?
5. Can it be derived from inlet and outlet chainages?
6. If chainage is used, how is skew handled?
7. Can the inlet and outlet be at different chainages?
8. What minimum/maximum barrel length is acceptable?

## Barrel Slope

9. Should barrel slope equal the current `SlopePercent`?
10. Is roadway/alignment slope necessarily equal to culvert barrel slope?
11. Should barrel slope be independently entered?
12. If derived from inlet/outlet invert levels, should the software calculate and display it?
13. What happens if entered slope and invert-derived slope disagree?

**Decision:** ______________________________________

---

# 6. Inlet Geometry

1. Which circular-pipe inlet configurations will CULVERT CAD support initially?
2. Should the supported configurations be based directly on the selected hydraulic
   design reference?
3. What exact terminology should the software use?
4. Which entrance-loss coefficients apply to each configuration?
5. Are coefficients dependent on pipe diameter, material, headwall, bevel,
   wingwall or other geometry?
6. Should inlet geometry be represented by an enum, catalogue table, or detailed model?
7. Should wingwall angle affect hydraulic calculations?
8. If yes, what engineering relationship governs it?
9. Should headwall/wingwall geometry be independently designed or initially
   treated as a selected standard detail?

**Decision:** ______________________________________

---

# 7. Outlet Geometry / Condition

1. What outlet configurations are supported?
2. Is a simple outlet enough for the first circular-pipe implementation?
3. Does outlet geometry affect the exit-loss coefficient?
4. What exit-loss coefficient/method should be used?
5. Does an outlet apron, wingwall or protection arrangement affect hydraulics?
6. Should outlet condition be a user input or selected standard detail?

**Decision:** ______________________________________

---

# 8. Tailwater

1. What exactly should `Tailwater` mean in CULVERT CAD?
2. Should it be stored as:
   - depth above outlet invert,
   - water-surface RL,
   - or another quantity?
3. What is the source of the tailwater value?
4. Is it surveyed, observed, calculated, or assumed?
5. Can tailwater be zero/free-discharge?
6. How is downstream channel geometry represented?
7. How should varying tailwater conditions be handled?
8. Should the engineer enter a design tailwater directly?
9. Should the software record the source and design basis of tailwater?
10. What happens if tailwater submerges the outlet?

**Decision:** ______________________________________

---

# 9. Inlet Control

1. What exact inlet-control method should be implemented?
2. Which equations/tables/coefficients govern circular pipe inlet control?
3. What inlet configurations are covered?
4. What inputs are required?
5. How is inlet-control headwater determined?
6. Is critical depth part of the calculation?
7. How should submerged inlet conditions be handled?
8. What output should the software expose for engineering traceability?
9. How should inlet-control PASS/FAIL be defined?

**Decision:** ______________________________________

---

# 10. Outlet Control

1. What exact outlet-control energy equation should be implemented?
2. Which elevation difference should be used?
3. How is barrel friction loss calculated?
4. Is Manning-based friction retained, or is another formulation required?
5. How is entrance loss calculated?
6. How is exit loss calculated?
7. How is tailwater incorporated?
8. Are other losses required?
9. How should junction/bend/debris losses be handled, if at all?
10. How is the outlet-control headwater determined?
11. What output should be shown in the calculation trace?

**Decision:** ______________________________________

---

# 11. Governing Control

1. How exactly should inlet-control and outlet-control results be compared?
2. Is the larger headwater the governing condition?
3. How should submerged/inapplicable cases be handled?
4. What should happen if one control calculation is outside its validity range?
5. Should the final result explicitly say:
   - Inlet Control
   - Outlet Control
   - or another state?
6. Should both control calculations be retained in the result snapshot?
7. Should the governing control be visible on the calculation sheet and reports?

**Decision:** ______________________________________

---

# 12. Headwater

1. What is the formal definition of Headwater Depth in CULVERT CAD?
2. Is headwater measured relative to inlet invert?
3. What components contribute to headwater?
4. Should the current `0.5D + Ke V²/(2g)` estimate be removed?
5. What is the approved replacement method?
6. Should critical depth be reported separately?
7. Should energy grade line and hydraulic grade line be reported?
8. What should happen when calculated headwater exceeds allowable limits?

**Decision:** ______________________________________

---

# 13. Freeboard / Overtopping

1. What is the allowable headwater elevation?
2. What reference level defines the available freeboard?
3. How is road formation level determined?
4. What minimum freeboard is required?
5. Is overtopping an automatic hydraulic failure?
6. Should the software calculate:
   - Headwater RL
   - Road formation RL
   - Available freeboard
   - Required freeboard
7. Should the result explicitly show the governing freeboard check?

**Decision:** ______________________________________

---

# 14. Velocity

1. What velocity should govern acceptance?
2. Full-flow velocity?
3. Design-flow velocity?
4. Velocity at another hydraulic condition?
5. Is the current `0.6–3.5 m/s` criterion approved?
6. What standard/reference establishes the lower limit?
7. What establishes the upper limit?
8. Are different limits required for different materials/conditions?
9. Should velocity be checked separately at inlet, barrel and outlet?
10. What happens when capacity passes but velocity fails?

**Decision:** ______________________________________

---

# 15. Multiple Pipes

1. How should discharge be divided between parallel pipes?
2. Is equal flow distribution assumed?
3. What pipe spacing is required?
4. Should spacing be a design input or standard catalogue value?
5. Does the inlet configuration remain common to all pipes?
6. How should entrance losses be treated for multiple barrels?
7. How should outlet conditions be treated?
8. How should structural loads be distributed among multiple pipes?
9. Does the number of pipes affect bedding/support?
10. What is the maximum number of barrels supported?

**Decision:** ______________________________________

---

# 16. Invert Levels / Levels

1. What is the authoritative inlet invert RL?
2. What is the authoritative outlet invert RL?
3. Who provides/approves these values?
4. Are they surveyed or designed?
5. Should the software derive barrel slope from them?
6. How should synthetic drawing values be eliminated?
7. How should level provenance be stored?
8. What datum/reference should apply?
9. How should upstream/downstream water levels relate to the same datum?

**Decision:** ______________________________________

---

# 17. Fill / Cover / Road Geometry

1. What exactly does `FillHeightM` represent?
2. Is it cover above the pipe crown or total embankment depth?
3. How is it measured?
4. Should minimum cover be checked?
5. What role should `RoadwayWidthM` play in engineering calculations?
6. Is roadway width only a drawing/road geometry input?
7. What role should `SkewAngleDeg` play?
8. Should skew alter effective barrel length?
9. Should skew alter inlet/outlet geometry?
10. What engineering basis governs any skew correction?

**Decision:** ______________________________________

---

# 18. Structural / Geotechnical

1. How should multiple-pipe loading be calculated?
2. How should soil type affect loading?
3. How should bearing capacity be used?
4. What foundation/bedding design method applies?
5. What bedding classes are supported?
6. How is bedding factor selected?
7. What minimum Factor of Safety is required?
8. Which load classes are supported?
9. Which pipe crushing-capacity data are authoritative?
10. Are headwalls/wingwalls/aprons included in structural design scope?
11. Is scour/protection design included in the first release?

**Decision:** ______________________________________

---

# 19. Final Culvert Configuration

1. What properties belong in the authoritative final configuration?
2. Should it contain:
   - pipe diameter
   - number of pipes
   - barrel length
   - barrel slope
   - inlet invert
   - outlet invert
   - fill/cover
   - pipe class
   - bedding
   - inlet configuration
   - outlet configuration
   - tailwater
   - roadway geometry
3. Should calculation, DXF, 3D, BOQ and reports consume this same configuration?
4. At what point is the configuration frozen?
5. How is a revision-specific configuration preserved?
6. Can drawings be generated from a configuration different from the calculated revision?

**Decision:** ______________________________________

---

# 20. Drawings / BOQ

1. Which dimensions must come directly from final engineering results?
2. Which dimensions may come from standard details?
3. Which quantities must be calculated?
4. Which current hard-coded values must be eliminated?
5. Should pipe spacing be configurable?
6. Should barrel length come from final geometry?
7. Should invert levels come from final geometry?
8. Should headwall/wingwall/apron dimensions be engineering outputs?
9. Should BOQ quantities be revision-specific?
10. Should reports identify the calculation revision/configuration ID?

**Decision:** ______________________________________

---

# 21. Engineering Validation

1. What minimum and maximum values should be validated for every hydraulic input?
2. Should invalid engineering values block calculation?
3. Should warnings be different from hard errors?
4. Should unsupported configurations be blocked?
5. Should every assumption/default be visible to the engineer?
6. Should the calculation result record the input values used?

**Decision:** ______________________________________

---

# 22. Benchmark / Verification Cases

1. What approved hand calculations will be used as benchmark cases?
2. Who will verify them?
3. Should there be:
   - inlet-control benchmark
   - outlet-control benchmark
   - high-tailwater benchmark
   - low-tailwater benchmark
   - single-pipe benchmark
   - multiple-pipe benchmark
   - hydraulic-fail benchmark
   - structural-fail benchmark
4. What tolerance is acceptable between software and benchmark results?
5. Should benchmark cases become automated regression tests?

**Decision:** ______________________________________

---

# 23. Final Engineering Approval

Before implementation is considered engineering-ready, confirm:

- [ ] Governing standards identified
- [ ] Standard editions identified
- [ ] Hydrology basis approved
- [ ] Design discharge policy approved
- [ ] Circular-pipe scope defined
- [ ] Pipe catalogue basis approved
- [ ] Barrel length definition approved
- [ ] Inlet configuration taxonomy approved
- [ ] Tailwater definition approved
- [ ] Inlet-control method approved
- [ ] Outlet-control method approved
- [ ] Loss coefficients/methods approved
- [ ] Governing-control method approved
- [ ] Headwater acceptance approved
- [ ] Freeboard/overtopping criteria approved
- [ ] Velocity criteria approved
- [ ] Multiple-pipe treatment approved
- [ ] Invert/level source approved
- [ ] Structural/geotechnical basis approved
- [ ] Final configuration architecture approved
- [ ] Drawing/BOQ consistency requirements approved
- [ ] Benchmark cases approved

---

# Current Software Position

Based on the current code audit, CULVERT CAD currently provides:

- Rational-method or overridden design discharge
- Catalogue-based circular-pipe sizing
- Manning full-bore capacity
- One-to-four pipe trial
- Full-flow/design-flow velocity calculations
- Simplified headwater estimate
- Basic structural load/FOS calculation
- Basic DXF/3D/BOQ/report output

It does **not yet provide**:

- governing inlet/outlet control
- tailwater/HGL
- barrel friction in headwater
- exit loss
- freeboard/overtopping acceptance
- verified final inlet/outlet levels
- final authoritative culvert geometry
- complete multi-pipe structural treatment
- bearing/foundation adequacy
- fully engineering-driven construction drawings

These points should be treated as the starting audit position, not as approved engineering conclusions.
