
export type ResourceType = 'Labor' | 'Material' | 'Equipment' | 'Subcontractor';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  resourceCount?: number;
  crewSize?: number;
  // Material 
  consumption?: number;
  wastePercentage?: number;
  usages?: number;
  // Shared
  linkedResourceId?: string;
  linkType?: 'price' | 'full';
  purchaseUnit?: string;
  conversionFactor?: number;
}

export interface Activity {
  id: string;
  boqId: string;
  name: string;
  unit?: string;
  conversionRate?: number;
  description: string;
  resources: Resource[];
  totalCost: number;
  unitRate: number;
  productivity?: number;
  linkedActivityId?: string;
  linkType?: 'full' | 'partial';
}

export type RateSource = 'Study' | 'Subcontractor';

export interface BOQItem {
  id: string;
  code: string;
  package?: string;
  description: string;
  unit: string;
  quantity: number;
  activities: Activity[];
  totalBudget: number;
  unitRate: number;
  rateSource?: RateSource;
  subcontractorRate?: number;
  linkingId?: string;
  linkingType?: 'price' | 'full';
}

export interface ActivityTemplate {
  id: string;
  name: string;
  unit?: string;
  conversionRate?: number;
  description: string;
  resources: Omit<Resource, 'id'>[];
  productivity?: number;
}

export interface TakeoffMeasurement {
  id: string;
  description: string;
  count: number;
  length?: number;
  width?: number;
  height?: number;
  total: number;
}

export interface QSTakeoff {
  id: string;
  boqItemId: string;
  activityId: string;
  resourceId: string;
  name: string;
  measurements: TakeoffMeasurement[];
  totalQuantity: number;
  unit?: string;
}

export interface Project {
  id: string;
  name: string;
  scopeOfWork?: string;
  boqItems: BOQItem[];
  subcontractorOffers?: SubcontractorOffer[];
  qsTakeoffs?: QSTakeoff[];
  currency: string;
  country: string;
  updatedAt: string;
  resourceLibrary?: LibraryResource[];
}

export interface QuickBudgetItem {
  id: string;
  code?: string;
  description: string;
  unit: string;
  quantity: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  totalCost: number;
  unitRate: number;
  rateSource?: 'Study' | 'Subcontractor';
  subcontractorRate?: number;
}

export interface SubcontractorOffer {
  id: string;
  name: string;
  package: string;
  itemRates: Record<string, number>; // maps boqItemId to unitRate
  isChosen: boolean;
  notes?: string;
}

export interface PriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  date: string;
}

export interface LibraryResource extends Omit<Resource, 'id' | 'quantity' | 'totalPrice'> {
  id: string; // Adding ID to library resources for easier management
  category?: string;
  code?: string;
  priceHistory?: PriceHistoryEntry[];
}
