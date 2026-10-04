import { z } from 'zod';

export const AllowedTemplates = z.enum([
  'parallel',
  'serpentine',
  'u_shape',
  'split',
  'campus',
  'curved',
  'arc',
  'radial',
  's_shape',
]);

export const TempleArchitectureSchema = z.object({
  gopuramCount: z.number().int().min(0).max(12).default(2),
  gopuramDirections: z.array(z.string()).default([]),
  entranceCount: z.number().int().min(1).max(16).default(1),
  exitCount: z.number().int().min(1).max(8).default(1),
  hasVipEntrance: z.boolean().default(false),
  hasCircumambulatoryPath: z.boolean().default(false),
  sanctumPosition: z.enum(['center', 'east', 'west', 'north', 'south']).default('center'),
  sanctumSize: z.enum(['standard', 'large', 'grand']).default('standard'),
  queueSystemCount: z.number().int().min(1).max(8).default(1),
  queueShapes: z.array(z.string()).default([]),
  securityCheckpointCount: z.number().int().min(0).max(16).default(1),
  holdingBaysCount: z.number().int().min(0).max(8).default(0),
  mandapams: z.array(z.string()).default([]),
});

/**
 * Strict schema for single AI layout intent.
 * Enforces pure high-level layout parameters with ZERO raw geometry.
 */
export const LayoutIntentSchema = z.object({
  template: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase().replace(/[-\s]/g, '_');
      if (lower === 'u_shape' || lower === 'ushape') return 'u_shape';
      if (lower === 's_shape' || lower === 'sshape') return 's_shape';
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
  architecture: TempleArchitectureSchema.optional(),
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

/**
 * Strict schema for AI Capacity Expansion Plan.
 * AI acts as high-level planner producing structured expansion intent without arbitrary meshes or geometry.
 */
export const CapacityExpansionPlanSchema = z.object({
  type: z.literal('capacity_expansion').default('capacity_expansion'),
  targetZone: z.string().min(1),
  reasoning: z.string().min(5).max(1000),
  changes: z.array(
    z.object({
      action: z.enum(['add_queue', 'extend_queue', 'add_holding_bay']),
      template: AllowedTemplates,
      lanes: z.number().int().min(1).max(16),
      laneWidth: z.number().min(0.8).max(4.0).default(2.0),
      spacing: z.number().min(0.5).max(4.0).default(1.5),
      connection: z.string().optional(),
    })
  ).min(1),
  expectedCapacityIncrease: z.number().nonnegative(),
  constraints: z.array(z.string()).default([]),
});
