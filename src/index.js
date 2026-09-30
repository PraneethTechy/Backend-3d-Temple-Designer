import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { generateAiLayoutRecommendations } from './services/ai/layoutAgent.js';
import { optimizeCurrentLayout } from './services/ai/recommendationAgent.js';
import { isOpenRouterConfigured, getOpenRouterModel } from './services/ai/openrouter.service.js';
import planRoutes from './routes/planRoutes.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback to cwd

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Scaffolded Health Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DevaSetu Smart Queue Designer API is running'
  });
});

// AI Service Status Endpoint
app.get('/api/ai/status', (req, res) => {
  res.json({
    success: true,
    configured: isOpenRouterConfigured(),
    model: getOpenRouterModel(),
  });
});

// Phase 4: AI Queue Designer Endpoint
app.post('/api/ai/layout', async (req, res) => {
  try {
    const { scene, prompt = '', mode = 'generate', allowFallback = true } = req.body || {};

    if (!scene || !scene.site) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scene data provided. Scene must contain site dimensions.',
      });
    }

    if (mode === 'optimize') {
      const result = await optimizeCurrentLayout(scene, prompt, { allowFallback });
      if (!result.success) {
        return res.status(503).json(result);
      }
      return res.json(result);
    } else {
      const result = await generateAiLayoutRecommendations(scene, prompt, { allowFallback });
      if (!result.success) {
        return res.status(503).json(result);
      }
      return res.json(result);
    }
  } catch (err) {
    console.error('[AI Endpoint Error]', err);
    return res.status(500).json({
      success: false,
      message: 'AI layout generation encountered an unexpected internal error. You can continue designing manually.',
      error: err.message,
    });
  }
});

// Phase 6: MongoDB Queue Plan Persistence Routes
app.use('/api/plans', planRoutes);

// Root welcome endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'DevaSetu Smart Queue Designer API',
    status: 'online',
    phase: 'Phase 6 - Production Ready (Persistence & Standalone Product)',
    endpoints: {
      health: '/api/health',
      aiStatus: '/api/ai/status',
      aiLayout: 'POST /api/ai/layout',
      plans: '/api/plans',
    }
  });
});

// Global process error resilience
process.on('unhandledRejection', (reason) => {
  console.warn('[DevaSetu Server] Handled rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[DevaSetu Server] Handled exception:', err?.message || err);
});

// Start Server
async function startServer() {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`[DevaSetu Server] API server listening on http://localhost:${PORT}`);
    console.log(`[DevaSetu Server] Health check available at http://localhost:${PORT}/api/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[DevaSetu Server] Port ${PORT} is currently in use. Please terminate any other process on port ${PORT} or change PORT in .env.`);
    } else {
      console.error('[DevaSetu Server] Server error:', err);
    }
  });
}

startServer();
