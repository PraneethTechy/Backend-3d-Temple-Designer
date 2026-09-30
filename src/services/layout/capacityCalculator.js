/**
 * DevaSetu Queue Capacity & Crowd Flow Calculator
 * Deterministic planning metrics for crowd throughput and space utilization.
 */

export const DEFAULT_PLANNING_CONFIG = {
  // Density assumption: 2.0 persons per square meter for comfortable standing queue
  densityPersonsPerSqMeter: 2.0,
  // Standard processing throughput per lane (persons per lane per hour)
  throughputPersonsPerLaneHour: 60,
  // Security scanner throughput capacity (persons per DFMD per hour)
  throughputPerSecurityCheckpoint: 450,
  // Darshan viewing capacity rate (persons per minute across darshan frontage)
  throughputDarshanPerMinute: 35,
  // Exit egress flow rate (persons per meter width per minute)
  exitFlowRatePerMeterMinute: 50,
};

/**
 * Calculates complete capacity and crowd metrics for a set of scene components
 */
export function calculateQueueCapacity(components = [], peakVisitors = 0, config = DEFAULT_PLANNING_CONFIG) {
  const cfg = { ...DEFAULT_PLANNING_CONFIG, ...config };

  // Identify components
  const queueLanes = components.filter((c) => c.type === 'queue');
  const securityUnits = components.filter((c) => c.type === 'security');
  const darshanPoints = components.filter((c) => c.type === 'darshan');
  const exitCorridors = components.filter((c) => c.type === 'exit');
  const waitingAreas = components.filter((c) => c.type === 'waiting');
  const entrances = components.filter((c) => c.type === 'entrance');

  // 1. Calculate physical queue lane area and capacity
  let totalQueueLength = 0;
  let totalQueueArea = 0;
  let totalEffectiveLanes = 0;

  queueLanes.forEach((q) => {
    const l = Number(q.dimensions?.length) || 0;
    const w = Number(q.dimensions?.width) || 0;
    const lanes = Number(q.properties?.lanes) || 1;

    totalQueueLength += l;
    totalQueueArea += l * w;
    totalEffectiveLanes += lanes;
  });

  // Waiting area contribution (if holding bays exist)
  let waitingAreaCapacity = 0;
  waitingAreas.forEach((w) => {
    const area = (Number(w.dimensions?.length) || 0) * (Number(w.dimensions?.width) || 0);
    // Waiting areas use 1.5 persons/m² for seated/holding
    waitingAreaCapacity += Math.round(area * 1.5);
  });

  // Base Queue Capacity from area & density
  const rawQueueCapacity = Math.round(totalQueueArea * cfg.densityPersonsPerSqMeter);
  const totalCombinedCapacity = rawQueueCapacity + waitingAreaCapacity;

  // 2. Peak Utilization calculation
  const safeCapacity = totalCombinedCapacity > 0 ? totalCombinedCapacity : 1;
  const peakNum = Number(peakVisitors) || 0;
  const utilization = totalCombinedCapacity > 0 ? Math.round((peakNum / totalCombinedCapacity) * 100) : 0;

  let utilizationStatus = 'empty';
  let utilizationLabel = 'No Queue Capacity';
  let utilizationSeverity = 'warning';

  if (totalCombinedCapacity > 0) {
    if (utilization <= 80) {
      utilizationStatus = 'within_capacity';
      utilizationLabel = 'Within planning capacity';
      utilizationSeverity = 'success';
    } else if (utilization <= 100) {
      utilizationStatus = 'near_capacity';
      utilizationLabel = 'Near planning capacity';
      utilizationSeverity = 'warning';
    } else {
      utilizationStatus = 'over_capacity';
      utilizationLabel = 'Over capacity (crowd overflow risk)';
      utilizationSeverity = 'warning';
    }
  }

  // 3. Estimated Planning Wait Time
  // Total hourly throughput across all active queue lanes
  const activeLanes = Math.max(1, totalEffectiveLanes);
  const totalHourlyThroughput = activeLanes * cfg.throughputPersonsPerLaneHour;
  const flowPerMinute = Math.max(1, totalHourlyThroughput / 60);

  // Time in minutes for peak crowd to cycle through queue
  const estimatedWaitMinutes = peakNum > 0
    ? Math.max(3, Math.round(peakNum / flowPerMinute))
    : 0;

  // 4. Bottleneck Detection
  const bottlenecks = [];

  // Check 1: Insufficient queue capacity vs peak visitors
  if (totalCombinedCapacity > 0 && peakNum > totalCombinedCapacity) {
    bottlenecks.push({
      type: 'queue_capacity',
      severity: 'warning',
      message: `Queue capacity (${totalCombinedCapacity.toLocaleString()} people) is below peak concurrent demand (${peakNum.toLocaleString()} people). Additional lanes or longer channels recommended.`,
    });
  }

  // Check 2: Security throughput limiting factor
  if (securityUnits.length > 0 && totalEffectiveLanes > 2) {
    const securityHourlyRate = securityUnits.length * cfg.throughputPerSecurityCheckpoint;
    if (securityHourlyRate < totalHourlyThroughput * 0.75) {
      bottlenecks.push({
        type: 'security_bottleneck',
        componentId: securityUnits[0].id,
        severity: 'warning',
        message: 'Security screening rate may become the limiting flow constraint. Consider an additional scanner.',
      });
    }
  }

  // Check 3: Too few lanes for peak visitors
  if (peakNum > 2000 && totalEffectiveLanes <= 2) {
    bottlenecks.push({
      type: 'lane_count',
      severity: 'warning',
      message: 'Peak visitor demand (>2,000) exceeds recommended throughput for 1-2 lanes. Consider 3-4 parallel or split channels.',
    });
  }

  // Check 4: Exit width constraint
  if (exitCorridors.length === 1 && totalCombinedCapacity > 1500) {
    const exitW = exitCorridors[0].dimensions?.width || 2;
    if (exitW < 3) {
      bottlenecks.push({
        type: 'exit_bottleneck',
        componentId: exitCorridors[0].id,
        severity: 'warning',
        message: 'Single narrow exit corridor may cause egress congestion during peak clearance.',
      });
    }
  }

  return {
    queueCapacity: totalCombinedCapacity,
    physicalQueueCapacity: rawQueueCapacity,
    waitingAreaCapacity,
    peakVisitors: peakNum,
    utilization,
    utilizationStatus,
    utilizationLabel,
    utilizationSeverity,
    estimatedWaitMinutes,
    totalQueueLength: Math.round(totalQueueLength),
    totalQueueArea: Math.round(totalQueueArea),
    totalEffectiveLanes,
    bottlenecks,
    assumptions: {
      density: cfg.densityPersonsPerSqMeter,
      densityUnit: 'persons / m²',
      throughputPerLaneHour: cfg.throughputPersonsPerLaneHour,
      disclaimer: 'Planning estimate based on standardized density. Not a certified safety standard.',
    },
  };
}
