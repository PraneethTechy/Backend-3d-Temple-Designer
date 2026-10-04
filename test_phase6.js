import assert from 'node:assert';

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('--- STARTING PHASE 6 VERIFICATION TEST SUITE ---');

  // Test 1: Validation of malformed input (Must reject with 400)
  console.log('\n[Test 1] Validating server rejects malformed payload...');
  const badRes = await fetch(`${API_BASE}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bad Plan',
      scene: {
        site: { length: -50, width: 'invalid' } // Obviously malformed!
      }
    }),
  });
  const badJson = await badRes.json();
  assert.strictEqual(badRes.status, 400, 'Malformed payload must return 400');
  assert.strictEqual(badJson.success, false, 'Should fail gracefully');
  console.log('✓ Rejection of malformed data verified.');

  // Test 2: Create a complete valid plan with realistic Scene JSON
  console.log('\n[Test 2] Creating a new valid plan with full Scene JSON...');
  const validScene = {
    temple: { name: 'Venkateswara Swamy Temple' },
    site: {
      unit: 'm',
      length: 60,
      width: 35,
      boundary: [
        { x: -30, y: 0, z: -17.5 },
        { x: 30, y: 0, z: -17.5 },
        { x: 30, y: 0, z: 17.5 },
        { x: -30, y: 0, z: 17.5 }
      ]
    },
    requirements: {
      expectedVisitors: 5000,
      peakVisitors: 1500
    },
    components: [
      {
        id: 'entrance-1',
        type: 'entrance',
        name: 'Main Gopuram Gate',
        position: { x: -25, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 2, width: 4, height: 3 },
        properties: { flowRate: 50, lanes: 2 },
        generated: false
      },
      {
        id: 'queue_lane-1',
        type: 'queue_lane',
        name: 'Serpentine Queue Segment 1',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 30, width: 1.5, height: 1.2 },
        properties: { maxWaitTime: 15, accessibility: true },
        generated: true
      },
      {
        id: 'darshan_point-1',
        type: 'darshan_point',
        name: 'Garbhagriha Sanctuary',
        position: { x: 25, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 6, width: 6, height: 4 },
        properties: { viewingTime: 10, batchSize: 20 },
        generated: false
      }
    ],
    paths: [
      {
        id: 'main-flow',
        name: 'General Darshan Path',
        waypoints: [
          { x: -25, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 25, y: 0, z: 0 }
        ]
      }
    ],
    analysis: {
      valid: true,
      errors: [],
      warnings: [],
      metrics: {
        totalQueueLength: 30,
        totalQueueArea: 45,
        standingCapacity: 90,
        estimatedWaitMinutes: 12
      }
    }
  };

  const createRes = await fetch(`${API_BASE}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tirumala Peak Festival Plan',
      scene: validScene
    }),
  });
  const createJson = await createRes.json();
  assert.strictEqual(createRes.status, 201, 'Create plan must return 201 Created');
  assert.strictEqual(createJson.success, true, 'Create response should have success: true');
  assert.ok(createJson.data._id || createJson.data.id, 'Created plan must have a stable ID');
  const planId = createJson.data._id || createJson.data.id;
  console.log(`✓ Plan created successfully with ID: ${planId}`);

  // Test 3: List plans (Must return array of metadata items without bloated geometry)
  console.log('\n[Test 3] Fetching list of saved plans...');
  const listRes = await fetch(`${API_BASE}/plans`);
  const listJson = await listRes.json();
  assert.strictEqual(listRes.status, 200, 'List plans must return 200 OK');
  assert.strictEqual(listJson.success, true);
  assert.ok(Array.isArray(listJson.data), 'Response data must be an array');
  const found = listJson.data.find(p => (p._id || p.id) === planId);
  assert.ok(found, 'Created plan must exist in list');
  assert.strictEqual(found.name, 'Tirumala Peak Festival Plan');
  assert.strictEqual(found.templeName, 'Venkateswara Swamy Temple');
  assert.strictEqual(found.site.length, 60);
  assert.strictEqual(found.site.width, 35);
  console.log(`✓ List endpoint verified. Found plan in list with length ${listJson.data.length}`);

  // Test 4: Get single plan by ID
  console.log(`\n[Test 4] Fetching plan details for ID ${planId}...`);
  const getRes = await fetch(`${API_BASE}/plans/${planId}`);
  const getJson = await getRes.json();
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getJson.success, true);
  assert.strictEqual(getJson.data.name, 'Tirumala Peak Festival Plan');
  assert.strictEqual(getJson.data.components.length, 3, 'Must retain all components');
  assert.strictEqual(getJson.data.paths.length, 1, 'Must retain paths');
  console.log('✓ Plan retrieval verified with complete scene integrity.');

  // Test 5: Update the plan (Simulate modifying layout and saving again)
  console.log(`\n[Test 5] Updating plan ID ${planId}...`);
  const updatedScene = JSON.parse(JSON.stringify(validScene));
  updatedScene.components.push({
    id: 'barrier-1',
    type: 'barrier',
    name: 'Crowd Stanchion 1',
    position: { x: 5, y: 0, z: 2 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { length: 4, width: 0.2, height: 1.0 },
    properties: { movable: true },
    generated: false
  });

  const updateRes = await fetch(`${API_BASE}/plans/${planId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tirumala Peak Festival Plan (Updated)',
      scene: updatedScene
    }),
  });
  const updateJson = await updateRes.json();
  assert.strictEqual(updateRes.status, 200, 'Update must return 200 OK');
  assert.strictEqual(updateJson.success, true);
  assert.strictEqual(updateJson.data.name, 'Tirumala Peak Festival Plan (Updated)');
  assert.strictEqual(updateJson.data.components.length, 4, 'Must have 4 components now');
  console.log('✓ Plan update verified without duplicate creation.');

  // Test 6: Delete the plan
  console.log(`\n[Test 6] Deleting plan ID ${planId}...`);
  const delRes = await fetch(`${API_BASE}/plans/${planId}`, {
    method: 'DELETE'
  });
  const delJson = await delRes.json();
  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delJson.success, true);
  console.log('✓ Plan deleted successfully.');

  // Test 7: Verify it no longer exists
  console.log('\n[Test 7] Verifying deleted plan cannot be retrieved...');
  const checkRes = await fetch(`${API_BASE}/plans/${planId}`);
  assert.strictEqual(checkRes.status, 404, 'Deleted plan must return 404');
  console.log('✓ 404 Not Found confirmed for deleted plan.');

  console.log('\n=== ALL PHASE 6 API VERIFICATION TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch((err) => {
  console.error('Phase 6 test suite failed:', err);
  process.exit(1);
});
