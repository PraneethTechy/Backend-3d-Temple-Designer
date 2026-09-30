/**
 * DevaSetu Spatial Units System
 * Consistent normalization to meters for all 3D scene calculations.
 */

export const UNITS = {
  METERS: 'meters',
  FEET: 'feet',
};

export const UNIT_LABELS = {
  [UNITS.METERS]: 'm',
  [UNITS.FEET]: 'ft',
};

export const UNIT_AREA_LABELS = {
  [UNITS.METERS]: 'm²',
  [UNITS.FEET]: 'sq ft',
};

export const FEET_TO_METERS = 0.3048;
export const METERS_TO_FEET = 1 / FEET_TO_METERS; // ~3.28084

/**
 * Normalizes any dimension to internal meters
 * @param {number} value 
 * @param {'meters' | 'feet'} unit 
 * @returns {number} normalized meters
 */
export function toMeters(value, unit = UNITS.METERS) {
  const num = Number(value);
  if (isNaN(num)) return 0;
  if (unit === UNITS.FEET) {
    return num * FEET_TO_METERS;
  }
  return num;
}

/**
 * Converts normalized internal meters to user's selected unit
 * @param {number} meters 
 * @param {'meters' | 'feet'} targetUnit 
 * @returns {number}
 */
export function fromMeters(meters, targetUnit = UNITS.METERS) {
  const num = Number(meters);
  if (isNaN(num)) return 0;
  if (targetUnit === UNITS.FEET) {
    return num * METERS_TO_FEET;
  }
  return num;
}

/**
 * Convert value between units
 */
export function convertUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return Number(value);
  const meters = toMeters(value, fromUnit);
  return fromMeters(meters, toUnit);
}

/**
 * Calculates surface area in user's unit and returns formatted metrics
 */
export function calculateAreaMetrics(length, width, unit = UNITS.METERS) {
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const rawArea = l * w;

  const lengthMeters = toMeters(l, unit);
  const widthMeters = toMeters(w, unit);
  const areaSqMeters = lengthMeters * widthMeters;
  const areaSqFeet = areaSqMeters * (METERS_TO_FEET * METERS_TO_FEET);

  return {
    rawArea,
    unit,
    lengthMeters,
    widthMeters,
    areaSqMeters,
    areaSqFeet,
    displayArea: unit === UNITS.METERS ? areaSqMeters : areaSqFeet,
    displayUnit: UNIT_AREA_LABELS[unit] || 'm²',
  };
}

/**
 * Format a number with thousands separators and optional decimals
 */
export function formatNumber(num, maxDecimals = 1) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: Number.isInteger(Number(num)) ? 0 : Math.min(1, maxDecimals),
  });
}
