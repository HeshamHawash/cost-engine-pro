const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ================= AI ESTIMATION RESPONSE CACHE =================
const AI_CACHE_STORAGE_KEY = 'cost_engine_ai_cache_v1';
const MAX_CACHE_ENTRIES = 120;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

function getFromCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AI_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, CacheEntry<T>>;
    const entry = cache[key];
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
      return entry.data;
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return null;
}

function saveToCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(AI_CACHE_STORAGE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[key] = { timestamp: Date.now(), data };
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      delete cache[keys[0]];
    }
    localStorage.setItem(AI_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    // Ignore storage quota errors
  }
}

const withRetry = async <T>(fn: () => Promise<T>, retries = 4, initialDelay = 1500): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message?.toLowerCase() || '';
      
      // Do not retry if the request was deliberately cancelled/aborted
      if (errorMessage.includes('cancel') || errorMessage.includes('abort')) {
        throw error;
      }
      
      const waitTime = initialDelay * Math.pow(2, i);
      console.warn(`Transient error or High demand encountered: "${error?.message}". Retrying in ${waitTime}ms (Attempt ${i + 1}/${retries})...`);
      await delay(waitTime);
    }
  }
  throw lastError;
};

export const estimateItemBreakdown = async (
  itemDescription: string, 
  itemUnit: string, 
  country: string, 
  currency: string, 
  libraryResources: { name: string, type: string, unit: string, unitPrice: number }[] = [],
  includeIndirectCost: boolean = true,
  projectSummary?: string,
  allBoqItemsSummary?: string,
  signal?: AbortSignal,
  forceRefresh: boolean = false
) => {
  const sanitizedDescription = itemDescription.substring(0, 500).replace(/"/g, "'");
  const sanitizedCountry = country.replace(/"/g, "'");
  const sanitizedCurrency = currency.replace(/"/g, "'");

  const cacheKey = `breakdown:${sanitizedCountry}:${sanitizedCurrency}:${sanitizedDescription.toLowerCase()}:${itemUnit.toLowerCase()}:${includeIndirectCost}:${libraryResources.map(r => r.name + r.unitPrice).join(',')}`;
  if (!forceRefresh) {
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      console.log(`[AI Cache Hit] Returned cached estimate for: "${sanitizedDescription}"`);
      return cached;
    }
  }

  return withRetry(async () => {
    if (signal?.aborted) throw new Error("Estimation cancelled");
    
    // Prepare library context
    const libraryContext = libraryResources.length > 0 
      ? `\n\nAVAILABLE LIBRARY RESOURCES (PREFER THESE IF RELEVANT):\n${libraryResources.map(r => `- ${r.name} (${r.type}, ${r.unitPrice} ${currency}/${r.unit})`).join('\n')}`
      : '';

    const summaryContext = projectSummary && projectSummary.trim()
      ? `\n\nPROJECT GENERAL SUMMARY & SCOPE OF WORK:\n${projectSummary.trim()}`
      : '';

    const boqItemsContext = allBoqItemsSummary && allBoqItemsSummary.trim()
      ? `\n\nOVERALL PROJECT BOQ LINE ITEMS (FOR SCOPE REFERENCE):\n${allBoqItemsSummary.trim()}`
      : '';

    const indirectCostPrompt = includeIndirectCost 
      ? `STRUCTURE REQUIREMENTS:
          1. Separate 'Material Supply, Delivery & Transportation' from 'Installation/Construction'.
          2. The first 1-2 activities MUST cover Material Procurement, Logistics, and Site Delivery.
          3. The remaining activities should cover Installation, Execution, and Finishing.
          4. Total 5 activities exactly.`
      : `STRUCTURE REQUIREMENTS:
          1. Focus EXCLUSIVELY on DIRECT COSTS or DRY COSTS for the item (Installation/Construction/Execution).
          2. DO NOT include Logistics, Safety, Site Delivery, Transportation, or other Indirect Costs.
          3. Generate 3 to 5 activities covering the direct execution of the work.`;

    const systemLogisticsPrompt = includeIndirectCost
      ? `LOGISTICS vs INSTALLATION:
        - Procurement/Logistics activities should have their own productivity rates (usually higher, representing the capacity of delivery/logistics).
        - Installation activities should have productivity rates representing actual craftsmanship/construction speed.
        - Do not lump these two distinct phases into the same activity to avoid distorting resource costs linked to productivity.`
      : `DIRECT COST / DRY COST RULES:
        - You MUST strictly focus on direct production, installation, or execution of the physical work.
        - All activities MUST be direct work. DO NOT include procurement, delivery, site overhead, safety, or logistics activities.
        - ALL resources must be directly consumed by or utilized in the production/installation.
        - Productivity rates should represent actual craftsmanship/construction speed, NOT delivery capacity.`;

    const response = await fetch('/api/ai/estimate-breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Estimate construction activities and resources for: "${sanitizedDescription}" (Unit: ${itemUnit}) in ${sanitizedCountry} (${sanitizedCurrency}). 
          
          ${indirectCostPrompt}
          
          ${libraryContext}
          
          ${summaryContext}
          
          ${boqItemsContext}`,
        systemInstruction: `You are an expert construction estimator. 
        Estimates must be realistic for ${sanitizedCountry} in ${sanitizedCurrency}.
        Ensure activity names are descriptive and provided in full text (do not truncate).
        
        PROJECT SCOPE AND BACKGROUND ANALYSIS:
        - You MUST review the provided 'PROJECT GENERAL SUMMARY & SCOPE OF WORK' and 'OVERALL PROJECT BOQ LINE ITEMS' (if present) to understand the project standard, entire construction scope, and execution environment.
        - Use this background context to tailor the estimated activities, productivities, and material/labor specifications of this active BOQ item so they are fully aligned and proportional to the overall project's nature and standard.
        
        ${systemLogisticsPrompt}
        
        MATERIAL ESTIMATION RULES:
        - You MUST explicitly figure out and include ALL materials required for implementing the BOQ items, even if not explicitly mentioned in the description.
        - The unit price for each material MUST accurately reflect the current local market rate in ${sanitizedCountry} using ${sanitizedCurrency}.
        - Specify the appropriate standard unit for each material (e.g., m2, m3, kg, ton, piece, L).
        
        LABOR CLASSIFICATION RULES:
        - Labor for General Works MUST be classified exactly as either "Skilled Labor", "Semi-Skilled Labor", or "Unskilled Labor". 
        - For specified works, use the specific skilled labor name (e.g., "Carpenter", "Mason") for each activity, but any general supporting labor MUST still be classified using the general categories ("Skilled Labor", "Semi-Skilled Labor", or "Unskilled Labor").
        
        ${libraryResources.length > 0 ? "IMPORTANT: You MUST check the 'AVAILABLE LIBRARY RESOURCES' provided. If a library resource matches the needed resource for an activity, use its EXACT name and unit price. Only create new resources if existing ones are not suitable." : ""}
        Return ONLY a JSON object. No conversational text.
        Use 'hr' for all Labor/Equipment resource units.
        'unitPrice' MUST be the SINGLE resource's HOURLY rate. 
        'resourceCount' is the crew/machine count.
        
        STRICT JSON RULES:
        1. NO comments.
        2. NO literal newlines or tabs inside strings.
        3. ALL double quotes (") inside string values MUST be escaped as \\".
        4. NO trailing commas.`,
        responseSchema: {
          type: "object",
          properties: {
            activities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  unit: { type: "string" },
                  conversionRate: { type: "number" },
                  productivity: { type: "number" },
                  resources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        type: { 
                          type: "string",
                          description: "One of: Labor, Material, Equipment, Subcontractor"
                        },
                        unit: { type: "string" },
                        unitPrice: { type: "number" },
                        resourceCount: { type: "number" },
                        consumption: { type: "number" },
                        wastePercentage: { type: "number" },
                        usages: { type: "number" },
                      },
                      required: ['name', 'type', 'unit', 'unitPrice']
                    }
                  }
                },
                required: ['name', 'unit', 'conversionRate', 'productivity', 'resources']
              }
            }
          },
          required: ['activities']
        }
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI request failed');
    }

    const result = await response.json();
    saveToCache(cacheKey, result);
    return result;
  });
};

export const getQuickBudgetReference = async (itemDescription: string, itemUnit: string, country: string, currency: string, signal?: AbortSignal, forceRefresh: boolean = false) => {
  const sanitizedDescription = itemDescription.substring(0, 500).replace(/"/g, "'");
  const sanitizedCountry = country.replace(/"/g, "'");
  const sanitizedCurrency = currency.replace(/"/g, "'");
  
  const cacheKey = `quickbudget:${sanitizedCountry}:${sanitizedCurrency}:${sanitizedDescription.toLowerCase()}:${itemUnit.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      console.log(`[AI Cache Hit] Returned cached quick budget for: "${sanitizedDescription}"`);
      return cached;
    }
  }

  return withRetry(async () => {
    if (signal?.aborted) throw new Error("Estimation cancelled");
    
    const response = await fetch('/api/ai/quick-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Estimate market UNIT RATES for: "${sanitizedDescription}" in 1 ${itemUnit} for ${sanitizedCountry} (${sanitizedCurrency}).`,
        systemInstruction: `You are a senior cost estimator. 
        Provide realistic market unit rates for ${sanitizedCountry} in ${sanitizedCurrency}.
        Return ONLY a JSON object.
        STRICT JSON RULES:
        1. NO comments.
        2. NO literal newlines or tabs inside strings.
        3. ALL double quotes (") inside string values MUST be escaped as \".
        4. NO trailing commas.
        5. DO NOT include any text before or after the JSON object.`,
        responseSchema: {
          type: "object",
          properties: {
            laborCost: { type: "number" },
            materialCost: { type: "number" },
            equipmentCost: { type: "number" },
            subcontractorCost: { type: "number" }
          },
          required: ['laborCost', 'materialCost', 'equipmentCost', 'subcontractorCost']
        }
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI request failed');
    }

    const result = await response.json();
    saveToCache(cacheKey, result);
    return result;
  });
};

export const estimateResourceUnitPrice = async (resourceName: string, resourceType: string, resourceUnit: string, country: string, currency: string, signal?: AbortSignal, forceRefresh: boolean = false) => {
  const sanitizedName = resourceName.substring(0, 200).replace(/"/g, "'");
  const sanitizedType = resourceType.replace(/"/g, "'");
  const sanitizedUnit = resourceUnit.replace(/"/g, "'");
  const sanitizedCountry = country.replace(/"/g, "'");
  const sanitizedCurrency = currency.replace(/"/g, "'");
  
  const cacheKey = `resprice:${sanitizedCountry}:${sanitizedCurrency}:${sanitizedName.toLowerCase()}:${sanitizedType.toLowerCase()}:${sanitizedUnit.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      console.log(`[AI Cache Hit] Returned cached price for resource: "${sanitizedName}"`);
      return cached;
    }
  }

  return withRetry(async () => {
    if (signal?.aborted) throw new Error("Estimation cancelled");
    
    const response = await fetch('/api/ai/estimate-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Estimate the current market unit price for a ${sanitizedType} resource named "${sanitizedName}" per 1 ${sanitizedUnit} in ${sanitizedCountry} (${sanitizedCurrency}). Provide a single realistic number representing the cost per ${sanitizedUnit}.`,
        systemInstruction: `You are a senior procurement officer and cost estimator. 
        Provide a realistic market unit price for the specified resource in ${sanitizedCountry} using ${sanitizedCurrency}.
        Return ONLY a JSON object with the property 'unitPrice'.`,
        responseSchema: {
          type: "object",
          properties: {
            unitPrice: { type: "number" }
          },
          required: ['unitPrice']
        }
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI request failed');
    }

    const result = await response.json();
    saveToCache(cacheKey, result);
    return result;
  });
};

