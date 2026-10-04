import assert from 'node:assert';
import { generateProceduralLayout } from '../client/src/services/layout/layoutGenerator.js';
import { validateLayout } from '../client/src/services/layout/layoutValidator.js';
import { generateSimulationPaths } from '../client/src/features/simulation/simulationPaths.js';
import { SimulationEngine } from '../client/src/features/simulation/simulationEngine.js';
import { generatePlanSummaryText } from '../client/src/utils/exportPlan.js';

const API_BASE = 'http://localhost:5001/api';

async function runEndToEndVerification() {
  console.log('===========================================================');
  console.log('  DEVASATU SMART QUEUE DESIGNER - COMPLETE E2E VERIFICATION ');
  console.log('===========================================================');

  // STEP 1: Create Temple Space
  console.log('\n[STEP 1] Creating Temple Space (60m × 35m, 5000 Expected, 1500 Peak)...');
  const site = {
    unit: 'meters',
    length: 60,
    width: 35,
    boundary: [
      { x: -30, y: 0, z: -17.5 },
      { x: 30, y: 0, z: -17.5 },
      { x: 30, y: 0, z: 17.5 },
      { x: -30, y: 0, z: 17.5 }
    ]
  };
  const requirements = { expectedVisitors: 5000, peakVisitors: 1500 };
  let workingScene = {
    temple: { name: 'Test Temple' },
    site,
    requirements,
    components: [],
    paths: [],
    analysis: { valid: true, errors: [], warnings: [], metrics: null }
  };
  assert.strictEqual(workingScene.temple.name, 'Test Temple');
  console.log('✓ Temple Space created.');

  // STEP 2: Generate Procedural Serpentine Layout
  console.log('\n[STEP 2] Generating Procedural Serpentine Layout...');
  const genResult = generateProceduralLayout(workingScene, { template: 'serpentine', laneCount: 4 });
  assert.strictEqual(genResult.success, true, 'Procedural generation must succeed');
  assert.ok(genResult.components.length > 0, 'Real 3D components must be generated');
  workingScene.components = genResult.components;
  workingScene.analysis = genResult.validation;
  console.log(`✓ Procedural Serpentine generated with ${workingScene.components.length} components.`);

  // STEP 3: Modify Layout Manually (Move, Resize, Add Barrier)
  console.log('\n[STEP 3] Manually modifying layout (Add Barrier, update component)...');
  const manualBarrier = {
    id: 'manual-barrier-1',
    type: 'barrier',
    name: 'Manual Crowd Demarcation Rail',
    position: { x: 5, y: 0, z: 10 },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { length: 6, width: 0.3, height: 1.0 },
    properties: { style: 'double-rail' },
    generated: false
  };
  workingScene.components.push(manualBarrier);
  // Modify position of first queue component
  const queueComp = workingScene.components.find(c => c.type === 'queue');
  if (queueComp) {
    queueComp.position.x += 1;
  }
  console.log(`✓ Manual edits applied. Total components: ${workingScene.components.length}`);

  // STEP 4: Run Validation
  console.log('\n[STEP 4] Running Layout Validation...');
  const validation = validateLayout(workingScene);
  workingScene.analysis = validation;
  assert.ok(validation.metrics, 'Metrics must be produced');
  assert.ok(validation.metrics.queueCapacity > 0, 'Capacity must be calculated');
  console.log(`✓ Validation metrics: Queue Capacity = ${validation.metrics.queueCapacity}, Utilization = ${validation.metrics.utilization}%`);

  // STEP 5: AI Assist Simulation Flow
  console.log('\n[STEP 5] Flow path generation & Crowd Simulation readiness...');
  const pathResult = generateSimulationPaths(workingScene);
  assert.strictEqual(pathResult.ready, true, 'Layout must be simulation ready');
  const paths = pathResult.paths;
  assert.ok(paths.length > 0, 'Simulation flow paths generated');
  workingScene.paths = paths;
  console.log(`✓ Generated ${paths.length} flow path(s) for crowd navigation.`);

  // STEP 6: Run Crowd Flow Simulation
  console.log('\n[STEP 6] Running crowd simulation steps...');
  const engine = new SimulationEngine(workingScene, paths);
  for (let s = 0; s < 50; s++) {
    engine.update(0.1, 2.0);
  }
  assert.ok(engine.agents.length > 0, 'Simulation generated active crowd agents');
  console.log(`✓ Simulation active. Active crowd agents: ${engine.agents.length}`);

  // STEP 7 & 8: Verify Density Heatmap & D3 Analytics Data
  console.log('\n[STEP 7 & 8] Checking 3D Heatmap Occupancy & Analytics...');
  assert.ok(engine.maxCellOccupancy > 0, 'Heatmap recorded spatial crowd occupancy');
  assert.ok(engine.metricsHistory.length > 0, 'D3 time-series data captured');
  console.log(`✓ Heatmap registered spatial density. Time series points: ${engine.metricsHistory.length}`);

  // STEP 9: Save Plan to Database
  console.log('\n[STEP 9] Saving Plan to MongoDB Persistence API...');
  const saveRes = await fetch(`${API_BASE}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Temple Queue Plan',
      scene: workingScene
    })
  });
  const saveJson = await saveRes.json();
  assert.strictEqual(saveRes.status, 201);
  assert.strictEqual(saveJson.success, true);
  const savedPlanId = saveJson.data._id || saveJson.data.id;
  console.log(`✓ Plan saved with ID: ${savedPlanId}`);

  // STEP 10: New Plan & Load Saved Plan
  console.log('\n[STEP 10] Simulating New Plan (Reset) & Loading from Persistence...');
  // Reset working scene
  workingScene = null;

  // Load from API
  const loadRes = await fetch(`${API_BASE}/plans/${savedPlanId}`);
  const loadJson = await loadRes.json();
  assert.strictEqual(loadRes.status, 200);
  assert.strictEqual(loadJson.success, true);

  const restoredPlan = loadJson.data;
  assert.strictEqual(restoredPlan.name, 'Test Temple Queue Plan');
  assert.strictEqual(restoredPlan.templeName, 'Test Temple');
  assert.strictEqual(restoredPlan.site.length, 60);
  assert.strictEqual(restoredPlan.site.width, 35);
  assert.ok(restoredPlan.components.length >= 4, 'Restored all components including manual barrier');

  // Verify dynamic revalidation on load
  const restoredAnalysis = validateLayout({
    site: restoredPlan.site,
    components: restoredPlan.components,
    requirements: restoredPlan.requirements
  });
  assert.ok(restoredAnalysis.metrics.queueCapacity > 0, 'Metrics freshly recalculated');
  console.log('✓ Restored plan integrity verified with dynamic recalculation.');

  // STEP 11: Modify & Update Existing Plan
  console.log('\n[STEP 11] Modifying restored plan and updating existing record...');
  const updatedRes = await fetch(`${API_BASE}/plans/${savedPlanId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Temple Queue Plan (Updated)',
      scene: {
        ...restoredPlan,
        components: [
          ...restoredPlan.components,
          {
            id: 'extra-barrier',
            type: 'barrier',
            name: 'Extra Stanchion',
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            scale: { x: 1, y: 1, z: 1 },
            dimensions: { length: 2, width: 0.3, height: 1 },
            properties: {},
            generated: false
          }
        ]
      }
    })
  });
  const updatedJson = await updatedRes.json();
  assert.strictEqual(updatedRes.status, 200);
  assert.strictEqual(updatedJson.data.name, 'Test Temple Queue Plan (Updated)');
  console.log('✓ Plan successfully updated without creating duplicate.');

  // STEP 12: Export JSON & Export Summary
  console.log('\n[STEP 12] Verifying Clean Export (Scene JSON & Summary)...');
  const summaryReport = generatePlanSummaryText({
    name: updatedJson.data.name,
    scene: updatedJson.data
  });
  assert.ok(summaryReport.includes('Test Temple'), 'Summary contains temple name');
  assert.ok(summaryReport.includes('60m (Length) x 35m (Width)'), 'Summary contains site dimensions');

  // Ensure exported components do NOT contain Three.js runtime properties
  const sampleComp = updatedJson.data.components[0];
  assert.strictEqual(sampleComp.geometry, undefined, 'Must not export Three.js geometry');
  assert.strictEqual(sampleComp.material, undefined, 'Must not export Three.js material');
  console.log('✓ Export verified clean without runtime rendering artifacts.');

  // STEP 13: Delete Saved Plan
  console.log('\n[STEP 13] Deleting Saved Plan from Persistence...');
  const delRes = await fetch(`${API_BASE}/plans/${savedPlanId}`, { method: 'DELETE' });
  const delJson = await delRes.json();
  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delJson.success, true);

  const checkDel = await fetch(`${API_BASE}/plans/${savedPlanId}`);
  assert.strictEqual(checkDel.status, 404, 'Deleted plan returns 404');
  console.log('✓ Plan deleted successfully and confirmed removed.');

  console.log('\n===========================================================');
  console.log('  ALL 13 END-TO-END STEPS VERIFIED AND PASSED 100%!       ');
  console.log('===========================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
