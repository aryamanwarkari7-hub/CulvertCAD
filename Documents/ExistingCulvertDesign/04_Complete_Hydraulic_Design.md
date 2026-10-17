# Culvert Engineering Basics — Complete Hydraulic Design

## 8. Hydraulic Design — Overview

We now know:

- **Design discharge (Q)** → how much water must pass.
- **Survey information** → where the culvert is and its physical levels.
- **Design inputs** → pipe size, slope, length, etc.

The central hydraulic question is:

> **Can the proposed culvert safely convey the required design discharge without causing unacceptable upstream or downstream conditions?**

Hydraulic design therefore goes beyond simply calculating pipe capacity.

The overall hydraulic chain is:

```text
Design Discharge
       ↓
Proposed Culvert Arrangement
       ↓
Pipe Geometry + Slope + Roughness
       ↓
Hydraulic Capacity
       ↓
Flow Depth + Velocity
       ↓
Inlet / Outlet Conditions
       ↓
Head Losses
       ↓
Inlet Control / Outlet Control
       ↓
Headwater + Tailwater
       ↓
Outlet Velocity / Scour
       ↓
Road Overtopping / Allowable Water Level
       ↓
Hydraulic PASS / FAIL
       ↓
Modify Design if Required
       ↓
Final Hydraulic Arrangement
```

---

# 8.1 Hydraulic Capacity

A pipe has a **hydraulic capacity**: the amount of water it can carry under the assumed design conditions.

The basic requirement is:

$$
Q_{capacity} \geq Q_{design}
$$

where:

- **Qcapacity** = calculated capacity of the proposed culvert
- **Qdesign** = required design discharge

If:

```text
Qcapacity ≥ Qdesign
```

the proposed arrangement may be hydraulically adequate with respect to capacity.

If:

```text
Qcapacity < Qdesign
```

the arrangement is insufficient and must be reconsidered.

Capacity alone, however, is not the complete hydraulic check.

---

# 8.2 Factors Affecting Hydraulic Capacity

Important factors include:

- Pipe diameter
- Number of pipes/barrels
- Pipe slope
- Pipe roughness
- Flow depth
- Flow condition
- Inlet condition
- Outlet condition
- Tailwater condition
- Hydraulic losses

Conceptually:

```text
Pipe diameter
      +
Number of pipes
      +
Pipe slope
      +
Pipe roughness
      +
Flow condition
      +
Inlet / Outlet conditions
      ↓
Hydraulic behaviour
```

---

# 8.3 Manning's Equation

CulvertCAD uses **Manning's equation** for its hydraulic calculation.

The general form is:

$$
Q = \frac{1}{n} A R^{2/3} S^{1/2}
$$

where:

- **Q** = discharge
- **n** = Manning's roughness coefficient
- **A** = flow area
- **R** = hydraulic radius
- **S** = pipe/channel slope

Manning's equation connects the physical characteristics of the flow section with the discharge that can be conveyed under the assumed conditions.

---

# 8.4 Manning's Roughness Coefficient

The **Manning roughness coefficient (n)** represents resistance to flow caused by the surface.

A smoother surface generally offers less resistance than a rougher surface.

The appropriate value depends on the relevant pipe material and design assumptions.

Conceptually:

```text
Smoother surface
      ↓
Lower resistance

Rougher surface
      ↓
Higher resistance
```

---

# 8.5 Flow Area

**Flow area (A)** is the cross-sectional area occupied by water.

For a completely full circular pipe:

$$
A = \frac{\pi D^2}{4}
$$

where:

- **A** = flow area
- **D** = pipe diameter

Increasing pipe diameter increases the available cross-sectional area.

For partially full flow, the actual water-filled area must be used rather than automatically assuming the pipe is full.

---

# 8.6 Hydraulic Radius

The **hydraulic radius (R)** is:

$$
R = \frac{A}{P}
$$

where:

- **A** = flow area
- **P** = wetted perimeter

The **wetted perimeter** is the portion of the pipe boundary that is in contact with water.

Therefore, hydraulic radius depends on the actual flow condition.

---

# 8.7 Pipe Slope

The longitudinal pipe slope provides a driving force for gravity flow.

The basic relationship is:

$$
S = \frac{\Delta H}{L}
$$

where:

- **S** = slope
- **ΔH** = elevation difference
- **L** = length

For example:

$$
S = \frac{0.5}{25} = 0.02
$$

Therefore:

**Slope = 0.02 = 2%**

The pipe slope is important to the hydraulic calculation and is connected to the survey-derived levels and proposed invert levels.

---

# 8.8 Multiple Barrels

If one pipe cannot carry the required discharge, the engineer may consider multiple barrels.

Conceptually:

```text
Required Q
    ↓
Test pipe arrangement
    ↓
Calculate capacity
    ↓
Capacity sufficient?
    ├── Yes → Continue
    └── No  → Modify design
```

For example:

```text
1 × Pipe
    ↓
Capacity = Q₁

2 × Pipes
    ↓
Combined arrangement
    ↓
Hydraulic assessment
```

The exact hydraulic behaviour depends on the adopted design assumptions.

---

# 9. Flow Depth

A pipe's discharge capacity does not tell us everything about how water behaves inside it.

We also need to understand:

> **How deep is the water?**

**Flow depth** is the vertical depth of water inside the pipe.

A pipe does not necessarily operate completely full.

```text
       _________
     /           \
    |~~~~~~~~~~~~~| ← Water
    |             |
     \___________/
          ↑
       Flow depth
```

The flow condition may be:

- partially full
- full
- under pressure

Flow depth affects:

- Flow area
- Wetted perimeter
- Hydraulic radius
- Velocity
- Hydraulic capacity

Therefore, the hydraulic calculation must use the appropriate flow condition rather than assuming that every culvert operates completely full.

---

# 10. Flow Velocity

**Velocity** tells us how quickly water moves through the pipe.

The basic relationship is:

$$
V = \frac{Q}{A}
$$

where:

- **V** = flow velocity
- **Q** = discharge
- **A** = flow area

Common unit:

**m/s — metres per second**

## 10.1 Why Velocity Matters

Very high velocity can cause:

- erosion
- outlet scour
- damage to downstream drainage
- unstable flow conditions

Very low velocity can encourage:

- sediment deposition
- blockage
- reduced drainage effectiveness

Therefore, velocity needs to be checked against the applicable engineering design criteria.

## 10.2 Capacity and Velocity

For a given discharge:

```text
Smaller flow area
      ↓
Higher velocity

Larger flow area
      ↓
Lower velocity
```

This is one reason why selecting a larger pipe is not automatically the only or correct engineering solution.

---

# 11. Headwater Level

A pipe may have enough hydraulic capacity, but another question remains:

> **How high does the water rise on the upstream side while passing through the culvert?**

This is the **headwater** concept.

## 11.1 What is Headwater?

**Headwater** is the water level immediately upstream of the culvert.

```text
                 ROAD
====================================

       Upstream              Downstream

       ~~~~~~~~~
       ~~~~~~~~~  ← Headwater
       ~~~~~~~~~
          ↓
        ┌───────┐
        │ PIPE  │  →→→ Water
        └───────┘
```

## 11.2 Headwater vs Discharge

**Discharge (Q)** means:

> How much water is flowing.

**Headwater** means:

> How high the upstream water level becomes while that water is passing through the culvert.

They are different hydraulic quantities.

## 11.3 What Affects Headwater?

Headwater can depend on:

- Design discharge
- Pipe diameter
- Number of barrels
- Pipe slope
- Pipe length
- Inlet geometry
- Outlet conditions
- Hydraulic losses
- Downstream/tailwater conditions

Conceptually:

```text
DESIGN DISCHARGE
       +
PIPE SIZE
       +
PIPE GEOMETRY
       +
INLET / OUTLET
       +
FLOW LOSSES
       +
TAILWATER
       ↓
HEADWATER
```

## 11.4 Why Headwater Matters

An excessive upstream water level can cause:

- upstream flooding
- water overtopping the road
- excessive inundation
- damage to the road embankment
- adverse effects on nearby property or drainage

The engineer therefore needs to compare the calculated headwater with the applicable allowable/design water level.

```text
Calculated headwater
        ↓
Compare with
acceptable/design water level
        ↓
      PASS / FAIL
```

---

# 12. Inlet, Outlet and Head Losses

Headwater depends not only on the pipe itself, but also on what happens as water enters and leaves the culvert.

## 12.1 Inlet

The **inlet** is where water enters the culvert.

Water does not enter the pipe without resistance.

Inlet geometry affects how smoothly water enters the culvert.

Examples can include:

- Pipe entrance
- Headwall
- Wingwalls
- Bevelled or improved inlet arrangements

The important engineering idea is:

> **The inlet can restrict flow and therefore contribute to upstream headwater.**

## 12.2 Outlet

The **outlet** is where water leaves the culvert.

The outlet must discharge water into the downstream drainage system without unacceptable effects.

Important considerations can include:

- Outlet water velocity
- Downstream water level
- Erosion/scour
- Outlet protection

## 12.3 Head Loss

As water flows through the culvert, some available hydraulic energy/head is lost because of resistance.

This is called **head loss**.

```text
Upstream energy
      ↓
   INLET LOSS
      ↓
   PIPE FRICTION
      ↓
   OUTLET LOSS
      ↓
Downstream energy
```

## 12.4 Sources of Head Loss

### Entrance Loss

Loss that occurs when water enters the pipe.

### Friction Loss

Resistance between flowing water and the pipe surface.

It is affected by:

- Pipe length
- Pipe roughness
- Flow conditions

### Exit Loss

Loss associated with water leaving the pipe and entering the downstream environment.

## 12.5 Why Head Loss Matters

Two culverts with the same:

- diameter
- slope
- discharge

may still have different hydraulic behaviour if they have different:

- pipe lengths
- inlet arrangements
- outlet conditions

Therefore:

> **The hydraulic performance of a culvert depends on the complete flow system, not just the pipe diameter.**

---

# 13. Inlet Control vs Outlet Control

A culvert can operate primarily under either:

- **Inlet control**
- **Outlet control**

This tells us what is controlling the flow through the culvert.

## 13.1 Inlet Control

Under **inlet control**, the restriction at the entrance of the culvert primarily controls the flow.

```text
UPSTREAM
~~~~~~~~~~~~~~
       ↓
     INLET
       ↓
   ┌─────────┐
   │  PIPE   │────────→
   └─────────┘
```

The pipe downstream may have sufficient capacity, but the water cannot enter the culvert quickly enough.

Therefore:

> **The inlet controls the hydraulic performance.**

Factors can include:

- Inlet geometry
- Pipe diameter
- Inlet shape
- Headwater
- Entrance conditions

## 13.2 Outlet Control

Under **outlet control**, the conditions through the entire culvert system primarily control the flow.

These can include:

- Pipe length
- Pipe slope
- Pipe roughness
- Pipe diameter
- Inlet losses
- Friction losses
- Outlet losses
- Tailwater level

Therefore:

> **The overall hydraulic system controls the performance.**

## 13.3 Why Both Matter

```text
             CULVERT
                ↓
       Evaluate flow conditions
                ↓
       ┌────────┴────────┐
       ↓                 ↓
 INLET CONTROL      OUTLET CONTROL
       ↓                 ↓
 Entrance governs    System governs
       └────────┬────────┘
                ↓
        Hydraulic assessment
```

The same pipe diameter can behave differently depending on inlet conditions, pipe geometry, downstream conditions, and other losses.

## 13.4 Why This Matters to CulvertCAD

Conceptually:

```text
Design Q
   ↓
Proposed culvert
   ↓
Hydraulic analysis
   ↓
Determine controlling condition
   ↓
Inlet Control / Outlet Control
   ↓
Calculate resulting hydraulic condition
   ↓
Check against design criteria
   ↓
PASS / FAIL
```

This is relevant because hydraulic adequacy depends on identifying the controlling condition.

---

# 14. Tailwater and Downstream Conditions

**Tailwater** is the downstream counterpart to **headwater**.

## 14.1 What is Tailwater?

**Tailwater** is the water level immediately downstream of the culvert.

```text
             ROAD
====================================

UPSTREAM                         DOWNSTREAM
~~~~~~~~~                         ~~~~~~~~~
 HEADWATER                         TAILWATER
     ↓                                 ↑
     │                                 │
     └───────┌─────────────┐───────────┘
             │    PIPE     │
             └─────────────┘
                    →
                  FLOW
```

## 14.2 Headwater vs Tailwater

| Term | Location | Meaning |
|---|---|---|
| **Headwater** | Upstream | Water level before entering the culvert |
| **Tailwater** | Downstream | Water level after leaving the culvert |

```text
UPSTREAM                         DOWNSTREAM
   ↓                                 ↓
Headwater                         Tailwater
   ↓                                 ↓
┌─────────────────────────────────────────┐
│                  PIPE                   │
└─────────────────────────────────────────┘
                    →
                  FLOW
```

## 14.3 Why Tailwater Matters

The downstream water level can affect how easily water can leave the pipe.

If the downstream water level is low:

```text
Pipe →→→→→→→
             ↓
          Free outlet
```

If the downstream water level is high:

```text
Pipe →→→→→
         ~~~~~~~~~
         Tailwater
```

The outlet becomes more submerged, increasing downstream resistance.

This can influence:

- Outlet control
- Flow depth
- Headwater
- Hydraulic capacity
- Outlet velocity

## 14.4 CulvertCAD Relationship

```text
             HEADWATER
                 ↓
              INLET
                 ↓
          ┌───────────┐
          │   PIPE    │ →→ FLOW
          └───────────┘
                 ↓
               OUTLET
                 ↓
             TAILWATER
```

> **Headwater describes the upstream condition; tailwater describes the downstream condition. Both can influence the hydraulic behaviour of the culvert.**

---

# 15. Critical Depth and Normal Depth — Supporting Concepts

These are useful engineering concepts for understanding hydraulic behaviour, but they do not necessarily need to become separate user inputs in CulvertCAD.

## 15.1 Critical Depth

**Critical depth** is the flow depth associated with the critical-flow condition.

It is relevant around hydraulic control sections and flow transitions.

## 15.2 Normal Depth

**Normal depth** is the flow depth associated with approximately uniform flow conditions.

It depends on:

- Discharge
- Geometry
- Slope
- Roughness

The distinction is:

| Term | Basic meaning |
|---|---|
| **Critical depth** | Depth associated with critical-flow conditions |
| **Normal depth** | Depth associated with uniform-flow conditions |

For our project, these should be treated primarily as **calculated/supporting hydraulic concepts**, rather than automatically as separate design inputs.

---

# 16. Outlet Velocity and Scour

The culvert does not end when water exits the pipe.

The discharged water enters the downstream channel or ground.

If the outlet velocity is too high for the downstream conditions, it can cause **scour**.

**Scour** means erosion or removal of soil/material caused by flowing water.

Conceptually:

```text
PIPE
┌──────────────┐
│              │ →→→→ High velocity
└──────────────┘
                     ↓
                 OUTLET
                     ↓
              Downstream soil
              ~~~~~~~~~~~~~~~
                  erosion
```

Therefore, the engineer needs to consider:

- Outlet velocity
- Downstream channel condition
- Soil/material susceptibility
- Need for outlet protection

Possible protection measures may include appropriate energy dissipation or structural protection, depending on the design.

The exact acceptable velocity and protection requirement must come from the applicable engineering criteria.

---

# 17. Road Overtopping and Allowable Upstream Water Level

A road-crossing culvert must be checked against the road level.

Conceptually:

```text
             ROAD LEVEL
====================================

          ~~~~~~~~~~~~~~~
          HEADWATER LEVEL
          ~~~~~~~~~~~~~~~

              ↓
           ┌─────┐
           │PIPE │
           └─────┘
```

The important question is:

> **Does the calculated upstream water level remain within the permitted/design limit relative to the road?**

If the water level becomes too high:

```text
Headwater
    ↓
Approaches road level
    ↓
Potential overtopping
    ↓
Hydraulic design may FAIL
```

This is why headwater is not just a theoretical calculation.

It can directly affect **road safety and drainage performance**.

---

# 18. Hydraulic Adequacy — PASS / FAIL

At the end of the hydraulic analysis, the proposed culvert must be assessed against the applicable design criteria.

The checks can conceptually include:

```text
Required discharge
        ↓
Capacity check
        ↓
Flow depth check
        ↓
Velocity check
        ↓
Headwater check
        ↓
Tailwater / outlet condition
        ↓
Inlet / outlet control
        ↓
Outlet velocity / scour
        ↓
Road overtopping / allowable level
        ↓
HYDRAULIC ASSESSMENT
```

The result should be something the application can clearly communicate:

```text
HYDRAULIC RESULT

Capacity       → PASS / FAIL
Velocity       → PASS / FAIL
Headwater      → PASS / FAIL
Outlet         → PASS / FAIL
Scour          → PASS / FAIL
Road level     → PASS / FAIL

Overall Hydraulic Status
               → PASS / FAIL
```

The exact checks and acceptance limits must be tied to the project's adopted standards and engineering rules.

---

# 19. Hydraulic Design Iteration

Hydraulic design is not necessarily a one-time calculation.

If the proposed arrangement fails, the engineer modifies the design.

For example:

```text
             DESIGN INPUTS
                   ↓
            Hydraulic analysis
                   ↓
              PASS / FAIL
                   ↓
          ┌────────┴────────┐
          ↓                 ↓
        PASS              FAIL
          ↓                 ↓
    Continue to       Modify design
    next checks            ↓
                    Recalculate
                          ↓
                    PASS / FAIL
```

Possible design changes may include:

- Pipe diameter
- Number of barrels
- Pipe slope
- Inlet arrangement
- Outlet arrangement
- Other applicable design parameters

The system should preserve the calculation result and allow the engineer to understand **why** a design passed or failed.

---

# 20. What Hydraulic Design Means for CulvertCAD

At the software level, hydraulic design can be understood as:

```text
ENGINEERING INPUTS
       ↓
Hydraulic Calculation Engine
       ↓
Calculated Hydraulic Results
       ↓
Engineering Checks
       ↓
Warnings / Errors / PASS-FAIL
       ↓
Design Decision
```

### Inputs

Typical hydraulic inputs may include:

- Design discharge
- Pipe diameter
- Number of pipes
- Pipe length
- Pipe slope
- Roughness
- Inlet information
- Outlet information
- Downstream/tailwater information
- Other applicable site/design parameters

### Calculated Results

The system may calculate:

- Hydraulic capacity
- Flow depth
- Velocity
- Headwater
- Tailwater-related conditions
- Head losses
- Controlling condition
- Outlet velocity
- Hydraulic adequacy

### Engineering Decision

The final question is:

> **Does the proposed culvert hydraulically satisfy the design requirements?**

---

# 21. Complete Hydraulic Design Flow

```text
                    DESIGN DISCHARGE (Q)
                             ↓
                    SELECT CULVERT TYPE
                             ↓
                PIPE DIAMETER / BARRELS
                             ↓
                    PIPE LENGTH / SLOPE
                             ↓
                     ROUGHNESS / n
                             ↓
                     FLOW CONDITIONS
                             ↓
                    MANNING CALCULATION
                             ↓
                    HYDRAULIC CAPACITY
                             ↓
                     FLOW DEPTH / AREA
                             ↓
                         VELOCITY
                             ↓
                    INLET CONDITIONS
                             ↓
                     HEAD LOSSES
                             ↓
                INLET / OUTLET CONTROL
                             ↓
                       HEADWATER
                             ↓
                       TAILWATER
                             ↓
                    OUTLET VELOCITY
                             ↓
                       SCOUR CHECK
                             ↓
                 ROAD OVERTOPPING CHECK
                             ↓
                   HYDRAULIC PASS / FAIL
                             ↓
                 ┌───────────┴───────────┐
                 ↓                       ↓
               PASS                    FAIL
                 ↓                       ↓
        Continue design            Modify inputs
                                         ↓
                                   Recalculate
                                         ↓
                                   PASS / FAIL
```

## Core Understanding

The hydraulic design is fundamentally answering four questions:

1. **Can the culvert carry the required water?**
2. **What happens to the water level upstream and downstream?**
3. **Is the resulting flow behaviour acceptable?**
4. **If not, what needs to change in the culvert design?**

> **Hydraulic design is therefore a calculation-and-check process, not merely a pipe-capacity calculation.**
