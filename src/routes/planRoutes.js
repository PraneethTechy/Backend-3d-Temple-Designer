/**
 * DevaSetu Queue Plan REST API Routes
 * CRUD endpoints for saving, listing, retrieving, updating, and deleting queue plans.
 * Supports primary MongoDB persistence with resilient fallback storage if database is offline.
 */

import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QueuePlan } from '../models/QueuePlan.js';
import { validatePlanPayload } from '../validators/planValidator.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_STORAGE_DIR = path.resolve(__dirname, '../../data');
const LOCAL_STORAGE_FILE = path.join(LOCAL_STORAGE_DIR, 'plans.json');

// Ensure local fallback storage directory exists
try {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORAGE_FILE)) {
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify([]), 'utf8');
  }
} catch (err) {
  console.warn('[PlanRoutes] Notice setting up local backup store:', err.message);
}

function readLocalPlans() {
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const content = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf8');
      return JSON.parse(content || '[]');
    }
  } catch (err) {
    console.warn('[LocalStore Read Error]', err.message);
  }
  return [];
}

function writeLocalPlans(plans) {
  try {
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(plans, null, 2), 'utf8');
  } catch (err) {
    console.warn('[LocalStore Write Error]', err.message);
  }
}

function isDbOnline() {
  return mongoose.connection.readyState === 1;
}

/**
 * POST /api/plans
 * Save a new queue plan
 */
router.post('/', async (req, res) => {
  try {
    const { valid, error, data } = validatePlanPayload(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan data provided',
        error,
      });
    }

    if (isDbOnline()) {
      const newPlan = new QueuePlan(data);
      const saved = await newPlan.save();
      return res.status(201).json({
        success: true,
        message: 'Plan saved successfully to MongoDB.',
        storage: 'mongodb',
        data: saved,
      });
    } else {
      // Local fallback persistence
      const localPlans = readLocalPlans();
      const newId = `plan_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();

      const newLocalPlan = {
        _id: newId,
        id: newId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      localPlans.unshift(newLocalPlan);
      writeLocalPlans(localPlans);

      return res.status(201).json({
        success: true,
        message: 'Plan saved successfully (local document store).',
        storage: 'local',
        data: newLocalPlan,
      });
    }
  } catch (err) {
    console.error('[Plan Save Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save plan.',
      error: err.message,
    });
  }
});

/**
 * GET /api/plans
 * List saved plans (metadata only)
 */
router.get('/', async (req, res) => {
  try {
    if (isDbOnline()) {
      const plans = await QueuePlan.find(
        {},
        {
          name: 1,
          templeName: 1,
          site: 1,
          requirements: 1,
          componentsCount: { $size: '$components' },
          metadata: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      )
        .sort({ updatedAt: -1 })
        .lean();

      return res.json({
        success: true,
        storage: 'mongodb',
        data: plans,
        count: plans.length,
      });
    } else {
      const localPlans = readLocalPlans();
      const metadataList = localPlans.map((p) => ({
        _id: p._id,
        id: p._id,
        name: p.name,
        templeName: p.templeName,
        site: p.site,
        requirements: p.requirements,
        componentsCount: Array.isArray(p.components) ? p.components.length : 0,
        metadata: p.metadata,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      return res.json({
        success: true,
        storage: 'local',
        data: metadataList,
        count: metadataList.length,
      });
    }
  } catch (err) {
    console.error('[Plan List Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve saved plans.',
      error: err.message,
    });
  }
});

/**
 * GET /api/plans/:id
 * Retrieve complete plan with all components
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbOnline() && mongoose.Types.ObjectId.isValid(id)) {
      const plan = await QueuePlan.findById(id).lean();
      if (plan) {
        return res.json({
          success: true,
          storage: 'mongodb',
          data: plan,
        });
      }
    }

    // Check local fallback store
    const localPlans = readLocalPlans();
    const found = localPlans.find((p) => String(p._id) === String(id) || String(p.id) === String(id));

    if (!found) {
      return res.status(404).json({
        success: false,
        message: 'Saved queue plan not found.',
      });
    }

    return res.json({
      success: true,
      storage: 'local',
      data: found,
    });
  } catch (err) {
    console.error('[Plan Fetch Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load plan.',
      error: err.message,
    });
  }
});

/**
 * PUT /api/plans/:id
 * Update an existing queue plan
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { valid, error, data } = validatePlanPayload(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan data provided',
        error,
      });
    }

    if (isDbOnline() && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await QueuePlan.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
      });

      if (updated) {
        return res.json({
          success: true,
          message: 'Plan updated successfully in MongoDB.',
          storage: 'mongodb',
          data: updated,
        });
      }
    }

    // Update in local store
    const localPlans = readLocalPlans();
    const index = localPlans.findIndex((p) => String(p._id) === String(id) || String(p.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Plan to update not found.',
      });
    }

    const updatedLocal = {
      ...localPlans[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    localPlans[index] = updatedLocal;
    writeLocalPlans(localPlans);

    return res.json({
      success: true,
      message: 'Plan updated successfully.',
      storage: 'local',
      data: updatedLocal,
    });
  } catch (err) {
    console.error('[Plan Update Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update plan.',
      error: err.message,
    });
  }
});

/**
 * DELETE /api/plans/:id
 * Delete a plan
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbOnline() && mongoose.Types.ObjectId.isValid(id)) {
      const deleted = await QueuePlan.findByIdAndDelete(id);
      if (deleted) {
        return res.json({
          success: true,
          message: 'Plan deleted successfully from MongoDB.',
          storage: 'mongodb',
          deletedId: id,
        });
      }
    }

    const localPlans = readLocalPlans();
    const filtered = localPlans.filter((p) => String(p._id) !== String(id) && String(p.id) !== String(id));

    if (filtered.length === localPlans.length) {
      return res.status(404).json({
        success: false,
        message: 'Plan to delete not found.',
      });
    }

    writeLocalPlans(filtered);

    return res.json({
      success: true,
      message: 'Plan deleted successfully.',
      storage: 'local',
      deletedId: id,
    });
  } catch (err) {
    console.error('[Plan Delete Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete plan.',
      error: err.message,
    });
  }
});

export default router;
