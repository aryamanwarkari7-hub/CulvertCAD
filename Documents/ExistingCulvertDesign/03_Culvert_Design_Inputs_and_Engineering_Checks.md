# Culvert Engineering Basics — Section 7

## 7. From a Selected Location to a Culvert Design

Once the engineer reviews and accepts a potential culvert location, we can finally move from **"where is the problem?"** to **"how should we design the culvert?"**

The key idea is:

> **A culvert design is a collection of engineering inputs used to determine a safe and suitable culvert arrangement.**

At this stage, we need information from several categories.

### 7.1 Hydraulic Inputs

We already established that the culvert must carry a required **Design Discharge (Q)**.

Important hydraulic inputs can include:

- Design discharge
- Catchment information
- Rainfall/design event information
- Pipe slope
- Pipe diameter
- Number of pipes
- Hydraulic characteristics

Conceptually:

```text
Design Discharge (Q)
        +
Pipe Geometry
        +
Pipe Slope
        ↓
Hydraulic Calculation
        ↓
Can the proposed culvert carry Q?
```

### 7.2 Geometric / Site Inputs

The engineer also needs to describe where the culvert will physically be installed.

This can include:

- Chainage
- Road level
- Existing ground level
- Inlet level
- Outlet level
- Pipe invert levels
- Culvert length
- Longitudinal slope

These define the physical arrangement:

```text
             ROAD
================================

        ← Culvert length →

       ┌─────────────────┐
       │      PIPE       │
       └─────────────────┘
        ↑               ↑
      Inlet           Outlet
      invert          invert
```

### 7.3 Structural Inputs

The pipe is buried below the road, so it is subjected to loads.

Important inputs can include:

- Soil/earth cover
- Soil properties
- Traffic/live load
- Bedding conditions
- Pipe class/strength
- Installation conditions

The basic question is:

> **Can the pipe safely withstand the loads acting on it?**

```text
             ROAD TRAFFIC
                 ↓
        =================
                 ↓
             EARTH FILL
                 ↓
        ─────────────────
                 ↓
              ┌─────┐
              │PIPE │
              └─────┘
                 ↑
               BEDDING
```

### 7.4 Pipe Selection

The engineer then needs to select an appropriate pipe arrangement.

This can involve:

- Pipe material
- Pipe diameter
- Number of barrels
- Pipe class/strength
- Bedding arrangement

For example:

```text
Required discharge
       ↓
Possible pipe arrangements
       ↓
┌──────────────────────┐
│ 1 × 900 mm pipe      │
│ 2 × 750 mm pipes     │
│ 2 × 900 mm pipes     │
└──────────────────────┘
       ↓
Hydraulic + structural checks
       ↓
Suitable arrangement
```

The important point is that **pipe selection is an engineering decision based on the calculations**, not simply a user choosing an arbitrary diameter.

### 7.5 Why CulvertCAD Separates the Inputs

The application needs to distinguish between:

```text
HYDROLOGY
    ↓
Water requirement

SITE / SURVEY
    ↓
Physical location

HYDRAULICS
    ↓
Water-carrying capacity

STRUCTURAL
    ↓
Load resistance

PIPE SELECTION
    ↓
Final arrangement
```

These eventually come together to produce the design.

### 7.6 The Design Input → Calculation Relationship

The overall idea is:

```text
                 DESIGN INPUTS
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
   HYDROLOGY        SURVEY       STRUCTURAL
       │              │              │
       ▼              ▼              ▼
Discharge Q      Site Levels      Loads
       │              │              │
       └──────────────┼──────────────┘
                      ▼
              CULVERT CALCULATION
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
      HYDRAULIC               STRUCTURAL
       CHECK                    CHECK
          │                       │
          └───────────┬───────────┘
                      ▼
               DESIGN RESULT
```

The next major concept is **Hydraulic Design**: how we determine whether a pipe can actually carry the required design discharge.
