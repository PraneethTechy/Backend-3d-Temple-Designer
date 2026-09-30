/**
 * DevaSetu AI Layout Agent
 * Orchestrates OpenRouter LLM planning -> Zod validation -> Procedural layout generation -> Deterministic metrics.
 */

import { SYSTEM_PROMPT, buildLayoutGenerationPrompt } from './layoutPrompt.js';
import { LayoutGenerationResponseSchema } from './layoutSchema.js';
import { callOpenRouterChat, isOpenRouterConfigured } from './openrouter.service.js';
import { generateProceduralLayout } from '../layout/layoutGenerator.js';
import { calculateQueueCapacity } from '../layout/capacityCalculator.js';
import { validateLayout } from '../layout/layoutValidator.js';

/**
 * Generates up to 3 diverse AI layout options.
 * Validates with Zod, passes through procedural engine, and computes deterministic metrics.
 */
export async function generateAiLayoutRecommendations(scene, userRequirement = '', options = {}) {
  const { allowFallback = false } = options;

  let rawAiResponse;

  if (isOpenRouterConfigured()) {
    try {
      const userPrompt = buildLayoutGenerationPrompt(scene, userRequirement);
      rawAiResponse = await callOpenRouterChat({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });
    } catch (err) {
      console.warn('[AI LayoutAgent] OpenRouter call failed:', err.message);
      if (!allowFallback) {
        return {
          success: false,
          message: 'AI layout generation is temporarily unavailable. You can continue designing manually.',
          error: err.message,
        };
      }
    }
  } else {
    if (!allowFallback) {
      return {
        success: false,
        message: 'AI layout generation is temporarily unavailable. You can continue designing manually.',
        error: 'OpenRouter API key is not configured in server environment.',
      };
    }
  }

  // If fallback is permitted and no AI response was obtained, generate intelligent procedural proposals
  let validatedData;
  let isFallback = false;

  if (!rawAiResponse) {
    isFallback = true;
    validatedData = generateFallbackProposals(scene);
  } else {
    // 1. Zod Validation
    const validationResult = LayoutGenerationResponseSchema.safeParse(rawAiResponse);
    if (!validationResult.success) {
      console.warn('[AI LayoutAgent] Zod validation rejected AI response:', validationResult.error.format());
      if (allowFallback) {
        isFallback = true;
        validatedData = generateFallbackProposals(scene);
      } else {
        return {
          success: false,
          message: 'AI response failed schema validation. You can continue designing manually.',
          error: validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        };
      }
    } else {
      validatedData = validationResult.data;
    }
  }

  // 2. Process each recommendation through the deterministic procedural engine
  const recommendations = [];

  for (let i = 0; i < validatedData.recommendations.length; i++) {
    const item = validatedData.recommendations[i];
    const intent = item.intent;

    // Convert intent parameters to procedural layout options
    const proceduralOptions = {
      template: intent.template,
      lanes: intent.lanes,
      laneWidth: intent.laneWidth,
      spacing: intent.spacing,
      includeSecurity: intent.security !== false,
      includeWaitingArea: intent.waitingArea === true,
      includeTempleArchitecture: intent.templeArchitecture !== false,
      multiZone: intent.multiZone === true || intent.template === 'campus',
    };

    // 3. Generate layout using existing deterministic procedural engine
    let proceduralResult = generateProceduralLayout(scene, proceduralOptions);

    if (!proceduralResult.success && proceduralOptions.lanes > 2 && proceduralOptions.template !== 'campus' && scene.site?.width) {
      // Safely reduce lane count to fit within available width
      const maxLanes = Math.max(2, Math.floor((scene.site.width - 6) / (proceduralOptions.laneWidth + proceduralOptions.spacing)));
      if (maxLanes < proceduralOptions.lanes) {
        const adjustedOptions = { ...proceduralOptions, lanes: maxLanes };
        const retryResult = generateProceduralLayout(scene, adjustedOptions);
        if (retryResult.success) {
          proceduralResult = retryResult;
          intent.lanes = maxLanes;
          if (!intent.warnings) intent.warnings = [];
          intent.warnings.push(`Adjusted lanes from ${proceduralOptions.lanes} to ${maxLanes} to respect site width boundaries (${scene.site.width}m).`);
        }
      }
    }

    if (!proceduralResult.success) {
      // AI proposed a layout that could not fit or violates boundary constraints
      recommendations.push({
        id: item.id || `rec-${i + 1}`,
        title: item.title || `Option ${String.fromCharCode(65 + i)}`,
        intent,
        fits: false,
        fitReason: proceduralResult.reason || 'AI suggestion could not fit within the available site.',
        suggestion: proceduralResult.suggestion || 'Reduce lane count or spacing.',
        components: [],
        analysis: {
          metrics: {
            queueCapacity: 0,
            utilization: 0,
            estimatedWaitMinutes: 0,
            totalQueueLength: 0,
            activeLanes: intent.lanes,
          },
          errors: [{ type: 'spatial_fit', message: proceduralResult.reason || 'Layout does not fit site bounds.' }],
          warnings: intent.warnings || [],
          isValid: false,
        },
        aiReasoning: intent.reasoning,
        isFallback,
      });
      continue;
    }

    const components = proceduralResult.components;

    // 4. Run existing deterministic capacity calculator
    const peakVisitors = Number(scene.requirements?.peakVisitors) || 0;
    const capacityMetrics = calculateQueueCapacity(components, peakVisitors);

    // 5. Run existing layout validator
    const layoutValidation = validateLayout(components, scene.site);

    recommendations.push({
      id: item.id || `rec-${i + 1}`,
      title: item.title || `Option ${String.fromCharCode(65 + i)}: ${intent.template.toUpperCase()}`,
      intent,
      fits: true,
      fitReason: null,
      components,
      generationId: proceduralResult.generationId,
      analysis: {
        metrics: capacityMetrics,
        errors: layoutValidation.errors,
        warnings: layoutValidation.warnings,
        isValid: layoutValidation.isValid,
      },
      aiReasoning: intent.reasoning,
      isFallback,
    });
  }

  return {
    success: true,
    mode: 'generate',
    isFallback,
    recommendations,
  };
}

/**
 * Generates 3 diverse procedural proposals as fallback when AI service is offline
 */
function generateFallbackProposals(scene) {
  const site = scene.site || { length: 50, width: 30 };
  const usableWidth = site.width - 6;
  const isLargeCampus =
    (site.length >= 140 && site.width >= 100) ||
    (scene.requirements?.peakVisitors >= 5000);

  if (isLargeCampus) {
    return {
      recommendations: [
        {
          id: 'opt-campus-fest',
          title: 'Option A: Distributed Multi-Zone Temple Campus (100K Festival)',
          intent: {
            template: 'campus',
            lanes: 16,
            laneWidth: 2.0,
            spacing: 1.5,
            entrances: 14,
            exits: 6,
            security: true,
            waitingArea: true,
            multiZone: true,
            reasoning: 'Deploys 5 Gopurams, 8 distinct queue patterns across Zones A-H, 16 DFMD security channels, holding loops, radial darshan approach, and 60m post-darshan dispersal plaza.',
            warnings: [],
          },
        },
        {
          id: 'opt-campus-express',
          title: 'Option B: Balanced Multi-Stream Festival Campus',
          intent: {
            template: 'campus',
            lanes: 16,
            laneWidth: 2.0,
            spacing: 1.5,
            entrances: 14,
            exits: 6,
            security: true,
            waitingArea: true,
            multiZone: true,
            reasoning: 'Calibrated 40% North, 30% West, 30% East arrival streams with separate holding loops, preventing campus gridlock.',
            warnings: [],
          },
        },
        {
          id: 'opt-campus-reserve',
          title: 'Option C: Surge Reserve Multi-Zone Campus',
          intent: {
            template: 'campus',
            lanes: 16,
            laneWidth: 2.0,
            spacing: 1.5,
            entrances: 14,
            exits: 6,
            security: true,
            waitingArea: true,
            multiZone: true,
            reasoning: 'Features Zone H dynamic surge overflow reserve bay (44m × 22m loop) with dedicated release gates to absorb peak arrival bursts.',
            warnings: [],
          },
        },
      ],
    };
  }

  // Option A: Parallel
  const parallelLanes = Math.min(6, Math.max(2, Math.floor(usableWidth / 3.5)));
  // Option B: Serpentine
  const serpentineLanes = Math.min(5, Math.max(3, Math.floor(usableWidth / 3.2)));
  // Option C: U-Shape
  const uShapeLanes = Math.min(4, Math.max(2, Math.floor(usableWidth / 4.0)));

  return {
    recommendations: [
      {
        id: 'opt-parallel',
        title: 'Option A: High-Throughput Parallel',
        intent: {
          template: 'parallel',
          lanes: parallelLanes,
          laneWidth: 2.0,
          spacing: 1.5,
          entrances: 1,
          exits: 1,
          security: true,
          waitingArea: false,
          reasoning: 'Parallel channels offer clear linear visibility and rapid barrier management for steady crowds.',
          warnings: [],
        },
      },
      {
        id: 'opt-serpentine',
        title: 'Option B: Compact High-Density Serpentine',
        intent: {
          template: 'serpentine',
          lanes: serpentineLanes,
          laneWidth: 2.0,
          spacing: 1.2,
          entrances: 1,
          exits: 1,
          security: true,
          waitingArea: false,
          reasoning: 'Serpentine zig-zag routing maximizes total holding capacity within the site footprint.',
          warnings: [],
        },
      },
      {
        id: 'opt-ushape',
        title: 'Option C: Smooth Continuous U-Shape',
        intent: {
          template: 'u_shape',
          lanes: uShapeLanes,
          laneWidth: 2.2,
          spacing: 1.6,
          entrances: 1,
          exits: 1,
          security: true,
          waitingArea: false,
          reasoning: 'U-shape channel routing provides safe buffer space between inward queue and outward darshan egress.',
          warnings: [],
        },
      },
    ],
  };
}
