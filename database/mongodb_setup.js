// database/mongodb_setup.js
// Run with: mongosh < mongodb_setup.js
// Creates collections and indexes for CulvertCAD_Documents database

db = db.getSiblingDB('CulvertCAD_Documents');

// ── SURVEYS COLLECTION ────────────────────────────────────────────────────────
db.createCollection('surveys');
db.surveys.createIndex({ ProjectId: 1 });
db.surveys.createIndex({ UploadedAt: -1 });

// ── CALC RESULTS COLLECTION ───────────────────────────────────────────────────
db.createCollection('calc_results');
db.calc_results.createIndex({ DesignId: 1 });
db.calc_results.createIndex({ RevisionId: 1 }, { unique: true });
db.calc_results.createIndex({ CalculatedAt: -1 });

// ── DRAWINGS COLLECTION ────────────────────────────────────────────────────────
db.createCollection('drawings');
db.drawings.createIndex({ RevisionId: 1 });
db.drawings.createIndex({ DesignId: 1 });

// ── ALIGNMENTS COLLECTION ──────────────────────────────────────────────────────
db.createCollection('alignments');
db.alignments.createIndex({ ProjectId: 1 });

// ── BATCH RUNS COLLECTION ──────────────────────────────────────────────────────
db.createCollection('batch_runs');
db.batch_runs.createIndex({ ProjectId: 1 });
db.batch_runs.createIndex({ StartedAt: -1 });

print('CulvertCAD_Documents collections and indexes created successfully.');
