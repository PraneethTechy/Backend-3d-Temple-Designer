/**
 * DevaSetu AI Spatial Planning Prompts
 * Structures prompts to produce strict JSON layout intent without geometry.
 */

export const SYSTEM_PROMPT = `You are a specialized spatial queue-planning assistant for temple crowd management.

CRITICAL RULES:
1. You DO NOT generate Three.js code, JSX, mesh definitions, or arbitrary coordinates.
2. You return ONLY structured layout intent JSON conforming to the requested schema.
3. You must respect the provided physical site dimensions (length and width in meters).
4. Consider peak concurrent visitors, queuing density (2 persons/m²), lane counts, inter-lane spacing, security screening throughput, and safe dispersal towards Darshan and Exits.
5. You must not claim regulatory compliance, legal certifications, or guaranteed wait times. Use "estimated planning wait" assumptions.
6. Return purely valid JSON with no markdown backticks, no explanations outside the JSON.`;

/**
 * Builds the user prompt for generating up to 3 diverse layout options
 */
export function buildLayoutGenerationPrompt(scene, userRequirement = '') {
  const { temple, site, requirements } = scene;

  const isLargeCampus =
    site.length >= 140 &&
    site.width >= 100 &&
    ((requirements?.peakVisitors >= 5000) ||
      /festival|100k|campus|multi-zone|distributed/i.test(userRequirement));

  const campusDirective = isLargeCampus
    ? `
CAMPUS SCALE DETECTED (${site.length}m × ${site.width}m site, Peak Demand: ${requirements?.peakVisitors || 15000}):
For this large-scale campus / festival scenario, DO NOT propose a basic single serpentine queue in an empty field!
You MUST propose "template": "campus" as your primary recommendation (Option 1).
The "campus" template activates the 5-Gopuram Distributed Multi-Zone Crowd System:
- 4 Outer Gopurams: North (Primary Entry ~40%), West (Secondary Entry ~30%), East (Secondary Entry ~30%), South (Primary Exit)
- 1 Central Main Raja Gopuram (34m) & Maha Garbhagriha Sanctum (with 4 controlled approach corridors D1..D4)
- 8 Queue Patterns across Zones A..H: North Serpentine, West Switchback, East Switchback, 16 DFMD Parallel Security Channels (6 North, 5 West, 5 East), Holding Circulation Loops, Radial Fan approach, Split-Merge, Post-Darshan Dispersal Plaza, and Dynamic Surge Overflow Reserve Bay.
- For Option 1, use: "template": "campus", "lanes": 16, "entrances": 14, "exits": 6, "security": true, "waitingArea": true, "multiZone": true.
`
    : '';

  const exampleTemplate = isLargeCampus ? 'campus' : 'parallel';
  const exampleLanes = isLargeCampus ? 16 : Math.min(6, Math.max(2, Math.floor((site.width - 6) / 3.5)));
  const exampleEntrances = isLargeCampus ? 14 : 1;
  const exampleExits = isLargeCampus ? 6 : 1;
  const exampleWaiting = isLargeCampus;

  return `SITE SPECIFICATIONS:
- Temple Name: "${temple?.name || 'Sanctuary Precinct'}"
- Available Crowd Space Footprint: ${site.length}m (Length) × ${site.width}m (Width)
- Measurement Unit: ${site.unit}
- Daily Expected Visitors: ${requirements?.expectedVisitors?.toLocaleString() || 'N/A'}
- Peak Concurrent Visitors: ${requirements?.peakVisitors?.toLocaleString() || 'N/A'}

USER INSTRUCTIONS:
"${userRequirement || 'Design an optimal queue system for peak crowd management within this site.'}"
${campusDirective}
TASK:
Propose up to 3 meaningfully different layout options that physically fit within ${site.length}m × ${site.width}m:
- Option 1: ${isLargeCampus ? 'Distributed Multi-Zone Temple Campus (template: "campus")' : 'High-throughput topology (e.g. Parallel or Serpentine)'}
- Option 2: Continuous flow topology (e.g. U-Shape or Serpentine with alternate spacing)
- Option 3: Balanced or Split branch topology (e.g. Split or Parallel)

Allowed templates: "parallel", "serpentine", "u_shape", "split"${isLargeCampus ? ', "campus"' : ''}.
CRITICAL CONSTRAINT: Total required width (lanes × laneWidth + (lanes - 1) × spacing) MUST be <= ${site.width - 6}m.
${isLargeCampus ? '' : `For site width ${site.width}m, you MUST NOT exceed ${Math.floor((site.width - 6) / 3.5)} lanes!`}

Respond strictly with this JSON structure:
{
  "recommendations": [
    {
      "id": "opt-1",
      "title": "Title describing strategy",
      "intent": {
        "template": "${exampleTemplate}",
        "lanes": ${exampleLanes},
        "laneWidth": 2.0,
        "spacing": 1.5,
        "entrances": ${exampleEntrances},
        "exits": ${exampleExits},
        "security": true,
        "waitingArea": ${exampleWaiting},
        ${isLargeCampus ? '"multiZone": true,' : ''}
        "reasoning": "Concise architectural rationale.",
        "warnings": []
      }
    }
  ]
}`;
}

/**
 * Builds the user prompt for optimizing an existing layout
 */
export function buildLayoutOptimizationPrompt(scene) {
  const { temple, site, requirements, components = [], analysis = {} } = scene;

  const compactComponents = components.map((c) => ({
    type: c.type,
    name: c.name,
    dimensions: c.dimensions,
    position: c.position,
    rotation: c.rotation,
  }));

  const metrics = analysis.metrics || {};
  const errors = analysis.errors || [];
  const warnings = analysis.warnings || [];

  const isLargeCampus =
    (site.length >= 140 && site.width >= 100) ||
    (requirements?.peakVisitors >= 5000);

  const campusOptNote = isLargeCampus
    ? `\nSPECIAL DIRECTIVE: Since this site is campus-scale (${site.length}m × ${site.width}m), if the current layout is single-zone or has bottlenecks, you can propose "template": "campus" (lanes: 16, multiZone: true) to deploy the distributed 5-Gopuram multi-zone festival campus.`
    : '';

  return `CURRENT CROWD LAYOUT & DIAGNOSTICS:
- Temple: "${temple?.name || 'Sanctuary'}"
- Site Dimensions: ${site.length}m × ${site.width}m
- Peak Concurrent Demand: ${requirements?.peakVisitors || 'N/A'} visitors
- Current Queue Capacity: ${metrics.queueCapacity || 0} people
- Current Peak Utilization: ${metrics.utilization || 0}%
- Current Estimated Wait: ${metrics.estimatedWaitMinutes || 0} minutes
- Active Components Count: ${components.length}
- Current Components: ${JSON.stringify(compactComponents)}
- Identified Issues: ${JSON.stringify(errors.map((e) => e.message).concat(warnings.map((w) => w.message)))}

TASK:
Analyze the bottlenecks and diagnostics above and propose an optimized layout intent to resolve capacity deficits, spatial collisions, or throughput constraints within ${site.length}m × ${site.width}m.${campusOptNote}

Respond strictly with this JSON structure:
{
  "intent": {
    "template": "serpentine",
    "lanes": 4,
    "laneWidth": 2.0,
    "spacing": 1.5,
    "entrances": 1,
    "exits": 1,
    "security": true,
    "waitingArea": false,
    "reasoning": "Concise architectural rationale for this optimization.",
    "warnings": []
  },
  "changes": [
    "List specific improvements made (e.g. Switched to serpentine to increase linear queue capacity)"
  ],
  "reasoning": "Overall strategic summary."
}`;
}
