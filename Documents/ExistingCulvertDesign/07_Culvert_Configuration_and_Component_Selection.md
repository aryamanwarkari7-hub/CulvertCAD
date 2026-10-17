# 32. Culvert Configuration and Component Selection

## 1. Purpose

After hydrology and hydraulic analysis establish the required water conveyance, the engineer must define the actual culvert arrangement.

This is the **configuration** of the culvert.

## 2. Main Configuration Decisions

Typical decisions include:

- Pipe diameter
- Number of barrels
- Pipe length
- Pipe alignment
- Pipe slope
- Inlet arrangement
- Outlet arrangement
- Headwall requirement
- Wingwall requirement
- Apron/protection requirement
- Cutoff/protection requirement

## 3. Single vs Multiple Barrel

```text
Required discharge
        ↓
Evaluate one pipe
        ↓
Capacity sufficient?
   ┌────┴────┐
   ↓         ↓
 YES         NO
   ↓         ↓
Continue   Increase size /
           add barrels
```

The selected arrangement must satisfy both hydraulic and structural requirements.

## 4. Pipe Diameter

Diameter affects:

- Hydraulic capacity
- Flow velocity
- Headwater
- Structural loading
- Construction requirements
- Cost

Therefore, diameter should be selected through an engineering iteration rather than as an isolated input.

## 5. Pipe Length and Alignment

Pipe length is influenced by:

- Road width
- Embankment geometry
- Side slopes
- Culvert skew
- Inlet/outlet location
- Survey levels

The final geometry must connect the upstream and downstream drainage conditions correctly.

## 6. Inlet Components

Depending on site and hydraulic conditions, the inlet may include:

- Pipe entrance
- Headwall
- Wingwalls
- Other inlet protection

The selection should be based on hydraulic, structural, and site requirements.

## 7. Outlet Components

The outlet may require:

- Headwall
- Wingwalls
- Apron
- Cutoff wall
- Scour protection
- Energy dissipation/protection measures

Not every outlet requires every component.

## 8. Component Selection Logic

```text
Hydrology
    ↓
Required Q
    ↓
Hydraulic analysis
    ↓
Pipe arrangement
    ↓
Site geometry
    ↓
Inlet / outlet requirements
    ↓
Structural / geotechnical checks
    ↓
Final configuration
```

## 9. CulvertCAD Representation

A design should therefore represent the culvert as a system rather than only as a pipe.

```text
CULVERT DESIGN
│
├── Pipe(s)
├── Inlet
├── Outlet
├── Headwall
├── Wingwalls
├── Apron / Protection
├── Foundation / Bedding
└── Other applicable components
```

> **Configuration converts engineering requirements into the physical arrangement that will actually be designed, documented, and constructed.**
