/**
 * Acceptance test for DevaSetu 100K Festival Distributed Multi-Zone Campus
 */

import { generateProceduralLayout, QUEUE_TEMPLATES } from './src/services/layout/layoutGenerator.js';
import { generateAiLayoutRecommendations } from './src/services/ai/layoutAgent.js';
import { COMPONENT_TYPES } from './src/utils/componentDefaults.js';

async function runAcceptanceTest() {
  console.log('=== STARTING 100K FESTIVAL CAMPUS ACCEPTANCE TEST ===\n');

  const festivalScene = {
    temple: { name: 'Sri Ganesha Temple' },
    site: { length: 250, width: 180, unit: 'meters' },
    requirements: {
      expectedVisitors: 100000,
      peakVisitors: 15000,
      averageArrivalPerHour: 8333,
      peakArrivalPerHour: 12000,
      operatingHours: 12,
    },
    components: [],
  };

  // Test 1: Direct Procedural Campus Layout Generation
  console.log('1. Testing generateProceduralLayout with template: campus...');
  const layoutResult = generateProceduralLayout(festivalScene, {
    template: QUEUE_TEMPLATES.CAMPUS,
  });

  if (!layoutResult.success) {
    console.error('FAILED: Procedural layout generation failed:', layoutResult.reason);
    process.exit(1);
  }
  console.log('✔ Procedural generation succeeded!');
  console.log(`  Components generated: ${layoutResult.components.length}`);
  console.log(`  Campus summary:`, layoutResult.summary);

  const comps = layoutResult.components;

  // Check 1: 5 Gopurams (3 incoming, 1 exit, 1 central main)
  const northGopuram = comps.find((c) => c.role === 'north-gopuram' || (c.type === COMPONENT_TYPES.ENTRANCE_GOPURAM && c.properties?.orientation === 'north'));
  const westGopuram = comps.find((c) => c.role === 'west-gopuram' || (c.type === COMPONENT_TYPES.ENTRANCE_GOPURAM && c.properties?.orientation === 'west'));
  const eastGopuram = comps.find((c) => c.role === 'east-gopuram' || (c.type === COMPONENT_TYPES.ENTRANCE_GOPURAM && c.properties?.orientation === 'east'));
  const southGopuram = comps.find((c) => c.role === 'south-gopuram' || (c.type === COMPONENT_TYPES.ENTRANCE_GOPURAM && c.properties?.orientation === 'south'));
  const mainGopuram = comps.find((c) => c.type === COMPONENT_TYPES.MAIN_GOPURAM);
  const darshanSanctum = comps.find((c) => c.type === COMPONENT_TYPES.DARSHAN_SANCTUM || c.type === COMPONENT_TYPES.DARSHAN);

  console.log('\n2. Verifying Gopuram Architecture:');
  console.log('  North Gopuram (Incoming):', !!northGopuram, northGopuram?.name, northGopuram?.position);
  console.log('  West Gopuram (Incoming):', !!westGopuram, westGopuram?.name, westGopuram?.position);
  console.log('  East Gopuram (Incoming):', !!eastGopuram, eastGopuram?.name, eastGopuram?.position);
  console.log('  South Gopuram (Public Exit):', !!southGopuram, southGopuram?.name, southGopuram?.position);
  console.log('  Central Main Gopuram:', !!mainGopuram, mainGopuram?.name, mainGopuram?.position);
  console.log('  Darshan Sanctum:', !!darshanSanctum, darshanSanctum?.name, darshanSanctum?.position);

  if (!northGopuram || !westGopuram || !eastGopuram || !southGopuram || !mainGopuram || !darshanSanctum) {
    console.error('FAILED: Missing required 5-gopuram / sanctum architectural elements!');
    process.exit(1);
  }

  // Check 2: Queue pattern diversity (at least 3 patterns)
  const patterns = new Set();
  comps.forEach((c) => {
    if (c.properties?.pattern) patterns.add(c.properties.pattern);
  });
  console.log('\n3. Verifying Queue Pattern Diversity:');
  console.log('  Detected patterns:', Array.from(patterns));
  if (patterns.size < 3) {
    console.error(`FAILED: Expected at least 3 distinct queue patterns, found: ${patterns.size}`);
    process.exit(1);
  }

  // Check 3: Security Channels
  const securityComps = comps.filter((c) => c.type === COMPONENT_TYPES.SECURITY);
  console.log(`\n4. Verifying Security Screening Channels: ${securityComps.length} channels`);
  if (securityComps.length < 12) {
    console.error(`FAILED: Expected at least 12 parallel security channels, found: ${securityComps.length}`);
    process.exit(1);
  }

  // Check 4: Post-Darshan Dispersal Plaza
  const dispersalPlaza = comps.find((c) => c.role === 'post-darshan-plaza' || c.properties?.zone === 'F');
  console.log('\n5. Verifying Post-Darshan Dispersal Plaza:');
  console.log('  Dispersal Plaza present:', !!dispersalPlaza, dispersalPlaza?.name, dispersalPlaza?.dimensions);
  if (!dispersalPlaza) {
    console.error('FAILED: Post-Darshan Dispersal Plaza is missing!');
    process.exit(1);
  }

  // Check 5: Bounds validation (all components strictly inside 250m x 180m site)
  console.log('\n6. Verifying Spatial Boundaries:');
  const halfL = 250 / 2;
  const halfW = 180 / 2;
  let outOfBounds = 0;
  comps.forEach((c) => {
    const halfCL = (c.dimensions?.length || 1) / 2;
    const halfCW = (c.dimensions?.width || 1) / 2;
    if (
      c.position.x - halfCL < -halfL - 0.5 ||
      c.position.x + halfCL > halfL + 0.5 ||
      c.position.z - halfCW < -halfW - 0.5 ||
      c.position.z + halfCW > halfW + 0.5
    ) {
      console.warn(`  Warning: Component ${c.name} (${c.id}) is near/outside boundary: pos=(${c.position.x}, ${c.position.z})`);
      outOfBounds++;
    }
  });
  console.log(`  Out of bounds count: ${outOfBounds}`);
  if (outOfBounds > 0) {
    console.error(`FAILED: ${outOfBounds} components violate site bounds!`);
    process.exit(1);
  }

  // Test 6: AI Layout Agent on 250m x 180m site
  console.log('\n7. Testing AI Layout Agent on 250m × 180m festival site...');
  const aiResult = await generateAiLayoutRecommendations(
    festivalScene,
    'Design a realistic 100K festival crowd campus with multiple gopurams and varied queue patterns',
    { allowFallback: true }
  );

  console.log(`  AI Result Success: ${aiResult.success}, fallback: ${aiResult.isFallback}`);
  console.log(`  Recommendations count: ${aiResult.recommendations?.length || 0}`);
  if (!aiResult.success || !aiResult.recommendations || aiResult.recommendations.length === 0) {
    console.error('FAILED: AI Layout Agent did not return recommendations!');
    process.exit(1);
  }

  const topRec = aiResult.recommendations[0];
  console.log(`  Top Recommendation: "${topRec.title}" | template: ${topRec.intent?.template} | fits: ${topRec.fits} | components: ${topRec.components?.length}`);

  if (topRec.intent?.template !== 'campus' && topRec.intent?.template !== 'serpentine') {
    console.warn('  Note: Top template is', topRec.intent?.template);
  }

  console.log('\n=== ALL 100K FESTIVAL CAMPUS ACCEPTANCE CHECKS PASSED SUCCESSFULLY! ===');
}

runAcceptanceTest().catch((err) => {
  console.error('Acceptance test failed with error:', err);
  process.exit(1);
});
