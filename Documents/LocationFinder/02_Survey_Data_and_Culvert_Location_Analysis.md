# Culvert Engineering Basics — Sections 4, 5 and 6

## 4. What Information Does the Engineer Need at the Culvert Location?

Now that we understand **where the water comes from** and **how the design event is defined**, we need to know the **physical conditions at the actual culvert location**.

This is where **survey data** becomes important.

A survey tells the engineer what the ground and road look like in terms of measurable coordinates and elevations.

### 4.1 Chainage

**Chainage** identifies a position along the road alignment.

For example:

```text
Road alignment

0 m ───── 100 m ───── 200 m ───── 300 m ─────→

                         ↑
                    Culvert location
                       Chainage
                        235 m
```

If a culvert is at:

**Chainage = 235 m**

it means the culvert location is 235 metres along the defined road alignment.

Chainage answers:

> **Where along the road is the culvert?**

### 4.2 RL — Reduced Level

**RL (Reduced Level)** is the elevation of a point relative to a chosen reference datum.

For example:

```text
Point A → RL = 101.250 m
Point B → RL = 100.800 m
```

RL tells us the **elevation/height** of a point.

A survey point can therefore have:

```text
Chainage → 235 m
RL       → 101.250 m
```

These tell us:

- **where** the point is along the road
- **how high** the point is

### 4.3 Existing Ground Level

The survey gives us the existing ground condition.

This is commonly referred to as:

**Existing Ground Level (EGL)**

or simply the existing ground RL at a location.

The engineer needs this because the culvert will be constructed **within and below the existing ground/road formation**.

### 4.4 Road Level

The road itself has a designed or existing elevation.

This is important because the culvert must pass underneath the road while maintaining the required road geometry.

The vertical relationship can be viewed as:

```text
Road Level
     ↓
Ground / Embankment
     ↓
Pipe
     ↓
Pipe invert
```

### 4.5 Invert Level

**Invert** means the **lowest internal level of a pipe or channel**.

For a circular pipe:

```text
       Pipe
     _________
   /             |             |
  |             |
   \_____↓_____/
         ↑
       Invert
```

The **invert level** is important because it defines where the water passage sits vertically.

For example:

```text
Road RL       = 102.500 m
Pipe invert   = 100.200 m
```

Difference:

**2.300 m**

This tells the engineer the vertical position of the culvert relative to the road.

### 4.6 Pipe Slope

A pipe generally needs a longitudinal slope so that water can flow through it.

The basic relationship is:

$$
S = \frac{\Delta H}{L}
$$

where:

- **S** = slope
- **ΔH** = difference in elevation
- **L** = length

For example, if the invert falls by 0.5 m over 25 m:

$$
S = \frac{0.5}{25} = 0.02
$$

Therefore:

**Slope = 0.02 = 2%**

This slope later becomes important in **hydraulic capacity calculations**.

### 4.7 Why Survey Data Matters to CulvertCAD

The intended workflow is:

```text
SURVEY DATA
     ↓
Import survey
     ↓
Analyse survey
     ↓
Identify relevant locations
     ↓
Review detected culvert locations
     ↓
Create design
```

The survey provides the **physical context** in which the culvert must be designed.

### 4.8 The Basic Survey Picture

A culvert has both a **horizontal position** and a **vertical position**.

#### Horizontal

```text
Road alignment
──────────────────────────────→

              ↑
           Chainage
             235 m
```

#### Vertical

```text
          Road Level
────────────────────────

       Ground / fill

          ________
        /                 |   PIPE     |
       |____________|
            ↑
          Invert
```

Together:

```text
CHAINAGE
   +
ELEVATIONS / RLs
   +
GROUND / ROAD INFORMATION
   ↓
PHYSICAL LOCATION OF CULVERT
```

### Important Terms

| Term | Meaning |
|---|---|
| **Survey** | Measurement of the physical site |
| **Chainage** | Position along the road alignment |
| **RL** | Elevation relative to a reference datum |
| **EGL** | Existing Ground Level |
| **Road Level** | Elevation of the road/formation |
| **Invert Level** | Lowest internal level of the pipe |
| **Slope** | Rate of elevation change along the pipe |

The key idea is:

> **Hydrology tells us how much water we need to carry, while survey data tells us the physical conditions in which we must carry it.**

---

## 5. Survey Data and Culvert Location Codes

The next step is to understand **what is actually inside the survey data** that CulvertCAD receives.

A survey CSV is not just a list of random coordinates. It contains **survey observations** that describe important features along the road and surrounding terrain.

A simplified survey record might contain:

```text
Chainage | RL     | Code
---------|--------|------
120.00   | 98.420 | C
120.00   | 98.610 | L
120.00   | 98.570 | R
```

The important idea is:

> **The numerical values tell us where and how high a point is; the code tells us what that point represents.**

### 5.1 Why Codes Are Needed

Suppose the survey contains 1,000 points.

CulvertCAD cannot treat every point identically.

It needs to distinguish between:

- Ground point
- Road centre
- Left edge
- Right edge
- Existing culvert
- Bridge
- Track
- Junction
- Other surveyed features

The **code** provides that meaning.

```text
Survey Point
     │
     ├── Chainage
     ├── RL
     └── Code
            ↓
      What does this point represent?
```

### 5.2 Survey Codes Used by CulvertCAD

The system recognizes codes including:

| Code | Meaning / Feature |
|---|---|
| `C` | Centre |
| `L` | Left |
| `R` | Right |
| `ex cd` | Existing culvert |
| `TBM` | Temporary Bench Mark |
| `Bridge` | Bridge |
| `Str` | Structure |
| `FN` | Fence |
| `Tr` | Track |
| `JR` | Junction |
| `EP` | Edge Point |

These codes allow the survey-processing system to identify features that may be relevant to culvert identification and design.

### 5.3 Centre, Left and Right Points

The codes `C`, `L`, and `R` are particularly useful for understanding the road geometry.

Conceptually:

```text
             L
             ●
             │
             │
C ●──────────┼──────────● R
             │
             │
```

They can help describe the position of the road or surveyed corridor.

For example:

- `C` = Centre point
- `L` = Left-side point
- `R` = Right-side point

The actual interpretation depends on the survey convention used by the project.

### 5.4 Existing Culvert

The code:

`ex cd`

identifies an **existing culvert** in the survey data.

This is important because the engineer may need to know whether a drainage structure already exists at a location.

Conceptually:

```text
Survey
   ↓
ex cd detected
   ↓
Existing culvert location
   ↓
Engineer reviews existing condition
```

This is different from automatically saying:

> "Build a new culvert here."

It identifies an existing feature that needs to be considered.

### 5.5 TBM — Temporary Bench Mark

**TBM** means **Temporary Bench Mark**.

It is a survey reference point with a known elevation.

It provides a reference from which other elevations can be established.

This matters because RL values only become meaningful when they are tied to a defined elevation reference/datum.

### 5.6 Other Feature Codes

The remaining codes identify physical features that may help describe the surveyed environment:

- `Bridge` → bridge location
- `Str` → structure
- `FN` → fence
- `Tr` → track
- `JR` → junction
- `EP` → edge point

These features provide **context around the road and drainage system**.

### 5.7 From CSV to Engineering Information

The next part of the CulvertCAD workflow is:

```text
SURVEY CSV
    ↓
Read survey records
    ↓
Read Chainage + RL + Code
    ↓
Interpret survey features
    ↓
Identify relevant locations
    ↓
Present detected culvert locations
    ↓
Engineer reviews them
```

This is important because CulvertCAD is not simply storing the CSV.

It is **extracting engineering meaning from the survey data**.

### Foundation

```text
HYDROLOGY
    ↓
How much water?
    ↓
Design Discharge (Q)

SURVEY
    ↓
Where is the culvert?
    ↓
What are the physical levels and features?
```

---

## 6. Survey Analysis — From Survey Points to a Potential Culvert Location

We now have two separate pieces of information:

```text
HYDROLOGY
    ↓
How much water?
    ↓
Design Discharge (Q)

SURVEY
    ↓
Where is the drainage location?
    ↓
Ground / road / feature information
```

**Survey Analysis** connects the survey data to a possible engineering location.

### 6.1 What is Survey Analysis?

Survey analysis means taking the imported survey observations and determining what they tell us about the **road corridor and drainage conditions**.

It is not yet the hydraulic or structural design.

At this stage, the system is mainly asking:

> **"Where are the locations that may require a culvert?"**

### 6.2 Raw Survey vs Analysed Survey

The imported CSV may contain many individual observations:

```text
Point 1 → Chainage, RL, Code
Point 2 → Chainage, RL, Code
Point 3 → Chainage, RL, Code
...
Point 1000
```

The engineer does not want to manually inspect every row.

CulvertCAD processes the data:

```text
CSV
 ↓
Parse survey records
 ↓
Interpret codes
 ↓
Group / analyse locations
 ↓
Detect relevant drainage features
 ↓
Potential culvert locations
```

### 6.3 Why Location Detection Matters

Suppose the survey contains:

```text
Chainage 100 m
Chainage 105 m
Chainage 110 m
...
Chainage 420 m
```

A potential drainage crossing may occur around:

```text
Chainage = 275 m
```

The system can identify that location for the engineer to review.

The important distinction is:

> **Detection is not approval.**

CulvertCAD should present a detected location as something for the engineer to **review**, not blindly convert every detected feature into a new culvert design.

### 6.4 Existing Culvert vs New Design

If the survey contains:

```text
ex cd
```

the survey indicates an **existing culvert**.

That does not automatically mean:

```text
ex cd
 ↓
Create new culvert
```

Instead:

```text
Existing feature detected
        ↓
Engineer reviews it
        ↓
Determine what should happen
```

The existing structure may need to be:

- retained
- replaced
- modified
- investigated further

The decision belongs to the engineering workflow.

### 6.5 Survey Analysis Output

The output of this stage should be something the engineer can understand and review.

Conceptually:

```text
SURVEY ANALYSIS
      ↓
Detected location
      ↓
Chainage
      ↓
Relevant survey information
      ↓
Feature / code
      ↓
Engineer review
```

For example:

```text
Potential Culvert Location

Chainage: 275 m
RL:       101.20 m
Feature:  Drainage crossing
Status:   Detected
```

The exact fields shown by CulvertCAD depend on the implementation.

### 6.6 Why This Matters for the Overall Workflow

The application begins with a **survey**, rather than immediately asking the engineer to create a culvert.

The workflow is:

```text
PROJECT
   ↓
SURVEY
   ↓
SURVEY ANALYSIS
   ↓
POTENTIAL CULVERT LOCATION
   ↓
ENGINEER REVIEW
   ↓
CREATE CULVERT DESIGN
```

The survey establishes **where** the engineering problem exists.

Hydrology establishes **how much water** the problem involves.

Only after these are understood do we move into the actual **culvert design**.

### Current Foundation

```text
             CULVERT PROBLEM
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
    HYDROLOGY                 SURVEY
        │                       │
  How much water?          Where is it?
        │                       │
 Design Discharge Q       Location + Levels
        │                       │
        └───────────┬───────────┘
                    ▼
          POTENTIAL CULVERT
             LOCATION
                    ↓
             ENGINEER REVIEW
                    ↓
            CULVERT DESIGN
```
