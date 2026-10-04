/**
 * DevaSetu Procedural Layout Generator Engine
 * Deterministic spatial orchestration from user architectural prompts to Scene JSON.
 */

import { COMPONENT_TYPES } from '../../utils/componentDefaults.js';
import { computeLayoutZones } from './componentPositioner.js';
import {
  generateParallelLanes,
  generateSerpentineLanes,
  generateUShapeLanes,
  generateSplitLanes,
  generateArcLanes,
  generateSShapeLanes,
  generateRadialLanes,
} from './queueGenerator.js';
import { validateLayout } from './layoutValidator.js';
import { generateFestivalScenario } from './festivalScenarioGenerator.js';
import { extractArchitecturalIntentFromPrompt } from './promptArchitectureExtractor.js';

export const QUEUE_TEMPLATES = {
  PARALLEL: 'parallel',
  SERPENTINE: 'serpentine',
  U_SHAPE: 'u_shape',
  SPLIT: 'split',
  CAMPUS: 'campus',
  ARC: 'arc',
  CURVED: 'curved',
  S_SHAPE: 's_shape',
  RADIAL: 'radial',
};

export const QUEUE_TEMPLATE_LABELS = {
  [QUEUE_TEMPLATES.PARALLEL]: 'Parallel Lanes',
  [QUEUE_TEMPLATES.SERPENTINE]: 'Serpentine (Zig-Zag)',
  [QUEUE_TEMPLATES.U_SHAPE]: 'U-Shape Continuous',
  [QUEUE_TEMPLATES.SPLIT]: 'Split Convergence',
  [QUEUE_TEMPLATES.CAMPUS]: 'Distributed Campus (Multi-Zone)',
  [QUEUE_TEMPLATES.ARC]: 'Curved Arc',
  [QUEUE_TEMPLATES.CURVED]: 'Curved Ribbon',
  [QUEUE_TEMPLATES.S_SHAPE]: 'S-Shape Continuous',
  [QUEUE_TEMPLATES.RADIAL]: 'Radial Darshan Approach',
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
 * directly determined by user architectural prompt requirements.
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

  // Extract architectural intent from user prompt (or pass pre-structured architecture)
  const promptText = options.prompt || scene.prompt || scene.options?.prompt || '';
  const promptArch = extractArchitecturalIntentFromPrompt(promptText, site);
  const arch = {
    ...promptArch,
    ...(options.architecture || {}),
  };

  const hasExplicitArchitecture = Boolean(
    options.architecture ||
    (promptText && (
      arch.gopuramCount !== 2 ||
      arch.entranceCount !== 1 ||
      arch.exitCount !== 1 ||
      arch.sanctumPosition !== 'east' ||
      arch.queueSystemCount !== 1 ||
      arch.hasCircumambulatoryPath ||
      arch.hasVipEntrance ||
      arch.preferredTemplate !== 'parallel'
    ))
  );

  // Campus Multi-Zone Template Check:
  // Preserved strictly for the 100K festival scenario demo or explicit campus template when NOT overridden by prompt architecture.
  const isCampus =
    !hasExplicitArchitecture &&
    (options.template === QUEUE_TEMPLATES.CAMPUS ||
      options.isFestivalDemo === true ||
      (options.multiZone === true && !options.architecture) ||
      (!promptText && site && site.length >= 140 && site.width >= 100 && requirements?.peakVisitors >= 5000));

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

  // Determine template to use (preserve queue shape from prompt if specified)
  const selectedTemplate =
    options.template && options.template !== QUEUE_TEMPLATES.PARALLEL
      ? options.template
      : (arch.preferredTemplate || options.template || QUEUE_TEMPLATES.PARALLEL);

  const isCentralSanctum = arch.sanctumPosition === 'center';
  const isLargeSanctum = arch.sanctumSize === 'large';

  // =========================================================================
  // 1. SANCTUM & DARSHAN POSITIONING
  // =========================================================================
  let sanctumX, sanctumZ, sanctumDim;
  let darshanX, darshanZ, darshanDim;

  if (isCentralSanctum) {
    sanctumX = 0;
    sanctumZ = 0;
    sanctumDim = isLargeSanctum
      ? { length: Math.min(22, Math.max(16, Math.round(zones.usableLength * 0.22))), width: Math.min(20, Math.max(14, Math.round(zones.usableWidth * 0.3))), height: 16 }
      : { length: Math.min(14, Math.max(10, Math.round(zones.usableLength * 0.18))), width: Math.min(14, Math.max(10, Math.round(zones.usableWidth * 0.22))), height: 12 };

    darshanX = Math.round(-(sanctumDim.length / 2 + 3.5) * 10) / 10;
    darshanZ = 0;
    darshanDim = { length: 4.5, width: Math.min(7.0, sanctumDim.width - 2), height: 2.8 };
  } else {
    // Eastern Sanctum
    sanctumX = Math.round((zones.usableMaxX - 5.5) * 10) / 10;
    sanctumZ = 0;
    sanctumDim = isLargeSanctum
      ? { length: 16, width: 14, height: 16 }
      : { length: 10, width: 10, height: 12 };

    darshanX = Math.round((sanctumX - sanctumDim.length / 2 - 4.5) * 10) / 10;
    darshanZ = 0;
    darshanDim = { length: 4.5, width: 5.5, height: 2.8 };
  }

  // Darshan Sanctum
  allComponents.push({
    id: `gen-darshan-sanctum-${genId}`,
    type: COMPONENT_TYPES.DARSHAN_SANCTUM,
    name: `${scene.temple?.name || 'Sri Ganesha'} ${isLargeSanctum ? 'Grand Maha' : ''} Garbhagriha`,
    position: { x: sanctumX, y: 0, z: sanctumZ },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: sanctumDim,
    properties: {
      vimanaHeight: isLargeSanctum ? 16 : 12,
      sanctumPillars: isLargeSanctum ? 12 : 8,
      diyaGlow: true,
      deity: scene.temple?.name || 'Sri Ganesha',
      orientation: isCentralSanctum ? 'central' : 'east',
    },
    generated: true,
    generationId: genId,
    role: 'darshan-sanctum',
    template: selectedTemplate,
  });

  // Darshan Viewing Mandapam
  allComponents.push({
    id: `gen-darshan-${genId}`,
    type: COMPONENT_TYPES.DARSHAN,
    name: `${isCentralSanctum ? 'Central' : 'Sacred'} Darshan Viewing Mandapam`,
    position: { x: darshanX, y: 0, z: darshanZ },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    dimensions: darshanDim,
    properties: {
      sanctumFocal: true,
      viewingWidth: darshanDim.width,
    },
    generated: true,
    generationId: genId,
    role: 'darshan',
    template: selectedTemplate,
  });

  // Circumambulatory Path (Pradakshina / Parikrama)
  if (arch.hasCircumambulatoryPath && isCentralSanctum) {
    const halfWid = sanctumDim.width / 2;
    const halfLen = sanctumDim.length / 2;
    const pathOffset = 4.0;

    allComponents.push({
      id: `gen-circum-north-${genId}`,
      type: COMPONENT_TYPES.BARRIER,
      name: 'North Pradakshina Walkway Boundary',
      position: { x: 0, y: 0, z: -(halfWid + pathOffset) },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: sanctumDim.length + 8, width: 0.3, height: 1.0 },
      properties: { style: 'brass-rail', roleDescription: 'Sacred Pradakshina circumambulatory path demarcation' },
      generated: true,
      generationId: genId,
      role: 'circumambulatory-path',
      template: selectedTemplate,
    });

    allComponents.push({
      id: `gen-circum-south-${genId}`,
      type: COMPONENT_TYPES.BARRIER,
      name: 'South Pradakshina Walkway Boundary',
      position: { x: 0, y: 0, z: (halfWid + pathOffset) },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: sanctumDim.length + 8, width: 0.3, height: 1.0 },
      properties: { style: 'brass-rail', roleDescription: 'Sacred Pradakshina circumambulatory path demarcation' },
      generated: true,
      generationId: genId,
      role: 'circumambulatory-path',
      template: selectedTemplate,
    });

    allComponents.push({
      id: `gen-circum-east-${genId}`,
      type: COMPONENT_TYPES.BARRIER,
      name: 'East Pradakshina Walkway Boundary',
      position: { x: (halfLen + pathOffset), y: 0, z: 0 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: sanctumDim.width + 6, width: 0.3, height: 1.0 },
      properties: { style: 'brass-rail', roleDescription: 'Sacred Pradakshina circumambulatory path demarcation' },
      generated: true,
      generationId: genId,
      role: 'circumambulatory-path',
      template: selectedTemplate,
    });
  }

  // =========================================================================
  // 2. GOPURAM PLACEMENT (EXACT REQUESTED COUNT)
  // =========================================================================
  const targetGopuramCount = Math.max(1, arch.gopuramCount || 2);
  const gopurams = [];

  if (targetGopuramCount === 4) {
    const towerLen = Math.min(18, Math.max(10, zones.usableWidth * 0.3));

    // North
    gopurams.push({
      id: `gen-gopuram-north-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'North Entrance Gopuram (Uttara Raja Dvaram)',
      position: { x: (isCentralSanctum ? 0 : zones.queueCenter.x), y: 0, z: Math.round((zones.usableMinZ + 3.0) * 10) / 10 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: towerLen, width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#BFA382', direction: 'North' },
      role: 'north-gopuram',
    });

    // South
    gopurams.push({
      id: `gen-gopuram-south-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'South Exit Gopuram (Dakshina Dvaram)',
      position: { x: (isCentralSanctum ? 0 : zones.queueCenter.x), y: 0, z: Math.round((zones.usableMaxZ - 3.0) * 10) / 10 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: towerLen, width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#8C7355', direction: 'South' },
      role: 'south-gopuram',
    });

    // West
    gopurams.push({
      id: `gen-gopuram-west-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'West Entrance Gopuram (Pashchima Dvaram)',
      position: { x: Math.round((zones.usableMinX + 3.0) * 10) / 10, y: 0, z: 0 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: Math.min(18, zones.usableWidth * 0.35), width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#A38F78', direction: 'West' },
      role: 'west-gopuram',
    });

    // East
    gopurams.push({
      id: `gen-gopuram-east-${genId}`,
      type: COMPONENT_TYPES.MAIN_GOPURAM,
      name: 'East Gopuram (Purva Raja Dvaram)',
      position: { x: Math.round((zones.usableMaxX - 3.0) * 10) / 10, y: 0, z: 0 },
      rotation: -90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: Math.min(20, zones.usableWidth * 0.4), width: 5.5, height: 24 },
      properties: { tiers: 6, archWidth: 5.5, stoneColor: '#9C7A5B', direction: 'East' },
      role: 'east-gopuram',
    });
  } else if (targetGopuramCount === 6) {
    const towerLen = Math.min(16, Math.max(10, zones.usableWidth * 0.28));

    // North
    gopurams.push({
      id: `gen-gopuram-north-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'North Entrance Gopuram (Uttara Dvaram)',
      position: { x: 0, y: 0, z: Math.round((zones.usableMinZ + 3.0) * 10) / 10 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: towerLen, width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#BFA382', direction: 'North' },
      role: 'north-gopuram',
    });

    // South
    gopurams.push({
      id: `gen-gopuram-south-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'South Exit Gopuram (Dakshina Dvaram)',
      position: { x: 0, y: 0, z: Math.round((zones.usableMaxZ - 3.0) * 10) / 10 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: towerLen, width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#8C7355', direction: 'South' },
      role: 'south-gopuram',
    });

    // West
    gopurams.push({
      id: `gen-gopuram-west-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'West Entrance Gopuram (Pashchima Dvaram)',
      position: { x: Math.round((zones.usableMinX + 3.0) * 10) / 10, y: 0, z: 0 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: Math.min(18, zones.usableWidth * 0.35), width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#A38F78', direction: 'West' },
      role: 'west-gopuram',
    });

    // East
    gopurams.push({
      id: `gen-gopuram-east-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'East Dispersal Gopuram (Purva Dvaram)',
      position: { x: Math.round((zones.usableMaxX - 3.0) * 10) / 10, y: 0, z: 0 },
      rotation: -90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: Math.min(18, zones.usableWidth * 0.35), width: 5.5, height: 20 },
      properties: { tiers: 5, archWidth: 5.0, stoneColor: '#A38F78', direction: 'East' },
      role: 'east-gopuram',
    });

    // Central Main Raja Gopuram (placed in front of Darshan Viewing Mandapam with proper clearance)
    const mainRajaX = Math.round((darshanX - 7.5) * 10) / 10;
    gopurams.push({
      id: `gen-gopuram-main-${genId}`,
      type: COMPONENT_TYPES.MAIN_GOPURAM,
      name: 'Central Main Raja Gopuram',
      position: { x: mainRajaX, y: 0, z: 0 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: Math.min(20, zones.usableWidth * 0.38), width: 5.5, height: 28 },
      properties: { tiers: 7, archWidth: 6.0, kalasams: 7, stoneColor: '#9C7A5B', direction: 'Central' },
      role: 'main-gopuram',
    });

    // VIP Protocol Entrance Gopuram (North-West corner)
    gopurams.push({
      id: `gen-gopuram-vip-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'VIP Protocol Entrance Gopuram',
      position: { x: Math.round((zones.usableMinX + 3.0) * 10) / 10, y: 0, z: Math.round((zones.usableMinZ + 6.0) * 10) / 10 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: 8.0, width: 4.5, height: 16 },
      properties: { tiers: 5, archWidth: 4.5, stoneColor: '#D4AF37', direction: 'VIP North-West' },
      role: 'vip-gopuram',
    });
  } else {
    // 2 Gopurams (Entrance + Main)
    gopurams.push({
      id: `gen-gopuram-entrance-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE_GOPURAM,
      name: 'Entrance Raja Dvaram Gopuram',
      position: { x: Math.round((zones.usableMinX + 3.0) * 10) / 10, y: 0, z: 0 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: Math.min(16, zones.usableWidth * 0.35), width: 5.0, height: 16 },
      properties: { tiers: 5, archWidth: 4.5, archHeight: 4.2, kalasams: 5, stoneColor: '#BFA382' },
      role: 'entrance-gopuram',
    });

    if (targetGopuramCount >= 2) {
      const eastMainX = isCentralSanctum ? Math.round((darshanX - 7.5) * 10) / 10 : Math.round((darshanX - 6.5) * 10) / 10;
      gopurams.push({
        id: `gen-gopuram-main-${genId}`,
        type: COMPONENT_TYPES.MAIN_GOPURAM,
        name: 'Main Raja Gopuram',
        position: { x: eastMainX, y: 0, z: 0 },
        rotation: 90,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: Math.min(16, zones.usableWidth * 0.4), width: 5.0, height: 22 },
        properties: { tiers: 7, archWidth: 5.5, archHeight: 5.5, kalasams: 7, stoneColor: '#9C7A5B' },
        role: 'main-gopuram',
      });
    }
  }

  gopurams.forEach((g) => {
    allComponents.push({
      ...g,
      generated: true,
      generationId: genId,
      template: selectedTemplate,
    });
  });

  // =========================================================================
  // 3. ENTRANCE GATES & SECURITY CHECKPOINTS
  // =========================================================================
  const entrances = [];
  const securities = [];
  const baseEntX = Math.round((zones.usableMinX + 10.0) * 10) / 10;

  // Dedicated VIP Entrance Gate if requested
  if (arch.hasVipEntrance) {
    const vipZ = Math.round((zones.usableMinZ + 6.0) * 10) / 10;
    entrances.push({
      id: `gen-entrance-vip-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE,
      name: 'VIP & Protocol Entrance Gate',
      position: { x: baseEntX, y: 0, z: vipZ },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: 3.5, width: 1.2, height: 3.2 },
      properties: { signage: 'VIP ENTRY', archType: 'ceremonial', isVip: true },
      role: 'entrance-vip',
    });

    if (options.includeSecurity !== false) {
      securities.push({
        id: `gen-security-vip-${genId}`,
        type: COMPONENT_TYPES.SECURITY,
        name: 'VIP Security Screening DFMD',
        position: { x: Math.round((baseEntX + 5.5) * 10) / 10, y: 0, z: vipZ },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 3.5, width: 2.2, height: 2.6 },
        properties: { metalDetector: true, baggageCounter: true, isVip: true },
        role: 'security-vip',
      });
    }
  }

  // Public Entrances
  const targetEntranceCount = Math.max(1, arch.entranceCount || 1);

  if (targetEntranceCount === 1) {
    entrances.push({
      id: `gen-entrance-${genId}`,
      type: COMPONENT_TYPES.ENTRANCE,
      name: 'Main Public Entrance Gate',
      position: { x: baseEntX, y: 0, z: 0 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: 3.5, width: 1.2, height: 3.2 },
      properties: { signage: 'ENTRY', archType: 'traditional' },
      role: 'entrance',
    });

    if (options.includeSecurity !== false) {
      securities.push({
        id: `gen-security-${genId}`,
        type: COMPONENT_TYPES.SECURITY,
        name: 'Security Screening DFMD',
        position: { x: Math.round((baseEntX + 5.5) * 10) / 10, y: 0, z: 0 },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 3.5, width: 2.5, height: 2.6 },
        properties: { metalDetector: true, baggageCounter: true },
        role: 'security',
      });
    }
  } else if (targetEntranceCount === 2) {
    const offsets = [-4.5, 4.5];
    offsets.forEach((zOff, idx) => {
      entrances.push({
        id: `gen-entrance-${genId}-${idx + 1}`,
        type: COMPONENT_TYPES.ENTRANCE,
        name: idx === 0 ? 'General Devotee Entrance Gate' : 'Special Darshan Entrance Gate',
        position: { x: baseEntX, y: 0, z: zOff },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 3.5, width: 1.2, height: 3.2 },
        properties: { signage: `ENTRY ${idx + 1}`, archType: 'traditional' },
        role: 'entrance',
      });

      if (options.includeSecurity !== false) {
        securities.push({
          id: `gen-security-${genId}-${idx + 1}`,
          type: COMPONENT_TYPES.SECURITY,
          name: `Security Screening DFMD ${idx + 1}`,
          position: { x: Math.round((baseEntX + 5.5) * 10) / 10, y: 0, z: zOff },
          rotation: 0,
          scale: { x: 1, y: 1, z: 1 },
          dimensions: { length: 3.5, width: 2.2, height: 2.6 },
          properties: { metalDetector: true, baggageCounter: true },
          role: 'security',
        });
      }
    });
  } else {
    // 3 or more entrances spread across public arrival corridor (offset from VIP sector if present)
    const minZ = arch.hasVipEntrance ? -4.0 : -Math.min(zones.usableWidth * 0.35, 14);
    const maxZ = Math.min(zones.usableWidth * 0.4, 18);
    const stepZ = (maxZ - minZ) / (targetEntranceCount - 1);

    for (let e = 0; e < targetEntranceCount; e++) {
      const entZ = Math.round((minZ + e * stepZ) * 10) / 10;
      entrances.push({
        id: `gen-entrance-${genId}-${e + 1}`,
        type: COMPONENT_TYPES.ENTRANCE,
        name: `Entrance Gate ${e + 1}`,
        position: { x: baseEntX, y: 0, z: entZ },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: 3.5, width: 1.2, height: 3.2 },
        properties: { signage: `ENTRY ${e + 1}`, archType: 'traditional' },
        role: 'entrance',
      });

      if (options.includeSecurity !== false) {
        securities.push({
          id: `gen-security-${genId}-${e + 1}`,
          type: COMPONENT_TYPES.SECURITY,
          name: `Security Screening DFMD ${e + 1}`,
          position: { x: Math.round((baseEntX + 5.5) * 10) / 10, y: 0, z: entZ },
          rotation: 0,
          scale: { x: 1, y: 1, z: 1 },
          dimensions: { length: 3.5, width: 2.0, height: 2.6 },
          properties: { metalDetector: true, baggageCounter: true },
          role: 'security',
        });
      }
    }
  }

  entrances.forEach((e) => allComponents.push({ ...e, generated: true, generationId: genId, template: selectedTemplate }));
  securities.forEach((s) => allComponents.push({ ...s, generated: true, generationId: genId, template: selectedTemplate }));

  // =========================================================================
  // 4. DISPERSAL EXITS (EXACT REQUESTED COUNT)
  // =========================================================================
  const targetExitCount = Math.max(1, arch.exitCount || 1);
  const exits = [];

  if (targetExitCount === 1) {
    const exitX = isCentralSanctum ? Math.round((sanctumX + sanctumDim.length / 2 + 5.0) * 10) / 10 : darshanX;
    const exitZ = Math.round((zones.usableMaxZ - 6.0) * 10) / 10;
    exits.push({
      id: `gen-exit-${genId}`,
      type: COMPONENT_TYPES.EXIT,
      name: 'Dispersal Exit Corridor',
      position: { x: exitX, y: 0, z: exitZ },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: 7.0, width: 2.8, height: 2.4 },
      properties: { signage: 'EXIT', oneWay: true },
      role: 'exit',
    });
  } else {
    // 2 or more exits: Primary South + Secondary North
    const exitX = isCentralSanctum ? Math.round((sanctumX + sanctumDim.length / 2 + 5.0) * 10) / 10 : darshanX;
    exits.push({
      id: `gen-exit-${genId}-1`,
      type: COMPONENT_TYPES.EXIT,
      name: 'South Primary Dispersal Exit',
      position: { x: exitX, y: 0, z: Math.round((zones.usableMaxZ - 6.0) * 10) / 10 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: 7.0, width: 3.0, height: 2.4 },
      properties: { signage: 'EXIT 1 (SOUTH)', oneWay: true },
      role: 'exit',
    });

    exits.push({
      id: `gen-exit-${genId}-2`,
      type: COMPONENT_TYPES.EXIT,
      name: 'North Secondary Dispersal Exit',
      position: { x: exitX, y: 0, z: Math.round((zones.usableMinZ + 6.0) * 10) / 10 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { length: 7.0, width: 3.0, height: 2.4 },
      properties: { signage: 'EXIT 2 (NORTH)', oneWay: true },
      role: 'exit',
    });
  }

  exits.forEach((x) => allComponents.push({ ...x, generated: true, generationId: genId, template: selectedTemplate }));

  // =========================================================================
  // 5. QUEUE AREAS & PRESERVING QUEUE SHAPES
  // =========================================================================
  const queueStartX = Math.round((baseEntX + 10.0) * 10) / 10;
  let queueLimitX = darshanX - 4.5;
  if (targetGopuramCount === 6 && isCentralSanctum) {
    const mainRaja = gopurams.find((g) => g.role === 'main-gopuram');
    if (mainRaja) {
      queueLimitX = mainRaja.position.x - 4.5;
    }
  } else if (targetGopuramCount >= 2 && !isCentralSanctum) {
    const mainRaja = gopurams.find((g) => g.role === 'main-gopuram');
    if (mainRaja) {
      queueLimitX = mainRaja.position.x - 4.5;
    }
  }
  const queueEndX = Math.round(queueLimitX * 10) / 10;
  const queueSpan = Math.max(6, queueEndX - queueStartX);
  const queueCenterX = Math.round(((queueStartX + queueEndX) / 2) * 10) / 10;

  const targetQueueSystems = Math.max(1, arch.queueSystemCount || 1);

  if (targetQueueSystems === 3) {
    // 3 distinct queue systems across North, Central, and South
    const queueZOffsets = [
      -Math.round(zones.usableWidth * 0.28),
      0,
      Math.round(zones.usableWidth * 0.28),
    ];
    const queueNames = [
      'North Approach Queue Lane',
      'Central General Queue Lane',
      'South Approach Queue Lane',
    ];

    queueZOffsets.forEach((zOff, qIdx) => {
      allComponents.push({
        id: `gen-queue-${genId}-sys-${qIdx + 1}`,
        type: COMPONENT_TYPES.QUEUE,
        name: queueNames[qIdx],
        position: { x: queueCenterX, y: 0, z: zOff },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: queueSpan, width: 2.0, height: 1.0 },
        properties: { lanes: 1, direction: 'forward', stream: qIdx === 0 ? 'north' : qIdx === 1 ? 'central' : 'south' },
        generated: true,
        generationId: genId,
        role: 'queue-lane',
        template: selectedTemplate,
      });
    });
  } else if (targetQueueSystems === 2) {
    // 2 distinct queue zones
    const offsets = [-Math.round(zones.usableWidth * 0.22), Math.round(zones.usableWidth * 0.22)];
    const names = ['General Devotee Queue Zone', 'Special Protocol Queue Zone'];

    offsets.forEach((zOff, qIdx) => {
      allComponents.push({
        id: `gen-queue-${genId}-zone-${qIdx + 1}`,
        type: COMPONENT_TYPES.QUEUE,
        name: names[qIdx],
        position: { x: queueCenterX, y: 0, z: zOff },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        dimensions: { length: queueSpan, width: 2.2, height: 1.0 },
        properties: { lanes: 1, direction: 'forward' },
        generated: true,
        generationId: genId,
        role: 'queue-lane',
        template: selectedTemplate,
      });
    });
  } else {
    // 1 queue system using requested template
    const queueZones = {
      ...zones,
      queueCenter: { x: queueCenterX, z: 0 },
      queueZoneWidth: queueSpan,
      queueMinX: queueStartX,
      queueMaxX: queueEndX,
    };

    let queueResult;
    const queueOptions = {
      ...options,
      template: selectedTemplate,
      architecture: arch,
      singleQueue: true,
    };

    switch (selectedTemplate) {
      case QUEUE_TEMPLATES.SERPENTINE:
        queueResult = generateSerpentineLanes(queueZones, queueOptions, genId);
        break;
      case QUEUE_TEMPLATES.U_SHAPE:
        queueResult = generateUShapeLanes(queueZones, queueOptions, genId);
        break;
      case QUEUE_TEMPLATES.SPLIT:
        queueResult = generateSplitLanes(queueZones, queueOptions, genId);
        break;
      case QUEUE_TEMPLATES.ARC:
      case QUEUE_TEMPLATES.CURVED:
        queueResult = generateArcLanes(queueZones, queueOptions, genId);
        break;
      case QUEUE_TEMPLATES.S_SHAPE:
        queueResult = generateSShapeLanes(queueZones, queueOptions, genId);
        break;
      case QUEUE_TEMPLATES.RADIAL:
        queueResult = generateRadialLanes(queueZones, queueOptions, genId);
        break;
      case QUEUE_TEMPLATES.PARALLEL:
      default:
        queueResult = generateParallelLanes(queueZones, queueOptions, genId);
        break;
    }

    if (queueResult && queueResult.components) {
      allComponents.push(...queueResult.components);
    }
  }

  // =========================================================================
  // 6. VALIDATION & FINAL ASSEMBLY
  // =========================================================================
  const validation = validateLayout({
    site,
    components: allComponents,
    requirements,
  });

  return {
    success: true,
    generationId: genId,
    template: selectedTemplate,
    architecture: arch,
    components: allComponents,
    validation,
  };
}
