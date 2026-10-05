
import { Resource, ResourceType } from './types.ts';

export const normalizeUnit = (unit: any, options: string[]) => {
  if (!unit && unit !== '') return options[0];
  const cleanUnit = (unit || '').toString().trim().toLowerCase();
  
  // Exact match
  const exactMatch = options.find(o => o && o.toLowerCase() === cleanUnit);
  if (exactMatch) return exactMatch;
  
  // Fuzzy match common variations
  const mapping: Record<string, string> = {
    'meters': 'm', 'meter': 'm', 'mtr': 'm',
    'kilometers': 'km', 'kilometer': 'km', 'kms': 'km',
    'square meters': 'm2', 'sqm': 'm2', 'm²': 'm2',
    'cubic meters': 'm3', 'cum': 'm3', 'm³': 'm3',
    'kilograms': 'kg', 'kgs': 'kg',
    'number': 'no', 'numbers': 'no', 'nos': 'no', 'qty': 'no',
    'lump sum': 'ls', 'l.s': 'ls', 'lsum': 'ls',
    'hours': 'hr', 'hrs': 'hr',
    'days': 'day',
    'weeks': 'wk',
    'months': 'mo',
    'pieces': 'pc', 'pcs': 'pc', 'piece': 'pc',
    'liter': 'L', 'liters': 'L', 'ltr': 'L', 'ltrs': 'L'
  };
  
  const mapped = mapping[cleanUnit];
  if (mapped) return mapped;

  return options.includes(cleanUnit) ? cleanUnit : options[0];
};

export const calculateResourceMetrics = (
  boqQty: number, 
  res: Partial<Resource>, 
  workingHours: number, 
  workingDays: number = 6, 
  activityProductivity: number = 1, 
  activityConversionRate: number = 1
) => {
  let unitCost = 0;
  let totalQuantity = 0;
  const conv = activityConversionRate || 1;
  const prod = activityProductivity || 1; 

  // Resource properties
  const count = res.resourceCount || 1;
  const factor = res.conversionFactor || 1;
  const rate = res.unitPrice || 0;
  const resUnit = (res.unit || 'hr').toLowerCase();

  if (res.type === 'Material') {
    const consumption = res.consumption || 0;
    const waste = 1 + (res.wastePercentage || 0) / 100;
    const usages = res.usages || 1;
    
    unitCost = (consumption * waste / usages) * (rate / factor) * conv;
    totalQuantity = (boqQty || 1) * conv * (consumption * waste / usages);
  } else if (res.type === 'Labor' || res.type === 'Equipment') {
    const effectiveQty = boqQty > 0 ? boqQty : 1;
    const daysRequired = (effectiveQty * conv) / prod;

    if (resUnit === 'day') {
      totalQuantity = daysRequired * count;
    } else if (resUnit === 'wk') {
      totalQuantity = (daysRequired / (workingDays || 6)) * count;
    } else if (resUnit === 'mo') {
      const daysPerMonth = (workingDays || 6) * 4.33;
      totalQuantity = (daysRequired / daysPerMonth) * count;
    } else {
      totalQuantity = daysRequired * workingHours * count;
    }
    
    unitCost = (totalQuantity * (rate / factor)) / effectiveQty;
    
    if (boqQty === 0) {
      totalQuantity = 0;
    }
  } else {
    totalQuantity = (res.quantity || 0);
    unitCost = boqQty > 0 ? (totalQuantity / boqQty) * (rate / factor) : (rate / factor) * conv;
  }

  return { unitCost, totalQuantity };
};

export const formatPriceHelper = (amount: number | undefined | null, symbol: string) => {
  const val = amount || 0;
  return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
