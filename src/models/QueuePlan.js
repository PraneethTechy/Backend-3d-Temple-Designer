/**
 * DevaSetu Queue Plan Mongoose Schema
 * Stores complete Scene JSON design specifications and metadata without Three.js runtime geometry.
 */

import mongoose from 'mongoose';
import { UNITS } from '../../shared/units.js';

const ComponentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    name: { type: String, default: '' },
    position: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
      z: { type: Number, required: true, default: 0 },
    },
    rotation: { type: Number, default: 0 },
    scale: {
      x: { type: Number, default: 1 },
      y: { type: Number, default: 1 },
      z: { type: Number, default: 1 },
    },
    dimensions: {
      length: { type: Number, required: true, default: 2 },
      width: { type: Number, required: true, default: 1 },
      height: { type: Number, default: 1 },
    },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    generated: { type: Boolean, default: false },
    generationId: { type: String, default: null },
    role: { type: String, default: null },
    template: { type: String, default: null },
  },
  { _id: false }
);

const QueuePlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      maxlength: [100, 'Plan name cannot exceed 100 characters'],
    },
    templeName: {
      type: String,
      required: [true, 'Temple name is required'],
      trim: true,
      maxlength: [120, 'Temple name cannot exceed 120 characters'],
    },
    site: {
      unit: {
        type: String,
        enum: [UNITS.METERS, UNITS.FEET],
        default: UNITS.METERS,
      },
      length: {
        type: Number,
        required: [true, 'Site length is required'],
        min: [5, 'Site length must be at least 5m'],
      },
      width: {
        type: Number,
        required: [true, 'Site width is required'],
        min: [5, 'Site width must be at least 5m'],
      },
      boundary: {
        type: [
          {
            x: Number,
            y: Number,
            z: Number,
          },
        ],
        default: [],
      },
    },
    requirements: {
      expectedVisitors: { type: Number, default: 0, min: 0 },
      peakVisitors: { type: Number, default: 0, min: 0 },
    },
    components: {
      type: [ComponentSchema],
      default: [],
    },
    paths: {
      type: Array,
      default: [],
    },
    analysis: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      lastUsedTemplate: { type: String, default: null },
      version: { type: String, default: '1.0' },
      source: { type: String, default: 'DevaSetu Smart Queue Designer' },
      tags: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

// Index for rapid sorted retrieval by update timestamp
QueuePlanSchema.index({ updatedAt: -1 });

export const QueuePlan = mongoose.models.QueuePlan || mongoose.model('QueuePlan', QueuePlanSchema);
