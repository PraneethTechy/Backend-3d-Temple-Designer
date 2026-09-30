/**
 * DevaSetu Spatial Coordinate System
 * Standardizes 3D spatial calculations on the horizontal X/Z ground plane (Y=0).
 */

import { toMeters } from '../../utils/units.js';

/**
 * Returns normalized metric bounds of the site centered at the origin
 */
export function getSiteBounds(site) {
  const lengthMeters = toMeters(site.length, site.unit);
  const widthMeters = toMeters(site.width, site.unit);

  const halfL = lengthMeters / 2;
  const halfW = widthMeters / 2;

  return {
    lengthMeters,
    widthMeters,
    minX: -halfL,
    maxX: halfL,
    minZ: -halfW,
    maxZ: halfW,
    centerX: 0,
    centerZ: 0,
  };
}

/**
 * Computes axis-aligned bounding box (AABB) for a component on the X/Z ground plane
 */
export function getComponentAABB(component) {
  const posX = component.position?.x || 0;
  const posZ = component.position?.z || 0;

  const dimL = component.dimensions?.length || 1;
  const dimW = component.dimensions?.width || 1;

  const rotationDeg = component.rotation || 0;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  // Effective dimensions along world X and Z axes
  const effectiveSpanX = dimL * cos + dimW * sin;
  const effectiveSpanZ = dimL * sin + dimW * cos;

  const halfX = effectiveSpanX / 2;
  const halfZ = effectiveSpanZ / 2;

  return {
    centerX: posX,
    centerZ: posZ,
    spanX: effectiveSpanX,
    spanZ: effectiveSpanZ,
    minX: posX - halfX,
    maxX: posX + halfX,
    minZ: posZ - halfZ,
    maxZ: posZ + halfZ,
  };
}

/**
 * Checks if a component's AABB fits inside site boundaries with an optional margin
 */
export function isComponentWithinSite(component, site, margin = 0.5) {
  const siteBounds = getSiteBounds(site);
  const aabb = getComponentAABB(component);

  const fitsX = aabb.minX >= siteBounds.minX + margin && aabb.maxX <= siteBounds.maxX - margin;
  const fitsZ = aabb.minZ >= siteBounds.minZ + margin && aabb.maxZ <= siteBounds.maxZ - margin;

  return {
    fits: fitsX && fitsZ,
    fitsX,
    fitsZ,
    excessLeft: Math.max(0, (siteBounds.minX + margin) - aabb.minX),
    excessRight: Math.max(0, aabb.maxX - (siteBounds.maxX - margin)),
    excessTop: Math.max(0, (siteBounds.minZ + margin) - aabb.minZ),
    excessBottom: Math.max(0, aabb.maxZ - (siteBounds.maxZ - margin)),
  };
}

/**
 * Determines whether two 2D AABBs overlap with an allowed threshold/buffer
 */
export function doAABBsOverlap(boxA, boxB, buffer = 0.1) {
  const noOverlapX = (boxA.maxX - buffer <= boxB.minX) || (boxA.minX + buffer >= boxB.maxX);
  const noOverlapZ = (boxA.maxZ - buffer <= boxB.minZ) || (boxA.minZ + buffer >= boxB.maxZ);
  return !(noOverlapX || noOverlapZ);
}
