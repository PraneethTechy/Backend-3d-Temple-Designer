/**
 * DevaSetu OpenRouter AI Service
 * OpenAI-compatible interface to OpenRouter LLM endpoints.
 * Never exposes API keys or logs secrets.
 */

import dotenv from 'dotenv';
dotenv.config();

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
const REQUEST_TIMEOUT_MS = 25000;

/**
 * Checks if OpenRouter is configured in environment
 */
export function isOpenRouterConfigured() {
  const key = process.env.OPENROUTER_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('your_') && !key.includes('placeholder'));
}

/**
 * Gets configured model name
 */
export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

/**
 * Calls OpenRouter chat completion API with structured system & user prompts.
 * Returns parsed JSON or throws structured error.
 */
export async function callOpenRouterChat({ systemPrompt, userPrompt, temperature = 0.2 }) {
  if (!isOpenRouterConfigured()) {
    throw new Error('OPENROUTER_API_KEY is not configured in server environment.');
  }

  const apiKey = process.env.OPENROUTER_API_KEY.trim();
  const model = getOpenRouterModel();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'DevaSetu Smart Queue Designer',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let parsedError = errorBody;
      try {
        const jsonErr = JSON.parse(errorBody);
        parsedError = jsonErr.error?.message || jsonErr.message || errorBody;
      } catch {
        // use raw errorBody
      }
      throw new Error(`OpenRouter API responded with status ${response.status}: ${parsedError}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('OpenRouter returned an empty message response.');
    }

    // Sanitize and extract JSON (strip markdown code fences if model returned ```json ... ```)
    const sanitized = sanitizeJsonResponse(rawContent);
    const parsed = JSON.parse(sanitized);

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    throw err;
  }
}

/**
 * Strips markdown code fences or surrounding text to isolate JSON
 */
function sanitizeJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  // Extract strictly between the outermost { and } to ignore model preambles or safety tags
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}
