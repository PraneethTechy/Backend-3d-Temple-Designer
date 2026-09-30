/**
 * DevaSetu Queue Plan Server Validator
 * Validates incoming Scene JSON structures prior to MongoDB persistence.
 */

import { z } from 'zod';
import { UNITS } from '../../shared/units.js';

const ComponentInputSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().default(''),
  position: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }).default({ x: 0, y: 0, z: 0 }),
  rotation: z
    .union([
      z.number(),
      z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        z: z.number().optional(),
      }),
    ])
    .default(0)
    .transform((val) => (typeof val === 'number' ? val : (val.y ?? val.z ?? 0))),
  scale: z
    .union([
      z.number().transform((s) => ({ x: s, y: s, z: s })),
      z.object({
        x: z.number().default(1),
        y: z.number().default(1),
        z: z.number().default(1),
      }),
    ])
    .default({ x: 1, y: 1, z: 1 }),
  dimensions: z
    .object({
      length: z.number().positive().default(1),
      width: z.number().positive().default(1),
      height: z.number().default(1),
    })
    .default({ length: 1, width: 1, height: 1 }),
  properties: z.record(z.any()).default({}),
  generated: z.boolean().default(false),
  generationId: z.string().nullable().default(null),
  role: z.string().nullable().default(null),
  template: z.string().nullable().default(null),
});

export const SavePlanPayloadSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(150),
  scene: z.object({
    temple: z
      .object({
        name: z.string().default('Sanctuary'),
      })
      .default({ name: 'Sanctuary' }),
    site: z.object({
      unit: z
        .enum([UNITS.METERS, UNITS.FEET, 'm', 'ft'])
        .default(UNITS.METERS)
        .transform((u) => (u === 'm' ? UNITS.METERS : u === 'ft' ? UNITS.FEET : u)),
      length: z.number().positive('Site length must be positive'),
      width: z.number().positive('Site width must be positive'),
      boundary: z.array(z.any()).default([]),
    }),
    requirements: z
      .object({
        expectedVisitors: z.number().min(0).default(0),
        peakVisitors: z.number().min(0).default(0),
      })
      .default({ expectedVisitors: 0, peakVisitors: 0 }),
    components: z.array(ComponentInputSchema).default([]),
    paths: z.array(z.any()).default([]),
    analysis: z.record(z.any()).default({}),
  }),
  metadata: z.record(z.any()).default({}),
});

/**
 * Validates and normalizes plan creation/update payload
 */
export function validatePlanPayload(body) {
  const result = SavePlanPayloadSchema.safeParse(body);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { valid: false, error: errorDetails, data: null };
  }

  const { name, scene, metadata } = result.data;

  // Prepare normalized document for Mongoose persistence
  const normalizedDoc = {
    name: name.trim(),
    templeName: (scene.temple?.name || 'Sanctuary').trim(),
    site: scene.site,
    requirements: scene.requirements,
    components: scene.components,
    paths: scene.paths || [],
    analysis: scene.analysis || {},
    metadata: {
      ...metadata,
      lastUsedTemplate: scene.components.find((c) => c.template)?.template || null,
      version: '1.0',
    },
  };

  return { valid: true, error: null, data: normalizedDoc };
}
