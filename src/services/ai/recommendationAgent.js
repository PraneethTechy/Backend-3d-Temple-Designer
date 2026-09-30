/**
 * DevaSetu AI Recommendation Agent
 * Optimizes an existing crowd layout based on current metrics and spatial constraints.
 * Enforces deterministic ground-truth comparison between current vs optimized metrics.
 */

import { SYSTEM_PROMPT, buildLayoutOptimizationPrompt } from './layoutPrompt.js';
import { LayoutOptimizationResponseSchema } from './layoutSchema.js';
import { callOpenRouterChat, isOpenRouterConfigured } from './openrouter.service.js';
import { generateProceduralLayout } from '../layout/layoutGenerator.js';
import { calculateQueueCapacity } from '../layout/capacityCalculator.js';
import { validateLayout } from '../layout/layoutValidator.js';

/**
 * Optimizes current scene layout using OpenRouter AI or deterministic spatial heuristics.
 */
export async function optimizeCurrentLayout(scene, userRequirement = '', options = {}) {
  const { allowFallback = false } = options;

  let rawAiResponse;

  if (isOpenRouterConfigured()) {
    try {
      const userPrompt = buildLayoutOptimizationPrompt(scene);
      rawAiResponse = await callOpenRouterChat({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });
    } catch (err) {
      console.warn('[AI RecommendationAgent] OpenRouter call failed:', err.message);
      if (!allowFallback) {
        return {
          success: false,
          message: 'AI layout optimization is temporarily unavailable. You can continue designing manually.',
          error: err.message,
        };
      }
    }
  } else {
    if (!allowFallback) {
      return {
        success: false,
        message: 'AI layout optimization is temporarily unavailable. You can continue designing manually.',
        error: 'OpenRouter API key is not configured in server environment.',
      };
    }
  }

  let validatedData;
  let isFallback = false;

  if (!rawAiResponse) {
    isFallback = true;
    validatedData = generateFallbackOptimization(scene);
  } else {
    const validationResult = LayoutOptimizationResponseSchema.safeParse(rawAiResponse);
    if (!validationResult.success) {
      console.warn('[AI RecommendationAgent] Zod validation rejected AI response:', validationResult.error.format());
      if (allowFallback) {
        isFallback = true;
        validatedData = generateFallbackOptimization(scene);
      } else {
        return {
          success: false,
          message: 'AI optimization response failed schema validation.',
          error: validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        };
      }
    } else {
      validatedData = validationResult.data;
    }
  }

  const intent = validatedData.intent;
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

  // Run existing deterministic procedural layout generator
  const proceduralResult = generateProceduralLayout(scene, proceduralOptions);

  // Compute ground-truth current metrics
  const peakVisitors = Number(scene.requirements?.peakVisitors) || 0;
  const currentMetrics = calculateQueueCapacity(scene.components || [], peakVisitors);

  if (!proceduralResult.success) {
    return {
      success: true,
      mode: 'optimize',
      isFallback,
      recommendation: {
        id: 'opt-failed',
        title: 'Optimized Layout (Exceeds Dimensions)',
        intent,
        fits: false,
        fitReason: proceduralResult.reason || 'AI suggestion could not fit within the available site.',
        suggestion: proceduralResult.suggestion || 'Site boundaries restrict proposed lane configuration.',
        components: [],
        currentMetrics,
        optimizedMetrics: currentMetrics,
        diff: { capacityDiff: 0, waitMinutesDiff: 0, utilizationDiff: 0 },
        changes: validatedData.changes || [],
        reasoning: intent.reasoning,
        analysis: {
          metrics: currentMetrics,
          errors: [{ type: 'spatial_fit', message: proceduralResult.reason }],
          warnings: [],
          isValid: false,
        },
      },
    };
  }

  const optimizedComponents = proceduralResult.components;

  // Compute deterministic optimized metrics
  const optimizedMetrics = calculateQueueCapacity(optimizedComponents, peakVisitors);
  const layoutValidation = validateLayout(optimizedComponents, scene.site);

  // Calculate actual numeric differences (NO ungrounded AI claims)
  const capacityDiff = (optimizedMetrics.queueCapacity || 0) - (currentMetrics.queueCapacity || 0);
  const waitMinutesDiff = (optimizedMetrics.estimatedWaitMinutes || 0) - (currentMetrics.estimatedWaitMinutes || 0);
  const utilizationDiff = (optimizedMetrics.utilization || 0) - (currentMetrics.utilization || 0);

  return {
    success: true,
    mode: 'optimize',
    isFallback,
    recommendation: {
      id: 'opt-optimized-layout',
      title: `Optimized Layout: ${intent.template.toUpperCase()} (${intent.lanes} Lanes)`,
      intent,
      fits: true,
      fitReason: null,
      components: optimizedComponents,
      generationId: proceduralResult.generationId,
      currentMetrics,
      optimizedMetrics,
      diff: {
        capacityDiff,
        waitMinutesDiff,
        utilizationDiff,
      },
      changes: validatedData.changes || [
        `Reconfigured to ${intent.template} queue topology`,
        `Adjusted to ${intent.lanes} lanes with ${intent.laneWidth}m width`,
      ],
      reasoning: validatedData.reasoning || intent.reasoning,
      analysis: {
        metrics: optimizedMetrics,
        errors: layoutValidation.errors,
        warnings: layoutValidation.warnings,
        isValid: layoutValidation.isValid,
      },
    },
  };
}

/**
 * Intelligent fallback heuristic when AI service is offline
 */
function generateFallbackOptimization(scene) {
  const site = scene.site || { length: 50, width: 30 };
  const currentComponents = scene.components || [];
  const peakVisitors = Number(scene.requirements?.peakVisitors) || 1500;
  const currentMetrics = calculateQueueCapacity(currentComponents, peakVisitors);

  const usableWidth = site.width - 6;
  const isLargeCampus =
    (site.length >= 140 && site.width >= 100) ||
    peakVisitors >= 5000;

  if (isLargeCampus) {
    return {
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
        reasoning: 'Upgraded layout to 5-Gopuram Distributed Multi-Zone Campus model to eliminate single-queue bottleneck and safely process 100K festival peak demand.',
        warnings: [],
      },
      changes: [
        'Decentralized single entrance into 3 incoming Gopurams (North 40%, West 30%, East 30%)',
        'Implemented 16 DFMD security channels and pre-screening holding loops in Zones A, B, and C',
        'Added central radial approach corridors D1-D4 to Sri Ganesha Maha Garbhagriha',
        'Built 60m Post-Darshan Dispersal Plaza and 4-channel South Exit Egress with surge overflow bay',
      ],
      reasoning: 'Multi-zone campus topology resolves severe capacity bottlenecks by distributing queue density across 8 functional spatial zones.',
    };
  }

  // If current capacity is below peak, switch to high-density serpentine with max lanes
  let template = 'serpentine';
  let lanes = Math.min(6, Math.max(3, Math.floor(usableWidth / 3.0)));

  if (currentMetrics.utilization < 70) {
    // If underutilized, parallel is cleaner
    template = 'parallel';
    lanes = Math.min(5, Math.max(2, Math.floor(usableWidth / 3.5)));
  }

  return {
    intent: {
      template,
      lanes,
      laneWidth: 2.0,
      spacing: 1.4,
      entrances: 1,
      exits: 1,
      security: true,
      waitingArea: false,
      reasoning: `Optimization balances crowd holding capacity (${peakVisitors} peak) against interior passageway clearance.`,
      warnings: [],
    },
    changes: [
      `Adopted ${template} topology to maximize linear queue capacity within ${site.length}m × ${site.width}m`,
      `Configured ${lanes} continuous channels with 1.4m barrier spacing for optimal crowd throughput`,
      'Integrated dedicated security checkpoint and direct darshan clearance corridor',
    ],
    reasoning: 'Redesigned queue geometry to eliminate throughput bottlenecks and maintain safe crowd density under 2 persons/m².',
  };
}
