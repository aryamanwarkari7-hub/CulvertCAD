# Culvert Engineering Basics

## 1. What is a Culvert?

A **culvert** is a structure that allows **water to pass underneath an obstruction**, most commonly a road, railway, or embankment.

The basic purpose is:

> **Allow water to cross underneath a road or embankment without damaging the road.**

A road can block the natural drainage path:

```text
Natural drainage:

Water → → → → →

After road construction:

              ROAD
        =================
Water →→→   █████████   ← blocked
            █████████
```

A culvert provides a controlled passage:

```text
              ROAD
================================
              │
Water →→→→→  ═══════  →→→→→
              │
================================
```

### Pipe Culvert

A **pipe culvert** uses one or more pipes.

- 1 pipe → single-barrel culvert
- 2 pipes → two-barrel culvert
- 3 pipes → three-barrel culvert

The engineer needs to determine an appropriate arrangement such as:

- Pipe diameter
- Number of pipes
- Installation level
- Other structural/design requirements

The selection cannot be arbitrary. It must satisfy two fundamental requirements:

```text
                 CULVERT DESIGN
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        Can water pass?     Can structure survive?
             │                   │
          HYDRAULICS          STRUCTURAL
```

### Hydraulics

**Hydraulics** deals with the movement of water.

It considers things such as:

- How much water is coming
- How much water the culvert can carry
- Water velocity
- Water levels

### Structural Design

**Structural design** deals with whether the culvert can withstand the loads acting on it.

For a pipe culvert, these can include:

- Soil/earth load
- Traffic/live load
- Other structural effects

### Design Discharge

The first major hydraulic quantity we eventually need is **Design Discharge (Q)**.

**Discharge** means the volume of water flowing through a section per unit time.

Common unit:

**m³/s — cubic metres per second**

Example:

`Q = 2.0 m³/s`

This means approximately 2 cubic metres of water must pass every second under the design condition.

---

## 2. Where Does the Water Come From?

Before selecting the culvert size, the engineer needs to determine:

> **How much water can reach the culvert during the design event?**

This leads to **catchment** and **hydrology**.

### Catchment

A **catchment** is the area of land from which rainfall flows toward a particular drainage point.

```text
        Hill              Hill
       /    \            /    \
      /      \          /      \
     /        \        /        \
    /          \______/          \
                 ↓
              Culvert
                 ↓
               Road
```

The land contributing water to that point is the **catchment area**.

It is commonly represented by:

**A = catchment area**

Typical units:

- hectares (ha)
- square kilometres (km²)

### Rainfall → Runoff

Not all rainfall reaches the culvert.

Some water:

- infiltrates into the ground
- evaporates
- is stored temporarily
- remains in surface depressions
- is intercepted by vegetation

Conceptually:

```text
RAINFALL
   ↓
Catchment
   ↓
Some water is lost/stored
   ↓
RUNOFF
   ↓
CULVERT
```

### Runoff Coefficient

A simplified way of representing the portion of rainfall contributing to runoff is the **runoff coefficient**, represented by:

**C**

For example:

`C = 0.60`

The actual value depends on the characteristics of the catchment.

### Rainfall Intensity

The engineer also needs to know **how intensely it rains**.

This is called **rainfall intensity**, represented by:

**I**

A common unit is:

**mm/hour**

For culvert design, the relevant rainfall intensity is associated with the selected **design event**.

### Design Discharge

The three important quantities are:

- Catchment area → **A**
- Runoff coefficient → **C**
- Rainfall intensity → **I**

CulvertCAD's calculation service uses the simplified **Rational Method**:

$$
Q = \frac{C \times I \times A}{360}
$$

for its relevant input units.

The result is:

**Q = Design Discharge**

measured in:

**m³/s**

The basic chain is:

```text
CATCHMENT
    ↓
Area (A)
    +
Rainfall intensity (I)
    +
Runoff coefficient (C)
    ↓
RUNOFF CALCULATION
    ↓
DESIGN DISCHARGE (Q)
    ↓
HYDRAULIC DESIGN
```

This explains why CulvertCAD's design inputs include:

- Catchment Area
- Rainfall Intensity
- Runoff Coefficient
- Design Discharge
- Return Period
- Hydrological Method

These describe the **hydrological problem that the culvert must handle**.

---

## 3. Return Period

Now we ask:

> **How severe a rainfall event should the culvert be designed to handle?**

This is where **Return Period** comes in.

### What is Return Period?

The **return period** is a statistical way of describing the frequency of a rainfall or flood event of a particular magnitude.

It is expressed in **years**.

Examples:

- 10-year event
- 25-year event
- 50-year event
- 100-year event

A **50-year event** does **not** mean that it happens exactly once every 50 years.

It means the event has an approximate:

**1/50 = 2% annual probability**

of being equalled or exceeded in any particular year.

### Annual Exceedance Probability

This is called **Annual Exceedance Probability (AEP)**.

$$
P = \frac{1}{T}
$$

where:

- **P** = annual probability of exceedance
- **T** = return period in years

| Return Period | Annual Exceedance Probability |
|---:|---:|
| 10 years | 10% |
| 25 years | 4% |
| 50 years | 2% |
| 100 years | 1% |

### Why Does Return Period Matter?

Not every road has the same consequences if flooding occurs.

The appropriate design event depends on the applicable engineering criteria and the importance/consequences associated with the road and drainage structure.

The general relationship is:

```text
RETURN PERIOD
      ↓
Select appropriate rainfall data
      ↓
Rainfall intensity
      ↓
Hydrological calculation
      ↓
DESIGN DISCHARGE (Q)
      ↓
HYDRAULIC DESIGN
```

Generally, a higher design return period corresponds to a more severe design rainfall event, which can result in:

```text
Higher rainfall intensity
        ↓
Higher design discharge
        ↓
Higher hydraulic requirement
        ↓
Potentially larger/more pipe barrels
```

However:

> **Return period itself does not directly size the pipe.**

It is part of establishing the **design rainfall and ultimately the design discharge**.

### Current Foundation

```text
CATCHMENT
    ↓
Catchment Area (A)
    +
RAINFALL
    ↓
Return Period
    ↓
Rainfall Intensity (I)
    +
Runoff Coefficient (C)
    ↓
HYDROLOGICAL CALCULATION
    ↓
DESIGN DISCHARGE (Q)
    ↓
HYDRAULIC DESIGN
```
