/**
 * DevaSetu Procedural Layout Generator Engine
 * Deterministic spatial orchestration from user requirements to Scene JSON.
 */

import { COMPONENT_TYPES } from '../../utils/componentDefaults.js';
import { computeLayoutZones } from './componentPositioner.js';
import {
  generateParallelLanes,
  generateSerpentineLanes,
  generateUShapeLanes,
  generateSplitLanes,
} from './queueGenerator.js';
import { validateLayout } from './layoutValidator.js';
import { generateFestivalScenario } from './festivalScenarioGenerator.js';

export const QUEUE_TEMPLATES = {
  PARALLEL: 'parallel',
  SERPENTINE: 'serpentine',
  U_SHAPE: 'u_shape',
  SPLIT: 'split',
  CAMPUS: 'campus',
};

export const QUEUE_TEMPLATE_LABELS = {
  [QUEUE_TEMPLATES.PARALLEL]: 'Parallel Lanes',
  [QUEUE_TEMPLATES.SERPENTINE]: 'Serpentine (Zig-Zag)',
  [QUEUE_TEMPLATES.U_SHAPE]: 'U-Shape Continuous',
  [QUEUE_TEMPLATES.SPLIT]: 'Split Convergence',
  [QUEUE_TEMPLATES.CAMPUS]: 'Distributed Campus (Multi-Zone)',
};

export const DEFAULT_GENERATION_OPTIONS = {
  template: QUEUE_TEMPLATES.PARALLEL,
  lanes: 4,
  laneWidth: 2.0,
  spacing: 1.5,
  includeSecurity: true,
  includeWaitingArea: false,
  includeTempleArchitecture: true,
};

let genSequence = 1;

/**
 * Procedurally generates a complete, deterministic crowd management layout
 */
export function generateProceduralLayout(scene, userOptions = {}) {
  const options = { ...DEFAULT_GENERATION_OPTIONS, ...userOptions };
  const site = scene.site;
  const requirements = scene.requirements;

  // Minimum dimensional feasibility check
  if (!site || site.length < 12 || site.width < 8) {
    return {
      success: false,
      reason: `Site dimensions (${site?.length || 0}m × ${site?.width || 0}m) are too constrained for procedural layout planning.`,
      suggestion: 'Expand site length to at least 20m and width to at least 15m to generate a standard queue system.',
    };
  }

  // Campus Multi-Zone Template Check
  const isCampus =
    options.template === QUEUE_TEMPLATES.CAMPUS ||
    options.multiZone === true ||
    (site && site.length >= 140 && site.width >= 100 && (requirements?.peakVisitors >= 5000 || options.template === 'campus'));

  if (isCampus) {
    if (!site || site.length < 140 || site.width < 100) {
      return {
        success: false,
        reason: `Distributed Temple Campus requires a campus site of at least 140m × 100m (current: ${site?.length || 0}m × ${site?.width || 0}m).`,
        suggestion: 'Expand site dimensions to 250m × 180m in Space Info panel or switch to Parallel/Serpentine.',
      };
    }
    const genId = `gen-fest-${Date.now().toString(36)}-${genSequence++}`;
    const campusRes = generateFestivalScenario(site, { ...options, generationId: genId });
    return {
      success: true,
      generationId: genId,
      template: QUEUE_TEMPLATES.CAMPUS,
      components: campusRes.components,
      summary: campusRes.summary,
      validation: campusRes.scene?.analysis,
    };
  }

  const zones = computeLayoutZones(site);
  if (zones.usableLength < 10 || zones.usableWidth < 6) {
    return {
      success: false,
      reason: `Usable interior crowd space (${zones.usableLength.toFixed(1)}m × ${zones.usableWidth.toFixed(1)}m) is too small after boundary margins.`,
      suggestion: 'Increase available space dimensions in the Space Info panel.',
    };
  }

  const genId = `gen-${Date.now().toString(36)}-${genSequence++}`;
  const allComponents = [];

  // 1. Generate Queue Lanes via selected Template
  let queueResult;
  switch (options.template) {
    case QUEUE_TEMPLATES.SERPENTINE:
      queueResult = generateSerpentineLanes(zones, options, genId);
      break;
    case QUEUE_TEMPLATES.U_SHAPE:
      queueResult = generateUShapeLanes(zones, options, genId);
      break;
    case QUEUE_TEMPLATES.SPLIT:
      queueResult = generateSplitLanes(zones, options, genId);
      break;
    case QUEUE_TEMPLATES.PARALLEL:
    default:
      queueResult = generateParallelLanes(zones, options, genId);
      break;
  }

  if (!queueResult.fits) {
    return {
      success: false,
      reason: queueResult.reason,
      suggestion: queueResult.suggestion,
    };
  }

  // 2. Entrance System Placement
  const hasTempleArch = options.includeTempleArchitecture !== false && zones.usableLength >= 48 && zones.usableWidth >= 20;

  if (hasTempleArch) {
    // A. Ceremonial Entrance Gopuram Gateway
    const gopuramEntranceX = Math.round((zones.usableMinX + 1.2) * 10) / 10;
    allComponents.push({
      id: `gen-gopuram-entrance-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'Entrance Raja Dvaram Gopuram',
      position: { x: gopuramEntranceX, y: 0, z: 0 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: Math.min(14, zones.usableWidth * 0.4),
        width: 6,
        height: 16,
      },
      properties: {
        tiers: 5,
        archWidth: 4.5,
        archHeight: 4.2,
        kalasams: 5,
        stoneColor: '#BFA382',
        roleDescription: 'Ceremonial Dravidian entrance gateway tower',
      },
      generated: true,
      generationId: genId,
      role: 'entrance-gopuram',
      template: options.template,
    });
  }

  // Entrance Gate Placement (Anchor into Queue Area)
  const entranceX = Math.round((hasTempleArch ? zones.usableMinX + 6.5 : zones.usableMinX + 2.5) * 10) / 10;
  allComponents.push({
    id: `gen-entrance-${genId}`,
    type: COMPONENT_TYPES.ENTRANCE,
    name: 'Main Entrance Gate',
    position: {
      x: entranceX,
      y: 0,
      z: 0,
    },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: {
      length: 4.0,
      width: 1.2,
      height: 3.2,
    },
    properties: {
      signage: 'ENTRY',
      archType: 'traditional',
    },
    generated: true,
    generationId: genId,
    role: 'entrance',
    template: options.template,
  });

  // 3. Security Checkpoint (Between Entrance and Queue Arena)
  if (options.includeSecurity) {
    const securityX = Math.round((entranceX + 4.5) * 10) / 10;
    allComponents.push({
      id: `gen-security-${genId}`,
      type: COMPONENT_TYPES.SECURITY,
      name: 'Security Screening DFMD',
      position: {
        x: securityX,
        y: 0,
        z: 0,
      },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: 5.0,
        width: 3.0,
        height: 2.6,
      },
      properties: {
        metalDetector: true,
        baggageCounter: true,
      },
      generated: true,
      generationId: genId,
      role: 'security',
      template: options.template,
    });
  }

  // 4. Add Queue Lanes and Guiding Barriers
  allComponents.push(...queueResult.components);

  // 5. Waiting Area Holding Bay (Optional holding area alongside queue)
  if (options.includeWaitingArea && zones.usableWidth > 20) {
    const waitZ = Math.round((zones.usableMaxZ - 4.5) * 10) / 10;
    allComponents.push({
      id: `gen-waiting-${genId}`,
      type: COMPONENT_TYPES.WAITING,
      name: 'Holding Bay Waiting Area',
      position: {
        x: Math.round(zones.queueCenter.x * 10) / 10,
        y: 0,
        z: waitZ,
      },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: 12.0,
        width: 6.0,
        height: 0.8,
      },
      properties: {
        seatingRows: 2,
        capacity: 40,
      },
      generated: true,
      generationId: genId,
      role: 'waiting-bay',
      template: options.template,
    });
  }

  // 6. Temple Architecture - Main Gopuram & Darshan Sanctorum
  let darshanX = Math.round((zones.usableMaxX - 3.5) * 10) / 10;

  if (hasTempleArch) {
    // Place Main Gopuram before Darshan point with ample room for Sanctum
    const mainGopuramX = Math.round(Math.min(zones.usableMaxX - 14.0, zones.queueMaxX + 4.0) * 10) / 10;
    allComponents.push({
      id: `gen-gopuram-main-${genId}`,
      type: COMPONENT_TYPES.MAIN_GOPURAM,
      name: 'Main Raja Gopuram',
      position: { x: mainGopuramX, y: 0, z: 0 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: {
        length: Math.min(16, zones.usableWidth * 0.45),
        width: 8,
        height: 22,
      },
      properties: {
        tiers: 7,
        archWidth: 5.5,
        archHeight: 5.5,
        kalasams: 7,
        stoneColor: '#9C7A5B',
        roleDescription: 'Majestic Raja Gopuram landmark terminating queue approach to sanctum',
      },
      generated: true,
      generationId: genId,
      role: 'main-gopuram',
      template: options.template,
    });

    // Darshan viewing point through portal
    darshanX = Math.round((mainGopuramX + 5.0) * 10) / 10;

    // Sacred Darshan Sanctum Vimana Tower
    const sanctumX = Math.round((darshanX + 6.0) * 10) / 10;
    if (sanctumX <= zones.usableMaxX + 2.0) {
      allComponents.push({
        id: `gen-darshan-sanctum-${genId}`,
        type: COMPONENT_TYPES.DARSHAN_SANCTUM,
        name: `${scene.temple?.name || 'Sri Ganesha'} Maha Garbhagriha`,
        position: { x: sanctumX, y: 0, z: 0 },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 10, width: 10, height: 12 },
        properties: {
          vimanaHeight: 12,
          sanctumPillars: 8,
          diyaGlow: true,
          deity: scene.temple?.name || 'Sri Ganesha',
        },
        generated: true,
        generationId: genId,
        role: 'darshan-sanctum',
        template: options.template,
      });
    }
  }

  // Darshan Point (Viewing focal point)
  allComponents.push({
    id: `gen-darshan-${genId}`,
    type: COMPONENT_TYPES.DARSHAN,
    name: 'Darshan Sanctorum',
    position: {
      x: darshanX,
      y: 0,
      z: 0,
    },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: {
      length: 5.0,
      width: 4.0,
      height: 2.8,
    },
    properties: {
      sanctumFocal: true,
      viewingWidth: 4.5,
    },
    generated: true,
    generationId: genId,
    role: 'darshan',
    template: options.template,
  });

  // 7. Exit Corridor (Dispersal Pathway from Darshan to Perimeter Egress)
  const exitZ = Math.round((zones.usableMinZ + 3.0) * 10) / 10;
  allComponents.push({
    id: `gen-exit-${genId}`,
    type: COMPONENT_TYPES.EXIT,
    name: 'Dispersal Exit Corridor',
    position: {
      x: darshanX,
      y: 0,
      z: exitZ,
    },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: {
      length: 7.0,
      width: 2.8,
      height: 2.4,
    },
    properties: {
      signage: 'EXIT',
      oneWay: true,
    },
    generated: true,
    generationId: genId,
    role: 'exit',
    template: options.template,
  });

  // 8. Run Validation on the generated Scene JSON
  const validation = validateLayout({
    site,
    components: allComponents,
    requirements,
  });

  return {
    success: true,
    generationId: genId,
    template: options.template,
    components: allComponents,
    validation,
  };
}
