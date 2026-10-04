/**
 * DevaSetu AI Capacity Expansion Agent
 * Generates structured, non-destructive queue expansion plans in response to capacity overload alerts.
 * Operates purely as a high-level planner; geometry is handled by deterministic layout engines.
 */

import { CapacityExpansionPlanSchema } from './layoutSchema.js';
import { callOpenRouterChat, isOpenRouterConfigured } from './openrouter.service.js';

export async function planCapacityExpansion(payload = {}, options = {}) {
  const { allowFallback = true } = options;
  const { problem = {}, site = {}, existingLayout = {}, existingQueues = [], requirements = {} } = payload;

  const targetZone = problem.zone || 'north';
  const occupancy = problem.occupancy || 0;
  const capacity = problem.capacity || 0;
  const utilization = problem.utilization || (capacity > 0 ? occupancy / capacity : 1.25);
  const arrivalRate = problem.arrivalRate || 0;
  const siteLength = site.length || 100;
  const siteWidth = site.width || 60;

  let rawAiResponse = null;

  if (isOpenRouterConfigured()) {
    try {
      const systemPrompt = `You are DevaSetu AI Pilgrimage Spatial Planner.
Your role is to propose high-level queue capacity expansion plans to alleviate severe crowd congestion in temple queue systems.
CRITICAL RULES:
1. You are a planner, NOT a geometry engine. Do NOT output 3D vertices, coordinates, or mesh objects.
2. Return ONLY a single valid JSON object strictly matching this schema:
{
  "type": "capacity_expansion",
  "targetZone": string,
  "reasoning": string,
  "changes": [
    {
      "action": "add_queue",
      "template": "serpentine" | "parallel" | "u_shape" | "arc" | "radial" | "s_shape",
      "lanes": integer between 1 and 12,
      "laneWidth": number between 1.0 and 3.0,
      "spacing": number between 1.0 and 2.5,
      "connection": string
    }
  ],
  "expectedCapacityIncrease": number,
  "constraints": string[]
}
3. Existing architecture (Sanctum, Gopurams, existing queues, security portals) MUST be preserved.
4. Ground your reasoning in the actual computed problem metrics provided.`;

      const userPrompt = `A crowd overload condition requires capacity expansion:
Target Zone: ${targetZone}
Current Occupancy: ${occupancy} devotees
Designed Capacity: ${capacity} devotees
Current Utilization: ${Math.round(utilization * 100)}%
Arrival Rate: ${arrivalRate}/min
Site Space: ${siteLength}m length x ${siteWidth}m width
Existing Queues in Zone: ${existingQueues.length} components
Requirements:
- preserveExistingQueues: ${requirements.preserveExistingQueues !== false}
- preserveTempleArchitecture: ${requirements.preserveTempleArchitecture !== false}
- allowCurvedQueues: ${requirements.allowCurvedQueues !== false}
- allowSerpentine: ${requirements.allowSerpentine !== false}

Propose an optimal queue expansion plan to absorb the crowd demand without violating temple constraints.`;

      rawAiResponse = await callOpenRouterChat({
        systemPrompt,
        userPrompt,
      });
    } catch (err) {
      console.warn('[CapacityExpansionAgent] OpenRouter call failed:', err.message);
      if (!allowFallback) {
        return {
          success: false,
          message: 'AI expansion planner is temporarily unavailable.',
          error: err.message,
        };
      }
    }
  }

  // Fallback to deterministic intelligent planning if OpenRouter is unconfigured or failed
  let planToValidate = rawAiResponse;

  if (!planToValidate) {
    if (!allowFallback) {
      return {
        success: false,
        message: 'AI expansion planner is unconfigured.',
        error: 'OpenRouter not configured and fallback disabled.',
      };
    }

    const deficit = Math.max(150, occupancy - capacity);
    const template = deficit >= 600 ? 'serpentine' : deficit >= 300 ? 'arc' : 'parallel';
    const lanes = Math.min(6, Math.max(2, Math.ceil(deficit / 250)));
    const laneWidth = 2.0;
    const spacing = 1.5;
    const expectedCapacityIncrease = lanes * (template === 'serpentine' ? 240 : 150);

    planToValidate = {
      type: 'capacity_expansion',
      targetZone,
      reasoning: `At the current ${Math.round(utilization * 100)}% utilization (${occupancy.toLocaleString()} devotees vs ${capacity.toLocaleString()} designed capacity), additional queue capacity of ${deficit}+ devotees is required in the ${targetZone} zone. Proposing ${lanes} ${template} lanes to expand holding volume and mitigate upstream queue spillover while strictly preserving sacred Dravidian architecture.`,
      changes: [
        {
          action: 'add_queue',
          template,
          lanes,
          laneWidth,
          spacing,
          connection: `${targetZone}-queue-junction -> security-holding`,
        },
      ],
      expectedCapacityIncrease,
      constraints: [
        'preserve existing temple architecture',
        'preserve existing queues',
        'remain inside site boundary',
        'maintain flow toward security',
      ],
    };
  }

  // Schema Validation
  const validationResult = CapacityExpansionPlanSchema.safeParse(planToValidate);
  if (!validationResult.success) {
    console.warn('[CapacityExpansionAgent] Validation failed:', validationResult.error.format());
    return {
      success: false,
      message: 'Expansion plan could not be safely validated against schema requirements.',
      error: validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  return {
    success: true,
    plan: validationResult.data,
  };
}
