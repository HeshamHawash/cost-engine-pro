import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  // Gemini Setup
  let ai: any = null;
  function getAI() {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  }

  // Helper for model fallback to handle potential service high demand (503) or rate limits with retries
  async function generateWithFallback(contents: any, config: any) {
    const ai = getAI();
    const modelsToTry = [
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
    ];
    
    let lastError: any = null;
    
    for (const model of modelsToTry) {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[AI Gen] Model: ${model} - Attempt ${attempt}/${maxRetries}`);
          return await ai.models.generateContent({
            model,
            contents,
            config
          });
        } catch (error: any) {
          lastError = error;
          const errStr = String(error?.message || error || '').toLowerCase();
          
          // Check if it's a daily/hard quota limit where retries on the SAME model are useless
          const isDailyQuotaExceeded = errStr.includes('quota exceeded') || 
                                       errStr.includes('exceeded your current quota') || 
                                       errStr.includes('exceeded your daily quota') ||
                                       errStr.includes('generativerequestsperday');
                                       
          if (isDailyQuotaExceeded) {
            console.warn(`[AI Gen Warning] Daily quota exceeded for current model ${model}. Switching to next model immediately without retries.`);
            break; // Break the current model's attempt loop to try the next fallback model
          }

          const isTransient = errStr.includes('503') || 
                              errStr.includes('500') ||
                              errStr.includes('unavailable') || 
                              errStr.includes('high demand') || 
                              errStr.includes('resource_exhausted') || 
                              errStr.includes('rate limit') ||
                              errStr.includes('429') ||
                              error?.status === 503 ||
                              error?.status === 429 ||
                              error?.status === 500;
                              
          if (isTransient) {
            const delayMs = attempt * 1000;
            console.warn(`[AI Gen Warning] Transient error with model ${model} (attempt ${attempt}/${maxRetries}):`, error.message || error, `. Retrying in ${delayMs}ms...`);
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          } else {
            throw error;
          }
        }
      }
      console.warn(`[AI Gen Warning] Model ${model} exhausted or skipped. Trying next fallback model...`);
    }
    
    throw lastError || new Error("AI Generation failed across all fallback models.");
  }

  // In-memory Rate Limiter: IP -> array of timestamps
  const rateLimitMap = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 30; // 30 AI requests per minute per IP

  function aiRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const timestamps = (rateLimitMap.get(ip) || []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({ 
        error: 'Too many requests. Please wait a minute before making more AI estimation requests.' 
      });
      return;
    }
    
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
    next();
  }

  function validateAiInput(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in .env.local'
      });
      return;
    }

    const { prompt, systemInstruction } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "prompt" parameter' });
      return;
    }
    if (prompt.length > 30000) {
      res.status(400).json({ error: 'Prompt exceeds maximum character limit of 30,000 characters' });
      return;
    }
    if (systemInstruction && (typeof systemInstruction !== 'string' || systemInstruction.length > 30000)) {
      res.status(400).json({ error: 'Invalid "systemInstruction" parameter' });
      return;
    }
    next();
  }

  // API Routes with rate limiting and input validation
  app.post('/api/ai/estimate-breakdown', aiRateLimiter, validateAiInput, async (req, res) => {
    try {
      const { prompt, systemInstruction, responseSchema } = req.body;
      const response = await generateWithFallback(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      });
      
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('AI Estimate Breakdown Error:', error);
      const status = error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429') ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });

  app.post('/api/ai/quick-budget', aiRateLimiter, validateAiInput, async (req, res) => {
    try {
      const { prompt, systemInstruction, responseSchema } = req.body;
      const response = await generateWithFallback(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      });
      
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('AI Quick Budget Error:', error);
      const status = error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429') ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });

  app.post('/api/ai/estimate-price', aiRateLimiter, validateAiInput, async (req, res) => {
    try {
      const { prompt, systemInstruction, responseSchema } = req.body;
      const response = await generateWithFallback(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      });
      
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('AI Estimate Price Error:', error);
      const status = error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429') ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });

  // Vite Middleware / Static Files
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
