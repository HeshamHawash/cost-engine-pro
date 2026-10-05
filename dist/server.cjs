var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var PORT = 3e3;
var isProd = process.env.NODE_ENV === "production";
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json());
  let ai = null;
  function getAI() {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
    return ai;
  }
  async function generateWithFallback(contents, config) {
    const ai2 = getAI();
    const modelsToTry = [
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
    ];
    let lastError = null;
    for (const model of modelsToTry) {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[AI Gen] Model: ${model} - Attempt ${attempt}/${maxRetries}`);
          return await ai2.models.generateContent({
            model,
            contents,
            config
          });
        } catch (error) {
          lastError = error;
          const errStr = String(error?.message || error || "").toLowerCase();
          const isDailyQuotaExceeded = errStr.includes("quota exceeded") || errStr.includes("exceeded your current quota") || errStr.includes("exceeded your daily quota") || errStr.includes("generativerequestsperday");
          if (isDailyQuotaExceeded) {
            console.warn(`[AI Gen Warning] Daily quota exceeded for current model ${model}. Switching to next model immediately without retries.`);
            break;
          }
          const isTransient = errStr.includes("503") || errStr.includes("500") || errStr.includes("unavailable") || errStr.includes("high demand") || errStr.includes("resource_exhausted") || errStr.includes("rate limit") || errStr.includes("429") || error?.status === 503 || error?.status === 429 || error?.status === 500;
          if (isTransient) {
            const delayMs = attempt * 1e3;
            console.warn(`[AI Gen Warning] Transient error with model ${model} (attempt ${attempt}/${maxRetries}):`, error.message || error, `. Retrying in ${delayMs}ms...`);
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
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
  const rateLimitMap = /* @__PURE__ */ new Map();
  const RATE_LIMIT_WINDOW_MS = 60 * 1e3;
  const MAX_REQUESTS_PER_WINDOW = 30;
  function aiRateLimiter(req, res, next) {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const timestamps = (rateLimitMap.get(ip) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({
        error: "Too many requests. Please wait a minute before making more AI estimation requests."
      });
      return;
    }
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
    next();
  }
  function validateAiInput(req, res, next) {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: "GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in .env.local"
      });
      return;
    }
    const { prompt, systemInstruction } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: 'Missing or invalid "prompt" parameter' });
      return;
    }
    if (prompt.length > 3e4) {
      res.status(400).json({ error: "Prompt exceeds maximum character limit of 30,000 characters" });
      return;
    }
    if (systemInstruction && (typeof systemInstruction !== "string" || systemInstruction.length > 3e4)) {
      res.status(400).json({ error: 'Invalid "systemInstruction" parameter' });
      return;
    }
    next();
  }
  app.post("/api/ai/estimate-breakdown", aiRateLimiter, validateAiInput, async (req, res) => {
    try {
      const { prompt, systemInstruction, responseSchema } = req.body;
      const response = await generateWithFallback(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error("AI Estimate Breakdown Error:", error);
      const status = error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("429") ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });
  app.post("/api/ai/quick-budget", aiRateLimiter, validateAiInput, async (req, res) => {
    try {
      const { prompt, systemInstruction, responseSchema } = req.body;
      const response = await generateWithFallback(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error("AI Quick Budget Error:", error);
      const status = error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("429") ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });
  app.post("/api/ai/estimate-price", aiRateLimiter, validateAiInput, async (req, res) => {
    try {
      const { prompt, systemInstruction, responseSchema } = req.body;
      const response = await generateWithFallback(prompt, {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error("AI Estimate Price Error:", error);
      const status = error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("429") ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });
  if (!isProd) {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
