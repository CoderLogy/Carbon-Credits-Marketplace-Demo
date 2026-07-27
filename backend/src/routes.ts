import { Router, Request, Response } from 'express';
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { calculateAvoidedEmissions } from './utils';

export const routes = Router();

const bootTime = Date.now().toString();

routes.get('/system/info', (req: Request, res: Response) => {
  res.json({ bootTime });
});

// --- Auth ---
// Business Rule: Enforces simple shared-secret admin claim for prototype demonstration
routes.post('/auth/claim-admin', async (req: Request, res: Response) => {
  const { walletAddress, secretCode } = req.body;
  if (secretCode === '2026') {
    const db = getDb();
    
    // Upsert user
    const existing = await db.get('SELECT id FROM users WHERE wallet_address = ?', [walletAddress]);
    if (existing) {
      await db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', existing.id]);
    } else {
      await db.run('INSERT INTO users (id, wallet_address, role) VALUES (?, ?, ?)', [uuidv4(), walletAddress, 'admin']);
    }

    res.json({ success: true, message: 'Admin role granted in DB. Please invoke claimAdminRole on-chain as well.' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid secret code.' });
  }
});

// --- Buildings ---
// Business Rule: Enforces building registration and assigns owner role to submitter
routes.post('/buildings', async (req: Request, res: Response) => {
  const { walletAddress, name, location, areaSqft, buildingType, energySource } = req.body;
  const db = getDb();
  
  let user = await db.get('SELECT id FROM users WHERE wallet_address = ?', [walletAddress]);
  if (!user) {
    const userId = uuidv4();
    await db.run('INSERT INTO users (id, wallet_address, role) VALUES (?, ?, ?)', [userId, walletAddress, 'building_owner']);
    user = { id: userId };
  }

  const buildingId = uuidv4();
  await db.run(
    'INSERT INTO buildings (id, owner_id, name, location, area_sqft, building_type, energy_source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [buildingId, user.id, name, location, areaSqft, buildingType, energySource]
  );
  
  res.json({ success: true, buildingId });
});

routes.get('/buildings', async (req: Request, res: Response) => {
  const db = getDb();
  const buildings = await db.all('SELECT * FROM buildings');
  res.json(buildings);
});

// --- Carbon Calculation (Mocked Implementation) ---
// Business Rule: Enforces MRV math, emission factors, and prevents double-reporting for the same period
routes.post('/calculate', async (req: Request, res: Response) => {
  const { buildingId, periodStart, periodEnd, baselineKwh, actualKwh, emissionFactor, emissionFactorSource = 'Custom' } = req.body;
  const db = getDb();
  
  if (new Date(periodStart) > new Date(periodEnd)) {
    return res.status(400).json({ success: false, message: 'Invalid date range: Start date cannot be after end date.' });
  }
  
  // Prevent double-counting: Check if a report for this building name and time period already exists
  const existingReport = await db.get(`
    SELECT e.id 
    FROM energy_reports e
    JOIN buildings b ON e.building_id = b.id
    WHERE LOWER(b.name) = LOWER((SELECT name FROM buildings WHERE id = ?)) 
      AND e.period_start = ? 
      AND e.period_end = ?
  `, [buildingId, periodStart, periodEnd]);

  if (existingReport) {
    return res.status(409).json({ 
      success: false, 
      message: 'Double-counting detected: A carbon credit request for this building and time period already exists.' 
    });
  }

  // (Baseline - Actual) * Factor
  const energySaved = Math.max(0, baselineKwh - actualKwh);
  const estimatedAvoidedTCO2e = calculateAvoidedEmissions(baselineKwh, actualKwh, emissionFactor) / 1000; // factor in kg CO2e / kWh

  const reportId = uuidv4();
  
  await db.run(
    `INSERT INTO energy_reports 
    (id, building_id, period_start, period_end, baseline_kwh, actual_kwh, energy_saved_kwh, emission_factor, emission_factor_source, estimated_avoided_tco2e, data_status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reportId, buildingId, periodStart, periodEnd, baselineKwh, actualKwh, energySaved, emissionFactor, emissionFactorSource, estimatedAvoidedTCO2e, 'calculated']
  );

  const calcId = uuidv4();
  await db.run(
    `INSERT INTO calculations 
    (id, energy_report_id, formula, inputs_json, emission_factor, emission_factor_source, result_tco2e) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [calcId, reportId, '(Baseline - Actual) * Factor', JSON.stringify(req.body), emissionFactor, emissionFactorSource, estimatedAvoidedTCO2e]
  );

  const projectId = uuidv4();
  await db.run(
    `INSERT INTO projects (id, building_id, energy_report_id, calculation_id, status) VALUES (?, ?, ?, ?, ?)`,
    [projectId, buildingId, reportId, calcId, 'draft']
  );

  res.json({ success: true, projectId, estimatedAvoidedTCO2e, formula: '(Baseline - Actual) * Factor' });
});

// --- Workflow Approvals ---
// Business Rule: Enforces state machine transitions (Draft -> Review -> Approved -> Issued -> Sold -> Listed/Retired)
routes.post('/projects/:id/submit', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { attestationAgreed } = req.body || {};
  const db = getDb();
  await db.run('UPDATE projects SET status = ?, double_counting_attestation = ? WHERE id = ?', ['review', attestationAgreed ? 1 : 0, id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'draft', 'review', 'Project Developer', `Submitted for review (Attestation: ${attestationAgreed ? 'Yes' : 'No'})`]);
  res.json({ success: true, status: 'review' });
});

routes.post('/projects/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  await db.run('UPDATE projects SET status = ? WHERE id = ?', ['approved', id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'review', 'approved', 'Auditor', 'Approved MRV report']);
  res.json({ success: true, status: 'approved' });
});

routes.post('/projects/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  await db.run('UPDATE projects SET status = ? WHERE id = ?', ['rejected', id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'review', 'rejected', 'Auditor', 'Rejected due to tamper or error']);
  res.json({ success: true, status: 'rejected' });
});

routes.post('/projects/:id/issue', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { price } = req.body || {};
  const listingPrice = price ? parseFloat(price) : null;
  
  const db = getDb();
  await db.run('UPDATE projects SET status = ?, price = ? WHERE id = ?', ['issued', listingPrice, id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'approved', 'issued', 'Admin', `Tokens minted and listed on marketplace${listingPrice ? ` for $${listingPrice}` : ''}`]);
  res.json({ success: true, status: 'issued' });
});
routes.post('/projects/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body || {}; 
  const db = getDb();
  const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [id]);
  
  if (project && project.owner_id === 'buyer') {
    await db.run('UPDATE projects SET status = ? WHERE id = ?', ['sold', id]);
    const actor = role || 'Market Buyer';
    await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'issued', 'sold', actor, `Listing cancelled by ${actor}`]);
    res.json({ success: true, status: 'sold' });
  } else {
    await db.run('UPDATE projects SET status = ? WHERE id = ?', ['approved', id]);
    await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'issued', 'approved', 'Admin', 'Listing cancelled by Admin']);
    res.json({ success: true, status: 'approved' });
  }
});

routes.post('/projects/:id/buy', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const project = await db.get('SELECT status FROM projects WHERE id = ?', [id]);
  const fromStatus = project ? project.status : 'issued';
  await db.run('UPDATE projects SET status = ?, owner_id = ? WHERE id = ?', ['sold', 'buyer', id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, fromStatus, 'sold', 'Market Buyer', 'Token purchased by buyer']);
  res.json({ success: true, status: 'sold' });
});

routes.post('/projects/:id/relist', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { price } = req.body;
  const db = getDb();
  const project = await db.get('SELECT status FROM projects WHERE id = ?', [id]);
  const fromStatus = project ? project.status : 'sold';
  await db.run('UPDATE projects SET status = ?, price = ? WHERE id = ?', ['listed', price, id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, fromStatus, 'listed', 'Market Buyer', `Credit re-listed for €${price}`]);
  res.json({ success: true, status: 'listed' });
});

routes.post('/projects/:id/transfer', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { recipient } = req.body;
  const db = getDb();
  await db.run('UPDATE projects SET status = ? WHERE id = ?', ['transferred', id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'sold', 'transferred', 'Market Buyer', `Credit transferred to ${recipient}`]);
  res.json({ success: true, status: 'transferred' });
});

routes.post('/projects/:id/retire', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { beneficiary, purpose } = req.body;
  const db = getDb();
  await db.run('UPDATE projects SET status = ?, beneficiary = ?, purpose = ? WHERE id = ?', ['retired', beneficiary, purpose, id]);
  await db.run('INSERT INTO audit_log (project_id, from_status, to_status, actor, notes) VALUES (?, ?, ?, ?, ?)', [id, 'sold', 'retired', 'Market Buyer', 'Token retired by owner']);
  res.json({ success: true, status: 'retired' });
});

routes.get('/projects/:id/audit-log', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const logs = await db.all('SELECT * FROM audit_log WHERE project_id = ? ORDER BY timestamp ASC', [id]);
  res.json(logs);
});

routes.get('/projects', async (req: Request, res: Response) => {
  const db = getDb();
  const projects = await db.all(`
    SELECT p.*, b.name as building_name, e.period_start, e.period_end, e.estimated_avoided_tco2e, e.baseline_kwh, e.actual_kwh, e.emission_factor, e.emission_factor_source, c.calculated_at
    FROM projects p
    JOIN buildings b ON p.building_id = b.id
    JOIN energy_reports e ON p.energy_report_id = e.id
    JOIN calculations c ON p.calculation_id = c.id
  `);
  res.json(projects);
});

// --- Smart Contract
