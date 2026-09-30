import { z } from 'zod';

export const AllowedTemplates = z.enum(['parallel', 'serpentine', 'u_shape', 'split', 'campus']);

/**
 * Strict schema for single AI layout intent.
 * Enforces pure high-level layout parameters with ZERO raw geometry.
 */
export const LayoutIntentSchema = z.object({
  template: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase().replace(/[-\s]/g, '_');
      if (lower === 'u_shape' || lower === 'ushape') return 'u_shape';
      return lower;
    }
    return val;
  }, AllowedTemplates),
  lanes: z.number().int().min(1).max(24),
  laneWidth: z.number().min(0.8).max(4.0),
  spacing: z.number().min(0.5).max(4.0),
  entrances: z.number().int().min(1).max(16).default(1),
  exits: z.number().int().min(1).max(16).default(1),
  security: z.boolean().default(true),
  waitingArea: z.boolean().default(false),
  multiZone: z.boolean().optional(),
  campusModel: z.any().optional(),
  zones: z.record(z.any()).optional(),
  crowdDistribution: z.record(z.any()).optional(),
  securityAllocation: z.record(z.any()).optional(),
  queuePatterns: z.array(z.string()).optional(),
  reasoning: z.string().min(5).max(1000),
  warnings: z.array(z.string()).default([]),
});

/**
 * Schema for AI layout generation response (up to 3 distinct options)
 */
export const LayoutGenerationResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(2).max(100),
      intent: LayoutIntentSchema,
    })
  ).min(1).max(3),
});

/**
 * Schema for AI layout optimization response
 */
export const LayoutOptimizationResponseSchema = z.object({
  intent: LayoutIntentSchema,
  changes: z.array(z.string()).min(1),
  reasoning: z.string().min(10),
});
