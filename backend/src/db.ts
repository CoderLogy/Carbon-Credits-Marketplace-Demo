import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function setupDb() {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './eclimai_carbon.db';
  
  db = await open({
    filename: path.resolve(__dirname, '..', dbPath),
    driver: sqlite3.Database
  });

  await db.exec(`
    -- Prototype mode: reset DB on every server start to serve fresh demo data
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS calculations;
    DROP TABLE IF EXISTS energy_reports;
    DROP TABLE IF EXISTS buildings;
    DROP TABLE IF EXISTS users;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      name TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      area_sqft INTEGER,
      building_type TEXT,
      energy_source TEXT DEFAULT 'electricity',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS energy_reports (
      id TEXT PRIMARY KEY,
      building_id TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      baseline_kwh REAL NOT NULL,
      actual_kwh REAL NOT NULL,
      energy_saved_kwh REAL NOT NULL,
      energy_source TEXT DEFAULT 'electricity',
      emission_factor REAL NOT NULL,
      emission_factor_source TEXT NOT NULL,
      estimated_avoided_tco2e REAL,
      data_status TEXT DEFAULT 'draft',
      import_method TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY,
      energy_report_id TEXT,
      formula TEXT NOT NULL,
      inputs_json TEXT NOT NULL,
      emission_factor REAL NOT NULL,
      emission_factor_source TEXT NOT NULL,
      assumptions TEXT,
      result_tco2e REAL NOT NULL,
      calculation_version TEXT DEFAULT 'v1.0',
      methodology TEXT DEFAULT 'IPMVP-Option-C',
      calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(energy_report_id) REFERENCES energy_reports(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      building_id TEXT,
      energy_report_id TEXT,
      calculation_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      price REAL DEFAULT NULL,
      owner_id TEXT DEFAULT NULL,
      beneficiary TEXT DEFAULT NULL,
      purpose TEXT DEFAULT NULL,
      reviewer_id TEXT,
      double_counting_attestation BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(building_id) REFERENCES buildings(id),
      FOREIGN KEY(energy_report_id) REFERENCES energy_reports(id),
      FOREIGN KEY(calculation_id) REFERENCES calculations(id),
      FOREIGN KEY(reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);
  
  console.log('Database connected and schema initialized.');
  await seedDb();
}

async function seedDb() {
  if (!db) return;
  const count = await db.get('SELECT COUNT(*) as count FROM projects');
  if (count.count > 0) return;

  const mockProjects = [
    { id: 'proj-1', building: 'Berlin Factory Retrofit', location: 'Europe', tco2e: 125.4, status: 'issued', factor: 0.3000, source: 'UBA 2026 (Germany)' },
    { id: 'proj-2', building: 'London Tech Hub HVAC', location: 'Europe', tco2e: 85.0, status: 'issued', factor: 0.1280, source: 'DEFRA 2025 (UK)' },
    { id: 'proj-3', building: 'Dublin Solar Connect', location: 'Europe', tco2e: 340.2, status: 'issued', factor: 0.2241, source: 'SEAI 2025 (Ireland)' },
    { id: 'proj-4', building: 'Paris Retail LED Upgrade', location: 'Europe', tco2e: 45.8, status: 'issued', factor: 0.0500, source: 'ADEME 2026 (France)' },
    { id: 'proj-5', building: 'Madrid Logistics Energy', location: 'Europe', tco2e: 520.0, status: 'issued', factor: 0.1800, source: 'MITERD 2026 (Spain)' },
    { id: 'proj-6', building: 'Rome Campus Insulation', location: 'Europe', tco2e: 75.5, status: 'issued', factor: 0.2500, source: 'ISPRA 2026 (Italy)' }
  ];

  await db.run("INSERT OR IGNORE INTO users (id, wallet_address, role) VALUES ('user-1', '0x123', 'building_owner')");

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const periodEndStr = now.toISOString().split('T')[0];
  const periodStartStr = oneYearAgo.toISOString().split('T')[0];

  for (const p of mockProjects) {
    const buildingId = `bldg-${p.id}`;
    const reportId = `rep-${p.id}`;
    const calcId = `calc-${p.id}`;

    const factor = p.factor;
    const saved = Math.round((p.tco2e * 1000) / factor);
    const actual = saved; // arbitrary, just to make baseline = 2x actual
    const baseline = saved * 2;

    await db.run(
      'INSERT INTO buildings (id, owner_id, name, location) VALUES (?, ?, ?, ?)',
      [buildingId, 'user-1', p.building, p.location]
    );

    await db.run(
      'INSERT INTO energy_reports (id, building_id, period_start, period_end, baseline_kwh, actual_kwh, energy_saved_kwh, emission_factor, emission_factor_source, estimated_avoided_tco2e) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [reportId, buildingId, periodStartStr, periodEndStr, baseline, actual, saved, factor, p.source, p.tco2e]
    );

    await db.run(
      'INSERT INTO calculations (id, energy_report_id, formula, inputs_json, emission_factor, emission_factor_source, result_tco2e) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [calcId, reportId, '(Baseline - Actual) * Factor', '{}', factor, p.source, p.tco2e]
    );

    await db.run(
      'INSERT INTO projects (id, building_id, energy_report_id, calculation_id, status, double_counting_attestation) VALUES (?, ?, ?, ?, ?, 1)',
      [p.id, buildingId, reportId, calcId, p.status]
    );

    // Randomize timestamps for history
    const baseTime = Date.now() - Math.floor(Math.random() * 1000000000);
    
    await db.run(
      'INSERT INTO audit_log (project_id, from_status, to_status, actor, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [p.id, null, 'draft', 'Project Developer', new Date(baseTime).toISOString(), 'Initial MRV data uploaded via CSV']
    );

    if (p.status === 'review' || p.status === 'approved' || p.status === 'issued') {
      await db.run(
        'INSERT INTO audit_log (project_id, from_status, to_status, actor, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, 'draft', 'review', 'Project Developer', new Date(baseTime + 86400000).toISOString(), 'Submitted for review (Attestation: Yes)']
      );
    }

    if (p.status === 'approved' || p.status === 'issued') {
      await db.run(
        'INSERT INTO audit_log (project_id, from_status, to_status, actor, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, 'review', 'approved', 'Auditor', new Date(baseTime + 172800000).toISOString(), 'Verified calculation and data integrity hashes. Approved for minting.']
      );
    }

    if (p.status === 'issued') {
      await db.run(
        'INSERT INTO audit_log (project_id, from_status, to_status, actor, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, 'approved', 'issued', 'Admin', new Date(baseTime + 259200000).toISOString(), 'Minted 125 VCU tokens on Polygon Amoy.']
      );
    }
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call setupDb() first.');
  }
  return db;
}
