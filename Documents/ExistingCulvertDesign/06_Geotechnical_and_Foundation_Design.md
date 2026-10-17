# 31. Geotechnical and Foundation Design

## 1. Purpose

Geotechnical design connects the culvert structure to the ground.

Structural design asks whether the pipe and concrete components can resist their loads.

Geotechnical design asks:

> **Can the soil safely support the culvert and its structural components under the design conditions?**

## 2. Main Geotechnical Inputs

Relevant inputs can include:

- Soil type
- Soil unit weight
- Allowable bearing pressure
- Soil strength parameters where required
- Groundwater condition
- Foundation level
- Existing ground level
- Fill/backfill properties
- Compaction condition
- Settlement considerations

## 3. Foundation Support

Loads from the structure ultimately reach the ground.

```text
CULVERT / STRUCTURE
        ↓
FOUNDATION / BEDDING
        ↓
GROUND
```

The supporting ground must be adequate for the applied loads.

## 4. Bearing Capacity

The foundation transmits pressure to the soil.

Conceptually:

```text
Structural load
      ↓
Foundation area
      ↓
Bearing pressure
      ↓
Compare with allowable soil pressure
      ↓
PASS / FAIL
```

The calculated foundation pressure should not exceed the applicable allowable/design bearing criterion.

## 5. Settlement

A foundation can be strong enough against bearing failure but still experience excessive settlement.

Therefore, where required, the design should consider:

- Total settlement
- Differential settlement
- Soil compressibility
- Ground condition
- Foundation arrangement

## 6. Sliding and Overturning

For headwalls and wingwalls, the foundation system may need stability checks.

```text
Earth pressure
      →
   ┌─────────┐
   │  WALL   │
   └─────────┘
      ↓
  FOUNDATION
```

Typical stability checks include:

- Sliding
- Overturning
- Bearing
- Structural strength

## 7. Groundwater

Groundwater can affect:

- Soil properties
- Effective stresses
- Foundation behaviour
- Water pressure
- Construction conditions
- Scour/seepage behaviour

Where groundwater is relevant, it must be included according to the adopted design method.

## 8. Bedding and Foundation

For a pipe culvert:

```text
        PIPE
      ╭───────╮
     ╱         ╲
    ╰───────────╯
    █████████████  ← Bedding
    █████████████
    ─────────────  ← Foundation / soil
```

Bedding provides support and helps distribute loads.

The actual bedding requirements must follow the adopted pipe-laying and structural provisions.

## 9. Geotechnical PASS / FAIL

```text
Soil inputs
    ↓
Foundation condition
    ↓
Bearing check
    ↓
Settlement check where required
    ↓
Stability checks where applicable
    ↓
PASS / FAIL
```

## 10. CulvertCAD Role

CulvertCAD should distinguish between:

**User-provided geotechnical information**

and

**Calculated foundation/stability results**.

The system should not invent soil properties. They should come from the survey, investigation, approved design assumptions, or project inputs.

> **Geotechnical design ensures that the culvert and its supporting components can safely interact with the ground.**
