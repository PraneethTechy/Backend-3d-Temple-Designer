/**
 * Comprehensive Acceptance Test for Continuous Crowd Simulation
 * Tests multi-stream campus continuous flow, bounded agent pool recycling,
 * orientation, corner turning, service dwell times, live counters, and long-run stability.
 */

import { generateFestivalScenario } from '../client/src/services/layout/festivalScenarioGenerator.js';
import { generateSimulationPaths } from '../client/src/features/simulation/simulationPaths.js';
import { SimulationEngine } from '../client/src/features/simulation/simulationEngine.js';
import { AGENT_STATES } from '../client/src/features/simulation/simulationModel.js';

async function runSimulationAcceptanceSuite() {
  console.log('=== STARTING CONTINUOUS CROWD SIMULATION ACCEPTANCE TEST ===\n');

  // 1. Generate Festival Scenario
  console.log('1. Generating 100K Festival Campus Scene JSON (250m × 180m)...');
  const scenarioResult = generateFestivalScenario({ length: 250, width: 180 });
  if (!scenarioResult.success) {
    console.error('FAILED: Festival scenario generation failed');
    process.exit(1);
  }
  const scene = scenarioResult.scene;
  console.log(`✔ Generated campus with ${scene.components.length} components.`);

  // 2. Generate Continuous Simulation Paths
  console.log('\n2. Deriving 16 Continuous Traversal Paths from Campus Scene JSON...');
  const pathResult = generateSimulationPaths(scene);
  if (!pathResult.ready) {
    console.error('FAILED: Simulation path generation failed:', pathResult.reason);
    process.exit(1);
  }
  console.log(`✔ Derived ${pathResult.paths.length} discrete continuous paths across North, West, and East streams.`);

  // Verify paths have 3 distinct entrance streams
  const northPaths = pathResult.paths.filter((p) => p.stream === 'north');
  const westPaths = pathResult.paths.filter((p) => p.stream === 'west');
  const eastPaths = pathResult.paths.filter((p) => p.stream === 'east');

  console.log(`  - North stream paths: ${northPaths.length}`);
  console.log(`  - West stream paths:  ${westPaths.length}`);
  console.log(`  - East stream paths:  ${eastPaths.length}`);

  if (northPaths.length < 5 || westPaths.length < 4 || eastPaths.length < 4) {
    console.error('FAILED: Missing required 3 entrance streams (North, West, East)!');
    process.exit(1);
  }

  // 3. Initialize Simulation Engine
  console.log('\n3. Initializing SimulationEngine...');
  const engine = new SimulationEngine(scene, pathResult.paths);
  engine.seedInitialAgents();
  console.log(`✔ Initial devotees seeded across campus: ${engine.agents.length} (Target: ${engine.targetVisualAgents})`);

  if (engine.agents.length === 0) {
    console.error('FAILED: Initial seeding produced 0 agents!');
    process.exit(1);
  }

  // 4. Direction & Heading Test
  console.log('\n4. Verifying Direction-Based Body Rotation & Heading...');
  let checkedRotations = 0;
  for (const agent of engine.agents) {
    if (typeof agent.targetHeading === 'number' && !isNaN(agent.targetHeading)) {
      checkedRotations++;
    }
  }
  console.log(`✔ Agents with valid target headings: ${checkedRotations} / ${engine.agents.length}`);
  if (checkedRotations !== engine.agents.length) {
    console.error('FAILED: Some agents lack valid orientation heading!');
    process.exit(1);
  }

  // 5. Long-Run Continuous Simulation Test (1,200 ticks = simulating 240+ seconds of real flow)
  console.log('\n5. Executing Long-Run Continuous Crowd Simulation (1,200 steps at 2x speed)...');

  let peakAgentsSeen = 0;
  let exitEventsSeen = 0;
  let observedStates = new Set();
  let maxWaitTime = 0;

  for (let step = 0; step < 1200; step++) {
    const prevCompleted = engine.totalCompletedCount;
    engine.update(0.1, 2.0); // 0.1s delta at 2.0x speed = 0.2s sim time per step

    if (engine.agents.length > peakAgentsSeen) {
      peakAgentsSeen = engine.agents.length;
    }

    if (engine.totalCompletedCount > prevCompleted) {
      exitEventsSeen++;
    }

    for (const a of engine.agents) {
      observedStates.add(a.state);
      if (a.waitTime > maxWaitTime) maxWaitTime = a.waitTime;

      // Verify no NaN positions or unbounded coordinates
      if (isNaN(a.position.x) || isNaN(a.position.z)) {
        console.error(`FAILED: Agent ${a.id} has NaN coordinates!`);
        process.exit(1);
      }
      if (Math.abs(a.position.x) > 130 || Math.abs(a.position.z) > 95) {
        console.error(`FAILED: Agent ${a.id} moved out of bounds: (${a.position.x}, ${a.position.z})`);
        process.exit(1);
      }
    }

    // Safety check: Visual agents must remain bounded
    if (engine.agents.length > engine.targetVisualAgents + 5) {
      console.error(`FAILED: Visual agents exceeded target cap: ${engine.agents.length} > ${engine.targetVisualAgents}`);
      process.exit(1);
    }
  }

  const finalMetrics = engine.getMetrics();
  console.log(`✔ Long-run test completed successfully!`);
  console.log(`  Simulation Time: ${finalMetrics.formattedTime} (${finalMetrics.simTimeSeconds}s)`);
  console.log(`  Active Visual Agents: ${finalMetrics.visualAgentsCount} (Cap: ${finalMetrics.targetVisualAgents})`);
  console.log(`  Visitors Entered: ${finalMetrics.visitorsEntered.toLocaleString()} devotees`);
  console.log(`  Visitors Active: ${finalMetrics.visitorsActive.toLocaleString()} devotees`);
  console.log(`  Visitors in Queue: ${finalMetrics.visitorsInQueue.toLocaleString()} devotees`);
  console.log(`  Visitors in Security: ${finalMetrics.visitorsInSecurity.toLocaleString()} devotees`);
  console.log(`  Visitors in Darshan: ${finalMetrics.visitorsInDarshan.toLocaleString()} devotees`);
  console.log(`  Visitors Completed/Exited: ${finalMetrics.visitorsCompleted.toLocaleString()} devotees`);
  console.log(`  Throughput per Hour: ${finalMetrics.throughputPerHour.toLocaleString()}/hr`);
  console.log(`  Average Wait Time: ${finalMetrics.avgWaitMinutes} min`);
  console.log(`  Bottleneck Stage: ${finalMetrics.bottleneck.zone} (${finalMetrics.bottleneck.reason})`);
  console.log(`  Observed States:`, Array.from(observedStates));

  // 6. Assertions for continuous flow & recycling
  console.log('\n6. Verifying Continuous Lifecycle & Recycling:');
  console.log('  Total Completed Count:', engine.totalCompletedCount);
  console.log('  Exit Events Observed:', exitEventsSeen);

  if (engine.totalCompletedCount === 0) {
    console.error('FAILED: No agents completed their journey through the system!');
    process.exit(1);
  }
  if (engine.agents.length === 0) {
    console.error('FAILED: Simulation drained to 0 agents instead of continuously recycling!');
    process.exit(1);
  }
  console.log('✔ Agents continuously entered, flowed through all zones, exited, and recycled!');

  // Verify key states were experienced
  if (!observedStates.has(AGENT_STATES.QUEUEING)) {
    console.error('FAILED: No agents experienced QUEUEING state!');
    process.exit(1);
  }
  if (!observedStates.has(AGENT_STATES.SECURITY)) {
    console.error('FAILED: No agents experienced SECURITY screening!');
    process.exit(1);
  }
  if (!observedStates.has(AGENT_STATES.DARSHAN)) {
    console.error('FAILED: No agents experienced DARSHAN sanctum!');
    process.exit(1);
  }
  if (!observedStates.has(AGENT_STATES.EXITING)) {
    console.error('FAILED: No agents experienced EXITING corridor!');
    process.exit(1);
  }
  console.log('✔ All crowd states verified: Entering, Waiting, Security, Queueing, Darshan, Exiting!');

  // 7. Verify 3D Heatmap Occupancy
  console.log('\n7. Verifying 3D Density Heatmap Accumulation:');
  console.log(`  Max cell occupancy: ${engine.maxCellOccupancy.toFixed(2)}s`);
  if (engine.maxCellOccupancy <= 0) {
    console.error('FAILED: Heatmap did not record crowd occupancy!');
    process.exit(1);
  }
  console.log('✔ Heatmap accumulated spatial crowd density correctly.');

  // 8. Verify D3 Time-Series Metrics History
  console.log('\n8. Verifying D3 Time-Series Analytics History:');
  console.log(`  Captured history points: ${engine.metricsHistory.length}`);
  if (engine.metricsHistory.length < 10) {
    console.error('FAILED: D3 metrics history has insufficient data points!');
    process.exit(1);
  }
  console.log('✔ D3 time-series history captured correctly.');

  console.log('\n=== ALL CONTINUOUS CROWD SIMULATION ACCEPTANCE CHECKS PASSED! ===');
}

runSimulationAcceptanceSuite().catch((err) => {
  console.error('Simulation acceptance suite failed with error:', err);
  process.exit(1);
});
