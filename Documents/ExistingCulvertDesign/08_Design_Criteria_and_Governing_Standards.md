# 33. Design Criteria and Governing Standards

## 1. Purpose

Engineering calculations are not valid simply because a formula produces a number.

The calculation must use the **correct design criteria and applicable standards**.

CulvertCAD therefore needs a clearly defined **design basis**.

## 2. Design Basis

The design basis should identify:

- Applicable standards
- Applicable standard editions
- Design assumptions
- Load models
- Hydraulic criteria
- Structural criteria
- Material requirements
- Safety/load factors
- Acceptance criteria

## 3. Project Standards

The project context identifies:

- **IS 783** — laying of concrete pipes
- **IS 458** — precast concrete pipes
- **IRC:SP:13** — small bridges and culverts
- **IRC:89** — relevant project-specific reference

The exact edition applicable to the project must be verified before implementation.

## 4. Why Edition Matters

Standards are revised.

Therefore:

```text
Standard name
     +
Edition
     +
Applicable project requirement
     ↓
Design rule
```

CulvertCAD should not silently mix provisions from different editions.

## 5. Engineering Rule Hierarchy

The system should conceptually follow:

```text
Project specification
        ↓
Applicable governing standard
        ↓
Design method
        ↓
Calculation parameters
        ↓
Acceptance criteria
```

Where two requirements conflict, the responsible engineering authority must determine the governing requirement.

## 6. Design Criteria Examples

Hydraulic criteria may define:

- Design discharge
- Allowable headwater
- Velocity criteria
- Overtopping criteria
- Scour/protection criteria

Structural criteria may define:

- Load models
- Load factors
- Material strength
- Pipe class
- Reinforcement requirements
- Stability criteria

## 7. CulvertCAD Implementation

Standards should not be scattered randomly through controller code.

A better conceptual arrangement is:

```text
Design Standard / Rules
        ↓
Calculation Service
        ↓
Calculated Results
        ↓
Engineering Checks
```

This makes the calculation engine easier to test and maintain.

## 8. Traceability

Every important calculated result should ideally be traceable to:

- Input
- Formula/method
- Standard/design rule
- Intermediate result
- Final result

Example:

```text
Design Q
   ↓
Hydraulic formula
   ↓
Capacity
   ↓
Acceptance criterion
   ↓
PASS / FAIL
```

> **A strong engineering application must be able to explain not only the result, but also the design basis behind the result.**
