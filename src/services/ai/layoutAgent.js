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
import { extractArchitecturalIntentFromPrompt } from './promptArchitectureExtractor.js';

/**
 * Generates up to 3 diverse AI layout options.
 * Validates with Zod, passes through procedural engine, and computes deterministic metrics.
 */
export async function generateAiLayoutRecommendations(scene, userRequirement = '', options = {}) {
  const { allowFallback = false } = options;
  const promptArchitecture = extractArchitecturalIntentFromPrompt(userRequirement, scene.site);

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
    validatedData = generateFallbackProposals(scene, userRequirement, promptArchitecture);
  } else {
    // 1. Zod Validation
    const validationResult = LayoutGenerationResponseSchema.safeParse(rawAiResponse);
    if (!validationResult.success) {
      console.warn('[AI LayoutAgent] Zod validation rejected AI response:', validationResult.error.format());
      if (allowFallback) {
        isFallback = true;
        validatedData = generateFallbackProposals(scene, userRequirement, promptArchitecture);
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

    const mergedArchitecture = {
      ...promptArchitecture,
      ...(intent.architecture || {}),
    };

    // Convert intent parameters to procedural layout options
    const proceduralOptions = {
      template: intent.template,
      lanes: intent.lanes,
      laneWidth: intent.laneWidth,
      spacing: intent.spacing,
      includeSecurity: intent.security !== false,
      includeWaitingArea: intent.waitingArea === true,
      includeTempleArchitecture: intent.templeArchitecture !== false,
      multiZone: intent.multiZone === true,
      architecture: mergedArchitecture,
      prompt: userRequirement,
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
 * Generates 3 diverse procedural proposals as fallback when AI service is offline.
 * Directly reflects the user's architectural prompt specifications.
 */
function generateFallbackProposals(scene, userRequirement = '', promptArchitecture = null) {
  const site = scene.site || { length: 50, width: 30 };
  const arch = promptArchitecture || extractArchitecturalIntentFromPrompt(userRequirement, site);
  const usableWidth = site.width - 6;

  const defaultLanes = Math.min(6, Math.max(2, Math.floor(usableWidth / 3.5)));
  const primaryTemplate = arch.preferredTemplate || 'parallel';

  // Determine diverse secondary and tertiary templates
  let altTemplate1 = 'serpentine';
  let altTemplate2 = 'u_shape';

  if (primaryTemplate === 'serpentine') {
    altTemplate1 = 'parallel';
    altTemplate2 = 'u_shape';
  } else if (primaryTemplate === 'u_shape') {
    altTemplate1 = 'parallel';
    altTemplate2 = 'serpentine';
  } else if (primaryTemplate === 'arc' || primaryTemplate === 'radial') {
    altTemplate1 = 'parallel';
    altTemplate2 = 'serpentine';
  }

  const gopuramDesc = `${arch.gopuramCount} Gopuram${arch.gopuramCount > 1 ? 's' : ''}`;
  const entranceDesc = `${arch.entranceCount} Entrance${arch.entranceCount > 1 ? 's' : ''}`;
  const sanctumDesc = arch.sanctumPosition === 'center' ? 'Central Sanctum' : 'Sanctum Axis';

  return {
    recommendations: [
      {
        id: 'opt-primary',
        title: `Option A: ${primaryTemplate.replace('_', '-').toUpperCase()} (${gopuramDesc}, ${sanctumDesc})`,
        intent: {
          template: primaryTemplate,
          lanes: defaultLanes,
          laneWidth: 2.0,
          spacing: 1.5,
          entrances: arch.entranceCount,
          exits: arch.exitCount,
          security: true,
          waitingArea: false,
          architecture: arch,
          reasoning: `Tailored architecture providing ${gopuramDesc}, ${entranceDesc}, ${arch.exitCount} Exit, and ${sanctumDesc} with ${primaryTemplate.replace('_', '-')} queue layout.`,
          warnings: [],
        },
      },
      {
        id: 'opt-alt-1',
        title: `Option B: ${altTemplate1.replace('_', '-').toUpperCase()} (${gopuramDesc}, High Holding)`,
        intent: {
          template: altTemplate1,
          lanes: Math.max(2, defaultLanes - (altTemplate1 === 'serpentine' ? 1 : 0)),
          laneWidth: 2.0,
          spacing: 1.2,
          entrances: arch.entranceCount,
          exits: arch.exitCount,
          security: true,
          waitingArea: true,
          architecture: arch,
          reasoning: `High-density queue configuration providing ${gopuramDesc} and continuous flow into ${sanctumDesc}.`,
          warnings: [],
        },
      },
      {
        id: 'opt-alt-2',
        title: `Option C: ${altTemplate2.replace('_', '-').toUpperCase()} (${gopuramDesc}, Balanced Flow)`,
        intent: {
          template: altTemplate2,
          lanes: Math.max(2, Math.min(4, defaultLanes)),
          laneWidth: 2.2,
          spacing: 1.6,
          entrances: arch.entranceCount,
          exits: arch.exitCount,
          security: true,
          waitingArea: false,
          architecture: arch,
          reasoning: `Balanced crowd circulation with dedicated ${entranceDesc}, ${gopuramDesc}, and smooth pilgrim dispersal.`,
          warnings: [],
        },
      },
    ],
  };
}
