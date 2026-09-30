/**
 * DevaSetu Smart Queue Designer Constants & Scene Schema
 */

import { UNITS } from './units.js';

export const QUEUE_COMPONENT_PLACEHOLDERS = [
  { id: 'entrance', name: 'Entrance Gate', icon: 'LogIn', description: 'Entry points & initial queuing lines', availableInPhase: 2 },
  { id: 'queue-lane', name: 'Queue Lane', icon: 'Rows', description: 'Serpentine & zig-zag crowd channels', availableInPhase: 2 },
  { id: 'barrier', name: 'Barrier / Stanchion', icon: 'Shield', description: 'Movable ropes and physical barricades', availableInPhase: 2 },
  { id: 'security', name: 'Security Checkpoint', icon: 'ScanFace', description: 'Metal detectors & baggage scanners', availableInPhase: 2 },
  { id: 'waiting-area', name: 'Waiting Area / Shed', icon: 'Armchair', description: 'Holding bays for batch releases', availableInPhase: 2 },
  { id: 'darshan', name: 'Darshan Sanctorum', icon: 'Sparkles', description: 'Primary focal sanctuary viewing point', availableInPhase: 2 },
  { id: 'exit', name: 'Exit Corridor', icon: 'LogOut', description: 'Dispersal avenues & footwear collection', availableInPhase: 2 },
];

/**
 * Creates an empty, standardized scene state conforming to DevaSetu single source of truth
 */
export function createInitialScene() {
  return {
    temple: {
      name: '',
    },
    site: {
      unit: UNITS.METERS,
      length: 0,
      width: 0,
      boundary: [],
    },
    requirements: {
      expectedVisitors: 0,
      peakVisitors: 0,
    },
    components: [],
    paths: [],
    analysis: {},
  };
}
