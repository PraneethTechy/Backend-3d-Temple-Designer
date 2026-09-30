/**
 * DevaSetu Component Positioner
 * Computes deterministic anchors and layout zones inside the site boundary.
 */

import { getSiteBounds } from './coordinateSystem.js';

export function computeLayoutZones(site) {
  const bounds = getSiteBounds(site);
  const totalL = bounds.lengthMeters;
  const totalW = bounds.widthMeters;

  // Perimeter margin from outer site boundary
  const marginX = Math.max(2.5, totalL * 0.06);
  const marginZ = Math.max(2.0, totalW * 0.08);

  const usableMinX = bounds.minX + marginX;
  const usableMaxX = bounds.maxX - marginX;
  const usableMinZ = bounds.minZ + marginZ;
  const usableMaxZ = bounds.maxZ - marginZ;

  const usableLength = usableMaxX - usableMinX;
  const usableWidth = usableMaxZ - usableMinZ;

  // Split length into sequential zones along X axis (Left -> Right pilgrimage flow)
  // Zone 1: Entry & Security (~18% of length)
  // Zone 2: Main Queue Arena (~58% of length)
  // Zone 3: Darshan & Egress (~24% of length)
  const entryZoneWidth = Math.min(10, Math.max(6, usableLength * 0.18));
  const darshanZoneWidth = Math.min(12, Math.max(7, usableLength * 0.22));
  const queueZoneWidth = usableLength - entryZoneWidth - darshanZoneWidth;

  const entryCenter = {
    x: usableMinX + entryZoneWidth / 2,
    z: 0,
  };

  const queueCenter = {
    x: usableMinX + entryZoneWidth + queueZoneWidth / 2,
    z: 0,
  };

  const darshanCenter = {
    x: usableMaxX - darshanZoneWidth / 2,
    z: 0,
  };

  const queueMinX = usableMinX + entryZoneWidth;
  const queueMaxX = usableMinX + entryZoneWidth + queueZoneWidth;

  return {
    bounds,
    usableLength,
    usableWidth,
    usableMinX,
    usableMaxX,
    usableMinZ,
    usableMaxZ,
    entryZoneWidth,
    queueZoneWidth,
    darshanZoneWidth,
    queueMinX,
    queueMaxX,
    entryCenter,
    queueCenter,
    darshanCenter,
  };
}
