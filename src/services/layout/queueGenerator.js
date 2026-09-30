/**
 * DevaSetu Procedural Queue Generators
 * Produces deterministic, normalized Scene JSON component specifications.
 */

import { COMPONENT_TYPES } from '../../utils/componentDefaults.js';

/**
 * 1. PARALLEL QUEUE TEMPLATE
 * Multiple straight parallel channels side-by-side
 */
export function generateParallelLanes(zones, params, genId) {
  const lanes = Math.max(1, parseInt(params.lanes, 10) || 4);
  const laneWidth = Math.max(1.0, parseFloat(params.laneWidth) || 2.0);
  const spacing = Math.max(0.5, parseFloat(params.spacing) || 1.5);

  const totalWidthNeeded = lanes * laneWidth + (lanes - 1) * spacing;
  if (totalWidthNeeded > zones.usableWidth) {
    return {
      fits: false,
      reason: `${lanes} parallel lanes of ${laneWidth}m width and ${spacing}m spacing require ${totalWidthNeeded.toFixed(1)}m width, but only ${zones.usableWidth.toFixed(1)}m is usable inside the site.`,
      suggestion: `Reduce lane count to ${Math.floor(zones.usableWidth / (laneWidth + spacing))} or decrease spacing to ${(zones.usableWidth / lanes - laneWidth).toFixed(1)}m.`,
    };
  }

  const queueLength = Math.max(4, Math.floor(zones.queueZoneWidth * 0.88));
  const startZ = -totalWidthNeeded / 2 + laneWidth / 2;
  const components = [];

  for (let i = 0; i < lanes; i++) {
    const laneZ = startZ + i * (laneWidth + spacing);
    components.push({
      id: `gen-queue-${genId}-lane-${i + 1}`,
      type: COMPONENT_TYPES.QUEUE,
      name: `Queue Lane ${i + 1}`,
      position: {
        x: Math.round(zones.queueCenter.x * 10) / 10,
        y: 0,
        z: Math.round(laneZ * 10) / 10,
      },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: queueLength,
        width: laneWidth,
        height: 1.0,
      },
      properties: {
        lanes: 1,
        direction: 'forward',
      },
      generated: true,
      generationId: genId,
      role: 'queue-lane',
      template: 'parallel',
    });
  }

  return { fits: true, components, totalWidthNeeded, queueLength };
}

/**
 * 2. SERPENTINE QUEUE TEMPLATE
 * Continuous zigzag back-and-forth channel
 */
export function generateSerpentineLanes(zones, params, genId) {
  const lanes = Math.max(2, parseInt(params.lanes, 10) || 4);
  const laneWidth = Math.max(1.0, parseFloat(params.laneWidth) || 2.0);
  const spacing = Math.max(0.6, parseFloat(params.spacing) || 1.2);

  const totalWidthNeeded = lanes * laneWidth + (lanes - 1) * spacing;
  if (totalWidthNeeded > zones.usableWidth) {
    return {
      fits: false,
      reason: `${lanes} serpentine rows require ${totalWidthNeeded.toFixed(1)}m width, exceeding the available ${zones.usableWidth.toFixed(1)}m site span.`,
      suggestion: `Reduce row count to ${Math.max(2, Math.floor(zones.usableWidth / (laneWidth + spacing)))} or adjust lane width.`,
    };
  }

  const queueLength = Math.max(5, Math.floor(zones.queueZoneWidth * 0.85));
  const startZ = -totalWidthNeeded / 2 + laneWidth / 2;
  const components = [];

  for (let i = 0; i < lanes; i++) {
    const rowZ = startZ + i * (laneWidth + spacing);
    // Alternate direction: even rows go right (0°), odd rows go left (180°)
    const isEven = i % 2 === 0;
    const rotation = isEven ? 0 : 180;

    components.push({
      id: `gen-queue-${genId}-serp-${i + 1}`,
      type: COMPONENT_TYPES.QUEUE,
      name: `Serpentine Section ${i + 1}`,
      position: {
        x: Math.round(zones.queueCenter.x * 10) / 10,
        y: 0,
        z: Math.round(rowZ * 10) / 10,
      },
      rotation,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: queueLength,
        width: laneWidth,
        height: 1.0,
      },
      properties: {
        lanes: 1,
        direction: isEven ? 'forward' : 'reverse',
      },
      generated: true,
      generationId: genId,
      role: 'queue-segment',
      template: 'serpentine',
    });

    // Add turnaround guide barrier at alternating ends between segments
    if (i < lanes - 1) {
      const turnBarrierX = isEven
        ? zones.queueCenter.x + queueLength / 2 + 0.5
        : zones.queueCenter.x - queueLength / 2 - 0.5;

      const turnBarrierZ = rowZ + (laneWidth + spacing) / 2;

      components.push({
        id: `gen-barrier-${genId}-turn-${i + 1}`,
        type: COMPONENT_TYPES.BARRIER,
        name: `Turn Guide ${i + 1}`,
        position: {
          x: Math.round(turnBarrierX * 10) / 10,
          y: 0,
          z: Math.round(turnBarrierZ * 10) / 10,
        },
        rotation: 90,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: {
          length: laneWidth + spacing + 0.4,
          width: 0.3,
          height: 1.0,
        },
        properties: { style: 'turn-barrier' },
        generated: true,
        generationId: genId,
        role: 'turn-barrier',
        template: 'serpentine',
      });
    }
  }

  return { fits: true, components, totalWidthNeeded, queueLength };
}

/**
 * 3. U-SHAPE QUEUE TEMPLATE
 * Loop channel running down and returning back
 */
export function generateUShapeLanes(zones, params, genId) {
  const laneWidth = Math.max(1.2, parseFloat(params.laneWidth) || 2.2);
  const spacing = Math.max(1.5, parseFloat(params.spacing) || 3.0);

  const totalWidthNeeded = laneWidth * 2 + spacing;
  if (totalWidthNeeded > zones.usableWidth) {
    return {
      fits: false,
      reason: `U-Shape layout requires at least ${totalWidthNeeded.toFixed(1)}m width, but available width is only ${zones.usableWidth.toFixed(1)}m.`,
      suggestion: 'Decrease turnaround center spacing or reduce lane width.',
    };
  }

  const armLength = Math.max(6, Math.floor(zones.queueZoneWidth * 0.82));
  const halfSpanZ = totalWidthNeeded / 2 - laneWidth / 2;
  const components = [];

  // Outbound Arm (Leg 1)
  components.push({
    id: `gen-queue-${genId}-ushape-arm1`,
    type: COMPONENT_TYPES.QUEUE,
    name: 'U-Shape Forward Leg',
    position: {
      x: Math.round(zones.queueCenter.x * 10) / 10,
      y: 0,
      z: Math.round(-halfSpanZ * 10) / 10,
    },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: {
      length: armLength,
      width: laneWidth,
      height: 1.0,
    },
    properties: { lanes: 1, direction: 'forward' },
    generated: true,
    generationId: genId,
    role: 'queue-arm',
    template: 'u_shape',
  });

  // Base Turnaround Connector
  const turnX = zones.queueCenter.x + armLength / 2 - laneWidth / 2;
  components.push({
    id: `gen-queue-${genId}-ushape-turn`,
    type: COMPONENT_TYPES.QUEUE,
    name: 'U-Shape Turn Connector',
    position: {
      x: Math.round(turnX * 10) / 10,
      y: 0,
      z: 0,
    },
    rotation: 90,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: {
      length: totalWidthNeeded - laneWidth,
      width: laneWidth,
      height: 1.0,
    },
    properties: { lanes: 1, direction: 'turn' },
    generated: true,
    generationId: genId,
    role: 'queue-turn',
    template: 'u_shape',
  });

  // Return Arm (Leg 2)
  components.push({
    id: `gen-queue-${genId}-ushape-arm2`,
    type: COMPONENT_TYPES.QUEUE,
    name: 'U-Shape Return Leg',
    position: {
      x: Math.round(zones.queueCenter.x * 10) / 10,
      y: 0,
      z: Math.round(halfSpanZ * 10) / 10,
    },
    rotation: 180,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: {
      length: armLength,
      width: laneWidth,
      height: 1.0,
    },
    properties: { lanes: 1, direction: 'reverse' },
    generated: true,
    generationId: genId,
    role: 'queue-arm',
    template: 'u_shape',
  });

  return { fits: true, components, totalWidthNeeded, queueLength: armLength * 2 };
}

/**
 * 4. SPLIT QUEUE TEMPLATE
 * Entrance feeds into multiple parallel branches that converge towards Darshan
 */
export function generateSplitLanes(zones, params, genId) {
  const laneWidth = Math.max(1.0, parseFloat(params.laneWidth) || 2.0);
  const branches = Math.max(2, Math.min(3, parseInt(params.lanes, 10) || 2));
  const spacing = Math.max(1.2, parseFloat(params.spacing) || 2.5);

  const totalWidthNeeded = branches * laneWidth + (branches - 1) * spacing;
  if (totalWidthNeeded > zones.usableWidth) {
    return {
      fits: false,
      reason: `Split layout with ${branches} branches requires ${totalWidthNeeded.toFixed(1)}m width, exceeding the available ${zones.usableWidth.toFixed(1)}m.`,
      suggestion: 'Reduce split branch count to 2 or decrease branch spacing.',
    };
  }

  const branchLength = Math.max(5, Math.floor(zones.queueZoneWidth * 0.8));
  const startZ = -totalWidthNeeded / 2 + laneWidth / 2;
  const components = [];

  for (let b = 0; b < branches; b++) {
    const branchZ = startZ + b * (laneWidth + spacing);
    const branchLetter = String.fromCharCode(65 + b); // A, B, C

    components.push({
      id: `gen-queue-${genId}-branch-${branchLetter}`,
      type: COMPONENT_TYPES.QUEUE,
      name: `Queue Branch ${branchLetter}`,
      position: {
        x: Math.round(zones.queueCenter.x * 10) / 10,
        y: 0,
        z: Math.round(branchZ * 10) / 10,
      },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: branchLength,
        width: laneWidth,
        height: 1.0,
      },
      properties: { lanes: 1, branch: branchLetter },
      generated: true,
      generationId: genId,
      role: 'queue-branch',
      template: 'split',
    });
  }

  return { fits: true, components, totalWidthNeeded, queueLength: branchLength * branches };
}
