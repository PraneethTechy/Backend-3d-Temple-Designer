/**
 * DevaSetu Layout Validator
 * Inspects Scene JSON components against physical boundaries, overlaps, and crowd flow logic.
 */

import { getSiteBounds, getComponentAABB, isComponentWithinSite, doAABBsOverlap } from './coordinateSystem.js';
import { calculateQueueCapacity } from './capacityCalculator.js';

export function validateLayout(sceneOrComponents, maybeSite, maybeReqs) {
  let site, components, requirements;
  if (Array.isArray(sceneOrComponents)) {
    components = sceneOrComponents;
    site = maybeSite || { length: 0, width: 0, unit: 'meters' };
    requirements = maybeReqs || { expectedVisitors: 0, peakVisitors: 0 };
  } else {
    const scene = sceneOrComponents || {};
    site = scene.site || { length: 0, width: 0, unit: 'meters' };
    components = scene.components || [];
    requirements = scene.requirements || { expectedVisitors: 0, peakVisitors: 0 };
  }

  const errors = [];
  const warnings = [];

  const siteBounds = getSiteBounds(site);

  // If no components exist yet
  if (components.length === 0) {
    return {
      valid: true,
      errors: [],
      warnings: [{
        id: 'warn-empty-scene',
        type: 'empty_scene',
        message: 'No crowd components placed in the scene yet.',
      }],
      metrics: calculateQueueCapacity([], requirements.peakVisitors),
    };
  }

  // A. Boundary Violation Check
  components.forEach((comp) => {
    const boundCheck = isComponentWithinSite(comp, site, 0.1);
    if (!boundCheck.fits) {
      errors.push({
        id: `err-boundary-${comp.id}`,
        componentId: comp.id,
        componentName: comp.name,
        type: 'outside_boundary',
        severity: 'error',
        message: `"${comp.name}" extends outside site boundary by ${Math.max(boundCheck.excessLeft, boundCheck.excessRight, boundCheck.excessTop, boundCheck.excessBottom).toFixed(1)}m.`,
      });
    }
  });

  // B. Major Component Overlap Check
  // Check pairs of components (excluding intentional adjacent touch between queue and barriers)
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const cA = components[i];
      const cB = components[j];

      // Exclude barrier-barrier or barrier-queue slight touching if intentional
      const isBarrierAndQueue = (cA.type === 'barrier' && cB.type === 'queue') || (cB.type === 'barrier' && cA.type === 'queue');
      const buffer = isBarrierAndQueue ? 0.3 : 0.5;

      const aabbA = getComponentAABB(cA);
      const aabbB = getComponentAABB(cB);

      if (doAABBsOverlap(aabbA, aabbB, buffer)) {
        // Significant overlap
        const isCriticalOverlap = (cA.type === 'entrance' || cA.type === 'exit' || cA.type === 'darshan') ||
                                  (cB.type === 'entrance' || cB.type === 'exit' || cB.type === 'darshan');

        const issue = {
          id: `overlap-${cA.id}-${cB.id}`,
          componentId: cA.id,
          secondaryComponentId: cB.id,
          componentName: `${cA.name} & ${cB.name}`,
          type: 'component_overlap',
          severity: isCriticalOverlap ? 'error' : 'warning',
          message: `Spatial collision: "${cA.name}" overlaps with "${cB.name}".`,
        };

        if (isCriticalOverlap) {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }
  }

  // C. Insufficient Space / Narrow Dimensions Check
  components.forEach((comp) => {
    if (comp.type === 'queue') {
      const w = Number(comp.dimensions?.width) || 0;
      const l = Number(comp.dimensions?.length) || 0;
      if (w < 1.0) {
        errors.push({
          id: `err-width-${comp.id}`,
          componentId: comp.id,
          componentName: comp.name,
          type: 'insufficient_width',
          severity: 'error',
          message: `"${comp.name}" width (${w}m) is below the minimum accessible width (1.0m).`,
        });
      }
      if (l < 2.0) {
        warnings.push({
          id: `warn-len-${comp.id}`,
          componentId: comp.id,
          componentName: comp.name,
          type: 'short_lane',
          severity: 'warning',
          message: `"${comp.name}" is very short (${l}m) to function effectively as a queue channel.`,
        });
      }
    }
  });

  // D. Disconnected Flow & Missing Key Zones Check
  const hasEntrance = components.some((c) => c.type === 'entrance');
  const hasQueue = components.some((c) => c.type === 'queue');
  const hasDarshan = components.some((c) => c.type === 'darshan');
  const hasExit = components.some((c) => c.type === 'exit');

  if (!hasEntrance) {
    warnings.push({
      id: 'warn-no-entrance',
      type: 'missing_entrance',
      severity: 'warning',
      message: 'No Entrance Gate designated in the crowd-management layout.',
    });
  }

  if (!hasQueue) {
    warnings.push({
      id: 'warn-no-queue',
      type: 'missing_queue',
      severity: 'warning',
      message: 'No Queue Lane components configured to channel visitors.',
    });
  }

  if (!hasDarshan) {
    warnings.push({
      id: 'warn-no-darshan',
      type: 'missing_darshan',
      severity: 'warning',
      message: 'No Darshan focal viewing area defined in this space.',
    });
  }

  if (!hasExit) {
    warnings.push({
      id: 'warn-no-exit',
      type: 'missing_exit',
      severity: 'warning',
      message: 'No Exit Corridor configured for safe crowd dispersal.',
    });
  }

  // Calculate Capacity and Bottlenecks
  const capacityMetrics = calculateQueueCapacity(components, requirements.peakVisitors);

  // Merge capacity bottlenecks into warnings/errors
  if (capacityMetrics.bottlenecks) {
    capacityMetrics.bottlenecks.forEach((b, idx) => {
      const bItem = {
        id: `bottleneck-${idx}-${b.type}`,
        componentId: b.componentId || null,
        type: b.type,
        severity: b.severity,
        message: b.message,
      };
      if (b.severity === 'error') {
        errors.push(bItem);
      } else {
        warnings.push(bItem);
      }
    });
  }

  const isValid = errors.length === 0;

  return {
    valid: isValid,
    errors,
    warnings,
    metrics: capacityMetrics,
    timestamp: Date.now(),
  };
}
