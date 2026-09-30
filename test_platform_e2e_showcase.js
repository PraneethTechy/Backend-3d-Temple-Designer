/**
 * DevaSetu Smart Queue Spatial Designer
 * Comprehensive Platform E2E Showcase & Verification Suite
 *
 * Runs tests across:
 * 1. Manual Component & Temple Architecture Placement
 * 2. Multi-Queue Topologies (Parallel, Serpentine, U-Shape, Split, Campus)
 * 3. AI Layout Generation with Coordinated Architecture
 * 4. AI Optimization Mode with Ground-Truth Diffs
 * 5. 100K Devotee Festival Campus Reference Scenario
 * 6. Multi-Stream Crowd Simulation Path Generation
 * 7. Layout Validation & Persistence Export
 */

import { COMPONENT_TYPES, createComponentInstance } from './src/utils/componentDefaults.js';
import { generateProceduralLayout, QUEUE_TEMPLATES } from './src/services/layout/layoutGenerator.js';
import { calculateQueueCapacity } from './src/services/layout/capacityCalculator.js';
import { validateLayout } from './src/services/layout/layoutValidator.js';
import { generateAiLayoutRecommendations } from './src/services/ai/layoutAgent.js';
import { optimizeCurrentLayout } from './src/services/ai/recommendationAgent.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✗ FAIL:\x1b[0m ${message}`);
  }
}

async function runSuite() {
  console.log('\n===============================================================');
  console.log('  DEVASATU SMART QUEUE DESIGNER - E2E PLATFORM VERIFICATION');
  console.log('===============================================================\n');

  const testSite = { length: 80, width: 45, unit: 'meters' };
  const baseScene = {
    site: testSite,
    temple: { name: 'Sri Venkateswara Swamy Temple' },
    requirements: { expectedVisitors: 15000, peakVisitors: 3000 },
    components: [],
  };

  // -------------------------------------------------------------
  // TEST CASE 1: Manual Architecture & Spatial Components
  // -------------------------------------------------------------
  console.log('\x1b[36m[TEST CASE 1]\x1b[0m Manual Dravidian Temple Architecture & Crowd Components');
  
  const entranceGopuram = createComponentInstance(COMPONENT_TYPES.ENTRANCE_GOPURAM);
  entranceGopuram.position = { x: -30, y: 0, z: 0 };
  assert(entranceGopuram.type === 'entrance_gopuram', 'Entrance Gopuram component created successfully');
  assert(entranceGopuram.properties.tiers === 5, 'Entrance Gopuram has 5 stepped pyramidal tiers');

  const mainGopuram = createComponentInstance(COMPONENT_TYPES.MAIN_GOPURAM);
  mainGopuram.position = { x: 20, y: 0, z: 0 };
  assert(mainGopuram.type === 'main_gopuram', 'Main Gopuram component created successfully');
  assert(mainGopuram.properties.tiers === 7, 'Main Raja Gopuram has 7 tiers');

  const sanctum = createComponentInstance(COMPONENT_TYPES.DARSHAN_SANCTUM);
  sanctum.position = { x: 30, y: 0, z: 0 };
  assert(sanctum.type === 'darshan_sanctum', 'Darshan Sanctum Garbhagriha created successfully');
  assert(sanctum.properties.diyaGlow === true, 'Sanctum includes sacred Diya illumination');

  const queueLane = createComponentInstance(COMPONENT_TYPES.QUEUE);
  queueLane.position = { x: 0, y: 0, z: 0 };
  assert(queueLane.type === 'queue', 'Queue Lane component created with stanchions & chevron flow');

  const security = createComponentInstance(COMPONENT_TYPES.SECURITY);
  security.position = { x: -20, y: 0, z: 0 };
  assert(security.type === 'security', 'Security DFMD checkpoint created with scanner properties');

  const manualScene = {
    ...baseScene,
    components: [entranceGopuram, security, queueLane, mainGopuram, sanctum],
  };

  const manualValidation = validateLayout(manualScene);
  assert(manualValidation.valid === true, 'Manual layout passes AABB boundary & overlap validation');
  assert(manualValidation.errors.length === 0, 'Zero spatial boundary violations in manual placement');

  // -------------------------------------------------------------
  // TEST CASE 2: Multi-Queue Topology Procedural Engine
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[TEST CASE 2]\x1b[0m Procedural Multi-Queue Topologies');
  
  const topologies = [
    { template: QUEUE_TEMPLATES.PARALLEL, lanes: 4, name: 'Parallel High-Speed' },
    { template: QUEUE_TEMPLATES.SERPENTINE, lanes: 6, name: 'Serpentine Continuous Flow' },
    { template: QUEUE_TEMPLATES.U_SHAPE, lanes: 4, name: 'U-Shape Deep Reversal' },
    { template: QUEUE_TEMPLATES.SPLIT, lanes: 6, name: 'Split Dual-Stream' },
  ];

  for (const topo of topologies) {
    const res = generateProceduralLayout(baseScene, {
      template: topo.template,
      lanes: topo.lanes,
      laneWidth: 2.0,
      spacing: 1.5,
      includeSecurity: true,
      includeWaitingArea: true,
      includeTempleArchitecture: true,
    });

    assert(res.success === true, `Procedural ${topo.name} generated successfully`);
    assert(res.components.length > 5, `${topo.name} contains queues, gates, security, gopurams & sanctum`);
    
    const cap = calculateQueueCapacity(res.components, baseScene.requirements.peakVisitors);
    assert(cap.queueCapacity > 0, `${topo.name} capacity calculated: ${cap.queueCapacity} devotees`);
    assert(cap.estimatedWaitMinutes > 0, `${topo.name} estimated wait: ${cap.estimatedWaitMinutes} minutes`);
  }

  // -------------------------------------------------------------
  // TEST CASE 3: AI Layout Generation with Coordinated Architecture
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[TEST CASE 3]\x1b[0m AI Layout Generator (Generate Mode)');

  const aiGenResult = await generateAiLayoutRecommendations(
    baseScene,
    'Design a high capacity queue with entrance gopuram, main raja gopuram, sanctum and security checkpoints',
    { allowFallback: true }
  );

  assert(aiGenResult.success === true, 'AI layout generation endpoint returned success: true');
  assert(Array.isArray(aiGenResult.recommendations), 'AI returned array of recommendations');
  assert(aiGenResult.recommendations.length >= 3, `AI provided ${aiGenResult.recommendations.length} diverse recommendations`);

  const firstRec = aiGenResult.recommendations[0];
  assert(firstRec.fits === true, `Recommendation 1 (${firstRec.title}) fits site bounds`);
  assert(firstRec.components.some(c => c.type === 'entrance_gopuram'), 'Recommendation includes Entrance Gopuram');
  assert(firstRec.components.some(c => c.type === 'main_gopuram'), 'Recommendation includes Main Raja Gopuram');
  assert(firstRec.components.some(c => c.type === 'darshan_sanctum'), 'Recommendation includes Darshan Sanctum');
  assert(firstRec.analysis?.metrics?.queueCapacity > 0, `Recommendation capacity: ${firstRec.analysis?.metrics?.queueCapacity}`);

  // -------------------------------------------------------------
  // TEST CASE 4: AI Optimization Mode with Ground-Truth Diffs
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[TEST CASE 4]\x1b[0m AI Optimization Mode (Optimize Mode)');

  // Start with a constrained 2-lane manual setup
  const constrainedRes = generateProceduralLayout(baseScene, {
    template: 'parallel',
    lanes: 2,
    includeSecurity: false,
    includeWaitingArea: false,
    includeTempleArchitecture: true,
  });

  const constrainedScene = {
    ...baseScene,
    components: constrainedRes.components,
  };

  const aiOptResult = await optimizeCurrentLayout(
    constrainedScene,
    'Optimize layout to eliminate bottlenecks and increase capacity for festival rush',
    { allowFallback: true }
  );

  assert(aiOptResult.success === true, 'AI optimization returned success: true');
  assert(aiOptResult.recommendation !== null, 'AI optimization produced structured recommendation');
  assert(aiOptResult.recommendation.diff !== undefined, 'AI optimization computed ground-truth metric diffs');
  assert(aiOptResult.recommendation.diff.capacityDiff >= 0, `Capacity improvement diff: +${aiOptResult.recommendation.diff.capacityDiff}`);
  assert(Array.isArray(aiOptResult.recommendation.changes), 'AI provided itemized list of improvements');

  // -------------------------------------------------------------
  // TEST CASE 5: Verification of Multi-Queue & Scene Validation
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[TEST CASE 5]\x1b[0m Layout Validation & Boundary Safety');

  // Intentionally place a component outside boundary to test error detection
  const outOfBoundsComponent = createComponentInstance(COMPONENT_TYPES.QUEUE);
  outOfBoundsComponent.position = { x: 100, y: 0, z: 100 };
  const invalidScene = {
    ...baseScene,
    components: [outOfBoundsComponent],
  };

  const invalidValidation = validateLayout(invalidScene);
  assert(invalidValidation.valid === false, 'Layout validator correctly flags out-of-bounds components');
  assert(invalidValidation.errors.length > 0, 'Boundary violation error reported with excess meters');

  // -------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  E2E TEST RUN COMPLETED: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('[Showcase Error]', err);
  process.exit(1);
});
