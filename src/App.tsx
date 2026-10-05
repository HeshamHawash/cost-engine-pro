/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Calculator, 
  ClipboardList, 
  Plus, 
  Trash2, 
  Home,
  ChevronLeft,
  ChevronRight, 
  ChevronDown, 
  Database, 
  Box, 
  Users, 
  Hammer, 
  Truck, 
  FileText,
  Save,
  Download,
  Upload,
  Search,
  Filter,
  LayoutDashboard,
  LayoutList,
  Settings,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  X,
  Edit2,
  Check,
  CheckCircle2,
  Trophy,
  Lock,
  Unlock,
  Shield,
  Library,
  BookOpen,
  ArrowRight,
  Link,
  Link2,
  Link2Off,
  Copy,
  ClipboardPaste,
  Undo2,
  Redo2,
  BarChart3,
  PieChart as PieChartIcon,
  CalendarDays,
  TrendingUp,
  Target,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  RefreshCw,
  Sparkles,
  Square,
  CheckSquare,
  Zap,
  Ban,
  Info,
  Globe,
  Banknote,
  Clock,
  Cloud,
  History,
  Columns,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  LogOut,
  Wand2,
  Maximize2,
  Minimize2,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
const QSSection = React.lazy(() => import('./QSSection.tsx').then(m => ({ default: m.QSSection })));
import { STANDARD_UNITS, RESOURCE_UNITS, SEED_LIBRARY } from './constants.ts';
import { estimateItemBreakdown, getQuickBudgetReference, estimateResourceUnitPrice } from './services/aiService.ts';
const Dashboard = React.lazy(() => import('./components/dashboard/Dashboard.tsx'));
import { Resource, Activity, BOQItem, ResourceType, LibraryResource, ActivityTemplate, Project, QuickBudgetItem, PriceHistoryEntry, SubcontractorOffer, RateSource, QSTakeoff, TakeoffMeasurement } from './types.ts';
import { normalizeUnit, calculateResourceMetrics, formatPriceHelper } from './helpers.ts';
import { generateHandbookPDF } from './utils/generateHandbookPdf.ts';

import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import * as storageService from './services/storageService.ts';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
];

const COUNTRIES = [
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'Egypt', code: 'EG' },
  { name: 'USA', code: 'US' },
  { name: 'UK', code: 'GB' },
  { name: 'India', code: 'IN' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Oman', code: 'OM' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Bahrain', code: 'BH' },
];

// --- Components ---

const Badge = React.memo(({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}>
    {children}
  </span>
));

const BOQItemRow = React.memo(({ 
  item, 
  isSelected, 
  isEditing, 
  isExpanded,
  onToggleExpand,
  onSelect, 
  onToggleSelection, 
  onEdit, 
  onDelete, 
  onAiEstimate, 
  isAiEstimating,
  formatPrice,
  isSelectedForBulk,
  editingState,
  setEditingState,
  onSaveEdit,
  onCancelEdit,
  onToggleRateSource,
  onUnlink,
  onAddItemAfter,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver
}: { 
  item: BOQItem; 
  isSelected: boolean; 
  isEditing: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onToggleSelection: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAiEstimate: (item: BOQItem) => void;
  isAiEstimating: boolean;
  formatPrice: (v: number) => string;
  isSelectedForBulk: boolean;
  editingState: { code: string; description: string; quantity: number; unit: string; package: string };
  setEditingState: (s: any) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onToggleRateSource: (id: string, source: RateSource) => void;
  onUnlink: (id: string) => void;
  onAddItemAfter?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDragOver?: (id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (draggedId: string, targetId: string) => void;
  isDragOver?: boolean;
}) => {
  const categoryTotals = useMemo(() => {
    return (item.activities || []).reduce((acc, activity) => {
      (activity.resources || []).forEach(res => {
        const type = res.type as ResourceType;
        acc[type] = (acc[type] || 0) + (res.totalPrice || 0);
      });
      return acc;
    }, { Labor: 0, Material: 0, Equipment: 0, Subcontractor: 0 } as Record<ResourceType, number>);
  }, [item.activities]);

  return (
    <div 
      onClick={onToggleExpand}
      onDragOver={(e) => {
        if (onDragOver) {
          e.preventDefault();
          onDragOver(item.id);
        }
      }}
      onDragLeave={() => {
        onDragLeave?.();
      }}
      onDrop={(e) => {
        if (onDrop) {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId && draggedId !== item.id) {
            onDrop(draggedId, item.id);
          }
        }
      }}
      className={`px-4 py-3 cursor-pointer border-l-4 transition-all ${
        isSelected ? 'bg-slate-100 border-orange-500 shadow-sm' : 'border-transparent hover:bg-slate-50 font-medium'
      } ${isDragOver ? 'border-t-2 border-dashed border-orange-500 bg-orange-50/50' : ''}`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5">
          {/* Drag Handle */}
          <div 
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("text/plain", item.id);
              onDragStart?.(item.id);
            }}
            onDragEnd={() => {
              onDragEnd?.();
            }}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
            title="Drag reference pin to re-arrange item"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          <input 
            type="checkbox" 
            checked={isSelectedForBulk}
            onChange={() => onToggleSelection(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-slate-300 bg-white text-orange-600 focus:ring-orange-500 focus:ring-offset-white"
          />
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.code}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {item.package && (
                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest leading-none">{item.package}</p>
              )}
              {item.linkingId && (
                <div className="flex items-center gap-0.5 px-1 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[7px] font-black uppercase tracking-tighter border border-indigo-100 italic group/link" title={`Linked Item (ID: ${item.linkingId})`}>
                   <Link2 className="w-2.5 h-2.5" />
                   Linked
                   <button 
                    onClick={(e) => { e.stopPropagation(); onUnlink(item.id); }}
                    className="ml-1 text-indigo-400 hover:text-red-500 hover:bg-white rounded transition-all opacity-0 group-hover/link:opacity-100"
                    title="Unlink this item"
                   >
                     <Link2Off className="w-2 h-2" />
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
           <p className="text-[12px] font-mono font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200/50 shadow-sm">
             {formatPrice(item.unitRate)}<span className="text-[9px] opacity-70 ml-1 font-sans">/{item.unit}</span>
           </p>
           {item.subcontractorRate !== undefined && item.subcontractorRate > 0 && (
             <div className="flex items-center gap-1 mt-1 p-0.5 bg-slate-100 rounded-md border border-slate-200" onClick={e => e.stopPropagation()}>
               <button 
                 onClick={() => onToggleRateSource(item.id, 'Study')}
                 className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${item.rateSource !== 'Subcontractor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Study
               </button>
               <button 
                 onClick={() => onToggleRateSource(item.id, 'Subcontractor')}
                 className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${item.rateSource === 'Subcontractor' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Sub
               </button>
             </div>
           )}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={`p-1 rounded transition-all border ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
              title="Open Detailed Breakdown"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAiEstimate(item);
              }}
              className={`p-1 rounded transition-colors ${isAiEstimating ? 'text-red-500 hover:bg-red-100' : 'text-orange-600 hover:bg-orange-100 hover:text-orange-700'}`}
              title={isAiEstimating ? "Stop AI Estimation" : "AI Breakdown"}
            >
              {isAiEstimating ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAddItemAfter?.(item.id);
              }}
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              title="Add new BOQ Item after this"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
           <button 
             onClick={(e) => {
               e.stopPropagation();
               if (isEditing) {
                 onSaveEdit(item.id);
               } else {
                 onEdit(item.id);
               }
             }}
             className={`p-1 rounded transition-colors ${isEditing ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100 hover:text-orange-600'}`}
             title={isEditing ? "Confirm Edit" : "Edit BOQ Item"}
           >
             {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
           </button>

           {isEditing && (
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 onCancelEdit();
               }}
               className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
               title="Cancel Edit"
             >
               <X className="w-3.5 h-3.5" />
             </button>
           )}
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-2 mb-2" onClick={e => e.stopPropagation()}>
          <div className="flex gap-2">
            <input 
              type="text"
              value={editingState.code}
              onChange={(e) => setEditingState({ ...editingState, code: e.target.value })}
              placeholder="Code (e.g. 1.1)"
              className="w-1/3 text-[10px] font-bold bg-white text-slate-700 border border-slate-200 rounded px-1.5 py-1 focus:ring-2 ring-orange-400 outline-none"
            />
            <input 
              type="text"
              value={editingState.package}
              onChange={(e) => setEditingState({ ...editingState, package: e.target.value })}
              placeholder="Package (e.g. Earthwork)"
              className="flex-1 text-[10px] font-black uppercase tracking-widest bg-white text-indigo-600 border border-indigo-200 rounded px-1.5 py-1 focus:ring-2 ring-indigo-505 outline-none"
            />
          </div>
          <textarea 
            value={editingState.description}
            onChange={(e) => setEditingState({ ...editingState, description: e.target.value })}
            className="w-full text-sm font-bold bg-white text-slate-900 border border-orange-200 rounded-sm focus:ring-2 ring-orange-500 p-1 resize-none shadow-inner transition-colors"
            rows={2}
            autoFocus
          />
        </div>
      ) : (
        <p className={`w-full text-sm font-bold mb-1 transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-400 line-clamp-2'}`}>
          {item.description}
        </p>
      )}
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <NumericInput 
                value={editingState.quantity || 0}
                onChange={(val) => setEditingState({ ...editingState, quantity: val })}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-16 text-[11px] font-mono font-bold bg-white text-slate-900 border border-orange-200 rounded px-1.5 py-0.5 outline-none focus:ring-2 ring-orange-500 transition-colors"
              />
              <select 
                value={editingState.unit}
                onChange={(e) => setEditingState({ ...editingState, unit: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-16 text-[10px] font-bold text-slate-600 bg-white border border-orange-200 rounded p-0.5 focus:ring-1 ring-orange-500 uppercase tracking-widest text-center transition-colors appearance-none cursor-pointer"
              >
                {STANDARD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Lock className="w-2.5 h-2.5 text-slate-300" />
              <span className="text-[11px] font-mono font-bold">{item.quantity}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">{item.unit}</span>
            </div>
          )}
        </div>
        {isSelected && !isEditing && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && !isEditing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {item.rateSource === 'Subcontractor' ? (
              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[7px] font-black uppercase text-orange-400 tracking-widest">Subcontractor Rate</span>
                  <span className="text-[16px] font-mono font-black text-orange-700">
                    {formatPrice(item.subcontractorRate || 0)}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-orange-100">
                  <Truck className="w-4 h-4 text-orange-500" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(['Labor', 'Material', 'Equipment', 'Subcontractor'] as ResourceType[]).map(type => (
                  <div key={type} className="flex flex-col gap-0.5 bg-slate-50/50 p-2 rounded border border-slate-100 hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${
                        type === 'Labor' ? 'bg-blue-500' : 
                        type === 'Material' ? 'bg-emerald-500' : 
                        type === 'Equipment' ? 'bg-orange-500' : 'bg-purple-500'
                      }`} />
                      <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider">Quick {type}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      {formatPrice(categoryTotals[type])}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Selected Rate Source</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.rateSource === 'Subcontractor' ? 'bg-orange-500' : 'bg-indigo-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {item.rateSource === 'Subcontractor' ? 'Subcontractor' : 'Study'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Total Budget</span>
                <span className="text-[14px] font-mono font-black text-indigo-700">
                  {formatPrice(item.totalBudget)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const CostEngineIcon = React.memo(({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <defs>
      <linearGradient id="blueC-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>
    <path 
      d="M 60.0 32.7 A 20 20 0 1 0 60.0 67.3 L 70.0 84.6 A 40 40 0 1 1 70.0 15.4 Z" 
      fill="url(#blueC-grad)" 
    />
    <path 
      d="M 58.5 68.1 L 63.5 79.0 A 32 32 0 0 0 70.6 74.5 L 75.7 80.6 A 40 40 0 0 0 84.6 70.0 L 77.7 66.0 A 32 32 0 0 0 81.5 55.6 L 89.4 56.9 A 40 40 0 0 0 89.4 43.1 L 81.5 44.4 A 32 32 0 0 0 77.7 34.0 L 84.6 30.0 A 40 40 0 0 0 75.7 19.4 L 70.6 25.5 A 32 32 0 0 0 63.5 21.0 L 58.5 31.9 A 20 20 0 0 1 58.5 68.1 Z" 
      fill="currentColor" 
    />
  </svg>
));

const ResourceTypeIcon = React.memo(({ type }: { type: ResourceType }) => {
  switch (type) {
    case 'Labor': return <Users className="w-3.5 h-3.5" />;
    case 'Material': return <Box className="w-3.5 h-3.5" />;
    case 'Equipment': return <Hammer className="w-3.5 h-3.5" />;
    case 'Subcontractor': return <Truck className="w-3.5 h-3.5" />;
  }
});

const ResourceTypeColor = (type: ResourceType) => {
  switch (type) {
    case 'Labor': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Material': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'Equipment': return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'Subcontractor': return 'bg-purple-100 text-purple-700 border border-purple-200';
  }
};

const NumericInput = React.memo(({ 
  value = 0, 
  onChange, 
  className = "", 
  placeholder = "",
  onKeyDown,
  allowNegative = false
}: { 
  value?: number; 
  onChange: (v: number) => void; 
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  allowNegative?: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState((value || 0) === 0 ? '' : (value || 0).toString());

  React.useEffect(() => {
    const parsedLocal = parseFloat(localValue);
    const currentValue = value || 0;
    if (isNaN(parsedLocal) && currentValue === 0) {
      if (localValue !== '') setLocalValue('');
      return;
    }
    if (parsedLocal !== currentValue) {
      setLocalValue(currentValue === 0 ? '' : currentValue.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setLocalValue('');
      onChange(0);
      return;
    }

    const regex = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    if (regex.test(val)) {
      setLocalValue(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  return (
    <input 
      type="text"
      value={localValue}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
});

const ActivityPanelItem = React.memo(({ 
  activity, 
  boqId, 
  updateActivity, 
  deleteActivity, 
  saveActivityAsTemplate, 
  formatPrice 
}: { 
  activity: Activity; 
  boqId: string; 
  updateActivity: (boqId: string, activityId: string, updates: any) => void; 
  deleteActivity: (boqId: string, activityId: string) => void; 
  saveActivityAsTemplate: (activity: Activity) => void; 
  formatPrice: (v: number | undefined | null) => string;
}) => (
  <div 
    className={`p-3 border-b border-slate-100 last:border-b-0 transition-all cursor-pointer ${(activity.resources || []).length > 0 ? 'bg-indigo-50/10 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
  >
    <div className="flex justify-between items-start mb-2">
      <input 
        type="text"
        value={activity.name}
        onChange={(e) => updateActivity(boqId, activity.id, { name: e.target.value })}
        className="font-black text-[14px] text-slate-800 bg-transparent border-none outline-none p-0 focus:ring-0 transition-colors flex-1 mr-2"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-colors ${(activity.resources || []).length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {(activity.resources || []).length > 0 ? 'Calculated' : 'Pending'}
        </span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            saveActivityAsTemplate(activity);
          }}
          className="p-1 text-slate-300 hover:text-indigo-500 transition-colors border border-slate-100 rounded bg-white shadow-sm"
          title="Save as Template"
        >
          <Save className="w-2.5 h-2.5" />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            deleteActivity(boqId, activity.id);
          }}
          className="p-1 text-slate-300 hover:text-red-500 transition-colors border border-slate-100 rounded bg-white shadow-sm"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
    
    <div className="flex flex-col gap-2">
      <div className="w-full">
        <input 
          type="text"
          placeholder="Activity description..."
          value={activity.description}
          onChange={(e) => updateActivity(boqId, activity.id, { description: e.target.value })}
          className="text-[10px] text-slate-500 italic w-full bg-transparent border-none outline-none p-0 focus:ring-0 mb-2"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <p className="text-[7px] opacity-40 uppercase font-black leading-none mb-1">Conv Rate</p>
            <NumericInput 
              value={activity.conversionRate || 1}
              onChange={(val) => updateActivity(boqId, activity.id, { conversionRate: val || 1 })}
              className="w-14 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50/50 border border-indigo-100 rounded px-1 py-0.5 text-center focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-[7px] opacity-40 uppercase font-black leading-none mb-1">Unit</p>
            <input 
              type="text"
              placeholder="..."
              value={activity.unit || ''}
              onChange={(e) => updateActivity(boqId, activity.id, { unit: e.target.value })}
              className="w-10 text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center outline-none"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-[7px] opacity-40 uppercase font-black leading-none mb-1">Prod (Qty/Day)</p>
            <NumericInput 
              value={activity.productivity || 1}
              onChange={(val) => updateActivity(boqId, activity.id, { productivity: val || 1 })}
              className="w-16 text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded px-1 py-0.5 text-center focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-slate-100 pl-4">
          <div className="text-right">
            <p className="text-[7px] opacity-50 uppercase font-black leading-none mb-1 text-indigo-500">Rate</p>
            <p className="text-[11px] font-mono font-black text-indigo-700 whitespace-nowrap">{formatPrice(activity.unitRate)}</p>
          </div>
          <div className="text-right">
            <p className="text-[7px] opacity-50 uppercase font-black leading-none mb-1">Cost</p>
            <p className="text-[11px] font-mono font-black text-slate-900 whitespace-nowrap">{formatPrice(activity.totalCost)}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
));

const ResourcePanelItem = React.memo(({
  res,
  boqId,
  activityId,
  isSelected,
  toggleSelection,
  updateResource,
  handleKeyDown,
  formatPrice
}: {
  res: Resource;
  boqId: string;
  activityId: string;
  isSelected: boolean;
  toggleSelection: (id: string) => void;
  updateResource: (boqId: string, activityId: string, resourceId: string, updates: any) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  formatPrice: (v: number | undefined | null) => string;
}) => (
  <div className={`group grid grid-cols-12 items-center gap-2 text-[11px] py-1.5 rounded-lg px-2 transition-all border-b border-slate-50 last:border-0 ${isSelected ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-slate-50'}`}>
    <div className="col-span-4 flex items-center gap-2 min-w-0">
      <input 
        type="checkbox"
        className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white shrink-0"
        checked={isSelected}
        onChange={() => toggleSelection(res.id)}
      />
      <div className={`shrink-0 ${res.type === 'Labor' ? 'text-blue-600' : res.type === 'Material' ? 'text-emerald-600' : res.type === 'Equipment' ? 'text-orange-600' : 'text-purple-600'}`}>
        <ResourceTypeIcon type={res.type} />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <input 
          type="text" 
          value={res.name}
          onChange={(e) => updateResource(boqId, activityId, res.id, { name: e.target.value })}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-none outline-none p-0 focus:ring-0 truncate font-bold text-slate-900 leading-tight transition-colors"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-400 font-mono font-bold truncate leading-tight">
            {res.quantity.toFixed(3)} {res.unit}
          </span>
          {res.linkedResourceId && (
            <span className={`px-1 rounded-[2px] text-[7px] font-black uppercase ${res.linkType === 'full' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>Linked</span>
          )}
        </div>
      </div>
    </div>
    <div className="col-span-3">
      {/* Add more fields here as needed */}
    </div>
    {/* ... other cols ... */}
  </div>
));

const BOQFilterDropdown = ({ 
  label, 
  options, 
  selected, 
  onToggle, 
  onSelectAll, 
  onClearAll 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onToggle: (opt: string) => void,
  onSelectAll: () => void,
  onClearAll: () => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider transition-all ${
          selected.length > 0 
            ? 'bg-orange-50 border-orange-200 text-orange-600 ring-1 ring-orange-100' 
            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        <span>{label} {selected.length > 0 ? `(${selected.length})` : ''}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-[100] max-h-64 flex flex-col"
          >
            <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-2">
              <button 
                onClick={onSelectAll}
                className="text-[9px] font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest"
              >
                Select All
              </button>
              <button 
                onClick={onClearAll}
                className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
              >
                Clear
              </button>
            </div>
            <div className="overflow-y-auto p-1 py-2 flex-1 scrollbar-thin scrollbar-thumb-slate-200">
              {options.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] font-medium text-slate-400">No data available</p>
                </div>
              ) : (
                options.map(opt => (
                  <label 
                    key={opt}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 rounded cursor-pointer group"
                  >
                    <input 
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={() => onToggle(opt)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 truncate">{opt}</span>
                  </label>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


const ResourceLibrarySection = React.memo(({ 
  library, 
  updateResource, 
  deleteResource, 
  addResource, 
  formatPrice,
  onExport,
  onImport,
  onExcelImport,
  setNotification,
  searchTerm,
  setSearchTerm
}: { 
  library: LibraryResource[], 
  updateResource: (id: string, updates: Partial<LibraryResource>) => void,
  deleteResource: (id: string) => void,
  addResource: (type: ResourceType) => void,
  formatPrice: (v: number) => string,
  onExport: () => void,
  onImport: () => void,
  onExcelImport?: () => void,
  setNotification?: (notif: { message: string, type: 'success' | 'error' | 'info' } | null) => void,
  searchTerm: string,
  setSearchTerm: (term: string) => void
}) => {
  const [filterType, setFilterType] = useState<ResourceType | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const [bulkUpdates, setBulkUpdates] = useState<{
    unitPrice?: number;
    type?: ResourceType;
    category?: string;
    unit?: string;
    multiplier?: number;
  }>({});

  const categories = useMemo(() => {
    const cats = new Set<string>();
    library.forEach(r => { if (r.category) cats.add(r.category); });
    return ['All', ...Array.from(cats)].sort();
  }, [library]);

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  const filteredLibrary = library.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (res.code && res.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'All' || res.type === filterType;
    const matchesCategory = filterCategory === 'All' || res.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLibrary.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLibrary.map(r => r.id)));
    }
  };

  const handleBulkUpdate = () => {
    selectedIds.forEach(id => {
      const updates: Partial<LibraryResource> = {};
      if (bulkUpdates.type) updates.type = bulkUpdates.type;
      if (bulkUpdates.category) updates.category = bulkUpdates.category;
      if (bulkUpdates.unit) updates.unit = bulkUpdates.unit;
      
      if (bulkUpdates.unitPrice !== undefined) {
        updates.unitPrice = bulkUpdates.unitPrice;
      } else if (bulkUpdates.multiplier !== undefined) {
        const item = library.find(r => r.id === id);
        if (item) {
          updates.unitPrice = item.unitPrice * bulkUpdates.multiplier;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        updateResource(id, updates);
      }
    });
    setSelectedIds(new Set());
    setShowBulkEdit(false);
    setBulkUpdates({});
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    selectedIds.forEach(id => deleteResource(id));
    setNotification?.({ message: `Successfully deleted ${count} resources`, type: 'success' });
    setSelectedIds(new Set());
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8 transition-colors relative">
       <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
          <header className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 mb-4 md:mb-8 bg-white/50 backdrop-blur-sm p-3 md:p-4 rounded-xl md:rounded-[28px] border border-slate-200/60 shadow-sm transition-all hover:bg-white/80">
             <div className="flex items-center gap-3 md:gap-4 shrink-0 px-1">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                   <Library className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="min-w-0">
                   <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight truncate leading-tight">Resource Library</h1>
                   <p className="text-slate-500 font-bold tracking-widest text-[7px] md:text-[8px] uppercase antialiased truncate">Global Master Database</p>
                </div>
             </div>
             
             <div className="relative flex-1 w-full max-w-full xl:max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                   type="text" 
                   placeholder="Search global library..."
                   className="w-full bg-white border border-slate-200 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 py-2 md:py-2.5 text-xs md:text-sm font-bold placeholder:text-slate-400 focus:ring-4 ring-indigo-500/10 outline-none transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>

             <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap justify-center sm:justify-start">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 rounded-xl overflow-x-auto max-w-full pb-2 sm:pb-1">
                   <button 
                     onClick={() => addResource('Labor')}
                     className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                   >
                     <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /> Labor
                   </button>
                   <button 
                     onClick={() => addResource('Material')}
                     className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                   >
                     <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /> Materials
                   </button>
                   <button 
                     onClick={() => addResource('Equipment')}
                     className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                   >
                     <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /> Equipment
                   </button>
                   <button 
                     onClick={() => addResource('Subcontractor')}
                     className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                   >
                     <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /> Subcon.
                   </button>
                </div>
                
                <div className="flex items-center gap-1.5 ml-0 xl:ml-2">
                   <button 
                     onClick={onExport}
                     className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg font-black uppercase tracking-widest text-[9px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 h-[34px]"
                   >
                     <Download className="w-3 h-3" /> Export
                   </button>
                   
                   <div className="relative" ref={importMenuRef}>
                     <button 
                       onClick={() => setShowImportMenu(!showImportMenu)}
                       className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg font-black uppercase tracking-widest text-[9px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 h-[34px]"
                     >
                       <Upload className="w-3 h-3" /> Import
                       <ChevronDown className={`w-3 h-3 transition-transform ${showImportMenu ? 'rotate-180' : ''}`} />
                     </button>
                     
                     <AnimatePresence>
                       {showImportMenu && (
                         <motion.div 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: 10 }}
                           className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 py-2 z-50 overflow-hidden"
                         >
                           <div className="px-4 py-2 border-b border-slate-50 mb-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Import Options</p>
                           </div>
                           <button 
                             onClick={() => {
                               onImport();
                               setShowImportMenu(false);
                             }}
                             className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                           >
                             <FileJson className="w-4 h-4 text-orange-500" />
                             <div className="flex flex-col">
                               <span>JSON Library</span>
                               <span className="text-[10px] font-medium text-slate-400">Native Data Structure</span>
                             </div>
                           </button>
                           {onExcelImport && (
                             <button 
                               onClick={() => {
                                 onExcelImport();
                                 setShowImportMenu(false);
                               }}
                               className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                             >
                               <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                               <div className="flex flex-col">
                                 <span>Excel Spreadsheet</span>
                                 <span className="text-[10px] font-medium text-slate-400">Import (.xlsx) records</span>
                               </div>
                             </button>
                           )}
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                </div>
             </div>
          </header>

          <div className="flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
                {(['All', 'Labor', 'Material', 'Equipment', 'Subcontractor'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t}
                  </button>
                ))}
             </div>

             <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-400 px-2">Category:</span>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer text-slate-600"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-colors">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px] md:min-w-[1000px]">
                   <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                         <th className="px-4 md:px-6 py-4 w-12 text-center">
                            <button 
                               onClick={toggleAll}
                               className={`transition-all ${selectedIds.size > 0 ? 'text-indigo-600' : 'text-slate-300'}`}
                            >
                               {selectedIds.size === filteredLibrary.length && filteredLibrary.length > 0 ? (
                                  <CheckSquare className="w-4 h-4 md:w-5 md:h-5" />
                               ) : selectedIds.size > 0 ? (
                                  <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-indigo-600 bg-indigo-600 rounded flex items-center justify-center">
                                    <div className="w-2.5 h-0.5 bg-white rounded-full" />
                                  </div>
                               ) : (
                                  <Square className="w-4 h-4 md:w-5 md:h-5" />
                               )}
                            </button>
                         </th>
                         <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">Code</th>
                         <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Resource Name</th>
                         <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 w-24 md:w-32">Type</th>
                         <th className="hidden lg:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-40">Category</th>
                         <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Unit</th>
                         <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 w-32 md:w-40 text-right">Unit Price</th>
                         <th className="px-4 md:px-6 py-4 w-12 md:w-20"></th>
                      </tr>
                   </thead>
                   <tbody>
                      {filteredLibrary.map((res) => {
                         const hasHistory = res.priceHistory && res.priceHistory.length > 0;
                         const isHistoryExpanded = expandedHistoryId === res.id;
                         
                         return (
                           <React.Fragment key={res.id}>
                              <tr 
                                 className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors group ${selectedIds.has(res.id) ? 'bg-indigo-50/30' : ''} ${isHistoryExpanded ? 'bg-indigo-50/20' : ''}`}
                              >
                            <td className="px-4 md:px-6 py-4 text-center">
                               <button 
                                  onClick={() => toggleSelection(res.id)}
                                  className={`transition-all ${selectedIds.has(res.id) ? 'text-indigo-600' : 'text-slate-200 group-hover:text-slate-400'}`}
                               >
                                  {selectedIds.has(res.id) ? <CheckSquare className="w-4 h-4 md:w-5 md:h-5" /> : <Square className="w-4 h-4 md:w-5 md:h-5" />}
                               </button>
                            </td>
                            <td className="hidden sm:table-cell px-6 py-4">
                               <input 
                                  value={res.code || ''}
                                  onChange={(e) => updateResource(res.id, { code: e.target.value })}
                                  className="w-full bg-transparent border-none focus:ring-0 text-xs font-mono font-bold text-slate-500"
                                  placeholder="RD-01..."
                                />
                            </td>
                            <td className="px-4 md:px-6 py-4">
                               <input 
                                  value={res.name}
                                  onChange={(e) => updateResource(res.id, { name: e.target.value })}
                                  className="w-full bg-transparent border-none focus:ring-0 text-xs md:text-sm font-black text-slate-900 truncate"
                                  placeholder="Resource name..."
                                />
                            </td>
                            <td className="px-4 md:px-6 py-4">
                               <div className="flex items-center gap-1 md:gap-2">
                                  <Badge className={ResourceTypeColor(res.type)}>
                                    <div className="flex items-center gap-1">
                                      <div className="hidden sm:block"><ResourceTypeIcon type={res.type} /></div>
                                      <span className="text-[8px] md:text-[9px]">{res.type}</span>
                                    </div>
                                  </Badge>
                               </div>
                            </td>
                            <td className="hidden lg:table-cell px-6 py-4">
                               <input 
                                  value={res.category || ''}
                                  onChange={(e) => updateResource(res.id, { category: e.target.value })}
                                  className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-500"
                                  placeholder="General..."
                                />
                            </td>
                            <td className="hidden sm:table-cell px-6 py-4">
                               <select 
                                  value={res.unit}
                                  onChange={(e) => updateResource(res.id, { unit: e.target.value })}
                                  className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer p-0"
                               >
                                  {RESOURCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                               </select>
                            </td>
                            <td className="px-4 md:px-6 py-4 text-right">
                               <div className="flex items-center justify-end gap-2">
                                  <div className="flex items-center gap-1">
                                     <span className="text-[8px] md:text-[10px] font-black text-slate-400">{formatPrice(0).split('0')[0]}</span>
                                     <NumericInput 
                                        value={Number((res.unitPrice || 0).toFixed(2))}
                                        onChange={(v) => updateResource(res.id, { unitPrice: Number(v.toFixed(2)) })}
                                        className="w-16 md:w-24 bg-transparent border-none focus:ring-0 text-xs md:text-sm font-black text-right text-slate-900"
                                     />
                                  </div>
                                  <button 
                                     onClick={() => setExpandedHistoryId(isHistoryExpanded ? null : res.id)}
                                     className={`p-1.5 rounded-lg transition-all ${isHistoryExpanded ? 'bg-indigo-100 text-indigo-600' : hasHistory ? 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100' : 'text-slate-200 cursor-not-allowed'}`}
                                     title={hasHistory ? "Price History" : "No price history yet"}
                                     disabled={!hasHistory && !isHistoryExpanded}
                                  >
                                     <History className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  </button>
                               </div>
                            </td>
                            <td className="px-4 md:px-6 py-4">
                               <div className="flex items-center justify-end opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                    onClick={() => deleteResource(res.id)}
                                    className="p-1.5 md:p-2 rounded-lg md:rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                 >
                                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  </button>
                               </div>
                            </td>
                          </tr>
                          {/* History Breakdown Row */}
                          <AnimatePresence>
                            {isHistoryExpanded && (
                              <tr>
                                <td colSpan={8} className="px-6 py-0 bg-slate-50/50">
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="py-6 px-10">
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-1 h-8 bg-indigo-500 rounded-full" />
                                          <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Price Timeline</h4>
                                            <p className="text-xs font-bold text-slate-700 uppercase">{res.name}</p>
                                          </div>
                                        </div>
                                        <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                          {res.priceHistory?.length || 0} Revisions
                                        </div>
                                      </div>

                                      <div className="max-w-4xl space-y-3">
                                        {res.priceHistory?.slice().reverse().map((entry, idx) => (
                                          <div key={entry.id} className="relative flex items-center gap-4 group/entry">
                                            <div className="w-24 shrink-0 text-[10px] font-black text-slate-400 uppercase">
                                              {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            
                                            <div className="relative flex flex-col items-center">
                                              <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-slate-300'} z-10`} />
                                              {idx < (res.priceHistory?.length || 0) - 1 && (
                                                <div className="w-0.5 h-16 bg-slate-200 absolute top-2.5" />
                                              )}
                                            </div>

                                            <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group-hover/entry:border-indigo-200 transition-colors">
                                              <div className="flex items-center gap-8">
                                                <div className="flex flex-col">
                                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">From</span>
                                                  <span className="text-sm font-bold text-slate-500 line-through decoration-slate-300">{formatPrice(entry.oldPrice)}</span>
                                                </div>
                                                <div className="flex items-center text-indigo-400">
                                                  <ArrowRight className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To</span>
                                                  <span className="text-sm font-black text-slate-900">{formatPrice(entry.newPrice)}</span>
                                                </div>
                                              </div>
                                              
                                              <div className="flex items-center gap-3">
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${
                                                  entry.newPrice > entry.oldPrice ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                                }`}>
                                                  {entry.newPrice > entry.oldPrice ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                                                  {Math.abs(((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1)}%
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                   })}
                      {filteredLibrary.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Search className="w-10 h-10 text-slate-200" />
                              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No resources found matching filter</p>
                            </div>
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
       </div>

       {/* Bulk Action Bar */}
       <AnimatePresence>
         {selectedIds.size > 0 && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 z-50 border border-slate-800"
           >
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Selected</span>
                <span className="text-sm font-black">{selectedIds.size} Resources</span>
              </div>
              
              <div className="w-px h-8 bg-slate-700" />
              
              <button 
                onClick={() => setShowBulkEdit(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Edit2 className="w-4 h-4" /> Bulk Edit
              </button>
              
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Trash2 className="w-4 h-4" /> Bulk Delete
              </button>
              
              <button 
                onClick={() => setSelectedIds(new Set())}
                 className="p-2 hover:bg-slate-800 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Bulk Edit Modal */}
       <AnimatePresence>
         {showBulkEdit && (
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
             >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Bulk Edit Resources</h3>
                  <button onClick={() => setShowBulkEdit(false)} className="hover:bg-slate-100 p-2 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Change Type</label>
                       <select 
                          value={bulkUpdates.type || ''}
                          onChange={(e) => setBulkUpdates(prev => ({ ...prev, type: e.target.value as ResourceType }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                       >
                          <option value="">No change</option>
                          <option value="Labor">Labor</option>
                          <option value="Material">Material</option>
                          <option value="Equipment">Equipment</option>
                          <option value="Subcontractor">Subcontractor</option>
                       </select>
                    </div>

                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Change Category</label>
                       <input 
                          type="text"
                          value={bulkUpdates.category || ''}
                          onChange={(e) => setBulkUpdates(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="Type category name..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                    </div>

                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Change Unit</label>
                       <select 
                          value={bulkUpdates.unit || ''}
                          onChange={(e) => setBulkUpdates(prev => ({ ...prev, unit: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                       >
                          <option value="">No change</option>
                          {RESOURCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                       </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Unit Price</label>
                         <input 
                            type="number"
                            value={bulkUpdates.unitPrice || ''}
                            onChange={(e) => setBulkUpdates(prev => ({ ...prev, unitPrice: e.target.value ? Number(e.target.value) : undefined, multiplier: undefined }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                      </div>
                      <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Scale Price (e.g. 1.1 = +10%)</label>
                         <input 
                            type="number"
                            step="0.01"
                            value={bulkUpdates.multiplier || ''}
                            onChange={(e) => setBulkUpdates(prev => ({ ...prev, multiplier: e.target.value ? Number(e.target.value) : undefined, unitPrice: undefined }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      This will apply changes to <span className="font-black underline">{selectedIds.size} selected</span> resources. Fields left empty will remain unchanged.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowBulkEdit(false)}
                      className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleBulkUpdate}
                      className="flex-1 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all"
                    >
                      Apply Changes
                    </button>
                  </div>
                </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
});

const SubconComparisonSection = React.memo(({ 
  boqItems,
  offers,
  onAddOffer,
  onAddImportedOffer,
  onUpdateRate,
  onChooseOffer,
  onDeleteOffer,
  onUpdateOfferName,
  formatPrice,
  currency
}: { 
  boqItems: BOQItem[], 
  offers: SubcontractorOffer[],
  onAddOffer: (pkg: string) => void,
  onAddImportedOffer: (pkg: string, name: string, itemRates: Record<string, number>) => void,
  onUpdateRate: (offerId: string, itemId: string, rate: number) => void,
  onChooseOffer: (offerId: string) => void,
  onDeleteOffer: (offerId: string) => void,
  onUpdateOfferName: (offerId: string, name: string) => void,
  formatPrice: (v: number) => string,
  currency: any
}) => {
  const packages = Array.from(new Set((boqItems || []).map(item => item.package).filter(Boolean))) as string[];
  const [selectedPkg, setSelectedPkg] = useState<string | null>(packages[0] || null);
  const [showImportMapper, setShowImportMapper] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [fieldMapping, setFieldMapping] = useState({ name: '', type: '', unit: '', rate: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pkgItems = (boqItems || []).filter(item => item.package === selectedPkg);
  const pkgOffers = (offers || []).filter(offer => offer.package === selectedPkg);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (json.length > 0) {
        const headers = Object.keys(json[0]);
        setImportHeaders(headers);
        setImportData(json);
        
        const newMapping = { name: '', type: '', unit: '', rate: '' };
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('name') || lower.includes('desc')) newMapping.name = h;
          if (lower.includes('type')) newMapping.type = h;
          if (lower.includes('unit')) newMapping.unit = h;
          if (lower.includes('rate') || lower.includes('price')) newMapping.rate = h;
        });
        setFieldMapping(newMapping);
        setShowImportMapper(true);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const applyImport = () => {
    if (!selectedPkg) return;
    const itemRates: Record<string, number> = {};
    importData.forEach(row => {
      const name = String(row[fieldMapping.name] || '').trim().toLowerCase();
      // Type is available just in case, but usually name is enough to match BOQ items.
      const unit = String(row[fieldMapping.unit] || '').trim();
      const normalizedUnit = normalizeUnit(unit, STANDARD_UNITS.concat(RESOURCE_UNITS));
      const rate = Number(row[fieldMapping.rate]) || 0;
      
      if (name && rate > 0) {
        const matchedItem = pkgItems.find(item => 
          item.description.toLowerCase().trim() === name && 
          normalizeUnit(item.unit, STANDARD_UNITS.concat(RESOURCE_UNITS)) === normalizedUnit
        );
        if (matchedItem) {
          itemRates[matchedItem.id] = rate;
        } else {
          const fallbackMatch = pkgItems.find(item => item.description.toLowerCase().trim() === name);
          if (fallbackMatch) {
            itemRates[fallbackMatch.id] = rate;
          }
        }
      }
    });

    onAddImportedOffer(selectedPkg, importFileName || 'Imported Subcontractor', itemRates);
    setShowImportMapper(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8 relative">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-2">
          <div className="flex items-center gap-3 md:gap-4 w-full lg:w-auto">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30 shrink-0">
              <Users className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight truncate">Subcontractor Comparison</h1>
              <p className="text-slate-500 font-medium tracking-wide text-[10px] md:text-xs uppercase antialiased">Compare quotes and link winning rates to cost study</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={selectedPkg || ''} 
              onChange={(e) => setSelectedPkg(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-tight text-slate-700 outline-none focus:ring-2 ring-purple-500 shadow-sm"
            >
              <option value="" disabled>Select Package...</option>
              {packages.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedPkg}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Import Excel
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
            />
            <button 
              onClick={() => selectedPkg && onAddOffer(selectedPkg)}
              disabled={!selectedPkg}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-purple-500/20"
            >
              <Plus className="w-3.5 h-3.5" /> Add Subcon
            </button>
          </div>
        </header>

        {!selectedPkg ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                <Box className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-wider">No Package Selected</p>
                <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">Select a work package from the dropdown above to start comparison.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Item Description</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 text-center">Unit</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-32 text-right">Study Rate</th>
                  {pkgOffers.map(offer => (
                    <th key={offer.id} className={`px-6 py-4 text-center relative group min-w-[180px] ${offer.isChosen ? 'bg-purple-50/50' : ''}`}>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 w-full justify-center">
                          <input 
                            type="text"
                            value={offer.name}
                            onChange={(e) => onUpdateOfferName(offer.id, e.target.value)}
                            className={`text-[11px] font-black uppercase tracking-tighter w-full text-center bg-transparent border-none focus:ring-0 focus:outline-none placeholder:opacity-30 ${offer.isChosen ? 'text-purple-600' : 'text-slate-800'}`}
                            placeholder="Unnamed Subcon"
                          />
                          <button onClick={() => onDeleteOffer(offer.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-all shrink-0"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <button 
                          onClick={() => onChooseOffer(offer.id)}
                          className={`mt-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${offer.isChosen ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                        >
                          {offer.isChosen ? 'Winner Chosen' : 'Select Winner'}
                        </button>
                      </div>
                    </th>
                  ))}
                  {(pkgOffers || []).length === 0 && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No Subcontractors Added</th>}
                </tr>
              </thead>
              <tbody>
                {pkgItems.map(item => {
                  const studyRate = (item.activities || []).reduce((acc, act) => acc + (act.unitRate || 0), 0);
                  const offerRates = pkgOffers.map(offer => (offer.itemRates || {})[item.id] || 0).filter(r => r > 0);
                  const allValidRates = [studyRate, ...offerRates].filter(r => r > 0);
                  const minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : studyRate;

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 line-clamp-1">{item.description}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-bold text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            {studyRate === minRate && studyRate > 0 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Best Rate" />
                            )}
                            <span className={`text-[11px] font-mono font-black px-2 py-1 rounded transition-all ${studyRate === minRate ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200' : 'text-indigo-600 bg-indigo-50'}`}>
                              {formatPrice(studyRate)}
                            </span>
                          </div>
                          {item.rateSource === 'Subcontractor' && (
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Reference only</span>
                          )}
                        </div>
                      </td>
                      {pkgOffers.map(offer => {
                        const rate = (offer.itemRates || {})[item.id] || 0;
                        const diff = rate > 0 ? (rate - studyRate) / studyRate * 100 : 0;
                        const isBest = rate === minRate && rate > 0;

                        return (
                          <td key={offer.id} className={`px-6 py-4 text-center ${offer.isChosen ? 'bg-purple-50/20' : ''}`}>
                            <div className="flex flex-col items-center gap-1">
                              <div className="relative w-full">
                                <NumericInput 
                                  value={rate}
                                  onChange={(v) => onUpdateRate(offer.id, item.id, v)}
                                  className={`w-full bg-transparent border-none focus:ring-0 text-center font-mono font-black text-sm transition-all ${isBest ? 'text-emerald-700' : rate > studyRate ? 'text-rose-600' : rate < studyRate && rate > 0 ? 'text-emerald-600' : 'text-slate-900'}`}
                                />
                                {isBest && (
                                  <div className="absolute -top-1 -right-1">
                                    <span className="flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                  </div>
                                )}
                              </div>
                              {rate > 0 && (
                                <span className={`text-[9px] font-bold ${diff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs Study
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      {(pkgOffers || []).length === 0 && <td className="px-6 py-4"></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedPkg && (pkgOffers || []).length > 0 && (
          <div className="bg-indigo-900 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                <Link className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">Active Cost Integration</h3>
                <p className="text-indigo-200 text-xs font-medium leading-relaxed max-w-xl uppercase tracking-widest">
                  When a winner is chosen, the rates are linked directly to the BOQ items. You can then toggle between the study and the subcon rate per item.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 relative z-10">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Status</div>
              <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                Direct Linking Enabled
              </div>
            </div>
          </div>
        )}
      </div>

      {showImportMapper && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Database className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Map Subcontractor Offer</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 ml-13">Align your Excel columns with the BOQ item description and rate.</p>
              </div>
              <button onClick={() => setShowImportMapper(false)} className="hover:bg-slate-100 p-2.5 rounded-2xl transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Columns className="w-3.5 h-3.5" /> Schema Alignment
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {Object.keys(fieldMapping).map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <select 
                        value={fieldMapping[field as keyof typeof fieldMapping]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFieldMapping(prev => ({ ...prev, [field]: val }));
                        }}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none"
                      >
                        <option value="">-- Ignore --</option>
                        {importHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="flex items-center gap-2 mb-2 text-slate-600">
                    <Info className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Note</span>
                 </div>
                 <p className="text-xs text-slate-500 font-medium">
                    The system will attempt to match BOQ items by matching the Description (name column) and handling Unit normalization. Any unmatched items or rows without rate will be skipped.
                 </p>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex justify-end gap-3 max-w-4xl mx-auto">
                <button 
                  onClick={applyImport}
                  disabled={!fieldMapping.name || !fieldMapping.rate}
                  className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 active:scale-[0.98]"
                >
                  <ArrowRight className="w-4 h-4" /> Process Import
                </button>
                <button 
                  onClick={() => setShowImportMapper(false)}
                  className="px-10 py-4 border-2 border-slate-100 hover:border-slate-300 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs transition-all font-mono text-slate-500"
                >
                  Discard
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
});

const QuickBudgetSection = React.memo(({ 
  items, 
  addItem, 
  importFromBOQ,
  updateItem, 
  deleteItem, 
  generateReference, 
  estimateAll,
  stopAI,
  status,
  isEstimating,
  country,
  currency,
  formatPrice,
  selectedIds,
  toggleSelection,
  toggleAll,
  deleteSelected,
  estimateSelected,
  onImportJSON,
  setNotification
}: { 
  items: QuickBudgetItem[], 
  addItem: () => void, 
  importFromBOQ: () => void,
  updateItem: (id: string, updates: Partial<QuickBudgetItem>) => void,
  deleteItem: (id: string) => void,
  generateReference: (id: string) => void,
  estimateAll: () => void,
  stopAI: () => void,
  status: string,
  isEstimating: Record<string, boolean>,
  country: string,
  currency: any,
  formatPrice: (v: number) => string,
  selectedIds: Set<string>,
  toggleSelection: (id: string) => void,
  toggleAll: (showOnlySelected?: boolean) => void, // Fixed signature
  deleteSelected: () => void,
  estimateSelected: () => void,
  onImportJSON: (items: QuickBudgetItem[]) => void,
  setNotification?: (notif: { message: string, type: 'success' | 'error' | 'info' } | null) => void
}) => {
  const isAnyEstimating = Object.values(isEstimating).includes(true);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const totalBoqAmount = items.reduce((sum, item) => sum + (item.totalCost || 0), 0);

  const exportToJson = () => {
    try {
      const dataStr = JSON.stringify(items, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quick_budget_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotification?.({ message: "Exported to JSON successfully", type: 'success' });
    } catch (err) {
      setNotification?.({ message: "JSON export failed", type: 'error' });
    }
  };

  const exportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(items.map(item => ({
        Code: item.code,
        Description: item.description,
        Unit: item.unit,
        Quantity: item.quantity,
        Labor: item.rateSource === 'Subcontractor' ? 0 : item.laborCost,
        Material: item.rateSource === 'Subcontractor' ? 0 : item.materialCost,
        Equipment: item.rateSource === 'Subcontractor' ? 0 : item.equipmentCost,
        Subcon: item.rateSource === 'Subcontractor' ? item.unitRate : item.subcontractorCost,
        'Unit Rate': item.unitRate,
        Total: item.totalCost
      })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Express Budget");
      XLSX.writeFile(workbook, `quick_budget_${new Date().toISOString().split('T')[0]}.xlsx`);
      setNotification?.({ message: "Exported to Excel successfully", type: 'success' });
    } catch (err) {
      setNotification?.({ message: "Excel export failed", type: 'error' });
    }
  };

  const exportToPdf = async () => {
    try {
      setNotification?.({ message: "Synthesizing Professional Budget Report...", type: 'info' });
      
      const reportContainer = document.createElement('div');
      reportContainer.id = 'temp-quick-budget-container';
      reportContainer.style.position = 'fixed';
      reportContainer.style.left = '-10000px';
      reportContainer.style.top = '0';
      reportContainer.style.width = '1123px'; // A4 landscape ~297mm
      reportContainer.style.backgroundColor = 'white';
      reportContainer.style.fontFamily = "'Inter', system-ui, sans-serif";
      document.body.appendChild(reportContainer);

      const today = new Date().toLocaleDateString('en-GB');

      reportContainer.innerHTML = `
        <div style="padding: 40px; color: #0f172a;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; border-bottom: 4px solid #ea580c; padding-bottom: 20px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 900; color: #ea580c; margin: 0;">Express Budget Report</h1>
              <p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0;">Reference-based engineering analysis for ${country}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Generated Date</div>
              <div style="font-size: 18px; font-weight: 900;">${today}</div>
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; gap: 40px;">
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Total BOQ Amount</div>
              <div style="font-size: 24px; font-weight: 900; color: #ea580c;">${formatPrice(totalBoqAmount)}</div>
            </div>
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Items Count</div>
              <div style="font-size: 24px; font-weight: 900; color: #1e293b;">${items.length}</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background-color: #ea580c; color: white;">
                <th style="padding: 12px 8px; text-align: left;">Code</th>
                <th style="padding: 12px 8px; text-align: left;">Description</th>
                <th style="padding: 12px 8px; text-align: left;">Qty</th>
                <th style="padding: 12px 8px; text-align: left;">Unit</th>
                <th style="padding: 12px 8px; text-align: right;">Rate</th>
                <th style="padding: 12px 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 8px; font-weight: 700;">${item.code || '-'}</td>
                  <td style="padding: 10px 8px; font-weight: 600; ${/[\u0600-\u06FF]/.test(item.description) ? 'direction: rtl; text-align: right;' : ''}">${item.description}</td>
                  <td style="padding: 10px 8px;">${item.quantity.toLocaleString()}</td>
                  <td style="padding: 10px 8px;">${item.unit}</td>
                  <td style="padding: 10px 8px; text-align: right;">${formatPrice(item.unitRate || 0)}</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 800; color: #ea580c;">${formatPrice(item.totalCost || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px;">
            Professional Express Budget Analysis | System Verification: COST ENGINE
          </div>
        </div>
      `;

      const doc = new jsPDF('l', 'mm', 'a4');
      const fileName = `quick_budget_${new Date().toISOString().split('T')[0]}.pdf`;

      await new Promise(resolve => setTimeout(resolve, 500));

      await doc.html(reportContainer, {
        html2canvas: html2canvas as any,
        callback: function (doc) {
          doc.save(fileName);
        },
        x: 0,
        y: 0,
        width: 297, // A4 landscape width in mm
        windowWidth: 1123,
        autoPaging: 'text'
      });

      document.body.removeChild(reportContainer);
      setNotification?.({ message: "Exported to PDF successfully", type: 'success' });
    } catch (err) {
      console.error("PDF export failed:", err);
      setNotification?.({ message: "PDF export failed", type: 'error' });
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedItems = JSON.parse(content);
        
        if (!Array.isArray(importedItems)) {
          throw new Error("Invalid format: Expected a list of budget items.");
        }

        // Basic validation/sanitization
        const sanitized = importedItems.map(item => ({
          ...item,
          id: item.id || crypto.randomUUID(), // ensure ID
          quantity: Number(item.quantity) || 0,
          laborCost: Number(item.laborCost) || 0,
          materialCost: Number(item.materialCost) || 0,
          equipmentCost: Number(item.equipmentCost) || 0,
          subcontractorCost: Number(item.subcontractorCost) || 0,
          totalCost: Number(item.totalCost) || 0,
          unitRate: Number(item.unitRate) || 0,
        })) as QuickBudgetItem[];

        onImportJSON(sanitized);
        setNotification?.({ message: `Successfully imported ${sanitized.length} items.`, type: 'success' });
      } catch (err) {
        console.error("Import failed:", err);
        setNotification?.({ message: "Failed to import JSON. Please check file format.", type: 'error' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8 transition-colors">
       <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-2">
             <div className="flex items-center gap-3 md:gap-4 w-full lg:w-auto">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30 shrink-0">
                   <Zap className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight truncate">Express Budget</h1>
                  <p className="text-slate-500 font-medium tracking-wide text-[10px] md:text-xs uppercase antialiased truncate">Reference-based budgeting for {country}</p>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-2 md:p-3 rounded-2xl border border-slate-200 shadow-sm w-full lg:w-auto">
                <div className="flex flex-row items-center justify-between sm:justify-start px-2 sm:px-3 sm:border-r border-slate-100 sm:mr-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-500 underline underline-offset-4 decoration-orange-500/30">Total Budget</span>
                    <span className="text-sm md:text-base font-black text-orange-600 font-mono tracking-tighter tabular-nums whitespace-nowrap">{formatPrice(totalBoqAmount)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json"
                    onChange={importFromJson}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    title="Import from JSON"
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={exportToJson}
                    title="Export to JSON"
                    className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all hover:scale-110 active:scale-95 group shadow-sm bg-white border border-slate-100"
                  >
                    <Download className="w-4 h-4 group-hover:stroke-[3px]" />
                  </button>
                  <button 
                    onClick={exportToExcel}
                    title="Export to Excel"
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all hover:scale-110 active:scale-95 group shadow-sm bg-white border border-slate-100"
                  >
                    <FileSpreadsheet className="w-4 h-4 group-hover:stroke-[3px]" />
                  </button>
                  <button 
                    onClick={exportToPdf}
                    title="Export to PDF"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
             </div>
             
             <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto">
                {isAnyEstimating ? (
                  <button 
                    onClick={stopAI}
                    className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap shadow-sm"
                  >
                    <Ban className="w-4 h-4" /> Stop AI
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={estimateAll}
                      disabled={items.length === 0}
                      className="bg-slate-900 text-white hover:bg-slate-800 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
                      <span className="hidden sm:inline">Estimate All Items</span>
                      <span className="sm:hidden">Estimate All</span>
                    </button>
                    {selectedIds.size > 0 && (
                      <button 
                        onClick={estimateSelected}
                        className="bg-orange-100 text-orange-600 hover:bg-orange-600 hover:text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 whitespace-nowrap shadow-sm border border-orange-200"
                      >
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Selected ({selectedIds.size})
                      </button>
                    )}
                  </div>
               )}
                
                {selectedIds.size > 0 && !isAnyEstimating && (
                   <button 
                      onClick={deleteSelected}
                      className="flex-1 sm:flex-none bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95 whitespace-nowrap shadow-sm"
                   >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> Delete ({selectedIds.size})
                   </button>
                )}

                <button 
                   onClick={importFromBOQ}
                   className="flex-1 sm:flex-none bg-white hover:bg-slate-100 text-slate-900 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95 whitespace-nowrap"
                >
                   <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> From BOQ
                </button>
                <button 
                   onClick={addItem}
                   className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 md:gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95 whitespace-nowrap"
                >
                   <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> Add Item
                </button>
             </div>
          </header>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-colors">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm">
                     <tr className="border-b border-slate-100 bg-slate-50/50 transition-colors group">
                        <th className="px-4 md:px-6 py-4 w-12 text-center">
                          <button 
                            onClick={() => toggleAll()}
                            className={`mx-auto w-4 h-4 md:w-5 md:h-5 rounded-md border-2 transition-all flex items-center justify-center ${allSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300 hover:border-orange-500'}`}
                          >
                            {allSelected && <Check className="w-2.5 h-2.5 md:w-3 md:h-3 stroke-[4]" />}
                          </button>
                        </th>
                        <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-20 md:w-24">Code</th>
                        <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 min-w-[400px]">Description</th>
                        <th className="hidden sm:table-cell px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-20 text-center">Unit</th>
                        <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 md:w-32 text-center">Qty</th>
                        <th className="hidden md:table-cell px-4 md:px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-600 text-center bg-slate-100/50">Labor</th>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-600 text-center bg-slate-100/50">Material</th>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-600 text-center bg-slate-100/50">Equip</th>
                        <th className="hidden md:table-cell px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-600 text-center bg-slate-100/50">Subcon</th>
                        <th className="hidden md:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Unit Rate</th>
                        <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Total Budget</th>
                        <th className="px-4 md:px-6 py-4 w-20 md:w-28"></th>
                     </tr>
                  </thead>
                  <tbody>
                     <AnimatePresence mode='popLayout'>
                     {items.map((item) => (
                        <motion.tr 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={item.id} 
                          className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors group ${selectedIds.has(item.id) ? 'bg-orange-50/30' : ''}`}
                        >
                           <td className="px-4 md:px-6 py-4 align-top text-center">
                             <button 
                                onClick={() => toggleSelection(item.id)}
                                className={`mx-auto w-4 h-4 md:w-5 md:h-5 rounded-md border-2 transition-all flex items-center justify-center mt-1 ${selectedIds.has(item.id) ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-200 hover:border-orange-500'}`}
                             >
                               {selectedIds.has(item.id) && <Check className="w-2.5 h-2.5 md:w-3 md:h-3 stroke-[4]" />}
                             </button>
                           </td>
                           <td className="px-4 md:px-6 py-4 align-top w-20 md:w-24">
                              <input 
                                 value={item.code || ''}
                                 onChange={(e) => updateItem(item.id, { code: e.target.value })}
                                 className="w-full bg-slate-50 border border-slate-100 rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-500 outline-none text-[10px] font-mono font-bold text-indigo-600 transition-all focus:bg-white"
                                 placeholder="Code..."
                              />
                           </td>
                           <td className="px-4 md:px-6 py-4 align-top min-w-[400px]">
                              <textarea 
                                 value={item.description}
                                 dir="auto"
                                 onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-xs md:text-sm font-black text-slate-800 placeholder:text-slate-300 resize-none min-h-[32px] md:min-h-[40px] leading-relaxed transition-colors focus:text-indigo-900 overflow-hidden"
                                 placeholder="Item description..."
                                 rows={1}
                                 onFocus={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                 }}
                                 onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = target.scrollHeight + 'px';
                                 }}
                              />
                           </td>
                           <td className="hidden sm:table-cell px-6 py-4 align-top w-20">
                              <select 
                                 value={item.unit}
                                 onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-bold text-slate-600 text-center cursor-pointer appearance-none mt-1"
                              >
                                 {STANDARD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                           </td>
                           <td className="px-4 md:px-6 py-4 align-top text-center w-24 md:w-32">
                              <NumericInput 
                                 value={item.quantity}
                                 onChange={(v) => updateItem(item.id, { quantity: v })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-[11px] md:text-xs font-bold text-slate-600 text-center mt-1"
                              />
                           </td>
                           <td className="hidden md:table-cell px-6 py-4 align-top bg-slate-50/[0.02]">
                              <NumericInput 
                                 value={item.laborCost}
                                 onChange={(v) => updateItem(item.id, { laborCost: v })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-black font-mono text-blue-600 text-center mt-1"
                              />
                           </td>
                           <td className="hidden md:table-cell px-6 py-4 align-top bg-slate-50/[0.02]">
                              <NumericInput 
                                 value={item.materialCost}
                                 onChange={(v) => updateItem(item.id, { materialCost: v })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-black font-mono text-emerald-600 text-center mt-1"
                              />
                           </td>
                           <td className="hidden md:table-cell px-6 py-4 align-top bg-slate-50/[0.02]">
                              <NumericInput 
                                 value={item.equipmentCost}
                                 onChange={(v) => updateItem(item.id, { equipmentCost: v })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-black font-mono text-orange-600 text-center mt-1"
                              />
                           </td>
                           <td className="hidden md:table-cell px-6 py-4 align-top bg-slate-50/[0.02]">
                              <NumericInput 
                                 value={item.subcontractorCost}
                                 onChange={(v) => updateItem(item.id, { subcontractorCost: v })}
                                 className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-black font-mono text-purple-600 text-center mt-1"
                              />
                           </td>
                           <td className="hidden md:table-cell px-6 py-4 align-top text-right">
                              <span className="text-[10px] font-black text-slate-400 block mt-2 whitespace-nowrap">{formatPrice(item.unitRate)}</span>
                           </td>
                           <td className="px-4 md:px-6 py-4 align-top text-right">
                              <span className="text-xs md:text-sm font-black text-slate-900 tracking-tight block mt-1.5 md:mt-2 whitespace-nowrap">{formatPrice(item.totalCost)}</span>
                           </td>
                           <td className="px-4 md:px-6 py-4 align-top">
                              <div className="flex items-center justify-end gap-1 md:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                 <button 
                                    onClick={() => generateReference(item.id)}
                                    disabled={isEstimating[item.id] || !item.description}
                                    className={`p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all ${isEstimating[item.id] ? 'bg-slate-100 border-slate-200 animate-pulse' : 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-600 hover:text-white'}`}
                                    title="Generate AI Reference Cost"
                                 >
                                    <Sparkles className={`w-3.5 h-3.5 ${isEstimating[item.id] ? 'animate-spin' : ''}`} />
                                 </button>
                                 <button 
                                    onClick={() => deleteItem(item.id)}
                                    className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 transition-all"
                                    title="Delete Item"
                                 >
                                    <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           </td>
                        </motion.tr>
                     ))}
                     </AnimatePresence>
                     {items.length === 0 && (
                        <tr>
                           <td colSpan={11} className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-4">
                                 <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                                    <Layers className="w-8 h-8" />
                                 </div>
                                 <div>
                                    <p className="text-sm font-black text-slate-900 uppercase tracking-wider">No quick budget items</p>
                                    <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest leading-relaxed">Start by adding an item or using AI references.<br/>It doesn't affect your main study.</p>
                                 </div>
                                 <button 
                                    onClick={addItem}
                                    className="mt-2 text-orange-600 font-black uppercase tracking-widest text-[10px] hover:underline"
                                 >
                                    Add your first item
                                 </button>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
             </div>
          </div>
       </div>
    </div>
  );
});

const UserGuideModal = ({ 
  isOpen, 
  onClose,
  setNotification
}: { 
  isOpen: boolean; 
  onClose: () => void;
  setNotification?: (notif: { message: string; type: 'error' | 'success' | 'info' | 'warning' } | null) => void;
}) => {
  const sections = [
    {
      title: "Quick Start: Express Budget",
      icon: <Zap className="w-5 h-5 text-orange-500" />,
      content: "Need a budget fast? Use the 'Express' tab to quickly draft line items. You can use AI to instantly fetch reference prices.",
      color: "bg-orange-50"
    },
    {
      title: "AI Estimation Study",
      icon: <Sparkles className="w-5 h-5 text-indigo-500" />,
      content: "For detailed studies, use the BOQ tab. Add an item, then click the sparkles to have AI generate a full breakdown of resources.",
      color: "bg-indigo-50"
    },
    {
      title: "Resource Library",
      icon: <Library className="w-5 h-5 text-emerald-500" />,
      content: "Manage rates centrally. Update a price in the Library to sync across all projects instantly.",
      color: "bg-emerald-50"
    },
    {
      title: "Precision Analytics",
      icon: <BarChart3 className="w-5 h-5 text-amber-500" />,
      content: "Toggle between Type, Category, and Work Item views in the Dashboard for multi-dimensional cost insights.",
      color: "bg-amber-50"
    },
    {
      title: "Professional Reports",
      icon: <FileText className="w-5 h-5 text-rose-500" />,
      content: "Export as high-quality PDFs or Excel sheets. Pro reports are ready for submission with vectorized metadata.",
      color: "bg-rose-50"
    },
    {
      title: "Cloud Sync & Backup",
      icon: <Database className="w-5 h-5 text-blue-500" />,
      content: "Your data is secured in safe local storage and can be exported as JSON for backup or team sharing.",
      color: "bg-blue-50"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-fit max-h-[90vh]"
          >
            {/* Sidebar with Image/Mockup */}
            <div className="w-full md:w-1/3 bg-slate-900 p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/20 rounded-full -ml-32 -mb-32 blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 flex items-center justify-center">
                    <CostEngineIcon className="w-10 h-10 text-orange-500 drop-shadow-md" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white tracking-widest uppercase">User Guide</span>
                    <span className="text-[8px] font-black text-slate-500 tracking-[0.2em] uppercase leading-none">v2.8.4 Stable</span>
                  </div>
                </div>
                <h3 className="text-3xl font-black text-white leading-tight mb-4">Master the Cost Engine</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Your all-in-one suite for professional construction cost estimating & engineering analysis.
                </p>
              </div>

              <div>
                <div className="relative z-10 mt-6 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                   <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Active Features</span>
                   </div>
                   <div className="space-y-2">
                      {['AI Breakdown', 'Market Analytics', 'PDF Reports'].map(f => (
                        <div key={f} className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] font-bold text-slate-300">{f}</span>
                        </div>
                      ))}
                   </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await generateHandbookPDF(setNotification as any);
                    } catch (err) {
                      console.error('Download handbook crash:', err);
                    }
                  }}
                  className="relative z-10 mt-5 w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-605 hover:to-orange-700 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 cursor-pointer border border-white/5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Handbook PDF
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Guide Sections</h4>
                  <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sections.map((s, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-orange-200/50 transition-all group"
                    >
                      <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-sm`}>
                        {s.icon}
                      </div>
                      <h5 className="text-[11px] font-black text-slate-900 mb-1.5 uppercase tracking-tighter leading-tight">{s.title}</h5>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        {s.content}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 bg-slate-900 rounded-3xl p-6 relative overflow-hidden group border border-white/5">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ring-1 ring-white/10">
                      <Sparkles className="w-7 h-7 text-orange-500 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-1">Precision Intelligence</p>
                      <h6 className="text-white font-black text-sm mb-1 uppercase tracking-tight">AI Batch Processing Enabled</h6>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-2xl">
                        Select multiple line items and use the "AI Estimate Selected" feature to synthesize entire project breakdowns at once. Our engine uses regional metadata for high-accuracy pricing.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-center">
                  <button 
                    onClick={onClose}
                    className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                  >
                    Get Started Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [draggedBoqItemId, setDraggedBoqItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [qsTakeoffs, setQsTakeoffs] = useState<QSTakeoff[]>([]);
  const [subcontractorOffers, setSubcontractorOffers] = useState<SubcontractorOffer[]>([]);
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('cost-engine-cloud-sync');
    return stored === null ? true : stored === 'true';
  });
  const [isCloudAutoSyncEnabled, setIsCloudAutoSyncEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('cost-engine-cloud-auto-sync');
    return stored === null ? true : stored === 'true';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedPackageForComparison, setSelectedPackageForComparison] = useState<string | null>(null);
  const [selectedBoqId, setSelectedBoqId] = useState<string | null>(null);
  const [expandedBoqInTableId, setExpandedBoqInTableId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [boqFilters, setBoqFilters] = useState({
    searchTerm: '',
    selectedUnits: [] as string[],
    selectedCodes: [] as string[],
    minQty: null as number | null,
    maxQty: null as number | null,
    minBudget: null as number | null,
    maxBudget: null as number | null,
    minRate: null as number | null,
    maxRate: null as number | null,
    sortKey: null as 'code' | 'description' | 'quantity' | 'unitRate' | 'totalBudget' | null,
    sortOrder: 'asc' as 'asc' | 'desc',
    selectedPackages: [] as string[],
  });

  const boqMetadata = useMemo(() => {
    const units = Array.from(new Set(boqItems.map(item => item.unit).filter(Boolean))).sort();
    const codes = Array.from(new Set(boqItems.map(item => item.code).filter(Boolean))).sort();
    const packages = Array.from(new Set(boqItems.map(item => item.package).filter(Boolean))).sort();
    const quantities = boqItems.map(item => item.quantity);
    const budgets = boqItems.map(item => item.totalBudget);
    
    return {
      units,
      codes,
      packages,
      minQty: quantities.length ? Math.min(...quantities) : 0,
      maxQty: quantities.length ? Math.max(...quantities) : 1000,
      minBudget: budgets.length ? Math.min(...budgets) : 0,
      maxBudget: budgets.length ? Math.max(...budgets) : 1000000
    };
  }, [boqItems]);

  const filteredBoqItems = useMemo(() => {
    let result = boqItems.filter(item => {
      const matchesSearch = (item.description || '').toLowerCase().includes(boqFilters.searchTerm.toLowerCase()) ||
                           (item.code || '').toLowerCase().includes(boqFilters.searchTerm.toLowerCase()) ||
                           (item.package || '').toLowerCase().includes(boqFilters.searchTerm.toLowerCase());
      
      const matchesUnit = (boqFilters.selectedUnits || []).length === 0 || (boqFilters.selectedUnits || []).includes(item.unit);
      const matchesCode = (boqFilters.selectedCodes || []).length === 0 || (boqFilters.selectedCodes || []).includes(item.code);
      const matchesPackage = (boqFilters.selectedPackages || []).length === 0 || (item.package && (boqFilters.selectedPackages || []).includes(item.package));
      
      const matchesQty = (boqFilters.minQty === null || item.quantity >= boqFilters.minQty) &&
                        (boqFilters.maxQty === null || item.quantity <= boqFilters.maxQty);
      
      const matchesBudget = (boqFilters.minBudget === null || item.totalBudget >= boqFilters.minBudget) &&
                           (boqFilters.maxBudget === null || item.totalBudget <= boqFilters.maxBudget);
      
      const matchesRate = (boqFilters.minRate === null || item.unitRate >= boqFilters.minRate) &&
                         (boqFilters.maxRate === null || item.unitRate <= boqFilters.maxRate);
                           
      return matchesSearch && matchesUnit && matchesCode && matchesPackage && matchesQty && matchesBudget && matchesRate;
    });

    // Sorting
    if (boqFilters.sortKey) {
      result.sort((a, b) => {
        const key = boqFilters.sortKey!;
        const order = boqFilters.sortOrder === 'asc' ? 1 : -1;
        
        const valA = a[key as keyof BOQItem];
        const valB = b[key as keyof BOQItem];
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return valA.localeCompare(valB) * order;
        }
        
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * order;
        }
        
        return 0;
      });
    }

    return result;
  }, [boqItems, boqFilters]);
  const [view, setView] = useState<'boq' | 'dashboard' | 'subcon-comparison' | 'library' | 'qs'>('boq');
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(8);
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState(6);
  const [currencyCode, setCurrencyCode] = useState('SAR');
  const [country, setCountry] = useState('Saudi Arabia');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [activeModal, setActiveModal] = useState<'create' | 'rename' | 'delete' | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [projectNameInput, setProjectNameInput] = useState('');

  const currentProject = useMemo(() => 
    projects.find(p => p.id === currentProjectId), 
    [projects, currentProjectId]
  );

  const initialized = useRef(false);
  const [bulkPriceValue, setBulkPriceValue] = useState<string>('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [exportSettings, setExportSettings] = useState<{
    columns: { [key: string]: boolean };
    includeActivities: boolean;
    includeResources: boolean;
    includeResourceSummary: boolean;
    includeCategorySummary: boolean;
    format: 'excel' | 'pdf';
  }>({
    columns: {
      code: true,
      package: true,
      description: true,
      unit: true,
      quantity: true,
      totalBudget: true,
      unitRate: true,
      type: true
    },
    includeActivities: true,
    includeResources: true,
    includeResourceSummary: true,
    includeCategorySummary: false,
    format: 'excel'
  });
  const [resourceLibrary, setResourceLibrary] = useState<LibraryResource[]>([]);
  const [activityTemplates, setActivityTemplates] = useState<ActivityTemplate[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResourceDeleteConfirm, setShowResourceDeleteConfirm] = useState(false);
  const [showClearTemplatesConfirm, setShowClearTemplatesConfirm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState<string | null>(null);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [isAiEstimating, setIsAiEstimating] = useState(false);
  const [showExpandedSummary, setShowExpandedSummary] = useState(false);
  const [dialogEditingId, setDialogEditingId] = useState<string | null>(null);
  const [dialogEditFields, setDialogEditFields] = useState({ code: '', package: '', description: '', unit: '', quantity: 0 });
  const [selectedDialogIds, setSelectedDialogIds] = useState<Set<string>>(new Set());
  const [editingItemInDialog, setEditingItemInDialog] = useState<BOQItem | null>(null);
  const [aiConsiderIndirectCost, setAiConsiderIndirectCost] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const stopAiRef = useRef(false);
  
  const stopAiEstimation = () => {
    stopAiRef.current = true;
    setIsAiEstimating(false);
    setNotification({ message: "Stopping AI process...", type: 'info' });
  };
  const [showLibrary, setShowLibrary] = useState(false);
  const [showLibraryImportMenu, setShowLibraryImportMenu] = useState(false);
  const libraryImportMenuRef = useRef<HTMLDivElement>(null);
  const [selectedBOQItemIds, setSelectedBOQItemIds] = useState<Set<string>>(new Set());
  const [estimatingLibraryPriceId, setEstimatingLibraryPriceId] = useState<string | null>(null);


  // Conflict Resolution State
  const [pendingConflict, setPendingConflict] = useState<{
    resource: LibraryResource;
    mode: 'activity' | 'library';
    targetIds?: { boqId: string; activityId: string };
    existingResource: any;
  } | null>(null);

  // BOQ Import Mapping States
  const [importMappingData, setImportMappingData] = useState<any[] | null>(null);
  const [showImportMapper, setShowImportMapper] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({
    itemCode: '',
    package: '',
    description: '',
    unit: '',
    quantity: ''
  });
  const [unitMappings, setUnitMappings] = useState<Record<string, string>>({});
  const [uniqueUnits, setUniqueUnits] = useState<string[]>([]);

  // Resource Import Mapping States
  const [resourceImportMappingData, setResourceImportMappingData] = useState<any[] | null>(null);
  const [showResourceImportMapper, setShowResourceImportMapper] = useState(false);
  const [resourceImportHeaders, setResourceImportHeaders] = useState<string[]>([]);
  const [resourceFieldMapping, setResourceFieldMapping] = useState<Record<string, string>>({
    name: '',
    type: '',
    unit: '',
    rate: ''
  });
  const [resourceUnitMappings, setResourceUnitMappings] = useState<Record<string, string>>({});
  const [uniqueResourceUnits, setUniqueResourceUnits] = useState<string[]>([]);

  // Undo/Redo State
  const [history, setHistory] = useState<BOQItem[][]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isUndoingRedoing = useRef(false);

  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      setNotification({ message: "Login failed. Please try again.", type: 'error' });
    }
  };

  const logout = async () => {
    if (hasUnsavedChanges) {
      await saveCurrentProject();
    }
    try {
      await signOut(auth);
      setProjects([]);
      setCurrentProjectId(null);
      setBoqItems([]);
      setResourceLibrary([]);
      setActivityTemplates([]);
      initialized.current = false;
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const recalculateItemTotals = (item: BOQItem): BOQItem => {
    const studyUnitRate = (item.activities || []).reduce((acc, act) => acc + (act.unitRate || 0), 0);
    const studyTotalBudget = studyUnitRate * item.quantity;
    
    if (item.rateSource === 'Subcontractor' && item.subcontractorRate !== undefined && item.subcontractorRate > 0) {
      return {
        ...item,
        unitRate: item.subcontractorRate,
        totalBudget: item.subcontractorRate * item.quantity
      };
    }
    
    return {
      ...item,
      unitRate: studyUnitRate,
      totalBudget: studyTotalBudget
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = storageService.subscribeToQueueCount(setPendingSyncCount);
    return () => unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    setIsDataLoading(true);
    let initialProjects: Project[] = [];
    try {
      // 1. Initial Load from LocalStorage (Immediate read)
      const localProjectsRecord = localStorage.getItem('cost-estimation-projects');
      const localLibraryRecord = localStorage.getItem('resource_library');
      const localTemplatesRecord = localStorage.getItem('activity_templates');

      let initialLibrary: LibraryResource[] = [];
      let initialTemplates: ActivityTemplate[] = [];

      if (localProjectsRecord) {
        try {
          const parsed = JSON.parse(localProjectsRecord);
          if (Array.isArray(parsed)) initialProjects = parsed;
        } catch (e) {}
      }

      if (localLibraryRecord) {
        try {
          const parsed = JSON.parse(localLibraryRecord);
          if (Array.isArray(parsed)) initialLibrary = parsed;
        } catch (e) {}
      }

      if (localTemplatesRecord) {
        try {
          const parsed = JSON.parse(localTemplatesRecord);
          if (Array.isArray(parsed)) initialTemplates = parsed;
        } catch (e) {}
      }

      // Seed library if empty
      if (initialLibrary.length === 0) {
        initialLibrary = SEED_LIBRARY.map(r => ({ ...r, id: crypto.randomUUID(), category: 'Seed Data' })) as LibraryResource[];
      }

      // Set initial state from LocalStorage
      setProjects(initialProjects);
      setResourceLibrary(initialLibrary);
      setActivityTemplates(initialTemplates);

      // Try to load last active project from local data first
      const lastActiveId = localStorage.getItem('last-active-project-id');
      let projectToLoad: Project | undefined;
      
      if (lastActiveId && initialProjects.some(p => p.id === lastActiveId)) {
        projectToLoad = initialProjects.find(p => p.id === lastActiveId);
      } else if (initialProjects.length > 0) {
        projectToLoad = initialProjects[0];
      }

      if (projectToLoad) {
        setBoqItems(projectToLoad.boqItems || []);
        setSubcontractorOffers(projectToLoad.subcontractorOffers || []);
        setQsTakeoffs(projectToLoad.qsTakeoffs || []);
        setCurrencyCode(projectToLoad.currency || 'SAR');
        setCountry(projectToLoad.country || 'Saudi Arabia');
        setScopeOfWork(projectToLoad.scopeOfWork || '');
        setResourceLibrary(projectToLoad.resourceLibrary !== undefined ? projectToLoad.resourceLibrary : initialLibrary);
        setCurrentProjectId(projectToLoad.id);
        initialized.current = true;
      }

      // 2. If user is logged in AND cloud sync is enabled, sync with Firestore
      if (user?.uid && isCloudSyncEnabled) {
        const fetchedProjects = await storageService.fetchProjects(user.uid);
        const fetchedLibrary = await storageService.fetchResourceLibrary(user.uid);
        const fetchedTemplates = await storageService.fetchActivityTemplates(user.uid);

        let mergedProjects = initialProjects;
        let mergedLibrary = initialLibrary;
        let mergedTemplates = initialTemplates;

        // If cloud is empty but local has data, upload local data
        if (fetchedProjects.length === 0 && initialProjects.length > 0) {
          for (const p of initialProjects) {
            await storageService.saveProject(user.uid, p);
          }
        } else if (fetchedProjects.length > 0) {
          // Cloud has data, it wins for now (we could implement smarter conflict resolution)
          mergedProjects = fetchedProjects;
        }

        if (fetchedLibrary.length === 0 && initialLibrary.length > 0) {
          await storageService.saveResourcesBulk(user.uid, initialLibrary);
        } else if (fetchedLibrary.length > 0) {
          mergedLibrary = fetchedLibrary;
        }

        if (fetchedTemplates.length === 0 && initialTemplates.length > 0) {
          for (const t of initialTemplates) {
            await storageService.saveActivityTemplate(user.uid, t);
          }
        } else if (fetchedTemplates.length > 0) {
          mergedTemplates = fetchedTemplates;
        }

        // Final State Update from Cloud/Merged data
        setProjects(mergedProjects);
        setResourceLibrary(mergedLibrary);
        setActivityTemplates(mergedTemplates);

        // Re-check project to load after cloud sync
        if (lastActiveId && mergedProjects.some(p => p.id === lastActiveId)) {
          projectToLoad = mergedProjects.find(p => p.id === lastActiveId);
        } else if (mergedProjects.length > 0 && !projectToLoad) {
          projectToLoad = mergedProjects[0];
        }

        if (projectToLoad) {
          setBoqItems(projectToLoad.boqItems || []);
          setSubcontractorOffers(projectToLoad.subcontractorOffers || []);
          setQsTakeoffs(projectToLoad.qsTakeoffs || []);
          setCurrencyCode(projectToLoad.currency || 'SAR');
          setCountry(projectToLoad.country || 'Saudi Arabia');
          setScopeOfWork(projectToLoad.scopeOfWork || '');
          setResourceLibrary(projectToLoad.resourceLibrary !== undefined ? projectToLoad.resourceLibrary : mergedLibrary);
          setCurrentProjectId(projectToLoad.id);
          initialized.current = true;
        }
      }
    } catch (error) {
      console.error("Data loading failed", error);
    } finally {
      setIsDataLoading(false);
      // Ensure initialized is true if we have projects, otherwise it will try to create a default
      if (initialProjects.length > 0) initialized.current = true;
    }
  }, [user, isCloudSyncEnabled]);

  useEffect(() => {
    if (!isAuthLoading) {
      loadData();
    }
  }, [user?.uid, isAuthLoading, loadData]);

  const activitiesScrollRef = useRef<HTMLDivElement>(null);
  const resourcesScrollRef = useRef<HTMLDivElement>(null);

  const toggleBOQItemSelection = useCallback((id: string) => {
    setSelectedBOQItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAllBOQ = useCallback(() => {
    setSelectedBOQItemIds(prev => {
      if (prev.size > 0 && prev.size === filteredBoqItems.length) {
        return new Set();
      } else {
        return new Set(filteredBoqItems.map(item => item.id));
      }
    });
  }, [filteredBoqItems]);

  const bulkDeleteBOQItems = useCallback(() => {
    if (selectedBOQItemIds.size === 0) return;
    
    const newItems = boqItems.filter(item => !selectedBOQItemIds.has(item.id));
    setBoqItems(newItems);
    
    // Clear selection
    const nextSelectedId = selectedBoqId && selectedBOQItemIds.has(selectedBoqId) ? null : selectedBoqId;
    setSelectedBoqId(nextSelectedId);
    setSelectedBOQItemIds(new Set());
    
    setNotification({ message: `Deleted ${selectedBOQItemIds.size} items`, type: 'success' });
  }, [selectedBOQItemIds, boqItems, selectedBoqId]);

  const linkBOQItems = useCallback(() => {
    if (selectedBOQItemIds.size < 2) {
      setNotification({ message: 'Select at least 2 items to link', type: 'info' });
      return;
    }
    
    const linkingId = crypto.randomUUID().substring(0, 8);
    const selectedItems = boqItems.filter(item => selectedBOQItemIds.has(item.id));
    
    // Use the one with most activities as template, or just the first one
    const masterItem = selectedItems.sort((a, b) => (b.activities?.length || 0) - (a.activities?.length || 0))[0];
    
    setBoqItems(prev => prev.map(item => {
      if (!selectedBOQItemIds.has(item.id)) return item;
      
      // If full linking, we synchronize activities
      const synchronizedActivities = (masterItem.activities || []).map(masterAct => {
        const linkedActivityId = masterAct.linkedActivityId || crypto.randomUUID().substring(0, 8);
        
        // Ensure resources also have links
        const linkedResources = (masterAct.resources || []).map(res => ({
          ...res,
          id: crypto.randomUUID(),
          linkedResourceId: res.linkedResourceId || res.id,
          linkType: 'full' as 'full'
        }));

        return {
          ...masterAct,
          id: crypto.randomUUID(),
          boqId: item.id,
          linkedActivityId,
          linkType: 'full' as 'full',
          resources: linkedResources
        };
      });

      // We also need to update the master item's own activities to have the new linked IDs if they didn't
      // But it's easier to just update everything in one pass if we are clever.
      
      return recalculateItemTotals({ 
        ...item, 
        activities: synchronizedActivities, 
        linkingId, 
        linkingType: 'full' 
      });
    }));

    // Second pass to ensure the master item itself is also updated in the state if it wasn't already (it is part of selectedBOQItemIds)
    
    setSelectedBOQItemIds(new Set());
    setNotification({ message: `Successfully linked ${selectedItems.length} items. Calculations will now synchronize.`, type: 'success' });
  }, [selectedBOQItemIds, boqItems]);

  const unlinkBOQItems = useCallback((targetId?: string) => {
    const idsToUnlink = targetId ? new Set([targetId]) : selectedBOQItemIds;
    if (idsToUnlink.size === 0) return;
    
    setBoqItems(prev => prev.map(item => {
      if (!idsToUnlink.has(item.id)) return item;
      
      const unlinkedActivities = (item.activities || []).map(act => ({
        ...act,
        linkedActivityId: undefined,
        linkType: undefined,
        resources: (act.resources || []).map(res => ({
          ...res,
          linkedResourceId: undefined,
          linkType: undefined
        }))
      }));

      return {
        ...item,
        linkingId: undefined,
        linkingType: undefined,
        activities: unlinkedActivities
      };
    }));

    if (!targetId) setSelectedBOQItemIds(new Set());
    setNotification({ message: targetId ? 'Item unlinked.' : 'Items unlinked.', type: 'info' });
  }, [selectedBOQItemIds]);

  const toggleSort = (key: 'code' | 'description' | 'quantity' | 'unitRate' | 'totalBudget' | null) => {
    setBoqFilters(prev => ({
      ...prev,
      sortKey: key,
      sortOrder: prev.sortKey === key && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showErrorMessage = (message: string) => {
    setNotification({ message, type: 'error' });
  };

  const showSuccessMessage = (message: string) => {
    setNotification({ message, type: 'success' });
  };

  // Search/Filter states
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [librarySearchTerm, setLibrarySearchTerm] = useState('');
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<ResourceType | 'All'>('All');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState<ResourceType | 'All'>('All');
  const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedBoqId && selectedBoq) {
      setExpandedActivityIds(new Set((selectedBoq.activities || []).map(a => a.id)));
    }
  }, [selectedBoqId]);

  const expandAllActivities = () => {
    if (selectedBoq) {
      setExpandedActivityIds(new Set((selectedBoq.activities || []).map(a => a.id)));
    }
  };

  const collapseAllActivities = () => {
    setExpandedActivityIds(new Set());
  };

  const toggleActivityExpansion = (id: string) => {
    setExpandedActivityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [resourceClipboard, setResourceClipboard] = useState<{ resource: Resource, isLink: boolean, linkType?: 'price' | 'full' } | null>(null);
  const [editingBoqId, setEditingBoqId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ code: '', description: '', quantity: 0, unit: '', package: '' });

  // Undo/Redo Effect
  useEffect(() => {
    if (isUndoingRedoing.current) {
      isUndoingRedoing.current = false;
      return;
    }

    if (boqItems.length === 0) return;

    const timer = setTimeout(() => {
      setHistory(prev => {
        const last = prev[currentIndex];
        // Simplified check: if it's the exact same reference, don't push
        // In this app, setBoqItems usually creates new references for the array
        // but let's check if the content is different if we want to be precise.
        // For now, let's just push if they are not the same reference.
        if (last === boqItems) return prev;

        const nextHistory = prev.slice(0, currentIndex + 1);
        nextHistory.push(boqItems);
        if (nextHistory.length > 50) nextHistory.shift();
        
        // We set index after this return
        return nextHistory;
      });
      // We need to sync currentIndex.
      // Since setHistory is async, we should probably do this more carefully.
    }, 500);

    return () => clearTimeout(timer);
  }, [boqItems]);

  // Sync currentIndex when history changes and it's not an undo/redo
  useEffect(() => {
    if (!isUndoingRedoing.current && history.length > 0) {
      setCurrentIndex(history.length - 1);
    }
  }, [history]);

  const undo = React.useCallback(() => {
    if (currentIndex > 0) {
      isUndoingRedoing.current = true;
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setBoqItems(history[prevIndex]);
    }
  }, [currentIndex, history]);

  const redo = React.useCallback(() => {
    if (currentIndex < history.length - 1) {
      isUndoingRedoing.current = true;
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setBoqItems(history[nextIndex]);
    }
  }, [currentIndex, history]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSelectedResourceIds(new Set());
  }, [selectedBoqId]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (libraryImportMenuRef.current && !libraryImportMenuRef.current.contains(event.target as Node)) {
        setShowLibraryImportMenu(false);
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsMobileSidebarOpen(false);
        setIsSidebarCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

      if (json.length > 0) {
        const headers = Object.keys(json[0]);
        setImportHeaders(headers);
        setImportMappingData(json);
        
        const newMapping = { ...fieldMapping };
        let unitHeader = '';
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('code')) newMapping.itemCode = h;
          if (lower.includes('desc') || lower.includes('name')) newMapping.description = h;
          if (lower.includes('pack') || lower.includes('cat') || lower.includes('group')) newMapping.package = h;
          if (lower.includes('unit')) {
            newMapping.unit = h;
            unitHeader = h;
          }
          if (lower.includes('qty') || lower.includes('quant')) newMapping.quantity = h;
        });
        setFieldMapping(newMapping);
        
        // Extract unique units
        if (unitHeader) {
          const units = Array.from(new Set(json.map(row => String(row[unitHeader] || '').trim()).filter(Boolean)));
          setUniqueUnits(units);
          
          // Pre-populate mappings with normalization
          const initialMappings: Record<string, string> = {};
          units.forEach(u => {
            initialMappings[u] = normalizeUnit(u, STANDARD_UNITS);
          });
          setUnitMappings(initialMappings);
        } else {
          setUniqueUnits([]);
          setUnitMappings({});
        }
        
        setShowImportMapper(true);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const applyImportMapping = () => {
    if (!importMappingData) return;

    const newItems: BOQItem[] = importMappingData.map(row => {
      const originalUnit = String(row[fieldMapping.unit] || '').trim();
      const mappedUnit = unitMappings[originalUnit] || normalizeUnit(originalUnit, STANDARD_UNITS);
      
      return {
        id: crypto.randomUUID(),
        code: String(row[fieldMapping.itemCode] || ''),
        package: String(row[fieldMapping.package] || ''),
        description: String(row[fieldMapping.description] || 'New Item'),
        unit: mappedUnit,
        quantity: parseFloat(row[fieldMapping.quantity]) || 0,
        activities: [],
        totalBudget: 0,
        unitRate: 0
      };
    });

    setBoqItems(prev => [...prev, ...newItems]);
    setNotification({ message: `Successfully imported ${newItems.length} items`, type: 'success' });
    setShowImportMapper(false);
    setImportMappingData(null);
    setUnitMappings({});
    setUniqueUnits([]);
  };

  const handleImportResourceExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (json.length > 0) {
        const headers = Object.keys(json[0]);
        setResourceImportHeaders(headers);
        setResourceImportMappingData(json);
        
        const newMapping = { ...resourceFieldMapping };
        let unitHeader = '';
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('name')) newMapping.name = h;
          if (lower.includes('type')) newMapping.type = h;
          if (lower.includes('unit')) {
            newMapping.unit = h;
            unitHeader = h;
          }
          if (lower.includes('rate') || lower.includes('price')) newMapping.rate = h;
        });
        setResourceFieldMapping(newMapping);
        
        // Extract unique units
        if (unitHeader) {
          const units: string[] = Array.from(new Set(json.map(row => String(row[unitHeader] || '').trim()).filter(Boolean)));
          setUniqueResourceUnits(units);
          
          // Pre-populate mappings with normalization
          const initialMappings: Record<string, string> = {};
          units.forEach((u: string) => {
            initialMappings[u] = normalizeUnit(u, RESOURCE_UNITS);
          });
          setResourceUnitMappings(initialMappings);
        } else {
          setUniqueResourceUnits([]);
          setResourceUnitMappings({});
        }
        
        setShowResourceImportMapper(true);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const applyResourceImportMapping = () => {
    if (!resourceImportMappingData) return;

    const importedResources: LibraryResource[] = resourceImportMappingData.map(row => {
      const originalUnit = String(row[resourceFieldMapping.unit] || '').trim();
      const mappedUnit = resourceUnitMappings[originalUnit] || normalizeUnit(originalUnit, RESOURCE_UNITS);
      
      const typeVal = String(row[resourceFieldMapping.type] || 'Material').trim();
      let normalizedType: ResourceType = 'Material';
      if (typeVal.toLowerCase().includes('labor')) normalizedType = 'Labor';
      else if (typeVal.toLowerCase().includes('equipment')) normalizedType = 'Equipment';
      else if (typeVal.toLowerCase().includes('subcon')) normalizedType = 'Subcontractor';

      const resource: any = {
        id: crypto.randomUUID(),
        name: String(row[resourceFieldMapping.name] || 'Untitled Resource'),
        type: normalizedType,
        unit: mappedUnit,
        unitPrice: parseFloat(row[resourceFieldMapping.rate]) || 0,
        productivityUnit: (row.ProductivityUnit || row.productivityUnit || 'unit/day') as any,
        crewSize: row.CrewSize || row.crewSize || 1,
        conversionFactor: parseFloat(row.ConversionFactor || row.conversionFactor || 1)
      };

      if (row.Productivity || row.productivity) {
        resource.productivity = row.Productivity || row.productivity;
      }
      if (row.PurchaseUnit || row.purchaseUnit) {
        resource.purchaseUnit = row.PurchaseUnit || row.purchaseUnit;
      }

      return resource as LibraryResource;
    });

    const mergedLibrary = [...resourceLibrary];
    importedResources.forEach(newItem => {
      if (!mergedLibrary.find(r => r.name === newItem.name && r.type === newItem.type)) {
        mergedLibrary.push(newItem);
      }
    });

    setResourceLibrary(mergedLibrary);
    // storageService.saveResourcesBulk is no longer called globally
    
    setNotification({ message: `Imported ${importedResources.length} resources from Excel.`, type: 'success' });
    setShowResourceImportMapper(false);
    setResourceImportMappingData(null);
    setResourceUnitMappings({});
    setUniqueResourceUnits([]);
  };

  const resourceExcelInputRef = useRef<HTMLInputElement>(null);
  const projectJsonInputRef = useRef<HTMLInputElement>(null);

  const triggerResourceExcelImport = () => {
    resourceExcelInputRef.current?.click();
  };

  const triggerProjectJsonImport = () => {
    projectJsonInputRef.current?.click();
  };

  const handleExportProjectJSON = () => {
    saveCurrentToState(); // Queue state save
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) {
       setNotification({ message: "No active project to export", type: 'error' });
       return;
    }
    
    // Explicitly merge the current fields so the export has EVERYTHING fresh
    // since saveCurrentToState is async and projects array might not be updated yet.
    const freshProjectData = {
      ...project,
      boqItems,
      subcontractorOffers,
      qsTakeoffs,
      currency: currencyCode,
      country,
      resourceLibrary
    };
    
    const exportData = {
      version: "1.0",
      type: "PROJECT_EXPORT",
      data: freshProjectData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setNotification({ message: "Project exported successfully", type: 'success' });
    setShowExportMenu(false);
  };

  const handleImportProjectJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed.type !== "PROJECT_EXPORT" || !parsed.data) {
          throw new Error("Invalid project export format");
        }
        
        const project = parsed.data as Project;
        // Basic validation
        if (!project.name || !Array.isArray(project.boqItems)) {
           throw new Error("Invalid project data structure");
        }

        // Add as a new project
        const importedProject: Project = {
          ...project,
          id: crypto.randomUUID(),
          name: `${project.name} (Imported)`,
          updatedAt: new Date().toISOString()
        };

        setProjects(prev => [...prev, importedProject]);
        // Switch to it immediately
        setBoqItems(importedProject.boqItems);
        setQsTakeoffs(importedProject.qsTakeoffs || []);
        setSubcontractorOffers(importedProject.subcontractorOffers || []);
        setCurrencyCode(importedProject.currency || 'SAR');
        setCountry(importedProject.country || 'Saudi Arabia');
        setResourceLibrary(importedProject.resourceLibrary !== undefined ? importedProject.resourceLibrary : SEED_LIBRARY.map(r => ({ ...r, id: crypto.randomUUID(), category: 'Seed Data' })) as LibraryResource[]);
        setCurrentProjectId(importedProject.id);
        localStorage.setItem('last-active-project-id', importedProject.id);
        
        setNotification({ message: "Project imported successfully", type: 'success' });
      } catch (err: any) {
        setNotification({ message: `Import failed: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Helpers moved to helpers.ts

  const recalculateAllWithNewSettings = (newHours: number, newDays: number) => {
    setBoqItems(prev => prev.map(item => {
      const updatedActivities = (item.activities || []).map(act => {
        const updatedResources = (act.resources || []).map(res => {
          const { unitCost, totalQuantity } = calculateResourceMetrics(item.quantity, res, newHours, newDays, act.productivity, act.conversionRate);
          return { 
            ...res, 
            quantity: totalQuantity, 
            totalPrice: unitCost 
          };
        });
        const unitRate = updatedResources.reduce((s, r) => s + r.totalPrice, 0);
        const totalCost = unitRate * item.quantity;
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate
        };
      });
      return recalculateItemTotals({ 
        ...item, 
        activities: updatedActivities
      });
    }));
  };

  const handleWorkingHoursChange = (newHours: number) => {
    setWorkingHoursPerDay(newHours);
    recalculateAllWithNewSettings(newHours, workingDaysPerWeek);
  };

  const handleWorkingDaysChange = (newDays: number) => {
    setWorkingDaysPerWeek(newDays);
    recalculateAllWithNewSettings(workingHoursPerDay, newDays);
  };

  const currency = useMemo(() => 
    CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0],
    [currencyCode]
  );

  const formatPrice = (amount: number | undefined | null) => {
    return formatPriceHelper(amount, currency.symbol);
  };

  const addBoqItem = (afterId?: string) => {
    const newItem: BOQItem = {
      id: crypto.randomUUID(),
      code: '',
      description: 'New BOQ Item',
      unit: STANDARD_UNITS[0],
      quantity: 1,
      activities: [],
      totalBudget: 0,
      unitRate: 0
    };

    setBoqItems(prev => {
      if (!afterId) {
        newItem.code = `${prev.length + 1}.01`;
        return [...prev, newItem];
      }

      const targetIdx = prev.findIndex(item => item.id === afterId);
      if (targetIdx === -1) {
        newItem.code = `${prev.length + 1}.01`;
        return [...prev, newItem];
      }

      // Try to intelligently guess the code sequence from the target item
      const targetItem = prev[targetIdx];
      if (targetItem.code) {
        const parts = targetItem.code.split('.');
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart)) {
          parts[parts.length - 1] = String(lastPart + 1).padStart(2, '0');
          newItem.code = parts.join('.');
        } else {
          newItem.code = `${targetItem.code}a`;
        }
      } else {
        newItem.code = `${prev.length + 1}.01`;
      }

      // Preserve folder/package
      newItem.package = targetItem.package;

      const updated = [...prev];
      updated.splice(targetIdx + 1, 0, newItem);
      return updated;
    });

    setSelectedBoqId(newItem.id);
  };

  const handleMoveBoqItem = (draggedId: string, targetId: string) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    setBoqItems(prev => {
      const dragIndex = prev.findIndex(item => item.id === draggedId);
      const targetIndex = prev.findIndex(item => item.id === targetId);
      if (dragIndex === -1 || targetIndex === -1) return prev;

      const updated = [...prev];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(targetIndex, 0, removed);
      return updated;
    });
  };

  const addSubconOffer = (pkg: string) => {
    const newOffer: SubcontractorOffer = {
      id: crypto.randomUUID(),
      name: `New Subcontractor ${subcontractorOffers.length + 1}`,
      package: pkg,
      itemRates: {},
      isChosen: false
    };
    setSubcontractorOffers([...subcontractorOffers, newOffer]);
  };

  const addImportedSubconOffer = (pkg: string, name: string, itemRates: Record<string, number>) => {
    const newOffer: SubcontractorOffer = {
      id: crypto.randomUUID(),
      name,
      package: pkg,
      itemRates,
      isChosen: false
    };
    setSubcontractorOffers(prev => [...prev, newOffer]);
  };

  const updateSubconRate = (offerId: string, itemId: string, rate: number) => {
    setSubcontractorOffers(prev => prev.map(offer => {
      if (offer.id !== offerId) return offer;
      return {
        ...offer,
        itemRates: { ...offer.itemRates, [itemId]: rate }
      };
    }));
  };

  const updateSubconName = (offerId: string, name: string) => {
    setSubcontractorOffers(prev => prev.map(offer => {
      if (offer.id !== offerId) return offer;
      return { ...offer, name };
    }));
  };

  const chooseSubcon = (offerId: string) => {
    const chosenOffer = subcontractorOffers.find(o => o.id === offerId);
    if (!chosenOffer) return;

    // 1. Mark as chosen and unmark others in the same package
    setSubcontractorOffers(prev => prev.map(offer => {
      if (offer.package === chosenOffer.package) {
        return { ...offer, isChosen: offer.id === offerId };
      }
      return offer;
    }));

    // 2. Link rates to BOQ items directly
    setBoqItems(prevItems => prevItems.map(item => {
      if (item.package !== chosenOffer.package) return item;

      const itemsSelectedSubconRate = chosenOffer.itemRates[item.id];
      if (itemsSelectedSubconRate === undefined || itemsSelectedSubconRate === 0) return item;

      return {
        ...item,
        subcontractorRate: itemsSelectedSubconRate,
        rateSource: 'Subcontractor',
        unitRate: itemsSelectedSubconRate,
        totalBudget: itemsSelectedSubconRate * item.quantity
      };
    }));

    setNotification({ 
      message: `Successfully linked ${chosenOffer.name} rates for ${chosenOffer.package} package`, 
      type: 'success' 
    });
  };

  const deleteSubconOffer = (offerId: string) => {
    setSubcontractorOffers(prev => prev.filter(o => o.id !== offerId));
  };

  const updateMultipleBoqPackages = (ids: Set<string>, packageName: string) => {
    setBoqItems(prev => prev.map(item => {
      if (ids.has(item.id)) {
        return { ...item, package: packageName.trim() };
      }
      return item;
    }));
  };

  const updateBoqItem = (id: string, updates: Partial<BOQItem>) => {
    setBoqItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      let updated = { ...item, ...updates };
      
      if (updates.quantity !== undefined && updates.quantity !== item.quantity) {
        const newQty = updates.quantity;
        updated.activities = (updated.activities || []).map(act => {
          const updatedResources = (act.resources || []).map(res => {
            const { unitCost, totalQuantity } = calculateResourceMetrics(newQty, res, workingHoursPerDay, workingDaysPerWeek, act.productivity, act.conversionRate);
            return { ...res, quantity: totalQuantity, totalPrice: unitCost };
          });
          const unitRate = updatedResources.reduce((s, r) => s + r.totalPrice, 0);
          const totalCost = unitRate * newQty;
          return { 
            ...act, 
            resources: updatedResources, 
            totalCost,
            unitRate
          };
        });
      }
      
      return recalculateItemTotals(updated);
    }));
  };

   const toggleRateSource = (id: string, source: RateSource) => {
    // Determine linkingId
    const targetItem = boqItems.find(i => i.id === id);
    const linkingId = targetItem?.linkingId;

    setBoqItems(prev => prev.map(item => {
      const isTarget = item.id === id;
      const isLinked = linkingId && item.linkingId === linkingId;
      if (!isTarget && !isLinked) return item;

      return recalculateItemTotals({ ...item, rateSource: source });
    }));
  };

  const updateSubcontractorRate = (id: string, rate: number) => {
    // Determine linkingId
    const targetItem = boqItems.find(i => i.id === id);
    const linkingId = targetItem?.linkingId;

    setBoqItems(prev => prev.map(item => {
      const isTarget = item.id === id;
      const isLinked = linkingId && item.linkingId === linkingId;
      if (!isTarget && !isLinked) return item;

      return recalculateItemTotals({ ...item, subcontractorRate: rate });
    }));
  };

  const recalculateAllTotals = () => {
    setBoqItems(prev => prev.map(item => {
      const updatedActivities = (item.activities || []).map(act => {
        const updatedResources = (act.resources || []).map(res => {
          const { unitCost, totalQuantity } = calculateResourceMetrics(
            item.quantity, 
            res, 
            workingHoursPerDay, 
            workingDaysPerWeek, 
            act.productivity || 1, 
            act.conversionRate || 1
          );
          return { ...res, quantity: totalQuantity, totalPrice: unitCost };
        });
        const unitRate = updatedResources.reduce((s, r) => s + r.totalPrice, 0);
        const totalCost = unitRate * item.quantity;
        return { ...act, resources: updatedResources, unitRate, totalCost };
      });
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
    
    setNotification({ message: "All calculations recalculated and synchronized", type: 'info' });
  };

  const deleteBoqItem = (id: string) => {
    setBoqItems(prev => prev.filter(item => item.id !== id));
    if (selectedBoqId === id) setSelectedBoqId(null);
  };

  const addActivity = (boqId: string) => {
    // 1. Find if this BOQ item is linked to others
    const targetItem = boqItems.find(i => i.id === boqId);
    const linkingId = targetItem?.linkingId;
    const linkedActivityId = crypto.randomUUID().substring(0, 8);

    setBoqItems(prev => prev.map(item => {
      // If it's the target OR if it shares the same linkingId
      if (item.id !== boqId && (!linkingId || item.linkingId !== linkingId)) return item;
      
      const newActivity: Activity = {
        id: crypto.randomUUID(),
        boqId: item.id,
        name: 'New Activity',
        description: '',
        productivity: 1,
        resources: [],
        totalCost: 0,
        unitRate: 0,
        linkedActivityId: linkingId ? linkedActivityId : undefined,
        linkType: linkingId ? 'full' : undefined
      };
      return recalculateItemTotals({ ...item, activities: [...(item.activities || []), newActivity] });
    }));
  };

  const updateActivity = (boqId: string, activityId: string, updates: Partial<Activity>) => {
    // Determine the linked ID if it exists
    let effectiveLinkedId: string | undefined;
    for (const item of boqItems) {
      const act = (item.activities || []).find(a => a.id === activityId);
      if (act) {
        effectiveLinkedId = act.linkedActivityId || act.id;
        break;
      }
    }

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = (item.activities || []).map(act => {
        const isTarget = item.id === boqId && act.id === activityId;
        const isLinked = effectiveLinkedId && (act.linkedActivityId === effectiveLinkedId || act.id === effectiveLinkedId);

        if (!isTarget && !isLinked) return act;

        itemChanged = true;
        let updated = { ...act, ...updates };
        
        if (updates.productivity !== undefined || updates.conversionRate !== undefined) {
          updated.resources = (updated.resources || []).map(res => {
            const { unitCost, totalQuantity } = calculateResourceMetrics(item.quantity, res, workingHoursPerDay, workingDaysPerWeek, updated.productivity, updated.conversionRate);
            return { ...res, quantity: totalQuantity, totalPrice: unitCost };
          });
        }

        const unitRate = updated.resources.reduce((acc, res) => acc + res.totalPrice, 0);
        updated.unitRate = unitRate;
        updated.totalCost = unitRate * item.quantity;
        return updated;
      });
      
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
  };

  const processAiEstimationForItem = async (boqItem: BOQItem): Promise<Activity[] | null> => {
    try {
      // 1. Get simplified library for context (limit to 100 items to avoid prompt bloat)
      const libraryContext = resourceLibrary.slice(0, 100).map(r => ({
        name: r.name,
        type: r.type,
        unit: r.unit,
        unitPrice: r.unitPrice
      }));

      const allBoqItemsSummary = boqItems
        .map(item => `- ${item.code ? `[${item.code}] ` : ''}${item.description} (Qty: ${item.quantity} ${item.unit})`)
        .join('\n');

      const result = await estimateItemBreakdown(
        boqItem.description, 
        boqItem.unit, 
        country, 
        currencyCode,
        libraryContext,
        aiConsiderIndirectCost,
        scopeOfWork,
        allBoqItemsSummary
      );
      
      if (result.activities && Array.isArray(result.activities)) {
        const newLibraryItems: LibraryResource[] = [];
        
        const mappedActivities = result.activities.map((aiAct: any) => {
          const actId = crypto.randomUUID().substring(0, 8);
          const productivity = aiAct.productivity || 1;
          const conversionRate = aiAct.conversionRate || 1;
          
          const resources: Resource[] = (aiAct.resources || []).map((aiRes: any) => {
            // Check if resource exists in library (exact name or case-insensitive match)
            const existingInLibrary = resourceLibrary.find(r => 
               r.name.toLowerCase() === aiRes.name.toLowerCase() && 
               r.type === aiRes.type
            );

            let resId: string;
            let finalName = aiRes.name;
            let finalUnitPrice = aiRes.unitPrice || 0;
            let finalUnit = (aiRes.type === 'Labor' || aiRes.type === 'Equipment') ? 'hr' : aiRes.unit;

            if (existingInLibrary) {
              resId = existingInLibrary.id;
              finalName = existingInLibrary.name;
              finalUnitPrice = existingInLibrary.unitPrice;
              finalUnit = existingInLibrary.unit;
            } else {
              // Not in library, check if we already added it in this run
              const alreadyAdded = newLibraryItems.find(r => 
                r.name.toLowerCase() === aiRes.name.toLowerCase() && 
                r.type === aiRes.type
              );
              
              if (alreadyAdded) {
                resId = alreadyAdded.id;
              } else {
                // Truly new item - add it to local list to be batched later
                resId = crypto.randomUUID().substring(0, 8);
                newLibraryItems.push({
                  id: resId,
                  name: aiRes.name,
                  type: aiRes.type as ResourceType,
                  unit: finalUnit,
                  unitPrice: finalUnitPrice,
                  category: 'AI Generated'
                });
              }
            }

            const baseResource = {
              id: crypto.randomUUID(),
              linkedResourceId: resId,
              linkType: 'price' as const,
              name: finalName,
              type: aiRes.type,
              unit: finalUnit,
              unitPrice: finalUnitPrice,
              quantity: 0,
              totalPrice: 0,
              category: existingInLibrary?.category || 'AI Generated',
              resourceCount: aiRes.resourceCount || 1,
              consumption: aiRes.consumption || 1,
              wastePercentage: aiRes.wastePercentage || 0,
              usages: aiRes.usages || 1
            };
            
            const metrics = calculateResourceMetrics(
              boqItem.quantity, 
              baseResource as any, 
              workingHoursPerDay, 
              workingDaysPerWeek, 
              productivity,
              conversionRate
            );
            
            return {
              ...baseResource,
              quantity: metrics.totalQuantity,
              totalPrice: metrics.unitCost
            } as Resource;
          });
          
          const actUnitRate = resources.reduce((acc, r) => acc + r.totalPrice, 0);
          
          return {
            id: actId,
            boqId: boqItem.id,
            name: aiAct.name,
            unit: aiAct.unit,
            conversionRate: conversionRate,
            description: "",
            resources,
            totalCost: actUnitRate * boqItem.quantity,
            unitRate: actUnitRate,
            productivity
          } as Activity;
        });

        // Batch update library if new items were found
        if (newLibraryItems.length > 0) {
          setResourceLibrary(prev => [...prev, ...newLibraryItems]);
          setNotification?.({ message: `Added ${newLibraryItems.length} new resources to library`, type: 'info' });
        }

        return mappedActivities;
      }
      return null;
    } catch (error: any) {
      console.error("AI Estimation Error:", error);
      // Propagate the specific error for rate limits
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        throw new Error("QUOTA_EXCEEDED");
      }
      setNotification?.({ message: `AI Estimation failed: ${error.message}`, type: 'error' });
      return null;
    }
  };

  const handleAiEstimation = async (boqItem: BOQItem) => {
    if (isAiEstimating) return;
    
    stopAiRef.current = false;
    setIsAiEstimating(true);
    try {
      const newActivities = await processAiEstimationForItem(boqItem);
      
      if (stopAiRef.current) {
        setNotification({ message: "AI estimation stopped.", type: 'info' });
        return;
      }

      if (newActivities) {
        setBoqItems(prev => {
          const targetItem = prev.find(i => i.id === boqItem.id);
          const linkingId = targetItem?.linkingId;

          return prev.map(item => {
            const isTarget = item.id === boqItem.id;
            const isLinked = linkingId && item.linkingId === linkingId;
            
            if (!isTarget && !isLinked) return item;

            // If it's a linked item (but not the target), we need to create clones of activities 
            // with different IDs but the same linked IDs.
            const activitiesToApply = isTarget ? newActivities : newActivities.map(act => ({
              ...act,
              id: crypto.randomUUID(),
              boqId: item.id,
              linkedActivityId: act.linkedActivityId || act.id,
              resources: (act.resources || []).map(res => ({
                ...res,
                id: crypto.randomUUID(),
                linkedResourceId: res.linkedResourceId || res.id
              }))
            }));

            const updatedActivities = [...(item.activities || []), ...activitiesToApply];
            return recalculateItemTotals({ ...item, activities: updatedActivities });
          });
        });
        
        setNotification({ message: `AI estimation complete! Added ${newActivities.length} activities.`, type: 'success' });
      } else {
        setNotification({ message: "Failed to generate AI estimation. The AI returned an invalid format.", type: 'error' });
      }
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setNotification({ message: "AI Quota exceeded. Please wait a moment before trying again.", type: 'error' });
      } else {
        setNotification({ message: "Failed to generate AI estimation. Please check your connection.", type: 'error' });
      }
    } finally {
      setIsAiEstimating(false);
    }
  };

  const handleBulkAiEstimation = async () => {
    if (isAiEstimating || selectedBOQItemIds.size === 0) return;
    
    stopAiRef.current = false;
    setIsAiEstimating(true);
    let successCount = 0;
    const itemsToEstimate = boqItems.filter(item => selectedBOQItemIds.has(item.id));
    const processedLinkingIds = new Set<string>();
    
    try {
      for (let i = 0; i < itemsToEstimate.length; i++) {
        const item = itemsToEstimate[i];

        // Skip if this item's linked group has already been processed in this bulk run
        if (item.linkingId && processedLinkingIds.has(item.linkingId)) {
          continue;
        }

        if (stopAiRef.current) {
          setNotification({ message: `Bulk estimation stopped. Processed ${successCount}/${itemsToEstimate.length} items.`, type: 'info' });
          break;
        }
        setNotification({ message: `Estimating item ${i + 1}/${itemsToEstimate.length}: ${item.description.slice(0, 30)}...`, type: 'success' });
        
        try {
          const newActivities = await processAiEstimationForItem(item);
          
          if (newActivities) {
            successCount++;
            setBoqItems(prev => {
              const targetItem = prev.find(i => i.id === item.id);
              const linkingId = targetItem?.linkingId;

              return prev.map(pItem => {
                const isTarget = pItem.id === item.id;
                const isLinked = linkingId && pItem.linkingId === linkingId;
                
                if (!isTarget && !isLinked) return pItem;

                const activitiesToApply = isTarget ? newActivities : newActivities.map(act => ({
                  ...act,
                  id: crypto.randomUUID(),
                  boqId: pItem.id,
                  linkedActivityId: act.linkedActivityId || act.id,
                  resources: (act.resources || []).map(res => ({
                    ...res,
                    id: crypto.randomUUID(),
                    linkedResourceId: res.linkedResourceId || res.id
                  }))
                }));

                const updatedActivities = [...(pItem.activities || []), ...activitiesToApply];
                return recalculateItemTotals({ ...pItem, activities: updatedActivities });
              });
            });

            if (item.linkingId) {
              processedLinkingIds.add(item.linkingId);
            }
          }
          
          // Add a small delay between items in bulk mode to avoid hitting rate limits too aggressively
          if (i < itemsToEstimate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        } catch (error: any) {
          if (error.message === "QUOTA_EXCEEDED") {
            setNotification({ message: "Quota reached during bulk operation. Skipping remaining items.", type: 'error' });
            break; // Stop bulk if quota is hit
          }
          console.error(`Failed to estimate ${item.id}:`, error);
        }
      }
      setNotification({ message: `Bulk AI estimation complete! Processed ${successCount}/${itemsToEstimate.length} items.`, type: 'success' });
      setSelectedBOQItemIds(new Set());
    } catch (error) {
      console.error(error);
      setNotification({ message: "An error occurred during bulk estimation.", type: 'error' });
    } finally {
      setIsAiEstimating(false);
    }
  };

  const saveCurrentToState = () => {
    if (!currentProjectId) return;
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id === currentProjectId) {
          return {
            ...p,
            boqItems,
            subcontractorOffers,
            qsTakeoffs,
            currency: currencyCode,
            country,
            scopeOfWork,
            updatedAt: new Date().toISOString(),
            resourceLibrary
          };
        }
        return p;
      });
      return updated;
    });
  };

  const loadProject = (id: string) => {
    let latestProjects = projects;
    // Save current state first to temporary variable to ensure we don't load stale data
    if (currentProjectId) {
      latestProjects = projects.map(p => {
        if (p.id === currentProjectId) {
          return {
            ...p,
            boqItems,
            subcontractorOffers,
            qsTakeoffs,
            currency: currencyCode,
            country,
            scopeOfWork,
            updatedAt: new Date().toISOString(),
            resourceLibrary
          };
        }
        return p;
      });
      setProjects(latestProjects);
    }
    
    const project = latestProjects.find(p => p.id === id);
    if (project) {
      setBoqItems(project.boqItems || []);
      setQsTakeoffs(project.qsTakeoffs || []);
      setSubcontractorOffers(project.subcontractorOffers || []);
      setCurrencyCode(project.currency || 'SAR');
      setCountry(project.country || 'Saudi Arabia');
      setScopeOfWork(project.scopeOfWork || '');
      setResourceLibrary(project.resourceLibrary !== undefined ? project.resourceLibrary : SEED_LIBRARY.map(r => ({ ...r, id: crypto.randomUUID(), category: 'Seed Data' })) as LibraryResource[]);
      setCurrentProjectId(id);
      setSelectedBOQItemIds(new Set());
      setSelectedResourceIds(new Set());
      localStorage.setItem('last-active-project-id', id);
      setNotification({ message: `Loaded project: ${project.name}`, type: 'success' });
    }
  };

  const createNewProject = (name: string = 'Untitled Project') => {
    // Save current state first
    if (currentProjectId) {
      saveCurrentToState();
    }

    const defaultLibrary = SEED_LIBRARY.map(r => ({ ...r, id: crypto.randomUUID(), category: 'Seed Data' })) as LibraryResource[];
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      scopeOfWork: '',
      boqItems: [],
      subcontractorOffers: [],
      qsTakeoffs: [],
      currency: 'SAR',
      country: 'Saudi Arabia',
      updatedAt: new Date().toISOString(),
      resourceLibrary: defaultLibrary
    };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    setBoqItems([]);
    setQsTakeoffs([]);
    setSubcontractorOffers([]);
    setResourceLibrary(defaultLibrary);
    setSelectedBOQItemIds(new Set());
    setSelectedResourceIds(new Set());
    setCurrencyCode('SAR');
    setCountry('Saudi Arabia');
    setScopeOfWork('');
    localStorage.setItem('last-active-project-id', newProject.id);
    setNotification({ message: "New project created", type: 'success' });
  };

  const renameProject = (id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    if (user && isCloudSyncEnabled) {
      const p = projects.find(proj => proj.id === id);
      if (p) storageService.saveProject(user.uid, { ...p, name: newName });
    }
    setNotification({ message: "Project renamed", type: 'success' });
  };

  const deleteProject = (id: string) => {
    const updatedProjects = projects.filter(p => p.id !== id);
    setProjects(updatedProjects);
    if (user && isCloudSyncEnabled) storageService.deleteProject(user.uid, id);
    
    if (currentProjectId === id) {
      if (updatedProjects.length > 0) {
        const firstProject = updatedProjects[0];
        setBoqItems(firstProject.boqItems || []);
        setSubcontractorOffers(firstProject.subcontractorOffers || []);
        setCurrencyCode(firstProject.currency || 'SAR');
        setCountry(firstProject.country || 'Saudi Arabia');
        setScopeOfWork(firstProject.scopeOfWork || '');
        setResourceLibrary(firstProject.resourceLibrary !== undefined ? firstProject.resourceLibrary : SEED_LIBRARY.map(r => ({ ...r, id: crypto.randomUUID(), category: 'Seed Data' })) as LibraryResource[]);
        setCurrentProjectId(firstProject.id);
        localStorage.setItem('last-active-project-id', firstProject.id);
      } else {
        setCurrentProjectId(null);
        setBoqItems([]);
        setSubcontractorOffers([]);
        setResourceLibrary(SEED_LIBRARY.map(r => ({ ...r, id: crypto.randomUUID(), category: 'Seed Data' })) as LibraryResource[]);
        setScopeOfWork('');
        localStorage.removeItem('last-active-project-id');
      }
    }
    setNotification({ message: "Project deleted", type: 'success' });
  };

  const [hasQuotaExceeded, setHasQuotaExceeded] = useState(false);

  const saveToLocal = useCallback(() => {
    if (!currentProjectId) return;
    
    setProjects(prev => prev.map(p => p.id === currentProjectId ? {
      ...p,
      boqItems,
      subcontractorOffers,
      qsTakeoffs,
      currency: currencyCode,
      country,
      scopeOfWork,
      updatedAt: new Date().toISOString(),
      resourceLibrary
    } : p));
  }, [currentProjectId, boqItems, subcontractorOffers, qsTakeoffs, currencyCode, country, scopeOfWork, resourceLibrary]);

  const saveToCloud = useCallback(async () => {
    if (!currentProjectId || !user || hasQuotaExceeded || !isCloudSyncEnabled) return;
    
    setIsSyncing(true);
    try {
      const project = projects.find(p => p.id === currentProjectId);
      if (!project) return;

      const updatedProject: Project = {
        ...project,
        boqItems,
        subcontractorOffers,
        qsTakeoffs,
        currency: currencyCode,
        country,
        scopeOfWork,
        updatedAt: new Date().toISOString(),
        resourceLibrary
      };

      await storageService.saveProject(user.uid, updatedProject);
      setHasUnsavedChanges(false);
    } catch (e: any) {
      if (e && typeof e.message === 'string' && (e.message.includes('resource-exhausted') || e.message.includes('Quota limit exceeded'))) {
        setHasQuotaExceeded(true);
        setNotification({ message: 'Cloud save disabled: Firebase quota limit exceeded for today.', type: 'error' });
      } else {
        console.error("Save to cloud failed:", e);
        setNotification({ message: 'Failed to sync with cloud. Check your connection.', type: 'error' });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [currentProjectId, projects, boqItems, subcontractorOffers, qsTakeoffs, currencyCode, country, scopeOfWork, user, resourceLibrary, hasQuotaExceeded, isCloudSyncEnabled]);

  const saveCurrentProject = useCallback(async () => {
    saveToLocal();
    if (isCloudAutoSyncEnabled) {
      await saveToCloud();
    }
  }, [saveToLocal, saveToCloud, isCloudAutoSyncEnabled]);

  // Update projects in localStorage
  useEffect(() => {
    localStorage.setItem('cost-estimation-projects', JSON.stringify(projects));
  }, [projects]);

  // Mandatory Debounced Local Save
  useEffect(() => {
    if (!initialized.current || isDataLoading || !currentProjectId) return;
    
    const timer = setTimeout(() => {
      saveToLocal();
    }, 2000); // 2 seconds debounce for local storage

    return () => clearTimeout(timer);
  }, [boqItems, qsTakeoffs, subcontractorOffers, currencyCode, country, scopeOfWork, resourceLibrary, saveToLocal, isDataLoading]);

  // Track unsaved changes for Cloud sync
  useEffect(() => {
    if (!initialized.current || isDataLoading) return;
    setHasUnsavedChanges(true);
  }, [boqItems, qsTakeoffs, subcontractorOffers, currencyCode, country, scopeOfWork, resourceLibrary]);

  // Persistent Settings
  useEffect(() => {
    localStorage.setItem('cost-engine-cloud-sync', String(isCloudSyncEnabled));
  }, [isCloudSyncEnabled]);

  useEffect(() => {
    localStorage.setItem('cost-engine-cloud-auto-sync', String(isCloudAutoSyncEnabled));
  }, [isCloudAutoSyncEnabled]);

  // Critical Save on Exit/Logout
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle Offline Status
  useEffect(() => {
    const handleOffline = () => {
      if (hasUnsavedChanges) {
        setNotification({ 
          message: 'System is now offline. Cloud sync is disabled, but your work is saved locally.', 
          type: 'warning' 
        });
      }
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [hasUnsavedChanges]);

  // Initial project creation if none exists
  useEffect(() => {
    if (initialized.current || isAuthLoading || isDataLoading) return;
    
    if (projects.length === 0) {
      initialized.current = true;
      createNewProject('Default Project');
    } else if (currentProjectId) {
      const p = projects.find(proj => proj.id === currentProjectId);
      if (p) {
        setBoqItems(p.boqItems || []);
        setQsTakeoffs(p.qsTakeoffs || []);
        setSubcontractorOffers(p.subcontractorOffers || []);
        setCurrencyCode(p.currency || 'SAR');
        setCountry(p.country || 'Saudi Arabia');
        initialized.current = true;
      } else if (projects.length > 0) {
        loadProject(projects[0].id);
        initialized.current = true;
      }
    } else if (projects.length > 0) {
      loadProject(projects[0].id);
      initialized.current = true;
    }
  }, [projects.length, currentProjectId, isAuthLoading, isDataLoading]);

  // Auto-sync to Cloud effect
  useEffect(() => {
    if (isAuthLoading || isDataLoading || !initialized.current || hasQuotaExceeded || !isCloudAutoSyncEnabled || !hasUnsavedChanges || !user) return;
    
    const timer = setTimeout(() => {
      saveToCloud();
    }, 60000); // 60s for cloud sync
    return () => clearTimeout(timer);
  }, [saveToCloud, isAuthLoading, isDataLoading, hasQuotaExceeded, isCloudAutoSyncEnabled, hasUnsavedChanges, user]);

  // Library and Template Persistence
  const updateResourceLibraryItem = async (resource: LibraryResource) => {
    // Intentionally empty since resourceLibrary is now tied to Project and auto-saved
  };

  const deleteResourceLibraryItem = async (id: string) => {
    // Intentionally empty since resourceLibrary is now tied to Project and auto-saved
  };

  const updateActivityTemplateItem = async (template: ActivityTemplate) => {
    if (user && isCloudSyncEnabled) await storageService.saveActivityTemplate(user.uid, template);
  };

  const deleteActivityTemplateItem = async (id: string) => {
    if (user && isCloudSyncEnabled) await storageService.deleteActivityTemplate(user.uid, id);
  };

  // Sync library and templates to localStorage as backup
  useEffect(() => {
    localStorage.setItem('resource_library', JSON.stringify(resourceLibrary));
  }, [resourceLibrary]);

  useEffect(() => {
    localStorage.setItem('activity_templates', JSON.stringify(activityTemplates));
  }, [activityTemplates]);

  const deleteActivity = (boqId: string, activityId: string) => {
    // 1. Find the linked activity ID
    let effectiveLinkedId: string | undefined;
    for (const item of boqItems) {
      const act = (item.activities || []).find(a => a.id === activityId);
      if (act) {
        effectiveLinkedId = act.linkedActivityId || act.id;
        break;
      }
    }

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = (item.activities || []).filter(act => {
        const isTarget = item.id === boqId && act.id === activityId;
        const isLinked = effectiveLinkedId && (act.linkedActivityId === effectiveLinkedId || act.id === effectiveLinkedId);
        
        if (isTarget || isLinked) {
          itemChanged = true;
          return false;
        }
        return true;
      });
      
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
  };

  const saveActivityAsTemplate = (activity: Activity) => {
    const template: ActivityTemplate = {
      id: crypto.randomUUID(),
      name: activity.name,
      description: activity.description,
      unit: activity.unit,
      conversionRate: activity.conversionRate,
      productivity: activity.productivity,
      resources: activity.resources.map(r => {
        const { id, ...rest } = r;
        return rest;
      })
    };
    setActivityTemplates(prev => [...prev, template]);
    if (user) updateActivityTemplateItem(template);
    showSuccessMessage(`Saved "${activity.name}" as template`);
  };

  const deleteActivityTemplate = (id: string) => {
    setActivityTemplates(prev => prev.filter(t => t.id !== id));
    if (user) deleteActivityTemplateItem(id);
  };

  const clearAllActivityTemplates = () => {
    const templatesToRemove = [...activityTemplates];
    setActivityTemplates([]);
    if (user) {
       templatesToRemove.forEach(t => deleteActivityTemplateItem(t.id));
    }
    setShowClearTemplatesConfirm(false);
    showSuccessMessage("Cleared all activity templates");
  };

  const applyActivityTemplate = (boqId: string, template: ActivityTemplate) => {
    setBoqItems(prev => prev.map(item => {
      if (item.id !== boqId) return item;
      
      const newActivity: Activity = {
        id: crypto.randomUUID(),
        boqId,
        name: template.name,
        description: template.description || '',
        productivity: template.productivity || 1,
        unit: template.unit,
        conversionRate: template.conversionRate || 1,
        resources: template.resources.map(r => ({
          ...r,
          id: crypto.randomUUID()
        })),
        totalCost: 0,
        unitRate: 0
      };

      // Recalculate metrics
      newActivity.resources = newActivity.resources.map(res => {
        const { unitCost, totalQuantity } = calculateResourceMetrics(item.quantity, res as any, workingHoursPerDay, workingDaysPerWeek, newActivity.productivity, newActivity.conversionRate);
        return {
          ...res,
          id: (res as any).id, 
          quantity: totalQuantity,
          totalPrice: unitCost
        } as Resource;
      });

      const actUnitRate = newActivity.resources.reduce((acc, r) => acc + r.totalPrice, 0);
      newActivity.unitRate = actUnitRate;
      newActivity.totalCost = actUnitRate * item.quantity;

      const updatedActivities = [...item.activities, newActivity];
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
    showSuccessMessage(`Applied template "${template.name}"`);
    setShowTemplatePicker(null);
  };

  const importActivityTemplatesFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          showErrorMessage("Spreadsheet is empty");
          return;
        }

        // Group by Activity Name
        const templatesMap: Record<string, any[]> = {};
        
        data.forEach(row => {
          const activityName = row['Activity'] || row['activity'] || 'Unnamed Activity';
          if (!templatesMap[activityName]) templatesMap[activityName] = [];
          templatesMap[activityName].push(row);
        });

        const newTemplates: ActivityTemplate[] = Object.entries(templatesMap).map(([name, rows]) => {
          return {
            id: crypto.randomUUID(),
            name,
            description: rows[0]['Activity UOM'] ? `UOM: ${rows[0]['Activity UOM']}` : 'Imported from Excel',
            unit: rows[0]['Activity UOM'] || rows[0]['unit'] || '',
            conversionRate: Number(rows[0]['Conversion Rate'] || rows[0]['conversionRate'] || 1),
            productivity: Number(rows[0]['Productivity'] || rows[0]['productivity'] || 1), 
            resources: rows.map(row => {
              // Map resource types correctly
              let type: ResourceType = 'Material';
              const rawType = String(row['Type'] || row['type'] || '').toLowerCase();
              if (rawType.includes('labor')) type = 'Labor';
              else if (rawType.includes('equipment')) type = 'Equipment';
              else if (rawType.includes('sub')) type = 'Subcontractor';

              return {
                name: row['Expindutre'] || row['Expenditure'] || row['resource'] || 'Unnamed Resource',
                type,
                unit: row['Expindutre UOM'] || row['Expenditure UOM'] || row['unit'] || 'each',
                unitPrice: Number(row['Rate'] || row['rate'] || row['Price'] || row['price'] || 0),
                resourceCount: Number(row['Count'] || row['count'] || 1),
                consumption: Number(row['Consumption'] || row['consumption'] || 1),
                wastePercentage: Number(row['Losses(%)'] || row['losses'] || 0),
                usages: Number(row['No. of Usage'] || row['usage'] || 1),
                quantity: 1, 
                totalPrice: 0 
              } as Omit<Resource, 'id'>;
            })
          };
        });

        setActivityTemplates(prev => [...prev, ...newTemplates]);
        showSuccessMessage(`Successfully imported ${newTemplates.length} activity templates`);
      } catch (err) {
        console.error("Excel Import Error:", err);
        showErrorMessage("Failed to parse Excel file. Ensure it matches the required format.");
      }
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const resolveConflict = (action: 'overwrite' | 'merge' | 'cancel') => {
    if (!pendingConflict) return;
    const { resource, mode, targetIds, existingResource } = pendingConflict;

    if (action === 'cancel') {
      setPendingConflict(null);
      return;
    }

    if (mode === 'library') {
      if (action === 'overwrite') {
        setResourceLibrary(prev => prev.map(r => 
          (r.name === resource.name && r.type === resource.type) ? resource : r
        ));
      } else if (action === 'merge') {
        const merged = { ...existingResource, ...resource };
        setResourceLibrary(prev => prev.map(r => 
          (r.name === resource.name && r.type === resource.type) ? merged : r
        ));
      }
    } else if (mode === 'activity') {
      if (targetIds) {
        setBoqItems(prev => prev.map(item => {
          if (item.id !== targetIds.boqId) return item;
          return {
            ...item,
            activities: item.activities.map(act => {
              if (act.id !== targetIds.activityId) return act;
              
              const updatedResources = act.resources.map(r => {
                if (r.name === resource.name && r.type === resource.type) {
                  const baseResource = action === 'overwrite' ? resource : { ...r, ...resource };
                  // We must preserve activity-specific fields
                  const merged = { ...r, ...baseResource };
                  
                  // Recalculate metrics
                  const { unitCost, totalQuantity } = calculateResourceMetrics(item.quantity, merged, workingHoursPerDay, workingDaysPerWeek, act.productivity, act.conversionRate);
                  return { ...merged, quantity: totalQuantity, totalPrice: unitCost };
                }
                return r;
              });
              
              const unitRate = updatedResources.reduce((s, r) => s + r.totalPrice, 0);
              const totalCost = unitRate * item.quantity;
              const updatedAct = { ...act, resources: updatedResources, totalCost, unitRate };
              
              const allActivities = item.activities.map(a => a.id === updatedAct.id ? updatedAct : a);
              return recalculateItemTotals({ ...item, activities: allActivities });
            })
          };
        }));
      }
    }
    setPendingConflict(null);
  };

  const addResource = (boqId: string, activityId: string, type: ResourceType, libraryRes: LibraryResource) => {
    const targetBoq = boqItems.find(i => i.id === boqId);
    const targetAct = (targetBoq?.activities || []).find(a => a.id === activityId);
    if (!libraryRes) return;
    
    const resourceName = libraryRes.name;
    const existing = (targetAct?.resources || []).find(r => r.name === resourceName && r.type === type);
    
    if (existing) {
      setPendingConflict({
        resource: { ...libraryRes },
        mode: 'activity',
        targetIds: { boqId, activityId },
        existingResource: existing
      });
      return;
    }

    // Determine effective linked activity ID
    let effectiveLinkedId: string | undefined = targetAct?.linkedActivityId || targetAct?.id;

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = (item.activities || []).map(act => {
        const isTarget = item.id === boqId && act.id === activityId;
        const isLinked = effectiveLinkedId && (act.linkedActivityId === effectiveLinkedId || act.id === effectiveLinkedId);
        
        if (!isTarget && !isLinked) return act;
        
        // Skip if resource already exists in this instance
        if ((act.resources || []).some(r => r.name === libraryRes.name && r.type === libraryRes.type)) return act;

        itemChanged = true;
        const newResource: Resource = {
          ...libraryRes,
          id: crypto.randomUUID(),
          linkedResourceId: libraryRes.id,
          linkType: 'price',
          unit: (libraryRes.type === 'Labor' || libraryRes.type === 'Equipment') ? 'hr' : libraryRes.unit,
          quantity: 1,
          totalPrice: 0,
        };
        const { unitCost, totalQuantity } = calculateResourceMetrics(item.quantity, newResource, workingHoursPerDay, workingDaysPerWeek, act.productivity, act.conversionRate);
        newResource.quantity = totalQuantity;
        newResource.totalPrice = unitCost;

        const updatedResources = [...act.resources, newResource];
        const unitRate = updatedResources.reduce((s, r) => s + r.totalPrice, 0);
        const totalCost = unitRate * item.quantity;
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate
        };
      });
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
  };

  const addToLibrary = (resource: Resource) => {
    const { id: _, quantity, totalPrice, ...libraryData } = resource;
    const exists = resourceLibrary.find(r => r.name === libraryData.name && r.type === libraryData.type);
    if (exists) {
      setPendingConflict({
        resource: { ...libraryData, id: exists.id } as LibraryResource,
        mode: 'library',
        existingResource: exists
      });
      return;
    }
    const newLibraryItem: LibraryResource = {
      ...libraryData,
      id: crypto.randomUUID(),
      category: 'General'
    };
    setResourceLibrary(prev => [...prev, newLibraryItem]);
    setNotification({ message: `"${resource.name}" added to library`, type: 'success' });
  };

  const deleteFromLibrary = (name: string, type: ResourceType) => {
    setResourceLibrary(prev => prev.filter(r => !(r.name === name && r.type === type)));
    setNotification({ message: "Removed from library", type: 'success' });
  };

  const handleAddResourceClick = (e: React.MouseEvent, boqId: string, activityId: string, type: ResourceType) => {
    e.stopPropagation();
    setLibraryTypeFilter(type);
    setShowLibrary(true);
    setNotification({ message: `Select ${type} from library to assign it. New resources must be added to library first.`, type: 'info' });
  };

  const updateResource = (boqId: string, activityId: string, resId: string, updates: Partial<Resource>) => {
    // 1. Find the target resource across ALL items first to determine the effectiveLinkedId
    let effectiveLinkedId: string | undefined;
    let targetResource: Resource | undefined;
    
    for (const item of boqItems) {
      for (const act of (item.activities || [])) {
        const r = (act.resources || []).find(res => res.id === resId);
        if (r) {
          targetResource = r;
          effectiveLinkedId = r.linkedResourceId || r.id;
          break;
        }
      }
      if (effectiveLinkedId) break;
    }

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = (item.activities || []).map(act => {
        let actChanged = false;
        const updatedResources = (act.resources || []).map(res => {
          const isTarget = item.id === boqId && act.id === activityId && res.id === resId;
          
          // A resource is linked if it shares the same linkedResourceId, 
          // OR if its ID is the linkedResourceId, OR if its linkedResourceId matches the target's ID
          const isLinked = effectiveLinkedId && (
            res.linkedResourceId === effectiveLinkedId || 
            res.id === effectiveLinkedId
          );
          
          if (!isTarget && !isLinked) return res;

          let effectiveUpdates = { ...updates };
          
          // 2. STRICTOR FILTERING for linked non-target resources
          if (isLinked && !isTarget) {
            // Fields that must be kept LOCAL to each activity/resource instance
            const localizedFields = [
              'consumption', 
              'wastePercentage', 
              'usages', 
              'crewSize', 
              'resourceCount', 
              'quantity', 
              'id', 
              'totalPrice',
              'category'
            ];

            // If it's a price-only link (default), we only sync specific financial fields
            if (res.linkType !== 'full') {
              const sharableFields = ['unitPrice', 'purchaseUnit', 'conversionFactor', 'unit'];
              effectiveUpdates = Object.fromEntries(
                Object.entries(updates).filter(([key]) => 
                  sharableFields.includes(key) && !localizedFields.includes(key)
                )
              );
            } else {
              // Even for 'full' links, we might want to protect some fields, but 'full' usually means everything.
              // Still, we prevent syncing ID or quantity directly as they are derived.
              effectiveUpdates = Object.fromEntries(
                Object.entries(updates).filter(([key]) => !localizedFields.includes(key))
              );
            }
          }

          if (Object.keys(effectiveUpdates).length === 0 && !isTarget) return res;

          actChanged = true;
          itemChanged = true;
          const updatedResource = { ...res, ...effectiveUpdates };
          
          const { unitCost, totalQuantity } = calculateResourceMetrics(
            item.quantity, 
            updatedResource, 
            workingHoursPerDay, 
            workingDaysPerWeek, 
            act.productivity, 
            act.conversionRate
          );
          
          return {
            ...updatedResource,
            quantity: totalQuantity,
            totalPrice: unitCost
          };
        });
        
        if (!actChanged) return act;
        const unitRate = updatedResources.reduce((acc, r) => acc + r.totalPrice, 0);
        const totalCost = unitRate * item.quantity;
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate
        };
      });
      
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
  };

  const copyResource = (resource: Resource, asLink: boolean, linkType?: 'price' | 'full') => {
    setResourceClipboard({ resource, isLink: asLink, linkType });
  };

  const pasteResource = (boqId: string, activityId: string) => {
    if (!resourceClipboard) return;
    const { resource, isLink, linkType } = resourceClipboard;
    
    setBoqItems(prev => prev.map(item => {
      if (item.id !== boqId) return item;

      // If linking, we need to ensure the source and target share a linkedResourceId
      let updatedResource = { ...resource, id: crypto.randomUUID(), linkType };
      
      if (isLink) {
        const linkedId = resource.linkedResourceId || crypto.randomUUID();
        updatedResource.linkedResourceId = linkedId;
        
        // We must also update the source resource in the state if it didn't have a linkedId
        if (!resource.linkedResourceId) {
          item.activities = item.activities.map(act => ({
            ...act,
            resources: act.resources.map(r => r.id === resource.id ? { ...r, linkedResourceId: linkedId, linkType } : r)
          }));
        }
      } else {
        delete updatedResource.linkedResourceId;
        delete updatedResource.linkType;
      }

      const updatedActivities = item.activities.map(act => {
        if (act.id !== activityId) return act;
        const updatedResources = [...act.resources, updatedResource];
        const totalCost = updatedResources.reduce((acc, r) => acc + r.totalPrice, 0);
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate: item.quantity > 0 ? totalCost / item.quantity : 0
        };
      });

      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
    setResourceClipboard(null);
  };

  const deleteResource = (boqId: string, activityId: string, resId: string) => {
    // 1. Find the resource across all items to get linked IDs
    let effectiveLinkedResId: string | undefined;
    let effectiveLinkedActId: string | undefined;

    for (const item of boqItems) {
      for (const act of (item.activities || [])) {
        const r = (act.resources || []).find(res => res.id === resId);
        if (r) {
          effectiveLinkedResId = r.linkedResourceId || r.id;
          effectiveLinkedActId = act.linkedActivityId || act.id;
          break;
        }
      }
      if (effectiveLinkedResId) break;
    }

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = (item.activities || []).map(act => {
        const isTargetAct = item.id === boqId && act.id === activityId;
        const isLinkedAct = effectiveLinkedActId && (act.linkedActivityId === effectiveLinkedActId || act.id === effectiveLinkedActId);
        
        if (!isTargetAct && !isLinkedAct) return act;

        const originalCount = (act.resources || []).length;
        const updatedResources = (act.resources || []).filter(res => {
          const isTargetRes = isTargetAct && res.id === resId;
          const isLinkedRes = effectiveLinkedResId && (res.linkedResourceId === effectiveLinkedResId || res.id === effectiveLinkedResId);
          return !(isTargetRes || isLinkedRes);
        });

        if (updatedResources.length === originalCount) return act;

        itemChanged = true;
        const totalCost = updatedResources.reduce((acc, r) => acc + r.totalPrice, 0);
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate: item.quantity > 0 ? totalCost / item.quantity : 0
        };
      });
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
  };

  const handleBulkEditPrice = () => {
    const price = parseFloat(bulkPriceValue);
    if (isNaN(price)) return;

    // 1. Identify all linked resource IDs associated with the selection
    const linkedIdsToUpdate = new Set<string>();
    boqItems.forEach(item => {
      item.activities.forEach(act => {
        act.resources.forEach(res => {
          if (selectedResourceIds.has(res.id)) {
            const lid = res.linkedResourceId || res.id;
            linkedIdsToUpdate.add(lid);
          }
        });
      });
    });

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = item.activities.map(act => {
        let changed = false;
        const updatedResources = act.resources.map(res => {
          const lid = res.linkedResourceId || res.id;
          if (selectedResourceIds.has(res.id) || linkedIdsToUpdate.has(lid)) {
            changed = true;
            itemChanged = true;
            const updatedResource = { ...res, unitPrice: price };
            const { unitCost, totalQuantity } = calculateResourceMetrics(item.quantity, updatedResource, workingHoursPerDay, workingDaysPerWeek, act.productivity, act.conversionRate);
            return { ...updatedResource, quantity: totalQuantity, totalPrice: unitCost };
          }
          return res;
        });
        if (!changed) return act;
        const unitRate = updatedResources.reduce((s, r) => s + r.totalPrice, 0);
        const totalCost = unitRate * item.quantity;
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate
        };
      });
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
    setShowBulkEdit(false);
    setBulkPriceValue('');
    setSelectedResourceIds(new Set());
  };

  const bulkDeleteResources = () => {
    // 1. Identify all linked resource IDs associated with the selection
    const linkedIdsToDelete = new Set<string>();
    
    boqItems.forEach(item => {
      item.activities.forEach(act => {
        act.resources.forEach(res => {
          if (selectedResourceIds.has(res.id)) {
            const lid = res.linkedResourceId || res.id;
            linkedIdsToDelete.add(lid);
          }
        });
      });
    });

    setBoqItems(prev => prev.map(item => {
      let itemChanged = false;
      const updatedActivities = item.activities.map(act => {
        const originalLength = act.resources.length;
        const updatedResources = act.resources.filter(res => {
          const lid = res.linkedResourceId || res.id;
          return !selectedResourceIds.has(res.id) && !linkedIdsToDelete.has(lid);
        });
        
        if (updatedResources.length === originalLength) return act;
        
        itemChanged = true;
        const totalCost = updatedResources.reduce((acc, r) => acc + r.totalPrice, 0);
        return { 
          ...act, 
          resources: updatedResources, 
          totalCost,
          unitRate: item.quantity > 0 ? totalCost / item.quantity : 0
        };
      });
      
      if (!itemChanged) return item;
      return recalculateItemTotals({ ...item, activities: updatedActivities });
    }));
    setSelectedResourceIds(new Set());
    setShowResourceDeleteConfirm(false);
  };

  const toggleResourceSelection = (id: string) => {
    setSelectedResourceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportLibrary = () => {
    const dataStr = JSON.stringify(resourceLibrary, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'resource_library.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportLibrary = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = event.target.files?.[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') return;
        const importedLibrary = JSON.parse(content);
        if (Array.isArray(importedLibrary)) {
          const mergedLibrary = [...resourceLibrary];
          importedLibrary.forEach((newItem: any) => {
            const itemWithId = {
              ...newItem,
              id: newItem.id || crypto.randomUUID(),
              category: newItem.category || 'General'
            };
            if (!mergedLibrary.find(r => r.name === itemWithId.name && r.type === itemWithId.type)) {
              mergedLibrary.push(itemWithId);
            }
          });

          setResourceLibrary(mergedLibrary);
          // storageService.saveResourcesBulk is no longer called globally
          setNotification({ message: 'Library imported successfully!', type: 'success' });
        }
      } catch (err) {
        console.error("Failed to parse library file", err);
        setNotification({ message: 'Failed to import library. Please ensure it is a valid JSON file.', type: 'error' });
      }
    };
    fileReader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const boqExcelInputRef = useRef<HTMLInputElement>(null);

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const triggerBoqExcelImport = () => {
    boqExcelInputRef.current?.click();
  };

  const handleExportExcel = async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOQ Estimate');

    const getColChar = (idx: number) => {
      if (idx <= 26) return String.fromCharCode(64 + idx);
      const first = String.fromCharCode(64 + Math.floor((idx - 1) / 26));
      const second = String.fromCharCode(64 + ((idx - 1) % 26) + 1);
      return first + second;
    };

    // Headers Preparation
    const headers: string[] = [];
    if (exportSettings.columns.code) headers.push('CODE');
    if (exportSettings.columns.package) headers.push('PACKAGE');
    if (exportSettings.columns.description) headers.push('DESCRIPTION');
    if (exportSettings.columns.unit) headers.push('UNIT');
    if (exportSettings.columns.quantity) headers.push('QTY');
    if (exportSettings.columns.unitRate) headers.push('UNIT RATE');
    
    if (exportSettings.includeCategorySummary) {
      headers.push('LABOR RATE', 'MATERIAL RATE', 'EQUIP RATE', 'SUB/OTHER RATE');
    }
    
    if (exportSettings.columns.totalBudget) headers.push('TOTAL COST');
    if (exportSettings.columns.type) headers.push('TYPE');
    
    // Add parameter headers
    const paramHeaders = ['Count', 'W. Hours', 'Conv. Rate', 'Productivity', 'Consumption', 'Waste', 'Usages', 'Factor'];
    const allHeaders = [...headers, ...paramHeaders];
    const headerChar = getColChar(allHeaders.length);

    // Title and Header Info
    worksheet.mergeCells(`A1:${headerChar}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'COST ENGINE - BOQ ANALYSIS REPORT';
    titleCell.font = { name: 'Segoe UI', family: 4, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900

    worksheet.mergeCells(`A2:${headerChar}2`);
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Generated on: ${new Date().toLocaleString()}`;
    dateCell.font = { name: 'Segoe UI', italic: true, size: 10, color: { argb: 'FF64748B' } };
    dateCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells(`A3:${headerChar}3`);
    const budgetCell = worksheet.getCell('A3');
    budgetCell.value = `Total Project Budget: ${formatPrice(totalProjectBudget)}`;
    budgetCell.font = { name: 'Segoe UI', bold: true, size: 12, color: { argb: 'FF1E293B' } };
    budgetCell.alignment = { horizontal: 'center' };
    
    worksheet.addRow([]); // Spacer

    const headerRow = worksheet.addRow(allHeaders);
    headerRow.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
      cell.font = { name: 'Segoe UI', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
      
      // Hide parameter columns that are NOT in the image (after Waste)
      // Image shows up to Column M (if all 7 standard headers are present)
      // Count(8), W.Hours(9), ConvRate(10), Productivity(11), Consumption(12), Waste(13)
      if (colIdx > headers.length + 6) {
        worksheet.getColumn(colIdx).hidden = true;
      }
    });

    const descColIdx = headers.indexOf('DESCRIPTION') + 1;
    const colQtyIdx = headers.indexOf('QTY') + 1;
    const colRateIdx = headers.indexOf('UNIT RATE') + 1;
    const colTotalIdx = headers.indexOf('TOTAL COST') + 1;
    
    const colPCountIdx = headers.length + 1;
    const colPHoursIdx = headers.length + 2;
    const colPConvIdx = headers.length + 3;
    const colPProdIdx = headers.length + 4;
    const colPConsIdx = headers.length + 5;
    const colPWasteIdx = headers.length + 6;
    const colPUsagesIdx = headers.length + 7;
    const colPFactorIdx = headers.length + 8;
    
    const colHiddenTotalQtyIdx = allHeaders.length + 1;
    worksheet.getColumn(colHiddenTotalQtyIdx).hidden = true;

    const resourceSummaryMap = new Map<string, {
      name: string;
      type: ResourceType;
      unit: string;
      totalQuantity: number;
      totalCost: number;
    }>();

    // Populate map independent of exportSettings.includeResources to ensure summary ALWAYS has data
    boqItems.forEach(item => {
      if (item.rateSource !== 'Subcontractor') {
        (item.activities || []).forEach(act => {
          (act.resources || []).forEach(res => {
            const key = `${res.name.trim()}|${(res.unit || '').trim()}|${res.type}`;
            const existing = resourceSummaryMap.get(key);
            if (existing) {
              existing.totalQuantity += res.quantity;
              existing.totalCost += res.totalPrice * item.quantity;
            } else {
              resourceSummaryMap.set(key, {
                name: res.name.trim(),
                type: res.type,
                unit: res.unit || '',
                totalQuantity: res.quantity,
                totalCost: res.totalPrice * item.quantity
              });
            }
          });
        });
      }
    });

    boqItems.forEach((item) => {
      const boqRow: any[] = [];
      if (exportSettings.columns.code) boqRow.push(item.code);
      if (exportSettings.columns.package) boqRow.push(item.package || '');
      if (exportSettings.columns.description) boqRow.push(item.description);
      if (exportSettings.columns.unit) boqRow.push(item.unit);
      if (exportSettings.columns.quantity) boqRow.push(item.quantity);
      if (exportSettings.columns.unitRate) boqRow.push(item.unitRate);
      
      if (exportSettings.includeCategorySummary) {
        let laborTotal = 0;
        let materialTotal = 0;
        let equipmentTotal = 0;
        let subtotal = 0;
        
        if (item.rateSource === 'Subcontractor') {
          subtotal = item.subcontractorRate || 0;
        } else {
          (item.activities || []).forEach(act => {
            (act.resources || []).forEach(res => {
              if (res.type === 'Labor') laborTotal += res.totalPrice;
              else if (res.type === 'Material') materialTotal += res.totalPrice;
              else if (res.type === 'Equipment') equipmentTotal += res.totalPrice;
              else subtotal += res.totalPrice;
            });
          });
        }
        boqRow.push(laborTotal, materialTotal, equipmentTotal, subtotal);
      }
      
      if (exportSettings.columns.totalBudget) boqRow.push(item.totalBudget);
      if (exportSettings.columns.type) boqRow.push('BOQ ITEM');
      
      const r = worksheet.addRow(boqRow);
      const boqRowNum = r.number;
      r.height = 25;
      r.eachCell((cell, colIdx) => {
        cell.font = { name: 'Segoe UI', bold: true, size: 10, color: { argb: 'FF1E293B' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
        cell.alignment = { vertical: 'middle' };
        if (colIdx !== 2) cell.alignment = { ...cell.alignment, horizontal: 'center' };
      });
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; 
      if (colHiddenTotalQtyIdx > 0) r.getCell(colHiddenTotalQtyIdx).value = 0;

      const activityRows: number[] = [];

      const shouldIncludeDetails = exportSettings.includeCategorySummary ? 
        (exportSettings.includeActivities || exportSettings.includeResources) : 
        true;

      if (exportSettings.includeActivities && (!exportSettings.includeCategorySummary || shouldIncludeDetails)) {
        if (item.rateSource === 'Subcontractor') {
          const actRow: any[] = [];
          if (exportSettings.columns.code) actRow.push('');
          if (exportSettings.columns.package) actRow.push('');
          if (exportSettings.columns.description) actRow.push(`  * Market Subcontractor Rate`);
          if (exportSettings.columns.unit) actRow.push(item.unit || '');
          if (exportSettings.columns.quantity) actRow.push('');
          if (exportSettings.columns.unitRate) actRow.push(item.subcontractorRate || 0);
          
          if (exportSettings.includeCategorySummary) {
            actRow.push('', '', '', '');
          }
          
          if (exportSettings.columns.totalBudget) actRow.push((item.subcontractorRate || 0) * item.quantity);
          if (exportSettings.columns.type) actRow.push('SUBCON-RATE');
          
          const ar = worksheet.addRow(actRow);
          const actRowNum = ar.number;
          activityRows.push(actRowNum);
          
          ar.eachCell((cell) => {
            cell.font = { name: 'Segoe UI', italic: true, size: 9.5, color: { argb: 'FFF97316' }, bold: true };
            cell.alignment = { vertical: 'middle' };
          });
          if (colHiddenTotalQtyIdx > 0) ar.getCell(colHiddenTotalQtyIdx).value = 0;
        } else {
          (item.activities || []).forEach(act => {
            const actRow: any[] = [];
          if (exportSettings.columns.code) actRow.push('');
          if (exportSettings.columns.package) actRow.push('');
          if (exportSettings.columns.description) actRow.push(`  ${act.name}`);
          if (exportSettings.columns.unit) actRow.push(act.unit || '');
          if (exportSettings.columns.quantity) actRow.push('');
          if (exportSettings.columns.unitRate) actRow.push(act.unitRate);
          
          if (exportSettings.includeCategorySummary) {
            actRow.push('', '', '', '');
          }
          
          if (exportSettings.columns.totalBudget) actRow.push(act.totalCost);
          if (exportSettings.columns.type) actRow.push('ACTIVITY');
          
          const ar = worksheet.addRow(actRow);
          const actRowNum = ar.number;
          activityRows.push(actRowNum);
          
          ar.eachCell((cell) => {
            cell.font = { name: 'Segoe UI', italic: true, size: 9.5, color: { argb: 'FF334155' } };
            cell.alignment = { vertical: 'middle' };
          });
          ar.getCell(2).font = { ...ar.getCell(2).font, bold: true };
          if (colHiddenTotalQtyIdx > 0) ar.getCell(colHiddenTotalQtyIdx).value = 0;

          const resourceRows: number[] = [];

          if (exportSettings.includeResources) {
            (act.resources || []).forEach(res => {
              const resRow: any[] = [];
              if (exportSettings.columns.code) resRow.push('');
              if (exportSettings.columns.package) resRow.push('');
              if (exportSettings.columns.description) resRow.push(res.name);
              if (exportSettings.columns.unit) resRow.push(res.unit);
              if (exportSettings.columns.quantity) {
                // Show quantity per unit of BOQ
                resRow.push(item.quantity > 0 ? res.quantity / item.quantity : 0);
              }
              if (exportSettings.columns.unitRate) resRow.push(res.unitPrice);
              
              if (exportSettings.includeCategorySummary) {
                resRow.push('', '', '', '');
              }
              
              if (exportSettings.columns.totalBudget) resRow.push(res.totalPrice);
              if (exportSettings.columns.type) resRow.push(res.type);
              
              const rr = worksheet.addRow(resRow);
              const resRowNum = rr.number;
              resourceRows.push(resRowNum);

              if (colHiddenTotalQtyIdx > 0 && colQtyIdx > 0) {
                 rr.getCell(colHiddenTotalQtyIdx).value = {
                    formula: `=${getColChar(colQtyIdx)}${resRowNum} * ${getColChar(colQtyIdx)}${boqRowNum}`,
                    result: res.quantity
                 };
              } else {
                 rr.getCell(colHiddenTotalQtyIdx).value = res.quantity;
              }

              // Add parameters to columns
              rr.getCell(colPCountIdx).value = res.resourceCount || 1;
              rr.getCell(colPHoursIdx).value = workingHoursPerDay;
              rr.getCell(colPConvIdx).value = act.conversionRate || 1;
              rr.getCell(colPProdIdx).value = act.productivity || 1;
              rr.getCell(colPConsIdx).value = res.consumption || 0;
              rr.getCell(colPWasteIdx).value = res.wastePercentage || 0;
              rr.getCell(colPUsagesIdx).value = res.usages || 1;
              rr.getCell(colPFactorIdx).value = res.conversionFactor || 1;

              // Formula for Resource Total Price (Cost contribution per BOQ unit)
              if (colTotalIdx > 0 && colRateIdx > 0) {
                const charRate = getColChar(colRateIdx);
                const charHours = getColChar(colPHoursIdx);
                const charConv = getColChar(colPConvIdx);
                const charProd = getColChar(colPProdIdx);
                const charCons = getColChar(colPConsIdx);
                const charWaste = getColChar(colPWasteIdx);
                const charUsages = getColChar(colPUsagesIdx);
                const charFactor = getColChar(colPFactorIdx);
                const charCount = getColChar(colPCountIdx);

                let formula = '';
                if (res.type === 'Material') {
                   // formula: (consumption * (1 + waste/100) / usages) * (rate / factor) * conv
                   formula = `=(${charCons}${resRowNum} * (1 + ${charWaste}${resRowNum}/100) / ${charUsages}${resRowNum}) * (${charRate}${resRowNum} / ${charFactor}${resRowNum}) * ${charConv}${resRowNum}`;
                } else if (res.type === 'Labor' || res.type === 'Equipment') {
                   // formula: ((workingHours * rate * count * factor) / prod) * conv
                   formula = `=((${charHours}${resRowNum} * ${charRate}${resRowNum} * ${charCount}${resRowNum} * ${charFactor}${resRowNum}) / ${charProd}${resRowNum}) * ${charConv}${resRowNum}`;
                } else {
                   rr.getCell(colTotalIdx).value = res.totalPrice;
                }

                if (formula) {
                  rr.getCell(colTotalIdx).value = { formula, result: res.totalPrice };
                }
              }

              // Also add formula to Qty column for resources if it's Labor/Equipment
              if (colQtyIdx > 0 && (res.type === 'Labor' || res.type === 'Equipment')) {
                const charCount = getColChar(colPCountIdx);
                const charHours = getColChar(colPHoursIdx);
                const charProd = getColChar(colPProdIdx);
                const charConv = getColChar(colPConvIdx);
                // Qty per unit of BOQ = (Count * Hours / Productivity) * Conv
                const qtyFormula = `=((${charCount}${resRowNum} * ${charHours}${resRowNum}) / ${charProd}${resRowNum}) * ${charConv}${resRowNum}`;
                rr.getCell(colQtyIdx).value = { formula: qtyFormula, result: item.quantity > 0 ? res.quantity / item.quantity : 0 };
              }

              if (colRateIdx > 0 && exportSettings.includeResourceSummary) {
                const charDesc = getColChar(descColIdx);
                rr.getCell(colRateIdx).value = {
                   formula: `=VLOOKUP(${charDesc}${resRowNum}, 'Resource Summary'!A:F, 5, FALSE)`,
                   result: res.unitPrice
                };
              }

              rr.eachCell((cell, colIdx) => {
                cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
                cell.alignment = { vertical: 'middle' };
                if (colIdx === descColIdx) {
                   cell.alignment = { ...cell.alignment, indent: 4 };
                }
              });
            });

            // Formula for Activity Unit Rate: Sum of child resources TOTAL COSTs
            if (colRateIdx > 0 && resourceRows.length > 0) {
              const charTotal = getColChar(colTotalIdx);
              const firstRow = resourceRows[0];
              const lastRow = resourceRows[resourceRows.length - 1];
              const sumRange = `${charTotal}${firstRow}:${charTotal}${lastRow}`;
              ar.getCell(colRateIdx).value = { formula: `SUM(${sumRange})`, result: act.unitRate };
            }

            // Formula for Activity Total Cost: Unit Rate * BOQ Qty
            if (colTotalIdx > 0 && colQtyIdx > 0) {
              const charRate = getColChar(colRateIdx);
              const charBoqQty = getColChar(colQtyIdx);
              ar.getCell(colTotalIdx).value = { 
                formula: `=${charRate}${actRowNum} * ${charBoqQty}${boqRowNum}`, 
                result: act.totalCost 
              };
            }
          }
        });
      }

        // Formula for BOQ Item Total Budget: Sum of child activities TOTAL COSTs
        if (colTotalIdx > 0 && activityRows.length > 0) {
          const charTotal = getColChar(colTotalIdx);
          const sumFormula = activityRows.map(rowNum => `${charTotal}${rowNum}`).join('+');
          r.getCell(colTotalIdx).value = { formula: `=${sumFormula}`, result: item.totalBudget };
        }

        // Formula for BOQ Item Unit Rate: Total Budget / Quantity
        if (colRateIdx > 0 && colQtyIdx > 0) {
          const charTotal = getColChar(colTotalIdx);
          const charQty = getColChar(colQtyIdx);
          r.getCell(colRateIdx).value = { formula: `=${charTotal}${boqRowNum} / ${charQty}${boqRowNum}`, result: item.unitRate };
        }
      }
    });

    // Auto-width columns
    if (worksheet.columns) {
      worksheet.columns.forEach((column) => {
        if (column) column.width = 15; 
      });
    }
    if (descColIdx > 0) worksheet.getColumn(descColIdx).width = 65;

    // Formatting numbers
    const finalTotalCostIdx = headers.indexOf('TOTAL COST') + 1;
    const finalUnitRateIdx = headers.indexOf('UNIT RATE') + 1;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 5) {
        if (finalTotalCostIdx > 0) row.getCell(finalTotalCostIdx).numFmt = '#,##0.00';
        if (finalUnitRateIdx > 0) row.getCell(finalUnitRateIdx).numFmt = '#,##0.00';
      }
    });

    // --- Resource Summary Sheet ---
    if (exportSettings.includeResourceSummary) {
      const summarySheet = workbook.addWorksheet('Resource Summary');

      // Add Title
      summarySheet.mergeCells('A1:F1');
      const sTitle = summarySheet.getCell('A1');
      sTitle.value = 'PROJECT RESOURCE CONSOLIDATION SUMMARY';
      sTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      sTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      summarySheet.getRow(1).height = 30;

      // Add Headers
      const summaryRowHeaders = ['RESOURCE NAME', 'RESOURCE TYPE', 'UNIT', 'TOTAL PROJECT QTY', 'AVG UNIT RATE', 'TOTAL PROJECT COST'];
      const sHeaderRow = summarySheet.addRow(summaryRowHeaders);
      sHeaderRow.height = 25;
      sHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { name: 'Segoe UI', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'thin', color: { argb: 'FF334155' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      // Add Sorted Data
      const sortedSummary = Array.from(resourceSummaryMap.values()).sort((a, b) => {
        // Sort by Type first, then Name
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      });

      sortedSummary.forEach(data => {
        const avgRate = data.totalQuantity > 0 ? data.totalCost / data.totalQuantity : 0;
        const row = summarySheet.addRow([
          data.name,
          data.type,
          data.unit,
          '',
          avgRate,
          data.totalCost
        ]);
        
        const sumRow = row.number;
        const charHidden = getColChar(colHiddenTotalQtyIdx);
        const charDesc = getColChar(descColIdx);
        const nameCellRef = `A${sumRow}`; 
        
        if (exportSettings.includeResources) {
          row.getCell(4).value = {
            formula: `=SUMIF('BOQ Estimate'!$${charDesc}:$${charDesc}, ${nameCellRef}, 'BOQ Estimate'!$${charHidden}:$${charHidden})`,
            result: data.totalQuantity
          };
        } else {
          row.getCell(4).value = data.totalQuantity;
        }
        
        row.height = 20;
        row.eachCell((cell, colIdx) => {
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
          cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'center' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
          
          if (colIdx >= 4) {
             cell.numFmt = '#,##0.00';
          }
        });
      });

      // Total Row for Summary
      const summaryTotalCost = sortedSummary.reduce((sum, item) => sum + item.totalCost, 0);
      const totalRow = summarySheet.addRow(['', '', '', '', 'GRAND TOTAL', summaryTotalCost]);
      totalRow.height = 30;
      totalRow.getCell(5).font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: 'FF0F172A' } };
      totalRow.getCell(6).font = { name: 'Segoe UI', bold: true, size: 12, color: { argb: 'FF4F46E5' } };
      totalRow.getCell(6).numFmt = `"${currency.symbol}" #,##0.00`;
      totalRow.eachCell((cell, idx) => {
        if (idx >= 5) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });

      // Column widths
      summarySheet.getColumn(1).width = 50; // Name
      summarySheet.getColumn(2).width = 20; // Type
      summarySheet.getColumn(3).width = 12; // Unit
      summarySheet.getColumn(4).width = 20; // Qty
      summarySheet.getColumn(5).width = 20; // Rate
      summarySheet.getColumn(6).width = 25; // Total Cost
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'BOQ_Estimate_Analysis.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
    
    setShowExportMenu(false);
    setShowExportConfig(false);
  };

  const handleExportPDF = async () => {
    setNotification({ message: 'Generating Professional BOQ Analysis Report...', type: 'info' });
    
    // Create a temporary container for the report
    const reportContainer = document.createElement('div');
    reportContainer.id = 'temp-report-container';
    reportContainer.style.position = 'fixed';
    reportContainer.style.left = '-10000px';
    reportContainer.style.top = '0';
    reportContainer.style.width = '794px'; // ~210mm at 96dpi
    reportContainer.style.backgroundColor = 'white';
    reportContainer.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
    document.body.appendChild(reportContainer);

    try {
      const currentProject = projects.find(p => p.id === currentProjectId);
      const today = new Date().toLocaleDateString('en-GB');
      
      // Render the report content as HTML string
      reportContainer.innerHTML = `
        <div style="background-color: white; color: #0f172a;">
          <!-- Header -->
          <div style="background-color: #0f172a; padding: 40px 60px; position: relative; color: white;">
            <div style="position: absolute; left: 0; top: 0; width: 30px; height: 100%; background-color: #ea580c;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span style="font-size: 42px; font-weight: 900; letter-spacing: -1.5px; line-height: 1;">COST</span>
                  <span style="font-size: 42px; font-weight: 900; color: #ea580c; letter-spacing: -1.5px; line-height: 1;">ENGINE</span>
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #94a3b8; margin-top: 12px; letter-spacing: 2px; text-transform: uppercase;">
                  Professional BOQ Engineering Analysis
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 2px; margin-bottom: 8px; text-transform: uppercase;">Report Date</div>
                <div style="font-size: 24px; font-weight: 900;">${today}</div>
              </div>
            </div>
          </div>

          <!-- Summary Bar -->
          <div style="padding: 30px 60px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px;">
            <div style="font-size: 18px; font-weight: 800; color: #1e293b;">
              PROJECT VALUATION: <span style="color: #4f46e5;">${formatPrice(totalProjectBudget)}</span>
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
              SCOPE: ${boqItems.length} ASSETS ESTIMATED
            </div>
          </div>

          <!-- Main Table -->
          <div style="padding: 0 60px 40px 60px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                  ${exportSettings.columns.code ? '<th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Code</th>' : ''}
                  ${exportSettings.columns.package ? '<th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Package</th>' : ''}
                  <th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Description</th>
                  ${exportSettings.columns.unit ? '<th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Unit</th>' : ''}
                  ${exportSettings.columns.quantity ? '<th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Qty</th>' : ''}
                  ${exportSettings.columns.totalBudget ? '<th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Total Valuation</th>' : ''}
                  ${exportSettings.columns.unitRate ? '<th style="padding: 16px 10px; text-align: left; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase;">Rate</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${boqItems.map(item => {
                  const isDescriptionRtl = /[\u0600-\u06FF]/.test(item.description);
                  return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      ${exportSettings.columns.code ? `<td style="padding: 20px 10px; vertical-align: top; font-weight: 700; color: #4f46e5;">${item.code || '-'}</td>` : ''}
                      ${exportSettings.columns.package ? `<td style="padding: 20px 10px; vertical-align: top; font-weight: 700; font-size: 11px; color: #6366f1; text-transform: uppercase;">${item.package || '-'}</td>` : ''}
                      <td style="padding: 20px 10px; vertical-align: top; font-weight: 900; font-size: 15px; color: #4f46e5; ${isDescriptionRtl ? 'direction: rtl; text-align: right;' : 'text-align: left;'}">
                        ${item.description}
                      </td>
                      ${exportSettings.columns.unit ? `<td style="padding: 20px 10px; vertical-align: top;">${item.unit}</td>` : ''}
                      ${exportSettings.columns.quantity ? `<td style="padding: 20px 10px; vertical-align: top;">${item.quantity.toLocaleString()}</td>` : ''}
                      ${exportSettings.columns.totalBudget ? `<td style="padding: 20px 10px; vertical-align: top; font-weight: 800;">${formatPrice(item.totalBudget)}</td>` : ''}
                      ${exportSettings.columns.unitRate ? `<td style="padding: 20px 10px; vertical-align: top;">${formatPrice(item.unitRate)}</td>` : ''}
                    </tr>
                    
                    ${exportSettings.includeActivities ? (
                      item.rateSource === 'Subcontractor' ? `
                        <tr style="background-color: #fffaf5;">
                          ${exportSettings.columns.code ? `<td></td>` : ''}
                          ${exportSettings.columns.package ? `<td></td>` : ''}
                          <td style="padding: 10px 10px 10px 30px; font-weight: 900; color: #ea580c; position: relative;">
                            <span style="position: absolute; left: 12px; color: #fb923c;">★</span>
                            Subcontractor Market Rate (Winner)
                          </td>
                          ${exportSettings.columns.unit ? `<td></td>` : ''}
                          ${exportSettings.columns.quantity ? `<td></td>` : ''}
                          ${exportSettings.columns.totalBudget ? `<td style="padding: 10px 10px; font-weight: 800; color: #ea580c;">${formatPrice(item.totalBudget)}</td>` : ''}
                          ${exportSettings.columns.unitRate ? `<td style="padding: 10px 10px; font-style: italic; color: #f97316; font-size: 11px;">Direct Selection</td>` : ''}
                        </tr>
                      ` : (item.activities || []).map(act => `
                        <tr style="background-color: #fbfcfe;">
                          ${exportSettings.columns.code ? `<td></td>` : ''}
                          ${exportSettings.columns.package ? `<td></td>` : ''}
                          <td style="padding: 10px 10px 10px 30px; font-weight: 700; color: #475569; position: relative;">
                            <span style="position: absolute; left: 12px; color: #cbd5e1;">•</span>
                            ${act.name}
                          </td>
                          ${exportSettings.columns.unit ? `<td></td>` : ''}
                          ${exportSettings.columns.quantity ? `<td></td>` : ''}
                          ${exportSettings.columns.totalBudget ? `<td style="padding: 10px 10px; font-weight: 700; color: #475569;">${formatPrice(act.totalCost)}</td>` : ''}
                          ${exportSettings.columns.unitRate ? `<td></td>` : ''}
                        </tr>
                      `).join('')
                    ) : ''}
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      const doc = new jsPDF('p', 'mm', 'a4');
      const fileName = `BOQ_Report_${currentProject?.name.replace(/\s+/g, '_') || 'Estimate'}.pdf`;

      await new Promise(resolve => setTimeout(resolve, 500));

      await doc.html(reportContainer, {
        html2canvas: html2canvas as any,
        callback: function (doc) {
          doc.save(fileName);
        },
        x: 0,
        y: 0,
        width: 210,
        windowWidth: 794,
        autoPaging: 'text'
      });
      
      setNotification({ message: 'Professional Analysis Exported Successfully', type: 'success' });
    } catch (error) {
      console.error('PDF generation error:', error);
      setNotification({ message: 'Failed to generate PDF.', type: 'error' });
    } finally {
      document.body.removeChild(reportContainer);
      setShowExportConfig(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const current = e.currentTarget as HTMLElement;
      const controls = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]')) as HTMLInputElement[];
      const currentIndex = controls.indexOf(current as HTMLInputElement);
      if (currentIndex > -1 && currentIndex < controls.length - 1) {
        controls[currentIndex + 1].focus();
        controls[currentIndex + 1].select();
      }
    }
  };

  const selectedBoq = useMemo(() => 
    boqItems.find(item => item.id === selectedBoqId), 
    [boqItems, selectedBoqId]
  );

  const currentBoqIndex = useMemo(() => 
    filteredBoqItems.findIndex(item => item.id === selectedBoqId),
    [filteredBoqItems, selectedBoqId]
  );

  const goToNextBoq = useCallback(() => {
    if (currentBoqIndex < filteredBoqItems.length - 1) {
      setSelectedBoqId(filteredBoqItems[currentBoqIndex + 1].id);
    }
  }, [currentBoqIndex, filteredBoqItems]);

  const goToPrevBoq = useCallback(() => {
    if (currentBoqIndex > 0) {
      setSelectedBoqId(filteredBoqItems[currentBoqIndex - 1].id);
    }
  }, [currentBoqIndex, filteredBoqItems]);

  useEffect(() => {
    const handleNavigationKeys = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) return;

      if (!selectedBoqId) return;

      if (e.key === 'ArrowRight') {
        goToNextBoq();
      } else if (e.key === 'ArrowLeft') {
        goToPrevBoq();
      } else if (e.key === 'Escape') {
        setSelectedBoqId(null);
      }
    };

    window.addEventListener('keydown', handleNavigationKeys);
    return () => window.removeEventListener('keydown', handleNavigationKeys);
  }, [selectedBoqId, goToNextBoq, goToPrevBoq]);

  useEffect(() => {
    if (selectedBoqId) {
      activitiesScrollRef.current?.scrollTo({ top: 0 });
      resourcesScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [selectedBoqId]);

  const boqCategoryTotals = useMemo(() => {
    if (!selectedBoq) return { Labor: 0, Material: 0, Equipment: 0, Subcontractor: 0 };
    return (selectedBoq.activities || []).reduce((acc, activity) => {
      (activity.resources || []).forEach(res => {
        const type = res.type as ResourceType;
        if (acc[type] !== undefined) {
          acc[type] += res.totalPrice;
        }
      });
      return acc;
    }, { Labor: 0, Material: 0, Equipment: 0, Subcontractor: 0 } as Record<ResourceType, number>);
  }, [selectedBoq]);

  const totalProjectBudget = useMemo(() => 
    boqItems.reduce((acc, item) => acc + item.totalBudget, 0),
    [boqItems]
  );

  const updateLibraryItem = (id: string, updates: Partial<LibraryResource>) => {
    setResourceLibrary(prev => prev.map(r => {
      if (r.id === id) {
        let updatedItem = { ...r, ...updates };
        
        if (updates.unitPrice !== undefined && updates.unitPrice !== r.unitPrice) {
          const historyEntry: PriceHistoryEntry = {
            id: crypto.randomUUID(),
            oldPrice: r.unitPrice,
            newPrice: updates.unitPrice,
            date: new Date().toISOString()
          };
          updatedItem.priceHistory = [...(r.priceHistory || []), historyEntry];
        }
        
        if (user) updateResourceLibraryItem(updatedItem);
        return updatedItem;
      }
      return r;
    }));
  };

  const deleteLibraryItem = (id: string) => {
    setResourceLibrary(prev => prev.filter(r => r.id !== id));
    if (user) deleteResourceLibraryItem(id);
  };

  const handleEstimateLibraryPrice = async (item: LibraryResource) => {
    if (estimatingLibraryPriceId) return;
    setEstimatingLibraryPriceId(item.id);
    try {
      const result = await estimateResourceUnitPrice(
        item.name,
        item.type,
        item.unit,
        country,
        currencyCode
      );
      if (result && result.unitPrice) {
        setResourceLibrary(prev => prev.map(r => 
          r.id === item.id ? { ...r, unitPrice: result.unitPrice } : r
        ));
        setNotification({ 
          message: `Price estimated: ${currency.symbol} ${result.unitPrice.toLocaleString()}`, 
          type: 'success' 
        });
      }
    } catch (error) {
      console.error("AI Price Estimation Error:", error);
      setNotification({ message: "Failed to estimate price", type: 'error' });
    } finally {
      setEstimatingLibraryPriceId(null);
    }
  };

  const addLibraryItem = (type: ResourceType) => {
    const newItem: LibraryResource = {
      id: crypto.randomUUID(),
      name: `New ${type}`,
      type,
      unit: (type === 'Labor' || type === 'Equipment') ? 'hr' : 'pc',
      unitPrice: 0,
      category: 'General'
    };
    setResourceLibrary(prev => [...prev, newItem]);
    if (user) updateResourceLibraryItem(newItem);
  };

  const dashboardStats = useMemo(() => {
    const allActivities = boqItems.flatMap(item => item.activities || []);
    const totalActivities = allActivities.length;

    // 1. Group by Resource Type
    const resourceTypeCosts: Record<string, number> = {
      'Labor': 0,
      'Material': 0,
      'Equipment': 0,
      'Subcontractor': 0
    };

    boqItems.forEach(item => {
      (item.activities || []).forEach(act => {
        (act.resources || []).forEach(res => {
          const actualTotalCost = res.totalPrice * item.quantity;
          resourceTypeCosts[res.type] = (resourceTypeCosts[res.type] || 0) + actualTotalCost;
        });
      });
    });

    const chartDataByType = Object.entries(resourceTypeCosts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);

    // 2. Group by Resource Category (from Library)
    const resourceCategoryCosts: Record<string, number> = {};
    
    boqItems.forEach(item => {
      (item.activities || []).forEach(act => {
        (act.resources || []).forEach(res => {
          const cat = res.category || 'General';
          const actualTotalCost = res.totalPrice * item.quantity;
          resourceCategoryCosts[cat] = (resourceCategoryCosts[cat] || 0) + actualTotalCost;
        });
      });
    });

    const chartDataByCategory = Object.entries(resourceCategoryCosts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 3. Group by Work Item (BOQ Items)
    const chartDataByWorkItem = boqItems
      .map(item => ({ name: item.description, value: item.totalBudget }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      totalActivities,
      chartDataByType,
      chartDataByCategory,
      chartDataByWorkItem,
      totalBudget: totalProjectBudget
    };
  }, [boqItems, totalProjectBudget]);


  const LogoComponent = () => (
    <div className="flex items-center gap-3 group cursor-default">
      <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center transition-all duration-500 group-hover:rotate-[5deg] group-hover:scale-105 shrink-0">
        <CostEngineIcon className="w-10 h-10 md:w-12 md:h-12 text-slate-800 drop-shadow-md" />
      </div>
      <div className="hidden sm:flex flex-col">
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none tracking-tighter">
            COST<span className="text-blue-600">ENGINE</span>
          </h1>
          <div className="px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-500 tracking-tighter border border-slate-200 uppercase">PRO</div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-[1px] w-4 bg-blue-400/50"></div>
          <p style={{ fontFamily: 'system-ui', fontSize: '6px' }} className="text-slate-400 font-bold tracking-[0.2em] uppercase whitespace-nowrap">Precision Pricing Infrastructure</p>
        </div>
      </div>
    </div>
  );

  const LandingView = () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 text-center animate-in fade-in duration-700 h-screen w-full fixed inset-0 z-[500] overflow-y-auto">
      <div className="max-w-md w-full my-auto pb-12">
        <div className="mb-8 flex justify-center">
          <LogoComponent />
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Welcome to Cost Engine</h2>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed font-medium">
            To start using our precision AI estimation tools, library management, and dashboards, please create or select a project.
          </p>
          
          <div className="space-y-3">
             <button 
                onClick={() => {
                  setProjectNameInput('New Project');
                  setActiveModal('create');
                }}
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
             >
                <Plus className="w-4 h-4" /> Create New Project
             </button>
             
             <button 
                onClick={triggerProjectJsonImport}
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
             >
                <FileJson className="w-4 h-4" /> Import Backup (.json)
             </button>

             <button 
                onClick={() => setShowUserGuide(true)}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 shadow-sm"
             >
                <BookOpen className="w-3.5 h-3.5" /> Learn How it Works
             </button>
          </div>
          
          {projects.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Or Select Recent Project</p>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadProject(p.id)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50 transition-all text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 truncate group-hover:text-orange-700">{p.name}</p>
                      <p className="text-[8px] text-slate-400 font-medium">Last updated: {new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-12 flex items-center justify-center gap-8 opacity-40 grayscale">
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center">
                <CostEngineIcon className="w-6 h-6 text-slate-900 drop-shadow-sm" />
              </div>
              <span className="text-[10px] font-black text-slate-900 tracking-tighter">V2.0</span>
           </div>
           <div className="h-4 w-px bg-slate-200" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Advanced Estimating</p>
        </div>
      </div>
    </div>
  );

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
        <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
          <CostEngineIcon className="w-24 h-24 text-white animate-pulse drop-shadow-[0_4px_16px_rgba(255,255,255,0.2)]" />
        </div>
        <p className="text-white font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">Initializing System Architecture...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col lg:flex-row overflow-hidden font-sans">
        <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-900 items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 scale-110" />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-indigo-900/80 to-transparent" />
          <div className="relative z-10 px-20">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 flex items-center justify-center text-white">
                <CostEngineIcon className="w-16 h-16 drop-shadow-[0_8px_16px_rgba(99,102,241,0.5)]" />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Cost Engine <span className="text-indigo-400">Pro</span></h1>
            </div>
            <h2 className="text-6xl font-black text-white tracking-tight leading-tight mb-8"> Precision Engineering for <span className="text-orange-500">Resource Budgets.</span></h2>
            <p className="text-xl text-indigo-200/70 font-medium leading-relaxed max-w-xl">
              The industry standard for BOQ analysis, AI-powered estimations, and multi-user resource planning.
            </p>
            
            <div className="mt-16 grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-4xl font-black text-white">400+</p>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Master Resources</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-black text-white">100%</p>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Enterprise Cloud Sync</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 relative">
          <div className="absolute top-0 right-0 p-8">
            <div className="px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 flex items-center gap-2">
              <Shield className="w-3 h-3 text-indigo-400" />
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Authenticated Access Only</span>
            </div>
          </div>

          <div className="lg:hidden flex items-center gap-3 mb-12">
            <CostEngineIcon className="w-10 h-10 text-indigo-500 drop-shadow-md" />
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">Cost Engine</h1>
          </div>

          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <h3 className="text-3xl font-black text-white tracking-tight mb-3 uppercase">Engineer Portal</h3>
              <p className="text-slate-400 font-medium">Access your cloud-synchronized project environment.</p>
            </div>

            <button 
              onClick={login}
              className="w-full group relative flex items-center justify-center gap-4 bg-white hover:bg-slate-50 text-slate-900 py-6 px-8 rounded-[2rem] font-black uppercase tracking-[0.15em] text-xs transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 border-b-4 border-slate-200"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Sign in with Google Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.3em]"><span className="bg-slate-950 px-4 text-slate-600">Secure Protocol v2.4</span></div>
            </div>
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full text-center">
            <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.3em]">
              &copy; 2024 COST ENGINE GLOBAL &bull; PROPERTY OF ENGINEERING DIVISION
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isDataLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center font-sans px-8">
        <div className="w-20 h-2 bg-slate-900 rounded-full overflow-hidden mb-6 border border-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-full bg-orange-600"
          />
        </div>
        <p className="text-white font-black uppercase tracking-[0.4em] text-[10px] animate-pulse text-center">Hydrating Project Matrix from Cloud Store...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors overflow-x-hidden">
      {!currentProjectId && <LandingView />}
      
      {/* Top Navigation Bar */}
      <header className="min-h-[3.5rem] bg-white text-slate-900 border-b border-slate-200 flex flex-col lg:flex-row items-center justify-between px-2 md:px-4 lg:px-6 py-1.5 md:py-2 shrink-0 transition-all z-[120] relative">
        <div className="flex items-center justify-between w-full lg:w-auto mb-1.5 lg:mb-0">
          <div className="flex items-center gap-1.5 md:gap-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileSidebarOpen(true);
              }}
              className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1 md:gap-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                }}
                className="hidden lg:flex p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors border border-slate-200"
                title={isSidebarCollapsed ? "Show Sidebar" : "Collapse Sidebar"}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              <LogoComponent />
            </div>
          </div>
        </div>
        
      <div className="flex items-center lg:justify-end gap-1.5 md:gap-3 lg:gap-6 w-full lg:w-auto pb-1 lg:pb-0 overflow-x-auto no-scrollbar sm:overflow-visible">
          {/* Main Navigation - Primary Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <nav className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button 
                onClick={() => setView('boq')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${view === 'boq' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                title="Bill of Quantities"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">BOQ</span>
              </button>
              <button 
                onClick={() => setView('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                title="Dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Dash</span>
              </button>
              <button 
                onClick={() => setView('subcon-comparison')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${view === 'subcon-comparison' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                title="Subcontractor Comparison"
              >
                <Users className={`w-3.5 h-3.5 ${view === 'subcon-comparison' ? 'text-white' : 'text-blue-500'}`} />
                <span className="hidden xl:inline">Subcon</span>
              </button>
              <button 
                onClick={() => setView('library')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${view === 'library' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                title="Resource Library"
              >
                <Library className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Library</span>
              </button>
              <button 
                onClick={() => setView('qs')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${view === 'qs' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                title="Quantity Surveying"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">QS</span>
              </button>
            </nav>

            {/* Quick Actions (Mobile) */}
            <div className="flex sm:hidden items-center gap-1">
              <button 
                onClick={saveToCloud}
                disabled={!user || isSyncing || !hasUnsavedChanges || !isCloudSyncEnabled}
                className={`p-2 rounded-lg transition-all ${isSyncing ? 'text-indigo-400 animate-pulse' : (hasUnsavedChanges ? 'text-indigo-600 bg-indigo-50' : 'text-emerald-500')}`}
                title="Cloud Sync"
              >
                <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              </button>
              <button 
                onClick={() => setIsCloudSyncEnabled(!isCloudSyncEnabled)}
                className={`p-2 rounded-lg ${isCloudSyncEnabled ? 'text-blue-600' : 'text-slate-300'}`}
                title="Toggle Cloud Sync"
              >
                <Database className="w-4 h-4" />
              </button>
              <button onClick={undo} disabled={currentIndex <= 0} className={`p-2 rounded-lg ${currentIndex <= 0 ? 'text-slate-200' : 'text-slate-500 active:bg-slate-100'}`}><Undo2 className="w-4 h-4" /></button>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 rounded-lg text-blue-600 active:bg-blue-50"><Download className="w-4 h-4" /></button>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="p-2 rounded-lg text-slate-500 active:bg-slate-100"
                title="Open in New Tab"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Config Settings Group - Removed from header to sidebar footer */}

          {/* Actions & Tools Group - Reorganized for better spacing */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {/* History Controls */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={undo}
                disabled={currentIndex <= 0}
                className={`p-1.5 rounded-md transition-all ${currentIndex <= 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={redo}
                disabled={currentIndex >= history.length - 1}
                className={`p-1.5 rounded-md transition-all ${currentIndex >= history.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sync Status & Cloud Sync */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                <label 
                  className="flex items-center gap-1.5 cursor-pointer title px-2 h-7 rounded-md hover:bg-slate-50 transition-colors" 
                  title="Toggle cloud synchronization (Firebase)"
                >
                  <input 
                    type="checkbox" 
                    checked={isCloudSyncEnabled}
                    onChange={(e) => setIsCloudSyncEnabled(e.target.checked)}
                    className="w-3 h-3 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter hidden lg:inline">Cloud Sync</span>
                </label>
                
                <div className="w-px h-3 bg-slate-200" />

                <label 
                  className="flex items-center gap-1.5 cursor-pointer title px-2 h-7 rounded-md hover:bg-slate-50 transition-colors" 
                  title="Automatically sync changes to cloud every 1 minute"
                >
                  <input 
                    type="checkbox" 
                    checked={isCloudAutoSyncEnabled}
                    onChange={(e) => setIsCloudAutoSyncEnabled(e.target.checked)}
                    className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter hidden lg:inline">Auto-Sync</span>
                </label>
              </div>

              {pendingSyncCount > 0 && (
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse"
                  title={`${pendingSyncCount} operations queued locally waiting for rate limits, network, or quota recovery. Background retry is active.`}
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  <span>Queued: {pendingSyncCount}</span>
                </div>
              )}

              <button
                onClick={() => {
                  if (pendingSyncCount > 0) {
                    storageService.processQueue();
                  } else {
                    saveToCloud();
                  }
                }}
                disabled={!user || isSyncing || (!hasUnsavedChanges && pendingSyncCount === 0) || !isCloudSyncEnabled}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${hasUnsavedChanges || pendingSyncCount > 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 animate-pulse' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}
                title="Manually sync current project to cloud"
              >
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-indigo-400 animate-pulse' : (hasUnsavedChanges ? 'bg-amber-400' : (pendingSyncCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'))} shrink-0`} />
                <span className="hidden lg:inline">{isSyncing ? 'Syncing...' : (hasUnsavedChanges ? 'Sync Now' : (pendingSyncCount > 0 ? 'Sync Pending' : 'Synced'))}</span>
                <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              </button>
            </div>

            {/* Export Menu */}
            <div className="relative z-50 mr-1" ref={exportMenuRef}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu(!showExportMenu);
                }}
                className="h-8 w-8 lg:h-auto lg:w-auto lg:px-3 lg:py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden lg:inline text-[9px]">Export</span>
              </button>
              {showExportMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 py-2 z-[200] overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-slate-50 mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Export Study</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportSettings(prev => ({ ...prev, format: 'excel' }));
                      setShowExportConfig(true);
                      setShowExportMenu(false);
                    }} 
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel Spreadsheet (.xlsx)
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportSettings(prev => ({ ...prev, format: 'pdf' }));
                      setShowExportConfig(true);
                      setShowExportMenu(false);
                    }} 
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-red-500" /> PDF Document (.pdf)
                  </button>
                  <div className="border-t border-slate-50 mt-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportProjectJSON();
                        setShowExportMenu(false);
                      }} 
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <FileJson className="w-4 h-4 text-amber-500" /> Backup Project (.json)
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* User Guide Toggle */}
            <button 
              onClick={() => setShowUserGuide(true)}
              className="h-8 w-8 bg-slate-100 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all shrink-0"
              title="User Guide"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="h-8 w-8 bg-slate-100 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all shrink-0"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
              {isMobileSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
                />
              )}
            </AnimatePresence>

            {/* BOQ Item Sidebar */}
            <aside 
              ref={sidebarRef}
              className={`
              bg-white border-r border-slate-200 
              flex flex-col shrink-0 transition-all duration-300 z-[100]
              fixed lg:absolute inset-y-0 left-0 
              ${(isSidebarCollapsed && !isMobileSidebarOpen) ? 'w-0 -translate-x-full opacity-0' : 'w-80 translate-x-0 opacity-100 shadow-2xl lg:shadow-none'}
              ${isMobileSidebarOpen ? 'translate-x-0 fixed' : ''}
            `}>
              {/* Project Manager Section */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Projects</span>
                    <button 
                      onClick={triggerProjectJsonImport}
                      className="p-1 hover:text-orange-600 transition-colors"
                      title="Import Project"
                    >
                      <FileJson className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setProjectNameInput('New Project');
                      setActiveModal('create');
                    }}
                    className="p-1 hover:text-orange-600 transition-colors"
                    title="New Project"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                  {projects.map(p => (
                    <div 
                      key={p.id}
                      className={`group flex items-center justify-between gap-2 p-2 rounded-lg transition-all cursor-pointer ${currentProjectId === p.id ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200' : 'hover:bg-slate-100 text-slate-600'}`}
                      onClick={() => loadProject(p.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Box className={`w-3.5 h-3.5 flex-shrink-0 ${currentProjectId === p.id ? 'text-orange-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-slate-400">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetProjectId(p.id);
                            setProjectNameInput(p.name);
                            setActiveModal('rename');
                          }}
                          className="p-1 hover:text-orange-600 transition-colors"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetProjectId(p.id);
                            setActiveModal('delete');
                          }}
                          className="p-1 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Summary / Scope of Work (AI Partner Guidance) */}
              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Project Scope & Summary
                    </span>
                  </div>
                  <button
                    onClick={() => setShowExpandedSummary(true)}
                    className="p-1 px-2 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-700 rounded text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:scale-105 border border-transparent shadow-sm"
                    title="Expand overall summary and edit BOQ item codes/details inline in a spacious workspace"
                  >
                    <Maximize2 className="w-2.5 h-2.5 text-orange-500" />
                    Expand Workspace
                  </button>
                </div>
                
                <textarea
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                  placeholder="Describe overall project scope of work, standards, height, location, or constraints here. AI will use this general background context to tailor all individual BOQ estimates."
                  className="w-full text-[11px] font-medium p-2.5 bg-slate-50 hover:bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-orange-300 rounded-lg h-24 focus:ring-1 focus:ring-orange-300 outline-none text-slate-700 placeholder:text-slate-400 leading-relaxed transition-all resize-none shadow-inner"
                />
                
                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 font-semibold italic pl-0.5">
                  <span>Used dynamically by AI Estimator</span>
                  {scopeOfWork ? (
                    <span className="text-emerald-500 flex items-center gap-0.5 font-bold">
                      <Check className="w-2.5 h-2.5" /> Active
                    </span>
                  ) : (
                    <span>No summary (optional)</span>
                  )}
                </div>
              </div>

              {/* Search & Global Actions Bar */}
              <div className="p-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search BOQ..." 
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium focus:ring-1 ring-orange-400 focus:bg-white outline-none text-slate-800 transition-all placeholder:text-slate-400"
                      value={boqFilters.searchTerm}
                      onChange={(e) => setBoqFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={`p-1.5 rounded-md transition-all ${showAdvancedFilters ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-500' : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200'}`}
                      title={showAdvancedFilters ? "Hide Filters" : "Show Filters"}
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={addBoqItem}
                      className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-600 hover:text-orange-600 transition-all shadow-sm"
                      title="Add BOQ Item"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showAdvancedFilters && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2.5 pt-0.5"
                    >
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <BOQFilterDropdown 
                            label="Unit"
                            options={boqMetadata.units}
                            selected={boqFilters.selectedUnits || []}
                            onToggle={(unit) => {
                              setBoqFilters(prev => ({
                                ...prev,
                                selectedUnits: (prev.selectedUnits || []).includes(unit)
                                  ? (prev.selectedUnits || []).filter(u => u !== unit)
                                  : [...(prev.selectedUnits || []), unit]
                              }));
                            }}
                            onSelectAll={() => setBoqFilters(prev => ({ ...prev, selectedUnits: [...boqMetadata.units] }))}
                            onClearAll={() => setBoqFilters(prev => ({ ...prev, selectedUnits: [] }))}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <BOQFilterDropdown 
                            label="Code"
                            options={boqMetadata.codes}
                            selected={boqFilters.selectedCodes || []}
                            onToggle={(code) => {
                              setBoqFilters(prev => ({
                                ...prev,
                                selectedCodes: (prev.selectedCodes || []).includes(code)
                                  ? (prev.selectedCodes || []).filter(c => c !== code)
                                  : [...(prev.selectedCodes || []), code]
                              }));
                            }}
                            onSelectAll={() => setBoqFilters(prev => ({ ...prev, selectedCodes: [...boqMetadata.codes] }))}
                            onClearAll={() => setBoqFilters(prev => ({ ...prev, selectedCodes: [] }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider pl-0.5 mb-1 block">Quantity Range</label>
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              placeholder="Min"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 ring-orange-500 outline-none"
                              value={boqFilters.minQty || ''}
                              onChange={(e) => setBoqFilters(prev => ({ ...prev, minQty: e.target.value ? parseFloat(e.target.value) : null }))}
                            />
                            <input 
                              type="number"
                              placeholder="Max"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 ring-orange-500 outline-none"
                              value={boqFilters.maxQty || ''}
                              onChange={(e) => setBoqFilters(prev => ({ ...prev, maxQty: e.target.value ? parseFloat(e.target.value) : null }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider pl-0.5 mb-1 block">Budget Range</label>
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              placeholder="Min"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 ring-orange-500 outline-none"
                              value={boqFilters.minBudget || ''}
                              onChange={(e) => setBoqFilters(prev => ({ ...prev, minBudget: e.target.value ? parseFloat(e.target.value) : null }))}
                            />
                            <input 
                              type="number"
                              placeholder="Max"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 ring-orange-500 outline-none"
                              value={boqFilters.maxBudget || ''}
                              onChange={(e) => setBoqFilters(prev => ({ ...prev, maxBudget: e.target.value ? parseFloat(e.target.value) : null }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 mt-1">
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={triggerBoqExcelImport}
                            className="p-1 px-1.5 hover:bg-slate-100 rounded text-[8px] font-bold text-slate-500 hover:text-orange-600 transition-colors uppercase tracking-widest flex items-center gap-1"
                          >
                            <FileSpreadsheet className="w-2.5 h-2.5" />
                            Import
                          </button>
                          <button 
                            onClick={recalculateAllTotals}
                            className="p-1 px-1.5 hover:bg-slate-100 rounded text-[8px] font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-1"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            Refit
                          </button>
                        </div>
                        <button 
                          onClick={() => setBoqFilters({
                            searchTerm: '',
                            selectedUnits: [],
                            selectedCodes: [],
                            minQty: null,
                            maxQty: null,
                            minBudget: null,
                            maxBudget: null,
                            minRate: null,
                            maxRate: null,
                            sortKey: null,
                            sortOrder: 'asc',
                            selectedPackages: []
                          })}
                          className="text-[8px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest px-1.5 py-0.5 border border-transparent hover:border-red-100 rounded"
                        >
                          Reset
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Selection & Bulk Actions Context Bar */}
              <div className={`px-3 py-2 border-b border-slate-100 flex items-center justify-between transition-all duration-300 ${selectedBOQItemIds.size > 0 ? 'bg-orange-50' : 'bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 group cursor-pointer" onClick={toggleSelectAllBOQ}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedBOQItemIds.size > 0 ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-300'}`}>
                    {selectedBOQItemIds.size > 0 && (
                      selectedBOQItemIds.size === filteredBoqItems.length ? <Check className="w-2.5 h-2.5 stroke-[4px]" /> : <div className="w-1.5 h-0.5 bg-white rounded-full" />
                    )}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${selectedBOQItemIds.size > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                    {selectedBOQItemIds.size > 0 ? `${selectedBOQItemIds.size} Selected` : 'Selection'}
                  </span>
                </div>
                
                <AnimatePresence mode="wait">
                  {selectedBOQItemIds.size > 0 ? (
                    <motion.div 
                      key="actions"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-1.5"
                    >
                      {isAiEstimating ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); stopAiEstimation(); }}
                          className="p-1 px-2.5 bg-red-600 text-white rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <Square className="w-2.5 h-2.5 fill-white" />
                          Stop
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={handleBulkAiEstimation}
                            className="p-1 px-2.5 bg-orange-600 text-white rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm hover:bg-orange-700 active:scale-95 transition-all"
                            title="Generate AI Estimate for all selected"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            AI
                          </button>
                          {selectedBOQItemIds.size >= 2 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); linkBOQItems(); }}
                              className="p-1 px-2.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                              title="Sync activities across selected items"
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              Link
                            </button>
                          )}
                          {boqItems.some(item => selectedBOQItemIds.has(item.id) && item.linkingId) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); unlinkBOQItems(); }}
                              className="p-1 px-2.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm hover:bg-slate-200 active:scale-95 transition-all"
                              title="Remove synchronization for selected items"
                            >
                              <Link2Off className="w-2.5 h-2.5" />
                              Unlink
                            </button>
                          )}
                          <button 
                            onClick={bulkDeleteBOQItems}
                            className="p-1 px-1.5 bg-white text-red-500 border border-red-200 rounded-md hover:bg-red-50 active:scale-95 transition-all"
                            title="Delete Selected"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="stats"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic"
                    >
                      {filteredBoqItems.length} items found
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredBoqItems.map(item => (
                  <BOQItemRow 
                    key={item.id}
                    item={item}
                    isSelected={selectedBoqId === item.id}
                    isEditing={editingBoqId === item.id}
                    isExpanded={expandedBoqInTableId === item.id}
                    onToggleExpand={() => setExpandedBoqInTableId(expandedBoqInTableId === item.id ? null : item.id)}
                    onSelect={() => {
                        setSelectedBoqId(item.id);
                        setIsMobileSidebarOpen(false);
                    }}
                    onToggleSelection={toggleBOQItemSelection}
                    onEdit={(id) => {
                        setEditingBoqId(id);
                        setEditFields({ 
                          code: item.code || '',
                          description: item.description, 
                          quantity: item.quantity, 
                          unit: item.unit,
                          package: item.package || ''
                        });
                    }}
                    onDelete={deleteBoqItem}
                    onAiEstimate={(item) => {
                        if (isAiEstimating) {
                            stopAiEstimation();
                        } else {
                            handleAiEstimation(item);
                        }
                    }}
                    isAiEstimating={isAiEstimating}
                    formatPrice={formatPrice}
                    isSelectedForBulk={selectedBOQItemIds.has(item.id)}
                    editingState={editFields}
                    setEditingState={setEditFields}
                    onSaveEdit={(id) => {
                        updateBoqItem(id, editFields);
                        setEditingBoqId(null);
                    }}
                    onCancelEdit={() => setEditingBoqId(null)}
                    onToggleRateSource={toggleRateSource}
                    onUnlink={unlinkBOQItems}
                    onAddItemAfter={addBoqItem}
                    onDragStart={(id) => setDraggedBoqItemId(id)}
                    onDragEnd={() => {
                        setDraggedBoqItemId(null);
                        setDragOverItemId(null);
                    }}
                    onDragOver={(id) => setDragOverItemId(id)}
                    onDragLeave={() => setDragOverItemId(null)}
                    onDrop={handleMoveBoqItem}
                    isDragOver={dragOverItemId === item.id}
                  />
                ))}
            {filteredBoqItems.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No items found</p>
              </div>
            )}
          </div>
          {/* App Settings Footer */}
          <div className="px-3 py-2 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-1.5 shrink-0">
             <div className="flex items-center gap-1" title="Country" style={{ maxWidth: '80px' }}>
               <Globe className="w-3 h-3 text-slate-400 shrink-0" />
               <select 
                 value={country}
                 onChange={(e) => {
                   const newCountry = e.target.value;
                   setCountry(newCountry);
                   const countryCurrencyMap: Record<string, string> = {
                     'Saudi Arabia': 'SAR', 'United Arab Emirates': 'AED', 'Egypt': 'EGP', 'USA': 'USD', 'UK': 'GBP',
                     'India': 'INR', 'Jordan': 'JOD', 'Kuwait': 'KWD', 'Oman': 'OMR', 'Qatar': 'QAR', 'Bahrain': 'BHD',
                   };
                   if (countryCurrencyMap[newCountry]) setCurrencyCode(countryCurrencyMap[newCountry]);
                 }}
                 className="text-[9px] font-bold text-slate-700 bg-transparent border-none outline-none p-0 focus:ring-0 cursor-pointer hover:text-orange-600 transition-colors truncate w-full"
               >
                 {COUNTRIES.map(c => (
                   <option key={c.code} value={c.name} className="bg-white text-slate-900">{c.name}</option>
                 ))}
               </select>
             </div>
             <div className="h-3 w-px bg-slate-200" />
             <div className="flex items-center gap-1" title="Currency">
               <Banknote className="w-3 h-3 text-slate-400 shrink-0" />
               <select 
                 value={currencyCode}
                 onChange={(e) => setCurrencyCode(e.target.value)}
                 className="text-[9px] font-bold text-slate-700 bg-transparent border-none outline-none p-0 focus:ring-0 cursor-pointer hover:text-orange-600 transition-colors w-9"
               >
                 {CURRENCIES.map(c => (
                   <option key={c.code} value={c.code} className="bg-white text-slate-900">{c.code}</option>
                 ))}
               </select>
             </div>
             <div className="h-3 w-px bg-slate-200" />
             <div className="flex items-center gap-1" title="Working Hours/Day">
               <Clock className="w-3 h-3 text-slate-400 shrink-0" />
               <NumericInput 
                 value={workingHoursPerDay}
                 onChange={handleWorkingHoursChange}
                 className="w-5 text-[9px] font-bold text-slate-700 bg-transparent border-none outline-none p-0 focus:ring-0 text-center hover:text-orange-600 transition-colors"
               />
             </div>
             <div className="h-3 w-px bg-slate-200" />
             <div className="flex items-center gap-1" title="Working Days/Week">
               <CalendarDays className="w-3 h-3 text-slate-400 shrink-0" />
               <NumericInput 
                 value={workingDaysPerWeek}
                 onChange={handleWorkingDaysChange}
                 className="w-5 text-[9px] font-bold text-slate-700 bg-transparent border-none outline-none p-0 focus:ring-0 text-center hover:text-orange-600 transition-colors"
               />
             </div>
             <div className="h-3 w-px bg-slate-200" />
             <label className="flex items-center gap-1.5 cursor-pointer title" title="Include Indirect Cost (Delivery & Logistics) in AI Estimation">
               <input 
                 type="checkbox" 
                 checked={aiConsiderIndirectCost}
                 onChange={(e) => setAiConsiderIndirectCost(e.target.checked)}
                 className="w-3 h-3 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
               />
               <span className="text-[9px] font-bold text-slate-700 flex items-center gap-1"><Sparkles className="w-3 h-3 text-orange-500" /> AI Indirect Cost</span>
             </label>
           </div>
          {/* Compact User Profile Footer */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                 <span className="text-[10px] font-bold text-slate-700 truncate">{user?.displayName || 'Engineer'}</span>
                 <span className="text-[8px] font-medium text-slate-500 truncate uppercase mt-0.5">{user?.email}</span>
              </div>
            </div>
            <button 
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all shrink-0" 
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
          {user && !user.emailVerified && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800 shrink-0 z-20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Email Verification Required:</strong> Cloud sync requires a verified email. Changes are saved locally on this machine.
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    if (auth.currentUser) {
                      const { sendEmailVerification } = await import('firebase/auth');
                      await sendEmailVerification(auth.currentUser);
                      setNotification({ message: "Verification email sent. Please check your inbox.", type: 'info' });
                    }
                  } catch (e: any) {
                    setNotification({ message: e.message || "Failed to send email verification", type: 'error' });
                  }
                }}
                className="text-amber-900 underline font-semibold hover:text-amber-700 ml-4 shrink-0"
              >
                Resend Verification
              </button>
            </div>
          )}
          {view === 'boq' ? (
            <AnimatePresence mode="wait">
              {selectedBoq ? (
            <motion.div
               key={selectedBoq.id}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden font-sans"
             >
               {/* Activities List */}
               <section className="col-span-1 lg:col-span-5 xl:col-span-4 p-3 md:p-5 lg:p-6 border-b lg:border-r border-slate-200 flex flex-col bg-white text-slate-900 lg:overflow-hidden transition-colors">
                 <div className="flex items-center gap-3 mb-4 md:mb-6 shrink-0">
                    <button 
                      onClick={() => setSelectedBoqId(null)}
                      className="p-2 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200 hover:bg-orange-600 hover:shadow-orange-200 transition-all active:scale-95 group"
                      title="Back to Project Dashboard"
                    >
                      <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm md:text-base lg:text-lg font-bold leading-none truncate pr-2">
                          Detailed Breakdown
                        </h2>
                      </div>
                      <p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 truncate">
                        Item {currentBoqIndex + 1} of {filteredBoqItems.length}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={goToPrevBoq}
                        disabled={currentBoqIndex <= 0}
                        className={`p-1.5 rounded-lg transition-all ${currentBoqIndex <= 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-white hover:text-orange-600 hover:shadow-sm shadow-slate-200'}`}
                        title="Previous Item (Left Arrow)"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-0.5" />
                      <button 
                        onClick={goToNextBoq}
                        disabled={currentBoqIndex >= filteredBoqItems.length - 1}
                        className={`p-1.5 rounded-lg transition-all ${currentBoqIndex >= filteredBoqItems.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-white hover:text-orange-600 hover:shadow-sm shadow-slate-200'}`}
                        title="Next Item (Right Arrow)"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                 </div>

                 {/* Ultra Compact BOQ Item Preview */}
                 <div className="mb-3 md:mb-4 p-2 md:p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-orange-200 group/preview relative overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                    <div className="flex items-center justify-between gap-2 md:gap-3">
                      <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
                        <span className="text-[7px] md:text-[8px] font-black text-white bg-slate-900 px-1 md:px-1.5 py-0.5 rounded shrink-0">{selectedBoq.code}</span>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-800 whitespace-normal" title={selectedBoq.description}>
                          {selectedBoq.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 shrink-0 border-l border-slate-200 pl-2 md:pl-3">
                        <div className="text-right">
                          <p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">Qty</p>
                          <p className="text-[8px] md:text-[9px] font-black text-slate-900 font-mono">{selectedBoq.quantity.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">Unit</p>
                          <p className="text-[8px] md:text-[9px] font-black text-slate-900 uppercase">{selectedBoq.unit}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedBoq.rateSource === 'Subcontractor' && (
                    <div className="mb-4 p-3 bg-orange-600 rounded-xl text-white shadow-lg shadow-orange-500/20 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-80">Active Rate Source</p>
                          <p className="text-xs font-bold">Subcontractor Rate Selected</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleRateSource(selectedBoq.id, 'Study')}
                        className="px-4 py-1.5 bg-white text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all font-bold shadow-sm"
                      >
                        Use Study
                      </button>
                    </div>
                  )}

                  {selectedBoq.rateSource !== 'Subcontractor' && selectedBoq.subcontractorRate !== undefined && selectedBoq.subcontractorRate > 0 && (
                    <div className="mb-4 p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                          <LayoutList className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-80">Active Rate Source</p>
                          <p className="text-xs font-bold">Detailed Study Selected</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-[8px] font-bold opacity-70 uppercase tracking-tighter leading-none">Subcon Rate</p>
                          <p className="text-[10px] font-mono font-bold leading-none">{formatPrice(selectedBoq.subcontractorRate)}</p>
                        </div>
                        <button 
                          onClick={() => toggleRateSource(selectedBoq.id, 'Subcontractor')}
                          className="px-4 py-1.5 bg-white text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all font-bold shadow-sm"
                        >
                          Use Subcon
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4 shrink-0">
                      {isAiEstimating ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); stopAiEstimation(); }}
                          className="bg-red-600 hover:bg-red-700 text-white p-1.5 md:p-2 rounded-lg shadow-lg shadow-red-500/20 transition-all font-bold text-[10px] px-2 md:px-3 flex items-center gap-1 md:gap-1.5"
                          title="Stop AI Estimation"
                        >
                          <Square className="w-3 h-3 md:w-3.5 md:h-3.5 fill-white" />
                          <span className="hidden sm:inline">Stop AI</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleAiEstimation(selectedBoq)}
                          disabled={isAiEstimating}
                          className={`bg-orange-50 hover:bg-orange-100 text-orange-600 p-1.5 md:p-2 rounded-lg border border-orange-200 transition-all font-bold text-[10px] px-2 md:px-3 flex items-center gap-1 md:gap-1.5 shadow-sm ${isAiEstimating ? 'animate-pulse cursor-not-allowed opacity-70' : ''}`}
                          title="AI Estimate Breakdown"
                        >
                          <Sparkles className={`w-3 h-3 md:w-3.5 md:h-3.5 ${isAiEstimating ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">{isAiEstimating ? 'AI Thinking...' : 'AI Breakdown'}</span>
                        </button>
                      )}
                      <button 
                        onClick={() => setShowTemplatePicker(selectedBoq.id)}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-1.5 rounded-lg border border-indigo-200 transition-all font-bold text-[10px] px-2"
                        title="Apply Template"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => addActivity(selectedBoq.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-[28px] px-3 rounded-lg shadow-sm shadow-indigo-500/10 font-black uppercase tracking-tight text-[8px] flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" /> Add New Activity
                      </button>
                    </div>

                    <div ref={activitiesScrollRef} className="flex-1 overflow-y-auto light-scrollbar border border-border rounded-xl flex flex-col min-h-0 bg-white">
                      {selectedBoq.rateSource === 'Subcontractor' ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
                          <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-600 mb-4 shadow-sm">
                            <Truck className="w-8 h-8" />
                          </div>
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Subcontractor Mode</h3>
                          <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
                            Detailed activities are hidden because you are using a direct subcontractor rate for this item.
                          </p>
                          
                          {subcontractorOffers.find(o => o.isChosen && (o.itemRates || {})[selectedBoq.id] === selectedBoq.subcontractorRate) ? (
                            <div className="mt-8 bg-orange-50 p-5 rounded-2xl border border-orange-100 w-full max-w-sm flex items-center gap-4 transition-all">
                              <div className="p-3 bg-white rounded-xl shadow-sm border border-orange-100 text-orange-600">
                                <Trophy className="w-6 h-6" />
                              </div>
                              <div className="text-left">
                                <p className="text-[7px] font-black text-orange-400 uppercase tracking-[0.2em] mb-0.5">Winning Subcontractor</p>
                                <p className="text-sm font-black text-slate-800 uppercase">
                                  {subcontractorOffers.find(o => o.isChosen && (o.itemRates || {})[selectedBoq.id] === selectedBoq.subcontractorRate)?.name}
                                </p>
                                <p className="text-xs font-mono font-bold text-orange-600 mt-1">
                                  {formatPrice(selectedBoq.subcontractorRate || 0)} / {selectedBoq.unit}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-8 bg-slate-50 p-5 rounded-2xl border border-slate-100 w-full max-w-sm flex flex-col items-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase italic">Manual Rate or Unnamed Offer</p>
                              <p className="text-xl font-mono font-black text-slate-700 mt-1">
                                {formatPrice(selectedBoq.subcontractorRate || 0)}
                              </p>
                            </div>
                          )}

                          <button 
                            onClick={() => toggleRateSource(selectedBoq.id, 'Study')}
                            className="mt-8 px-6 py-2.5 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                          >
                            Switch to Detailed Study
                          </button>
                        </div>
                      ) : (
                        <>
                          {(selectedBoq.activities || []).map(activity => (
                            <ActivityPanelItem 
                              key={activity.id}
                              activity={activity}
                              boqId={selectedBoq.id}
                              updateActivity={updateActivity}
                              deleteActivity={deleteActivity}
                              saveActivityAsTemplate={saveActivityAsTemplate}
                              formatPrice={formatPrice}
                            />
                          ))}

                          {(selectedBoq.activities || []).length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                              <div className="h-64 w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl transition-colors bg-slate-50/30 p-6">
                                <Truck className="w-8 h-8 text-slate-200 mb-2" />
                                <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-4">No Study Created Yet</p>
                                <div className="flex flex-col gap-2 w-full max-w-xs">
                                  <button 
                                    onClick={() => addActivity(selectedBoq.id)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                                  >
                                    <Plus className="w-3 h-3" /> Create Detailed Study
                                  </button>
                                  <div className="flex items-center gap-2 my-2">
                                    <div className="h-px bg-slate-200 flex-1" />
                                    <span className="text-[8px] font-black text-slate-300 uppercase">OR</span>
                                    <div className="h-px bg-slate-200 flex-1" />
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const el = document.getElementById('subcon-section');
                                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-orange-200 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all shadow-sm"
                                  >
                                    <LayoutList className="w-3 h-3" /> Select from Comparison
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>

                {/* Resource Assignment Panel */}
                <section className="col-span-1 lg:col-span-7 xl:col-span-8 p-2 md:p-4 lg:p-6 bg-slate-50 flex flex-col lg:overflow-hidden transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-4">
                      <h2 className="text-sm md:text-lg font-bold text-slate-900 leading-tight">Resource Assignment</h2>
                      <div className="flex items-center gap-1.5 md:gap-2 bg-white border border-slate-200 px-2 py-1.5 rounded-lg transition-colors">
                        <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Filter:</span>
                        <select 
                          value={assignmentTypeFilter}
                          onChange={(e) => setAssignmentTypeFilter(e.target.value as any)}
                          className="text-[9px] md:text-[10px] font-bold text-slate-900 bg-transparent border-none outline-none p-0 focus:ring-0 cursor-pointer transition-colors"
                        >
                          <option value="All" className="bg-white text-slate-900">All Types</option>
                          <option value="Labor" className="bg-white text-slate-900">Labor only</option>
                          <option value="Material" className="bg-white text-slate-900">Material only</option>
                          <option value="Equipment" className="bg-white text-slate-900">Equipment only</option>
                          <option value="Subcontractor" className="bg-white text-slate-900">Subcontractor only</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1 ml-0 md:ml-2">
                        <button 
                          onClick={expandAllActivities}
                          className="p-1 px-1.5 md:px-2 hover:bg-slate-200 bg-slate-100 rounded border border-slate-200 text-[8px] md:text-[9px] font-black uppercase text-slate-600 transition-all hover:text-indigo-600"
                        >
                          Expand
                        </button>
                        <button 
                          onClick={collapseAllActivities}
                          className="p-1 px-1.5 md:px-2 hover:bg-slate-200 bg-slate-100 rounded border border-slate-200 text-[8px] md:text-[9px] font-black uppercase text-slate-600 transition-all hover:text-orange-600"
                        >
                          Collapse
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                      {selectedResourceIds.size > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => setShowBulkEdit(true)}
                            className="text-[9px] sm:text-[10px] px-2 py-1.5 bg-indigo-600 text-white font-bold rounded shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <Edit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Bulk Edit ({selectedResourceIds.size})
                          </button>
                          <button 
                            onClick={() => setShowResourceDeleteConfirm(true)}
                            className="text-[9px] sm:text-[10px] px-2 py-1.5 bg-red-600 text-white font-bold rounded shadow-sm hover:bg-red-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Bulk Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col min-h-0">
                    {selectedBoq.rateSource === 'Subcontractor' ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 mt-2">
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-4 animate-pulse">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Subcontractor Rate Active</h3>
                        <p className="text-xs text-slate-400 font-medium">Resources are managed directly via the market rate.</p>
                      </div>
                    ) : (selectedBoq.activities || []).length > 0 ? (
                      <div className="rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 transition-colors bg-white">
                        <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0 transition-colors">
                          <span className="text-xs font-bold truncate pr-4">Active Activity Planning</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              className="w-3 h-3 rounded bg-white/10 border-white/20 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                              checked={(selectedBoq.activities || []).every(a => (a.resources || []).every(r => selectedResourceIds.has(r.id)))}
                              onChange={(e) => {
                                const allIds = (selectedBoq.activities || []).flatMap(a => (a.resources || []).map(r => r.id));
                                if (e.target.checked) setSelectedResourceIds(new Set(allIds));
                                else setSelectedResourceIds(new Set());
                              }}
                            />
                            <span className="text-[10px] text-slate-300 font-mono">Select All</span>
                          </div>
                        </div>
                        
                        <div ref={resourcesScrollRef} className="p-4 space-y-6 overflow-y-auto flex-1">
                          {/* Each activity's resources grouped */}
                          {(selectedBoq.activities || []).map(activity => (
                             <div key={activity.id} className="pb-4 border-b border-slate-100 last:border-0">
                               <div className="flex flex-col gap-2 mb-3">
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2 flex-1 min-w-0">
                                     <button 
                                       onClick={() => toggleActivityExpansion(activity.id)}
                                       className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-indigo-600 shrink-0"
                                     >
                                       {expandedActivityIds.has(activity.id) ? (
                                         <ChevronDown className="w-3.5 h-3.5" />
                                       ) : (
                                         <ChevronRight className="w-3.5 h-3.5" />
                                       )}
                                     </button>
                                     <input 
                                        type="checkbox"
                                        className="w-3 h-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500 focus:ring-offset-white"
                                        checked={(activity.resources || []).length > 0 && (activity.resources || []).every(r => selectedResourceIds.has(r.id))}
                                        onChange={(e) => {
                                          const actIds = (activity.resources || []).map(r => r.id);
                                          setSelectedResourceIds(prev => {
                                            const next = new Set(prev);
                                            if (e.target.checked) actIds.forEach(id => next.add(id));
                                            else actIds.forEach(id => next.delete(id));
                                            return next;
                                          });
                                        }}
                                      />
                                        <h4 
                                          className="text-xs font-black text-slate-800 uppercase tracking-tight leading-relaxed transition-colors break-words flex-1 cursor-pointer hover:text-indigo-600"
                                          onClick={() => toggleActivityExpansion(activity.id)}
                                        >
                                          {activity.name}
                                        </h4>
                                        <div className="flex items-center gap-1.5 mr-2">
                                          <div className="px-2 py-0.5 bg-indigo-50 rounded text-[9px] font-mono font-bold text-indigo-600 border border-indigo-100 whitespace-nowrap" title="Unit Rate">
                                            {formatPrice(activity.unitRate)}/{activity.unit || 'u'}
                                          </div>
                                          <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-mono font-bold text-slate-600 border border-slate-200 whitespace-nowrap" title="Total Cost">
                                            {formatPrice(activity.totalCost)}
                                          </div>
                                        </div>
                                   </div>
                                   <div className="flex gap-1">
                                     <button 
                                       onClick={() => setShowLibrary(true)} 
                                       className="p-1 hover:bg-slate-100 rounded mr-2 transition-colors" 
                                       title="Browse Library"
                                     >
                                       <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                     </button>
                                     <button onClick={(e) => handleAddResourceClick(e, selectedBoq.id, activity.id, 'Labor')} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Add Labor"><Users className="w-3.5 h-3.5 text-blue-600" /></button>
                                     <button onClick={(e) => handleAddResourceClick(e, selectedBoq.id, activity.id, 'Material')} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Add Material"><Box className="w-3.5 h-3.5 text-emerald-600" /></button>
                                     <button onClick={(e) => handleAddResourceClick(e, selectedBoq.id, activity.id, 'Equipment')} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Add Equipment"><Hammer className="w-3.5 h-3.5 text-orange-600" /></button>
                                     <button onClick={(e) => handleAddResourceClick(e, selectedBoq.id, activity.id, 'Subcontractor')} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Add Subcon"><Truck className="w-3.5 h-3.5 text-purple-600" /></button>
                                     {resourceClipboard && (
                                       <button 
                                         onClick={() => pasteResource(selectedBoq.id, activity.id)} 
                                         className="p-1 hover:bg-indigo-100 bg-indigo-50 rounded ml-2 flex items-center gap-1 px-2 border border-indigo-200 transition-colors" 
                                         title={`Paste as ${resourceClipboard.isLink ? (resourceClipboard.linkType === 'full' ? 'Full Link' : 'Price Link') : 'Independent Copy'}`}
                                       >
                                         <ClipboardPaste className="w-3 h-3 text-indigo-600" />
                                         <span className="text-[9px] font-bold text-indigo-700 uppercase underline-offset-1 transition-colors">Paste</span>
                                       </button>
                                     )}
                                   </div>
                                 </div>
                                 
                                 {/* Type Breakdown */}
                                 {expandedActivityIds.has(activity.id) && (
                                   <div className="mt-4 space-y-4">
                                     <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                                       {(['Labor', 'Material', 'Equipment', 'Subcontractor'] as ResourceType[]).map(type => {
                                     const total = activity.resources.filter(r => r.type === type).reduce((sum, r) => sum + r.totalPrice, 0);
                                     if (total === 0) return null;
                                     const unitRate = selectedBoq.quantity > 0 ? total / selectedBoq.quantity : 0;
                                     
                                     return (
                                       <div key={type} className="flex flex-col shrink-0 transition-all group/type">
                                         <div className="flex items-center gap-1.5 mb-0.5">
                                           <div className={`w-1.5 h-1.5 rounded-full ${
                                             type === 'Labor' ? 'bg-blue-500' : 
                                             type === 'Material' ? 'bg-emerald-500' : 
                                             type === 'Equipment' ? 'bg-orange-500' : 'bg-purple-500'
                                           }`} />
                                           <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider transition-colors group-hover/type:text-slate-900">{type} Sum</span>
                                         </div>
                                         <div className="flex flex-col pl-3 border-l border-slate-200">
                                           <span className="text-[11px] font-mono font-black text-slate-900 leading-none">
                                             {formatPrice(total)}
                                           </span>
                                         </div>
                                       </div>
                                     );
                                   })}
                                 </div>
                                <div className="space-y-1 overflow-x-hidden">
                                 <div className="grid grid-cols-12 gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 px-1">
                                   <div className="col-span-4">Resource Identity</div>
                                   <div className="col-span-3 text-center">Estimation Engine</div>
                                   <div className="col-span-3 text-center">Market Rate & Units</div>
                                   <div className="col-span-2 text-right pr-2">Subtotal</div>
                                 </div>
                                 {activity.resources
                                   .filter(res => assignmentTypeFilter === 'All' || res.type === assignmentTypeFilter)
                                   .map(res => (
                                   <div key={res.id} className={`group grid grid-cols-12 items-center gap-2 text-[11px] py-1.5 rounded-lg px-2 transition-all border-b border-slate-50 last:border-0 ${selectedResourceIds.has(res.id) ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-slate-50'}`}>
                                       <div className="col-span-4 flex items-center gap-2 min-w-0">
                                        <input 
                                          type="checkbox"
                                          className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white shrink-0"
                                          checked={selectedResourceIds.has(res.id)}
                                          onChange={() => toggleResourceSelection(res.id)}
                                        />
                                        <div className={`shrink-0 ${res.type === 'Labor' ? 'text-blue-600' : res.type === 'Material' ? 'text-emerald-600' : res.type === 'Equipment' ? 'text-orange-600' : 'text-purple-600'}`}>
                                          <ResourceTypeIcon type={res.type} />
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <input 
                                            type="text" 
                                            value={res.name}
                                            onChange={(e) => updateResource(selectedBoq.id, activity.id, res.id, { name: e.target.value })}
                                            onKeyDown={handleKeyDown}
                                            className="w-full bg-transparent border-none outline-none p-0 focus:ring-0 truncate font-bold text-slate-900 leading-tight transition-colors"
                                          />
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] text-slate-400 font-mono font-bold truncate leading-tight">
                                              {res.quantity.toFixed(3)} {res.unit}
                                            </span>
                                            {res.linkedResourceId && (
                                              <span className={`px-1 rounded-[2px] text-[7px] font-black uppercase ${res.linkType === 'full' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>Linked</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="col-span-3 flex items-center gap-1.5 justify-center bg-slate-100/30 rounded py-1 px-1.5 transition-all">
                                        {(res.type !== 'Material' && res.type !== 'Subcontractor') ? (
                                          <div className="flex items-center gap-3 w-full justify-center">
                                            <div className="flex flex-col items-center">
                                              <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1">Count</span>
                                              <NumericInput 
                                                value={res.resourceCount || 1}
                                                onChange={(val) => updateResource(selectedBoq.id, activity.id, res.id, { resourceCount: val || 1 })}
                                                onKeyDown={handleKeyDown}
                                                className="w-10 text-center bg-white border border-slate-200 rounded shadow-sm h-5 p-0 focus:ring-1 ring-indigo-500 font-mono text-[10px] text-slate-900 font-bold"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center opacity-30">
                                               <span className="text-[7px] uppercase font-black tracking-tighter leading-none mb-1">Prod</span>
                                               <span className="text-[10px] font-mono font-bold leading-none">{activity.productivity || 1}</span>
                                            </div>
                                          </div>
                                        ) : res.type === 'Material' ? (
                                          <div className="flex items-center gap-1.5 justify-between w-full">
                                            <div className="flex flex-col items-center flex-1">
                                              <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1">Cons</span>
                                              <NumericInput 
                                                value={res.consumption || 0}
                                                onChange={(val) => updateResource(selectedBoq.id, activity.id, res.id, { consumption: val || 0 })}
                                                className="w-full text-center bg-white border border-slate-200 rounded h-5 p-0 focus:ring-1 ring-indigo-500 font-mono text-[9px] font-bold"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center flex-1">
                                              <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1">Waste%</span>
                                              <NumericInput 
                                                value={res.wastePercentage || 0}
                                                onChange={(val) => updateResource(selectedBoq.id, activity.id, res.id, { wastePercentage: val || 0 })}
                                                className="w-full text-center bg-white border border-slate-200 rounded h-5 p-0 focus:ring-1 ring-indigo-500 font-mono text-[9px] font-bold"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center flex-1">
                                              <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1">Uses</span>
                                              <NumericInput 
                                                value={res.usages || 1}
                                                onChange={(val) => updateResource(selectedBoq.id, activity.id, res.id, { usages: val || 1 })}
                                                className="w-full text-center bg-white border border-slate-200 rounded h-5 p-0 focus:ring-1 ring-indigo-500 font-mono text-[9px] font-bold"
                                              />
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center w-full">
                                            <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1">Total Fixed Quantity</span>
                                            <NumericInput 
                                              value={res.quantity}
                                              onChange={(val) => updateResource(selectedBoq.id, activity.id, res.id, { quantity: val })}
                                              className="w-20 text-center bg-white border border-slate-200 rounded h-5 p-0 focus:ring-1 ring-indigo-500 font-mono text-[10px] font-bold shadow-sm"
                                            />
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="col-span-3 flex items-center gap-1 bg-slate-50 p-1 rounded border border-slate-100 transition-colors">
                                        <div className="flex flex-col items-center flex-1">
                                          <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1 italic">
                                            {res.type === 'Labor' || res.type === 'Equipment' ? 'Rate/Hr' : 'Rate'}
                                          </span>
                                          <div className="flex items-center bg-white border border-slate-200 rounded shadow-sm h-5 px-1 w-full transition-colors">
                                            <span className="text-[8px] text-slate-400 font-bold mr-0.5">{currency.symbol} </span>
                                            <NumericInput 
                                              value={Number((res.unitPrice || 0).toFixed(2))}
                                              onChange={(val) => updateResource(selectedBoq.id, activity.id, res.id, { unitPrice: Number((val || 0).toFixed(2)) })}
                                              onKeyDown={handleKeyDown}
                                              className="w-full text-right bg-transparent border-none outline-none p-0 focus:ring-0 font-mono text-[10px] text-slate-900 font-bold"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-center flex-1 min-w-0">
                                          <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-1 italic">Unit</span>
                                          {res.type === 'Labor' || res.type === 'Equipment' ? (
                                            <div className="w-full text-center bg-slate-100 border border-slate-200 rounded font-mono text-slate-400 h-5 text-[9px] flex items-center justify-center font-bold">
                                              hr
                                            </div>
                                          ) : (
                                            <select 
                                              value={res.unit}
                                              onChange={(e) => updateResource(selectedBoq.id, activity.id, res.id, { unit: e.target.value })}
                                              className="w-full text-center bg-white border border-slate-200 outline-none rounded font-mono text-slate-600 h-5 text-[9px] shadow-sm appearance-none cursor-pointer font-bold leading-none px-0.5"
                                            >
                                              {RESOURCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="col-span-2 text-right relative group/actions flex flex-col justify-center pr-2 h-10 overflow-hidden">
                                        <div className="flex flex-col items-end transition-all duration-300 group-hover/actions:opacity-0 group-hover/actions:-translate-y-2">
                                          <p className="text-[7px] text-slate-500 uppercase font-black tracking-tighter mb-0.5">Unit Cost</p>
                                          <p className="font-mono font-black text-indigo-600 text-[10px] sm:text-[11px] leading-none tabular-nums">
                                            {formatPrice(res.totalPrice)}
                                          </p>
                                        </div>
                                        
                                        <div className="absolute inset-0 flex items-center justify-end px-1 opacity-0 group-hover/actions:opacity-100 transition-all duration-300 bg-white/95 backdrop-blur-[1px] gap-0.5 translate-y-4 group-hover/actions:translate-y-0">
                                          <button 
                                            onClick={() => addToLibrary(res)} 
                                            className="p-1 hover:bg-amber-50 rounded text-slate-300 hover:text-amber-500 transition-all"
                                            title="Add to Library"
                                          >
                                            <Library className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => copyResource(res, false)} 
                                            className="p-1 hover:bg-blue-50 rounded text-slate-300 hover:text-blue-500 transition-all"
                                            title="Independent Copy"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </button>
                                          <div className="flex flex-col gap-0.5">
                                            <button 
                                              onClick={() => copyResource(res, true, 'price')} 
                                              className="p-1 hover:bg-indigo-50 rounded text-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center leading-none"
                                              title="Link Unit Rate"
                                            >
                                              <Link className="w-2.5 h-2.5" />
                                              <span className="text-[5px] font-black uppercase mt-0.5">Rate</span>
                                            </button>
                                          </div>
                                          <button 
                                            onClick={() => deleteResource(selectedBoq.id, activity.id, res.id)} 
                                            className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 transition-all"
                                            title="Delete Resource"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {res.linkedResourceId && (
                                          <div className="absolute top-1 right-2 group-hover/actions:opacity-0 transition-opacity">
                                            <div className={`p-0.5 rounded-full shadow-sm ${res.linkType === 'full' ? 'bg-indigo-500' : 'bg-slate-400'} text-white`}>
                                              <Link className="w-1.5 h-1.5" />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                 {(activity.resources || []).length === 0 && (
                                   <p className="text-[10px] text-slate-300 italic py-1 transition-colors">No resources assigned</p>
                                 )}
                                   </div>
                                 </div>
                               )}
                             </div>
                           </div>
                         ))}
                        </div>

                        <div className="px-4 md:px-6 py-3 bg-white border-t border-slate-200 shrink-0 flex flex-col lg:flex-row items-center justify-between gap-4 transition-all group/summary">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto flex-1">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Labor</span>
                              <span className="text-[11px] font-bold text-blue-600 font-mono whitespace-nowrap">{formatPrice(boqCategoryTotals.Labor)}</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-4">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Material</span>
                              <span className="text-[11px] font-bold text-emerald-600 font-mono whitespace-nowrap">{formatPrice(boqCategoryTotals.Material)}</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-4">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Equipment</span>
                              <span className="text-[11px] font-bold text-orange-600 font-mono whitespace-nowrap">{formatPrice(boqCategoryTotals.Equipment)}</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-4">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subcon</span>
                              <span className="text-[11px] font-bold text-purple-600 font-mono whitespace-nowrap">{formatPrice(boqCategoryTotals.Subcontractor)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between lg:justify-end gap-6 sm:gap-8 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">Unit Rate</span>
                              <div className="flex items-baseline gap-1">
                                <span className={`text-base sm:text-lg font-black tracking-tight tabular-nums whitespace-nowrap ${selectedBoq.rateSource === 'Subcontractor' ? 'text-orange-600' : 'text-slate-900'}`}>{formatPrice(selectedBoq.unitRate)}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase italic">/ {selectedBoq.unit}</span>
                              </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Item Total Budget</span>
                              <div className={`bg-gradient-to-br px-6 py-2 rounded-2xl border-2 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.2)] transition-all flex items-center justify-center ${selectedBoq.rateSource === 'Subcontractor' ? 'from-orange-500 to-orange-600 border-orange-400 text-white' : 'from-orange-50 to-orange-100 border-orange-200 text-orange-600 group-hover/summary:border-orange-300'}`}>
                                <span className="text-lg sm:text-xl font-black font-mono tracking-tighter leading-none">
                                  {formatPrice(selectedBoq.totalBudget)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center p-8 opacity-50 transition-colors">
                        <Users className="w-10 h-10 text-slate-200 mb-4" />
                        <p className="text-sm font-bold text-slate-400">Activity resources will appear here once activities are created.</p>
                      </div>
                    )}
                  </div>
                </section>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col bg-white overflow-hidden transition-colors">
                {/* Compact BOQ Top Header with Dark Colors */}
                <div className="bg-slate-800 pt-4 pb-0 flex flex-col shrink-0 border-b border-slate-700 relative z-20">
                  <div className="px-4 lg:px-8 pb-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <h3 className="text-lg lg:text-xl font-black text-white tracking-tight transition-colors">Project Bill of Quantities</h3>
                        <p className="text-[10px] lg:text-xs text-slate-400 font-medium">Standard Itemized Breakdown</p>
                      </div>
                      <div className="hidden lg:flex items-center gap-3 border-l border-slate-700 pl-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-800 px-2 py-1 rounded">
                          {filteredBoqItems.length} of {boqItems.length} items
                        </span>
                        {(boqFilters.searchTerm || (boqFilters.selectedUnits || []).length > 0 || (boqFilters.selectedCodes || []).length > 0 || (boqFilters.selectedPackages || []).length > 0 || boqFilters.minQty !== null || boqFilters.maxQty !== null || boqFilters.minBudget !== null || boqFilters.maxBudget !== null) && (
                          <button 
                            onClick={() => {
                              setBoqFilters(prev => ({
                                ...prev,
                                searchTerm: '',
                                selectedUnits: [],
                                selectedCodes: [],
                                selectedPackages: [],
                                minQty: null,
                                maxQty: null,
                                minBudget: null,
                                maxBudget: null,
                                minRate: null,
                                maxRate: null,
                                sortKey: null,
                                sortOrder: 'asc'
                              }));
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 border border-indigo-500/30 rounded-lg transition-all"
                          >
                            <X className="w-3 h-3" /> Clear Filters
                          </button>
                        )}
                        {boqFilters.sortKey && (
                          <button 
                            onClick={() => toggleSort(null)}
                            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 hover:text-slate-300 border border-slate-700 rounded-lg transition-all shadow-sm"
                            title="Reset to default original order"
                          >
                            <History className="w-3.5 h-3.5" /> Reset Sort
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full lg:w-auto">
                      <button 
                        onClick={triggerBoqExcelImport}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Import Excel</span><span className="sm:hidden">Import</span>
                      </button>
                      <button 
                        onClick={addBoqItem}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 transition-all border border-indigo-500"
                      >
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Item</span><span className="sm:hidden">New</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Mobile filtering info */}
                  <div className="lg:hidden px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-800 px-2 py-1 rounded whitespace-nowrap">
                      {filteredBoqItems.length} of {boqItems.length} items
                    </span>
                    {(boqFilters.searchTerm || (boqFilters.selectedUnits || []).length > 0 || (boqFilters.selectedCodes || []).length > 0 || (boqFilters.selectedPackages || []).length > 0 || boqFilters.minQty !== null || boqFilters.maxQty !== null || boqFilters.minBudget !== null || boqFilters.maxBudget !== null) && (
                      <button 
                        onClick={() => {
                          setBoqFilters(prev => ({
                            ...prev,
                            searchTerm: '', 
                            selectedUnits: [], 
                            selectedCodes: [], 
                            selectedPackages: [], 
                            minQty: null, 
                            maxQty: null, 
                            minBudget: null, 
                            maxBudget: null, 
                            minRate: null, 
                            maxRate: null, 
                            sortKey: null, 
                            sortOrder: 'asc'
                          }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-all whitespace-nowrap"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col bg-white relative">
                  <div className="overflow-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-xs md:text-sm border-separate border-spacing-0 min-w-[1000px] table-fixed">
                      <thead className="sticky top-0 z-[30] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                        <tr className="bg-slate-800 group">
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-10 px-4 md:px-6 py-3"></th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-32 px-4 md:px-6 py-3 text-left font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300" title="Item Classification Code">
                            <div className="flex flex-col gap-2">
                              <span className="pl-1">Code</span>
                              <select 
                                className="bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 focus:ring-1 ring-indigo-500 outline-none w-full transition-shadow"
                                value={(boqFilters.selectedCodes || []).length === 1 ? boqFilters.selectedCodes[0] : 'All'}
                                onChange={(e) => setBoqFilters(prev => ({ ...prev, selectedCodes: e.target.value === 'All' ? [] : [e.target.value] }))}
                              >
                                <option value="All">All</option>
                                {boqMetadata.codes.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-40 px-4 md:px-6 py-3 text-left font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300" title="Item Package/Category">
                            <div className="flex flex-col gap-2">
                              <span className="pl-1 flex items-center gap-1.5"><Layers className="w-2.5 h-2.5 text-indigo-400" /> Package</span>
                              <select 
                                className="bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 focus:ring-1 ring-indigo-500 outline-none w-full transition-shadow"
                                value={(boqFilters.selectedPackages || []).length === 1 ? boqFilters.selectedPackages[0] : 'All'}
                                onChange={(e) => setBoqFilters(prev => ({ ...prev, selectedPackages: e.target.value === 'All' ? [] : [e.target.value] }))}
                              >
                                <option value="All">All Packages</option>
                                {boqMetadata.packages.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 px-4 md:px-6 py-3 text-left font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300" title="Item Description">
                            <div className="flex flex-col gap-2">
                              <span className="pl-1">Desc.</span>
                              <input 
                                type="text"
                                placeholder="Filter..."
                                className="bg-slate-700 border border-slate-600 rounded-md shadow-sm px-2 py-1 text-[9px] font-bold text-slate-200 focus:ring-1 ring-indigo-500 outline-none w-full transition-shadow placeholder-slate-400"
                                value={boqFilters.searchTerm}
                                onChange={(e) => setBoqFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                              />
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-28 px-4 md:px-6 py-3 text-center font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300">
                            <div className="flex flex-col gap-2 items-center">
                              <span>Unit</span>
                              <select 
                                className="bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 focus:ring-1 ring-indigo-500 outline-none w-20 transition-shadow"
                                value={(boqFilters.selectedUnits || []).length === 1 ? boqFilters.selectedUnits[0] : 'All'}
                                onChange={(e) => setBoqFilters(prev => ({ ...prev, selectedUnits: e.target.value === 'All' ? [] : [e.target.value] }))}
                              >
                                <option value="All">All</option>
                                {boqMetadata.units.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-32 px-4 md:px-6 py-3 text-right font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300" title="Quantity">
                            <div className="flex flex-col gap-2 items-end">
                              <button 
                                onClick={() => toggleSort('quantity')}
                                className="flex items-center gap-1 hover:text-indigo-400 transition-colors group"
                              >
                                <span>Qty</span>
                                {boqFilters.sortKey === 'quantity' ? (
                                  boqFilters.sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />
                                ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
                              </button>
                              <div className="flex gap-1 items-center">
                                <NumericInput 
                                  placeholder="Min"
                                  className="w-12 bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 text-right transition-shadow placeholder-slate-400"
                                  value={boqFilters.minQty || 0}
                                  onChange={(v) => setBoqFilters(prev => ({ ...prev, minQty: v === 0 ? null : v }))}
                                />
                                <span className="text-[8px] text-slate-500">-</span>
                                <NumericInput 
                                  placeholder="Max"
                                  className="w-12 bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 text-right transition-shadow placeholder-slate-400"
                                  value={boqFilters.maxQty || 0}
                                  onChange={(v) => setBoqFilters(prev => ({ ...prev, maxQty: v === 0 ? null : v }))}
                                />
                              </div>
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-40 px-4 md:px-6 py-3 text-right font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300" title="Unit Rate (Price per Unit)">
                             <div className="flex flex-col gap-2 items-end">
                              <button 
                                onClick={() => toggleSort('unitRate')}
                                className="flex items-center gap-1 hover:text-indigo-400 transition-colors group"
                              >
                                <span>Rate</span>
                                {boqFilters.sortKey === 'unitRate' ? (
                                  boqFilters.sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />
                                ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
                              </button>
                              <div className="flex gap-1 items-center">
                                <NumericInput 
                                  placeholder="Min"
                                  className="w-16 bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 text-right transition-shadow placeholder-slate-400"
                                  value={boqFilters.minRate || 0}
                                  onChange={(v) => setBoqFilters(prev => ({ ...prev, minRate: v === 0 ? null : v }))}
                                />
                                <span className="text-[8px] text-slate-500">-</span>
                                <NumericInput 
                                  placeholder="Max"
                                  className="w-16 bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 text-right transition-shadow placeholder-slate-400"
                                  value={boqFilters.maxRate || 0}
                                  onChange={(v) => setBoqFilters(prev => ({ ...prev, maxRate: v === 0 ? null : v }))}
                                />
                              </div>
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-40 px-4 md:px-6 py-3 text-right font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-300" title="Total Budget (Qty x Rate)">
                            <div className="flex flex-col gap-2 items-end">
                              <button 
                                onClick={() => toggleSort('totalBudget')}
                                className="flex items-center gap-1 hover:text-indigo-400 transition-colors group"
                              >
                                <span>Total</span>
                                {boqFilters.sortKey === 'totalBudget' ? (
                                  boqFilters.sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />
                                ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
                              </button>
                              <div className="flex gap-1 items-center">
                                <NumericInput 
                                  placeholder="Min"
                                  className="w-16 bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 text-right transition-shadow placeholder-slate-400"
                                  value={boqFilters.minBudget || 0}
                                  onChange={(v) => setBoqFilters(prev => ({ ...prev, minBudget: v === 0 ? null : v }))}
                                />
                                <span className="text-[8px] text-slate-500">-</span>
                                <NumericInput 
                                  placeholder="Max"
                                  className="w-16 bg-slate-700 border border-slate-600 rounded-md shadow-sm px-1.5 py-1 text-[9px] font-bold text-slate-200 text-right transition-shadow placeholder-slate-400"
                                  value={boqFilters.maxBudget || 0}
                                  onChange={(v) => setBoqFilters(prev => ({ ...prev, maxBudget: v === 0 ? null : v }))}
                                />
                              </div>
                            </div>
                          </th>
                          <th className="sticky top-0 z-[30] bg-slate-800 border-b border-slate-700 w-12 px-4 md:px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBoqItems.map(item => {
                          const isExpanded = expandedBoqInTableId === item.id;
                          
                          return (
                            <React.Fragment key={item.id}>
                              <tr 
                                onClick={() => setExpandedBoqInTableId(isExpanded ? null : item.id)}
                                className={`group hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50/30' : ''}`}
                              >
                                <td className="px-4 py-5 text-center align-top">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedBoqInTableId(isExpanded ? null : item.id);
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                                  >
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-orange-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                  </button>
                                </td>
                                <td className="px-6 py-5 align-top">
                                  <span className="font-mono font-black text-indigo-600 text-xs bg-indigo-50 px-2 py-1 rounded inline-block">
                                    {item.code}
                                  </span>
                                </td>
                                <td className="px-6 py-5 align-top">
                                  {item.package ? (
                                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.1em] bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                                      {item.package}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase text-slate-300 italic">No Package</span>
                                  )}
                                </td>
                                <td className="px-6 py-5 align-top">
                                  <p className="font-bold text-slate-800 break-words" style={{ lineHeight: '1.7' }} dir="auto">{item.description}</p>
                                </td>
                                <td className="px-6 py-5 text-center align-top">
                                  <Badge className="bg-white text-slate-600 border border-slate-200">
                                    {item.unit}
                                  </Badge>
                                </td>
                                <td className="px-6 py-5 text-right font-mono font-bold text-slate-700 align-top">
                                  {item.quantity.toLocaleString()}
                                </td>
                                <td className="px-6 py-5 text-right font-mono text-slate-500 whitespace-nowrap align-top">
                                  <div className="flex flex-col items-end gap-1.5">
                                    <span className={`text-[13px] font-black ${item.rateSource === 'Subcontractor' ? 'text-orange-600' : 'text-slate-900'}`}>
                                      {formatPrice(item.unitRate)}
                                    </span>
                                    {item.subcontractorRate !== undefined && item.subcontractorRate > 0 && (
                                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200" onClick={e => e.stopPropagation()}>
                                        <button 
                                          onClick={() => toggleRateSource(item.id, 'Study')}
                                          className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${item.rateSource !== 'Subcontractor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                          Study
                                        </button>
                                        <button 
                                          onClick={() => toggleRateSource(item.id, 'Subcontractor')}
                                          className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${item.rateSource === 'Subcontractor' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                          Sub
                                        </button>
                                       </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right whitespace-nowrap align-top">
                                  <span className="font-mono font-black text-slate-900 text-md">
                                    {formatPrice(item.totalBudget)}
                                  </span>
                                </td>
                                <td className="px-6 py-5 align-top"></td>
                              </tr>
                              
                              {/* Quick Revision Breakdown Row */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={9} className="px-6 py-0 bg-slate-50/50">
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="py-6 space-y-4">
                                          <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-1 h-8 bg-orange-500 rounded-full" />
                                              <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Quick Revision Breakdown</h4>
                                                <p className="text-xs font-bold text-slate-700 uppercase">{item.code} - Activity & Resource Analysis</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAiEstimation(item);
                                                }}
                                                disabled={isAiEstimating}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isAiEstimating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-100'}`}
                                              >
                                                <Sparkles className={`w-3 h-3 ${isAiEstimating ? 'animate-spin' : ''}`} />
                                                {isAiEstimating ? 'AI Thinking...' : 'AI Estimate'}
                                              </button>
                                              <button 
                                                onClick={() => setSelectedBoqId(item.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                                              >
                                                Breakdown Details <ArrowRight className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>

                                          {item.rateSource === 'Subcontractor' ? (
                                            <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex items-center justify-between max-w-2xl mx-auto shadow-sm">
                                              <div className="flex items-center gap-4">
                                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-orange-100 flex items-center justify-center text-orange-600">
                                                  <Truck className="w-6 h-6" />
                                                </div>
                                                <div>
                                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400 mb-0.5">Active External Rate</h4>
                                                  <p className="text-sm font-bold text-slate-700">Subcontractor Market Rate Selected</p>
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Direct Cost</p>
                                                <p className="text-2xl font-mono font-black text-orange-700 leading-none">
                                                  {formatPrice(item.subcontractorRate || 0)} <span className="text-xs font-sans opacity-60 text-slate-400">/ {item.unit}</span>
                                                </p>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                              {(item.activities || []).map(activity => {
                                              const typeSummary = (activity.resources || []).reduce((acc, res) => {
                                                acc[res.type] = (acc[res.type] || 0) + (res.totalPrice || 0);
                                                return acc;
                                              }, {} as Record<string, number>);

                                              return (
                                                <div key={activity.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group/act transition-all hover:border-indigo-200">
                                                  <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex justify-between items-start group-hover/act:bg-indigo-50/50 transition-colors">
                                                    <div className="min-w-0 pr-2">
                                                      <h5 className="text-[12px] font-black text-slate-800 truncate uppercase tracking-tight">{activity.name}</h5>
                                                      <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-black font-mono text-slate-500 uppercase">
                                                          Req Qty: {(item.quantity * (activity.conversionRate || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {activity.unit || item.unit}
                                                        </span>
                                                      </div>
                                                      <div className="flex gap-1.5 mt-1.5">
                                                        {Object.entries(typeSummary).map(([type, total]) => (
                                                          <div key={type} className={`w-1.5 h-1.5 rounded-full ring-1 ring-white ${
                                                            type === 'Labor' ? 'bg-blue-500' : 
                                                            type === 'Material' ? 'bg-emerald-500' : 
                                                            type === 'Equipment' ? 'bg-orange-500' : 'bg-purple-500'
                                                          }`} title={`${type}: ${formatPrice(total as number)}`} />
                                                        ))}
                                                      </div>
                                                    </div>
                                                    <div className="shrink-0">
                                                      <span className="text-[10px] font-mono font-black text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm inline-block whitespace-nowrap">
                                                        {formatPrice(activity.unitRate)} <span className="text-[8px] opacity-60 font-sans">/ {activity.unit || item.unit}</span>
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <div className="p-3 space-y-3 flex-1">
                                                    {/* Productivity Section */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-1">
                                                      <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Productivity</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1">
                                                          <NumericInput 
                                                            value={activity.productivity || 0}
                                                            onChange={(val) => updateActivity(item.id, activity.id, { productivity: val })}
                                                            className="w-16 text-[10px] font-mono font-black text-orange-600 border border-slate-100 rounded px-1.5 py-1 text-center focus:ring-1 ring-orange-500 outline-none hover:border-orange-200 bg-orange-50/30"
                                                          />
                                                          <span className="text-[8px] font-black text-slate-400 uppercase">{(activity.unit || item.unit)}/day</span>
                                                        </div>
                                                        <div className="px-2 py-1 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase">
                                                          {activity.productivity && item.quantity ? Math.ceil((item.quantity * (activity.conversionRate || 1)) / activity.productivity).toLocaleString() : 0} Days
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                      {(activity.resources || []).map(res => (
                                                    <div key={res.id} className="flex items-center justify-between group/res">
                                                      <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                          res.type === 'Labor' ? 'bg-blue-500' : 
                                                          res.type === 'Material' ? 'bg-emerald-500' : 
                                                          res.type === 'Equipment' ? 'bg-orange-500' : 'bg-purple-500'
                                                        }`} />
                                                        <span className="text-[10px] font-bold text-slate-600 truncate">{res.name}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                        {res.type === 'Material' ? (
                                                          <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1">
                                                              <NumericInput 
                                                                value={res.consumption || 0}
                                                                onChange={(val) => updateResource(item.id, activity.id, res.id, { consumption: val })}
                                                                className="w-10 text-[9px] font-mono font-bold text-slate-900 border border-slate-100 rounded px-1 py-0.5 text-center focus:ring-1 ring-orange-500 outline-none hover:border-orange-200 bg-slate-50/50"
                                                                title="Consumption"
                                                              />
                                                              <span className="text-[7px] font-black text-slate-400 uppercase">{res.unit}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                              <NumericInput 
                                                                value={res.wastePercentage || 0}
                                                                onChange={(val) => updateResource(item.id, activity.id, res.id, { wastePercentage: val })}
                                                                className="w-8 text-[9px] font-mono font-bold text-slate-900 border border-slate-100 rounded px-1 py-0.5 text-center focus:ring-1 ring-orange-500 outline-none hover:border-orange-200 bg-slate-50/50"
                                                                title="Waste %"
                                                              />
                                                              <span className="text-[7px] font-black text-slate-400 uppercase">%w</span>
                                                            </div>
                                                          </div>
                                                        ) : (
                                                          <div className="flex items-center gap-1">
                                                            <NumericInput 
                                                              value={res.resourceCount || res.quantity || 0}
                                                              onChange={(val) => updateResource(item.id, activity.id, res.id, { 
                                                                [res.type === 'Material' || res.type === 'Subcontractor' ? 'quantity' : 'resourceCount']: val 
                                                              })}
                                                              className="w-10 text-[9px] font-mono font-bold text-slate-900 border border-slate-100 rounded px-1 py-0.5 text-center focus:ring-1 ring-orange-500 outline-none hover:border-orange-200 bg-slate-50/50"
                                                            />
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">{res.unit}</span>
                                                          </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-[8px] text-slate-400 font-bold">{currency.symbol}</span>
                                                          <NumericInput 
                                                            value={res.unitPrice}
                                                            onChange={(val) => updateResource(item.id, activity.id, res.id, { unitPrice: val })}
                                                            className="w-14 text-[9px] font-mono font-bold text-indigo-600 border border-slate-100 rounded px-1 py-0.5 text-right focus:ring-1 ring-orange-500 outline-none hover:border-orange-200 bg-slate-50/50"
                                                          />
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                  </div>
                                                </div>
                                              </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                            
                                            {item.rateSource !== 'Subcontractor' && (item.activities || []).length === 0 && (
                                            <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                              <p className="text-xs font-bold text-slate-400">No activities defined for this item yet.</p>
                                              <button 
                                                onClick={() => setSelectedBoqId(item.id)}
                                                className="mt-4 text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline"
                                              >
                                                Go to Breakdown Details to add activities
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })}
                        {filteredBoqItems.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-6 py-20 text-center text-slate-400">
                              <Database className="w-10 h-10 mx-auto mb-4 opacity-20" />
                              <p className="font-bold">No BOQ items found</p>
                              <p className="text-xs mt-1">Try adjusting your search or add a new item.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Fixed Bottom Total Bar */}
                  <div className="bg-slate-800 shrink-0 border-t border-slate-700 flex items-center justify-end z-[30] relative shadow-[0_-8px_16px_rgba(0,0,0,0.15)] px-4 md:px-6 py-4 mt-auto">
                    <div className="w-[1000px] max-w-full flex justify-end gap-6 items-center pr-12">
                      <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">Project Total</span>
                      <span className="font-mono font-black text-lg text-emerald-400 whitespace-nowrap">
                        {formatPrice(totalProjectBudget)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </AnimatePresence>
          ) : view === 'dashboard' ? (
          <React.Suspense fallback={
            <div className="flex-1 h-full flex items-center justify-center bg-slate-50">
              <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Loading Analytics Dashboard...</span>
              </div>
            </div>
          }>
            <Dashboard 
              stats={dashboardStats} 
              currency={currency} 
              formatPrice={formatPrice} 
            />
          </React.Suspense>
        ) : view === 'library' ? (
          <ResourceLibrarySection 
            library={resourceLibrary}
            updateResource={updateLibraryItem}
            deleteResource={deleteLibraryItem}
            addResource={addLibraryItem}
            formatPrice={formatPrice}
            onExport={handleExportLibrary}
            onImport={triggerImport}
            onExcelImport={triggerResourceExcelImport}
            setNotification={setNotification}
            searchTerm={globalSearchTerm}
            setSearchTerm={setGlobalSearchTerm}
          />
        ) : view === 'qs' ? (
          <React.Suspense fallback={
            <div className="flex-1 h-full flex items-center justify-center bg-slate-50">
              <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                <span>Loading Quantity Surveying Workspace...</span>
              </div>
            </div>
          }>
            <QSSection 
              boqItems={boqItems}
              qsTakeoffs={qsTakeoffs}
              setQsTakeoffs={setQsTakeoffs}
              updateResource={updateResource}
              formatPrice={formatPrice}
            />
          </React.Suspense>
        ) : (
          <SubconComparisonSection 
            boqItems={boqItems}
            offers={subcontractorOffers}
            onAddOffer={addSubconOffer}
            onAddImportedOffer={addImportedSubconOffer}
            onUpdateRate={updateSubconRate}
            onUpdateOfferName={updateSubconName}
            onChooseOffer={chooseSubcon}
            onDeleteOffer={deleteSubconOffer}
            formatPrice={formatPrice}
            currency={currency}
          />
        )}
        </main>
      </div>

      {/* Import Mapper Modal */}
      <AnimatePresence>
        {showResourceImportMapper && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Database className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Map Resource Columns</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1 ml-13">Align your Excel columns with the library's resource schema.</p>
                </div>
                <button onClick={() => setShowResourceImportMapper(false)} className="hover:bg-slate-100 p-2.5 rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Columns className="w-3.5 h-3.5" /> Schema Alignment
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {Object.keys(resourceFieldMapping).map((field) => (
                      <div key={field} className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <select 
                          value={resourceFieldMapping[field]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setResourceFieldMapping(prev => ({ ...prev, [field]: val }));
                            if (field === 'unit' && val && resourceImportMappingData) {
                              const units: string[] = Array.from(new Set(resourceImportMappingData.map(row => String(row[val] || '').trim()).filter(Boolean)));
                              setUniqueResourceUnits(units);
                              const initialMappings: Record<string, string> = {};
                              units.forEach((u: string) => {
                                initialMappings[u] = normalizeUnit(u, RESOURCE_UNITS);
                              });
                              setResourceUnitMappings(initialMappings);
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        >
                          <option value="">Select Column...</option>
                          {resourceImportHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {uniqueResourceUnits.length > 0 && resourceFieldMapping.unit && (
                  <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                          <Layers className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 tracking-tight">Resource Unit Bulk Mapping</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Found {uniqueResourceUnits.length} unique units</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                      {uniqueResourceUnits.map(unit => (
                        <div key={unit} className="flex flex-col gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 transition-all hover:border-indigo-200 group">
                          <div className="flex-1 min-w-0">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5" /> Source File
                            </span>
                            <span className="block text-xs font-mono font-black text-slate-700 truncate bg-white px-2 py-1 rounded-lg border border-slate-100" title={unit}>{unit}</span>
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                              <Target className="w-2.5 h-2.5" /> Standardize
                            </span>
                            <select 
                              value={resourceUnitMappings[unit] || ''}
                              onChange={(e) => setResourceUnitMappings(prev => ({ ...prev, [unit]: e.target.value }))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-black focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer transition-all uppercase"
                            >
                              <option value="">Select...</option>
                              {RESOURCE_UNITS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                    <History className="w-3.5 h-3.5" /> Data Preview
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 border-b border-slate-200">
                          {resourceImportHeaders.slice(0, 5).map(h => <th key={h} className="text-left py-3 px-4 font-black uppercase tracking-widest">{h}</th>)}
                          {resourceImportHeaders.length > 5 && <th className="text-left py-3 px-4 italic">...</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {resourceImportMappingData?.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t border-slate-100 font-mono text-slate-600 hover:bg-slate-50 transition-colors">
                            {resourceImportHeaders.slice(0, 5).map(h => <td key={h} className="py-3 px-4 max-w-[150px] truncate">{String(row[h])}</td>)}
                            {resourceImportHeaders.length > 5 && <td className="py-3 px-4 text-slate-300">...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-white border-t border-slate-100 shrink-0">
                <div className="flex gap-4">
                  <button 
                    onClick={applyResourceImportMapping}
                    disabled={!resourceFieldMapping.name || !resourceFieldMapping.type || !resourceFieldMapping.rate}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white py-4 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 transition-all font-mono"
                  >
                    Confirm & Start Import
                  </button>
                  <button 
                    onClick={() => setShowResourceImportMapper(false)}
                    className="px-10 py-4 border-2 border-slate-100 hover:border-slate-300 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs transition-all font-mono text-slate-500"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showImportMapper && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Map Excel Columns</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1 ml-13">Map your BOQ data structure to the project schema.</p>
                </div>
                <button onClick={() => setShowImportMapper(false)} className="hover:bg-slate-100 p-2.5 rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Columns className="w-3.5 h-3.5" /> Schema Alignment
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {Object.keys(fieldMapping).map((field) => (
                      <div key={field} className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <select 
                          value={fieldMapping[field]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFieldMapping(prev => ({ ...prev, [field]: val }));
                            if (field === 'unit' && val && importMappingData) {
                              const units: string[] = Array.from(new Set(importMappingData.map(row => String(row[val] || '').trim()).filter(Boolean)));
                              setUniqueUnits(units);
                              const initialMappings: Record<string, string> = {};
                              units.forEach((u: string) => {
                                initialMappings[u] = normalizeUnit(u, STANDARD_UNITS);
                              });
                              setUnitMappings(initialMappings);
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
                        >
                          <option value="">Select Column...</option>
                          {importHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {uniqueUnits.length > 0 && fieldMapping.unit && (
                  <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                          <Layers className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 tracking-tight">Unit Bulk Mapping</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Identified {uniqueUnits.length} source units</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                      {uniqueUnits.map(unit => (
                        <div key={unit} className="flex flex-col gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 transition-all hover:border-emerald-200 group">
                          <div className="flex-1 min-w-0">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5" /> Source Unit
                            </span>
                            <span className="block text-xs font-mono font-black text-slate-700 truncate bg-white px-2 py-1 rounded-lg border border-slate-100" title={unit}>{unit}</span>
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <span className="block text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                              <Target className="w-2.5 h-2.5" /> Map To
                            </span>
                            <select 
                              value={unitMappings[unit] || ''}
                              onChange={(e) => setUnitMappings(prev => ({ ...prev, [unit]: e.target.value }))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-black focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer transition-all uppercase"
                            >
                              <option value="">Select...</option>
                              {STANDARD_UNITS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                    <History className="w-3.5 h-3.5" /> Data Preview
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 border-b border-slate-200">
                          {importHeaders.slice(0, 5).map(h => <th key={h} className="text-left py-3 px-4 font-black uppercase tracking-widest">{h}</th>)}
                          {importHeaders.length > 5 && <th className="text-left py-3 px-4 italic">...</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {importMappingData?.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t border-slate-100 font-mono text-slate-600 hover:bg-slate-50 transition-colors">
                            {importHeaders.slice(0, 5).map(h => <td key={h} className="py-3 px-4 max-w-[150px] truncate">{String(row[h])}</td>)}
                            {importHeaders.length > 5 && <td className="py-3 px-4 text-slate-300">...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-white border-t border-slate-100 shrink-0 flex justify-end gap-4">
                <button 
                  onClick={() => setShowImportMapper(false)}
                  className="px-10 py-4 border-2 border-slate-100 hover:border-slate-300 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs transition-all font-mono text-slate-500"
                >
                  Discard
                </button>
                <button 
                  onClick={applyImportMapping}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 transition-all font-mono"
                >
                  IMPORT {importMappingData?.length} ITEMS
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {showBulkEdit && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-colors"
            >
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center transition-colors">
                <span className="text-sm font-bold">Bulk Edit Unit Price</span>
                <button onClick={() => setShowBulkEdit(false)} className="hover:bg-white/10 p-1 rounded transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-500">
                  Update the unit price for <strong>{selectedResourceIds.size}</strong> selected resources. This action will recalculate all associated costs.
                </p>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block transition-colors">New Unit Price ({currency.symbol})</label>
                  <input 
                    type="number"
                    value={bulkPriceValue}
                    onChange={(e) => setBulkPriceValue(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 ring-indigo-500 outline-none text-slate-800 transition-colors"
                    placeholder="Enter price..."
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setShowBulkEdit(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkEditPrice}
                    disabled={!bulkPriceValue}
                    className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Modal */}
      <AnimatePresence>
        {showResourceDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-colors"
            >
              <div className="p-4 bg-red-600 text-white flex justify-between items-center transition-colors">
                <span className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Bulk Delete Resources
                </span>
                <button onClick={() => setShowResourceDeleteConfirm(false)} className="hover:bg-white/10 p-1 rounded transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 font-medium">
                  Are you sure you want to delete <strong>{selectedResourceIds.size}</strong> selected resources from this BOQ?
                </p>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <p className="text-[10px] text-red-600 font-medium italic">
                    This action cannot be undone. All estimation parameters associated with these resources will be lost.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setShowResourceDeleteConfirm(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors text-slate-500"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={bulkDeleteResources}
                    className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-colors"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resource Library Modal */}
      <AnimatePresence>
        {showLibrary && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col transition-colors"
            >
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0 transition-colors">
                <div className="flex items-center gap-2">
                  <Library className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold uppercase tracking-wider">Global Resource Library</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={libraryImportMenuRef}>
                    <button 
                      onClick={() => setShowLibraryImportMenu(!showLibraryImportMenu)}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                      title="Import Options"
                    >
                      <Plus className="w-4 h-4" /> Import
                      <ChevronDown className={`w-3 h-3 transition-transform ${showLibraryImportMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {showLibraryImportMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 py-2 z-50 overflow-hidden"
                        >
                          <div className="px-4 py-2 border-b border-slate-50 mb-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Import Resources</p>
                          </div>
                          <button 
                            onClick={() => {
                              triggerImport();
                              setShowLibraryImportMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                          >
                            <FileJson className="w-4 h-4 text-orange-500" />
                            <div className="flex flex-col">
                              <span>Standard JSON Library</span>
                              <span className="text-[10px] font-medium text-slate-400">Native (.json) export</span>
                            </div>
                          </button>
                          <button 
                            onClick={() => {
                              triggerResourceExcelImport();
                              setShowLibraryImportMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                            <div className="flex flex-col">
                              <span>Excel Spreadsheet</span>
                              <span className="text-[10px] font-medium text-slate-400">Import (.xlsx) records</span>
                            </div>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={handleExportLibrary}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                    title="Export Library (.json)"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2 bg-red-500/10 p-1 rounded-lg border border-red-500/20">
                      <span className="text-[10px] font-bold text-red-400 px-2 uppercase">Confirm Clear?</span>
                      <button 
                        onClick={async () => {
                          const itemsToRemove = [...resourceLibrary];
                          setResourceLibrary([]);
                          if (user && isCloudSyncEnabled) {
                             for (const item of itemsToRemove) {
                               await storageService.deleteResourceFromLibrary(user.uid, item.id);
                             }
                          }
                          setShowClearConfirm(false);
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-black uppercase transition-colors"
                      >
                        Yes, Clear
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-[10px] font-black uppercase transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowClearConfirm(true)}
                      className="p-2 hover:bg-red-900/30 rounded-lg text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 text-xs font-bold"
                      title="Clear All Library"
                    >
                      <Trash2 className="w-4 h-4" /> Clear All
                    </button>
                  )}
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  <button onClick={() => setShowLibrary(false)} className="hover:bg-white/10 p-1 rounded transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-2 transition-colors">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search by resource name..."
                    value={librarySearchTerm}
                    onChange={(e) => setLibrarySearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 ring-indigo-500 outline-none transition-all text-slate-800"
                  />
                </div>
                <select 
                  value={libraryTypeFilter}
                  onChange={(e) => setLibraryTypeFilter(e.target.value as any)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 ring-indigo-500 transition-colors"
                >
                  <option value="All">All Categories</option>
                  <option value="Labor">Labor</option>
                  <option value="Material">Materials</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Subcontractor">Subcontractors</option>
                </select>
                <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shrink-0">
                  <span className="text-[9px] font-black uppercase text-slate-400 px-1 ml-1">Quick Add:</span>
                  <button 
                    onClick={() => addLibraryItem('Labor')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-2.5 h-2.5" /> Labor
                  </button>
                  <button 
                    onClick={() => addLibraryItem('Material')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-md font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-2.5 h-2.5" /> Material
                  </button>
                  <button 
                    onClick={() => addLibraryItem('Equipment')}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1.5 rounded-md font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-2.5 h-2.5" /> Equip
                  </button>
                  <button 
                    onClick={() => addLibraryItem('Subcontractor')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-md font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-2.5 h-2.5" /> Subcon
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <tr className="text-left">
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Resource Name</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Unit Rate</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Deployment</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Actions</th>
                    </tr>
                  </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const filteredAndSorted = resourceLibrary
                    .filter(item => {
                      const matchesSearch = (item.name || '').toLowerCase().includes(librarySearchTerm.toLowerCase());
                      const matchesType = libraryTypeFilter === 'All' || item.type === libraryTypeFilter;
                      return matchesSearch && matchesType;
                    })
                    .sort((a, b) => {
                      if (a.type !== b.type) return a.type.localeCompare(b.type);
                      return (a.name || '').localeCompare(b.name || '');
                    });

                  if (filteredAndSorted.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-400 italic">Library is empty or no matches found</p>
                        </td>
                      </tr>
                    );
                  }

                  return filteredAndSorted.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <Badge className={`${ResourceTypeColor(item.type)} flex items-center gap-1.5 px-2 w-fit`}>
                          <ResourceTypeIcon type={item.type} />
                          {item.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.name} 
                          onChange={(e) => {
                              updateLibraryItem(item.id, { name: e.target.value });
                          }}
                          className="font-bold text-slate-800 text-sm w-full bg-transparent border-none outline-none focus:ring-0 transition-colors mb-1"
                        />
                        <div className="flex gap-4 opacity-50 group-hover:opacity-100 transition-opacity">
                              {(item.type === 'Labor' || item.type === 'Equipment') && (
                                <div className="flex flex-col">
                                  <span className="text-[7px] text-slate-500 font-bold uppercase">Crew</span>
                                  <NumericInput 
                                    value={item.crewSize || 1}
                                    onChange={(val) => {
                                      updateLibraryItem(item.id, { crewSize: val || 1 });
                                    }}
                                    className="w-8 text-[9px] font-mono font-bold text-indigo-600 bg-transparent border-b border-slate-200 outline-none transition-colors"
                                  />
                                </div>
                              )}
                        </div>
                      </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-bold">{currency.symbol} </span>
                              <NumericInput 
                                value={item.unitPrice} 
                                onChange={(val) => {
                                  updateLibraryItem(item.id, { unitPrice: val || 0 });
                                }}
                                className="w-16 text-sm font-mono font-bold text-slate-700 bg-transparent border-b border-dashed border-slate-200 outline-none text-right transition-colors"
                              />
                              <button 
                                onClick={() => handleEstimateLibraryPrice(item)}
                                disabled={!!estimatingLibraryPriceId}
                                className={`p-1 rounded-md transition-all ${estimatingLibraryPriceId === item.id ? 'animate-spin bg-indigo-50 text-indigo-600' : 'hover:bg-indigo-50 text-slate-300 hover:text-indigo-600'}`}
                                title="Estimate Price with AI"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                              <span className="text-xs text-slate-400 font-bold">/</span>
                                {item.type === 'Labor' || item.type === 'Equipment' ? (
                                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1 rounded">hr</span>
                                ) : (
                                  <select 
                                    value={item.unit}
                                    onChange={(e) => {
                                      updateLibraryItem(item.id, { unit: e.target.value });
                                    }}
                                    className="text-xs font-bold text-slate-500 bg-transparent border-none outline-none focus:ring-0 p-0 appearance-none cursor-pointer"
                                  >
                                    {RESOURCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="max-h-[85px] overflow-y-auto no-scrollbar border border-slate-100 rounded-lg p-1.5 bg-slate-50/50 hover:bg-white transition-colors shadow-inner min-w-[150px]">
                              <div className="flex flex-wrap gap-1">
                                {(selectedBoq?.activities || []).map(act => (
                                <button 
                                  key={act.id}
                                  onClick={() => {
                                    addResource(selectedBoq.id, act.id, item.type, item);
                                    setShowLibrary(false);
                                  }}
                                  className="text-[8px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all font-bold flex items-center gap-1 text-slate-700"
                                >
                                  {act.name.substring(0, 10)}... <ArrowRight className="w-2 h-2" />
                                </button>
                              ))}
                              {(!selectedBoq || (selectedBoq.activities || []).length === 0) && (
                                <p className="text-[9px] text-slate-400 italic">No project activities</p>
                              )}
                            </div>
                          </div>
                        </td>
                          <td className="px-6 py-4 align-top text-center">
                            <button 
                              onClick={() => {
                                deleteLibraryItem(item.id);
                              }}
                              className="text-slate-300 hover:text-red-500 transition-all"
                              title="Delete from Library"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Conflict Resolution Dialog */}
      <AnimatePresence>
        {pendingConflict && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6"
            >
              <div className="flex items-center gap-3 mb-4 text-orange-500">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-black uppercase tracking-tight">Resource Conflict</h3>
              </div>
              <p className="text-slate-600 text-sm mb-6 font-medium leading-relaxed">
                A resource named <span className="font-bold text-slate-900">"{pendingConflict.resource.name}"</span> of type <span className="font-bold text-slate-900 uppercase">{pendingConflict.resource.type}</span> already exists. How would you like to proceed?
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => resolveConflict('overwrite')}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-200 hover:border-indigo-200 transition-all group text-left"
                >
                  <div>
                    <p className="font-black text-xs uppercase tracking-widest text-slate-900">Overwrite</p>
                    <p className="text-[10px] text-slate-500 font-medium">Replace existing with new values</p>
                  </div>
                  <RefreshCw className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:rotate-180 transition-all duration-500" />
                </button>
                
                <button
                  onClick={() => resolveConflict('merge')}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-50 rounded-2xl border border-slate-200 hover:border-emerald-200 transition-all group text-left"
                >
                  <div>
                    <p className="font-black text-xs uppercase tracking-widest text-slate-900">Merge</p>
                    <p className="text-[10px] text-slate-500 font-medium">Combine non-empty fields</p>
                  </div>
                  <Layers className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-all" />
                </button>
                
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => resolveConflict('cancel')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Templates Modal */}
      <AnimatePresence>
        {showTemplatePicker && (
          <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Layers className="w-6 h-6 text-indigo-400" /> Activity Templates
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Quickly apply standard cost structures</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => document.getElementById('excel-upload')?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10"
                    title="Import from Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Import Excel</span>
                  </button>
                  {activityTemplates.length > 0 && (
                    <button 
                      onClick={() => setShowClearTemplatesConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-500 shadow-lg shadow-rose-500/20"
                      title="Delete All Templates"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Delete All</span>
                    </button>
                  )}
                  <button onClick={() => setShowTemplatePicker(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {activityTemplates.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl">
                    <Layers className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No templates saved yet</p>
                    <p className="text-[10px] text-slate-400 mt-2">Save an activity as a template to see it here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activityTemplates.map(template => (
                      <div 
                        key={template.id}
                        className="group bg-slate-50 rounded-2xl p-4 border border-slate-200 hover:border-indigo-500 transition-all flex flex-col shadow-sm hover:shadow-md"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-sm text-slate-900 capitalize break-words pr-2">{template.name}</h4>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteActivityTemplate(template.id);
                            }}
                            className="p-1.5 opacity-100 md:opacity-40 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                            title="Delete Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-4 line-clamp-2 italic font-medium">{template.description || 'No description provided'}</p>
                        
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex -space-x-1.5">
                            {(['Labor', 'Material', 'Equipment', 'Subcontractor'] as ResourceType[]).map(type => {
                              const count = template.resources.filter(r => r.type === type).length;
                              if (count === 0) return null;
                              return (
                                <div key={type} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                                  type === 'Labor' ? 'bg-blue-500 text-white' : type === 'Material' ? 'bg-emerald-500 text-white' : type === 'Equipment' ? 'bg-orange-500 text-white' : 'bg-purple-500 text-white'
                                }`} title={`${count} ${type} resources`}>
                                  <ResourceTypeIcon type={type} />
                                </div>
                              );
                            })}
                          </div>
                          <button 
                            onClick={() => applyActivityTemplate(showTemplatePicker, template)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Activity Templates Confirmation */}
      <AnimatePresence>
        {showClearTemplatesConfirm && (
          <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-[40px] shadow-2xl max-w-md w-full border border-slate-200"
            >
              <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-2xl font-black text-center mb-2 tracking-tight uppercase">Delete All Templates?</h3>
              <p className="text-slate-500 text-center mb-8 font-medium">This action cannot be undone. All saved activity templates will be permanently removed.</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowClearTemplatesConfirm(false)}
                  className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-900 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={clearAllActivityTemplates}
                  className="px-6 py-4 rounded-2xl bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20"
                >
                  Yes, Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Configuration Modal */}
      <AnimatePresence>
        {showExportConfig && (
          <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                    <Download className="w-5 h-5 text-indigo-600" /> 
                    Export Configuration
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                    Select columns and details to include
                  </p>
                </div>
                <button onClick={() => setShowExportConfig(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Column Selection</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {Object.entries(exportSettings.columns).map(([key, enabled]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group">
                        <div 
                          onClick={() => setExportSettings(prev => ({
                            ...prev,
                            columns: { ...prev.columns, [key]: !enabled }
                          }))}
                          className={`w-10 h-6 p-1 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-xs font-bold text-slate-700 capitalize group-hover:text-indigo-600 transition-colors">
                          {key.replace(/([A-Z])/g, ' $1')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Structure Depth</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.includeActivities}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, includeActivities: e.target.checked }))}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-700">Include Activities</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.includeResources}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, includeResources: e.target.checked }))}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-700">Include Resources</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.includeResourceSummary}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, includeResourceSummary: e.target.checked }))}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-700">Include Resource Summary Sheet</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.includeCategorySummary}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, includeCategorySummary: e.target.checked }))}
                          className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-xs font-bold text-slate-700">Summary by Category (L,M,E)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Export Format</h4>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setExportSettings(prev => ({ ...prev, format: 'excel' }))}
                        className={`flex-1 p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${exportSettings.format === 'excel' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:border-emerald-200'}`}
                      >
                        <FileSpreadsheet className={`w-6 h-6 ${exportSettings.format === 'excel' ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Excel</span>
                      </button>
                      <button 
                        onClick={() => setExportSettings(prev => ({ ...prev, format: 'pdf' }))}
                        className={`flex-1 p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${exportSettings.format === 'pdf' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-100 hover:border-rose-200'}`}
                      >
                        <FileText className={`w-6 h-6 ${exportSettings.format === 'pdf' ? 'text-rose-500' : 'text-slate-400'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest">PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 flex gap-4">
                <button 
                  onClick={() => setShowExportConfig(false)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-white text-slate-900 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={exportSettings.format === 'excel' ? handleExportExcel : handleExportPDF}
                  className="flex-1 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Generate Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Action Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    activeModal === 'delete' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'
                  }`}>
                    {activeModal === 'create' && <Plus className="w-6 h-6" />}
                    {activeModal === 'rename' && <Edit2 className="w-6 h-6" />}
                    {activeModal === 'delete' && <Trash2 className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">
                      {activeModal === 'create' && 'New Project'}
                      {activeModal === 'rename' && 'Rename Project'}
                      {activeModal === 'delete' && 'Delete Project'}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {activeModal === 'delete' ? 'Confirm permanent removal' : 'Project metadata'}
                    </p>
                  </div>
                </div>

                {activeModal !== 'delete' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Project Name</label>
                      <input 
                        autoFocus
                        type="text" 
                        value={projectNameInput}
                        onChange={(e) => setProjectNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (activeModal === 'create') createNewProject(projectNameInput);
                            else if (activeModal === 'rename' && targetProjectId) renameProject(targetProjectId, projectNameInput);
                            setActiveModal(null);
                          }
                        }}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 ring-indigo-500 outline-none transition-all placeholder:text-slate-400 font-bold text-sm"
                        placeholder="Enter project name..."
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-600 font-medium leading-relaxed">
                    Are you sure you want to delete this project? All associated BOQ items and activities will be permanently lost.
                  </p>
                )}
              </div>

              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-white text-slate-900 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (activeModal === 'create') {
                      createNewProject(projectNameInput);
                    } else if (activeModal === 'rename' && targetProjectId) {
                      renameProject(targetProjectId, projectNameInput);
                    } else if (activeModal === 'delete' && targetProjectId) {
                      deleteProject(targetProjectId);
                    }
                    setActiveModal(null);
                  }}
                  className={`flex-1 px-6 py-4 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-xl ${
                    activeModal === 'delete' 
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              notification.type === 'error' 
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20' 
                : notification.type === 'info'
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20'
                : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
            }`}
          >
            {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : notification.type === 'info' ? <Info className="w-5 h-5" /> : <Check className="w-5 h-5" />}
            <p className="text-sm font-black tracking-tight">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <UserGuideModal isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} setNotification={setNotification} />
      {/* Expandable Project Summary & BOQ Items Editor */}
      <AnimatePresence>
        {showExpandedSummary && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!editingItemInDialog) {
                  setShowExpandedSummary(false);
                  setSelectedDialogIds(new Set());
                }
              }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-7xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Project Summary & BOQ Editor</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Spacious Workspace</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowExpandedSummary(false);
                    setSelectedDialogIds(new Set());
                  }} 
                  className="hover:bg-slate-100 p-2.5 rounded-2xl transition-all border border-transparent hover:border-slate-200"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Body Panel */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[calc(92vh-150px)]">
                {/* Left Column: Huge Scope of Work Field */}
                <div className="lg:col-span-4 flex flex-col gap-4 bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 shadow-inner">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Project Scope & Summary</h4>
                  </div>
                  <textarea
                    value={scopeOfWork}
                    onChange={(e) => setScopeOfWork(e.target.value)}
                    placeholder="Describe overall project scope of work, style, standards (e.g., luxury height, high-grade concrete, 5-star hotel specifications, residential villa height standards, constraints, etc.)."
                    className="flex-1 min-h-[300px] w-full text-xs font-bold p-4 bg-white/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-orange-400 rounded-2xl focus:ring-4 focus:ring-orange-100 outline-none text-slate-700 placeholder:text-slate-400 leading-relaxed transition-all resize-none shadow-sm"
                  />
                  <div className="text-[9px] text-slate-400 font-semibold italic pl-1 flex items-center justify-between">
                    <span>Used dynamically across all AI Estimator queries</span>
                    <span className="text-emerald-500 flex items-center gap-0.5 font-bold">
                      <Check className="w-3 h-3" /> Auto-saved to Cloud
                    </span>
                  </div>
                </div>

                {/* Right Column: Full BOQ Catalog Table & Editor */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">BOQ Line Items catalog ({boqItems.length})</h4>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">Select checkboxes to edit Multiple item packages</span>
                    </div>

                    {/* Bulk Package Update Strip */}
                    <AnimatePresence>
                      {selectedDialogIds.size > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="px-4 py-3 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner mt-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                            <span className="text-xs font-black text-orange-850 uppercase tracking-wider">
                              {selectedDialogIds.size} Item{selectedDialogIds.size > 1 ? 's' : ''} Selected
                            </span>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input 
                              type="text"
                              placeholder="Type existing or custom package name"
                              id="bulk-package-input"
                              className="flex-1 sm:flex-initial px-3 py-1.5 bg-white border border-orange-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-400 outline-none w-full sm:w-56 text-slate-700 placeholder:text-slate-350"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const textVal = (e.currentTarget as HTMLInputElement).value;
                                  if (textVal.trim()) {
                                    updateMultipleBoqPackages(selectedDialogIds, textVal);
                                    setNotification({ 
                                      message: `Assigned folder/package to "${textVal.trim()}" for ${selectedDialogIds.size} items.`, 
                                      type: 'success' 
                                    });
                                    setSelectedDialogIds(new Set());
                                    e.currentTarget.value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const inputEl = document.getElementById('bulk-package-input') as HTMLInputElement;
                                if (inputEl && inputEl.value.trim()) {
                                  updateMultipleBoqPackages(selectedDialogIds, inputEl.value);
                                  setNotification({ 
                                    message: `Assigned folder/package to "${inputEl.value.trim()}" for ${selectedDialogIds.size} items.`, 
                                    type: 'success' 
                                  });
                                  setSelectedDialogIds(new Set());
                                  inputEl.value = '';
                                } else {
                                  setNotification({ message: 'Please enter a package name first.', type: 'info' });
                                }
                              }}
                              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-orange-200 cursor-pointer text-center"
                            >
                              Collect to Package
                            </button>
                            <button 
                              type="button"
                              onClick={() => setSelectedDialogIds(new Set())}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex-1 overflow-x-auto border border-slate-150 rounded-2xl bg-white shadow-sm">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <th className="p-3 w-8"></th>
                          <th className="p-3 w-10 text-center">
                            <input 
                              type="checkbox"
                              className="rounded border-slate-200 text-orange-600 focus:ring-orange-400 w-3.5 h-3.5 cursor-pointer accent-orange-600"
                              checked={boqItems.length > 0 && selectedDialogIds.size === boqItems.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDialogIds(new Set(boqItems.map(item => item.id)));
                                } else {
                                  setSelectedDialogIds(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="p-3 w-24">Code</th>
                          <th className="p-3 w-32">Package</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 w-28">Unit</th>
                          <th className="p-3 w-28">Quantity</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boqItems.map(item => {
                          const isSelected = selectedDialogIds.has(item.id);
                          return (
                            <tr 
                              key={item.id} 
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverItemId(item.id);
                              }}
                              onDragLeave={() => {
                                setDragOverItemId(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const draggedId = e.dataTransfer.getData("text/plain");
                                if (draggedId && draggedId !== item.id) {
                                  handleMoveBoqItem(draggedId, item.id);
                                }
                                setDraggedBoqItemId(null);
                                setDragOverItemId(null);
                              }}
                              className={`border-b border-slate-100 text-slate-700 transition-all ${
                                isSelected ? 'bg-orange-50/20' : 'hover:bg-slate-50/50'
                              } ${
                                dragOverItemId === item.id ? 'border-t-2 border-dashed border-orange-500 bg-orange-50/50' : ''
                              }`}
                            >
                              {/* Drag Grip Column */}
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div 
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData("text/plain", item.id);
                                    setDraggedBoqItemId(item.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedBoqItemId(null);
                                    setDragOverItemId(null);
                                  }}
                                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors inline-block"
                                  title="Drag reference pin to re-arrange item"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                              </td>

                              {/* Selection Checkbox */}
                              <td className="p-3 text-center">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-200 text-orange-600 focus:ring-orange-400 w-3.5 h-3.5 cursor-pointer accent-orange-600"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const copy = new Set(selectedDialogIds);
                                    if (e.target.checked) {
                                      copy.add(item.id);
                                    } else {
                                      copy.delete(item.id);
                                    }
                                    setSelectedDialogIds(copy);
                                  }}
                                />
                              </td>

                              {/* 1. Code */}
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-500">{item.code || '-'}</span>
                              </td>

                              {/* 2. Package */}
                              <td className="p-3">
                                {item.package ? (
                                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold uppercase tracking-wider block overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]" title={item.package}>
                                    {item.package}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 italic">-</span>
                                )}
                              </td>

                              {/* 3. Description */}
                              <td className="p-3">
                                <span className="text-slate-800 font-bold block max-w-sm line-clamp-2" title={item.description}>
                                  {item.description}
                                </span>
                              </td>

                              {/* 4. Unit */}
                              <td className="p-3">
                                <span className="font-mono font-bold uppercase text-slate-500">{item.unit}</span>
                              </td>

                              {/* 5. Quantity */}
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-800">{item.quantity}</span>
                              </td>

                              {/* 6. Actions */}
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button 
                                    type="button"
                                    onClick={() => addBoqItem(item.id)}
                                    className="p-1 px-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-650 rounded border border-slate-100 hover:border-emerald-200 transition-colors flex items-center gap-1 font-bold text-[10px]"
                                    title="Add new item after this one"
                                  >
                                    <Plus className="w-3 h-3 text-emerald-500" /> After
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setEditingItemInDialog(item);
                                      setDialogEditFields({
                                        code: item.code || '',
                                        package: item.package || '',
                                        description: item.description || '',
                                        unit: item.unit || '',
                                        quantity: item.quantity || 0
                                      });
                                    }}
                                    className="p-1 px-2.5 bg-slate-50 hover:bg-orange-50 text-slate-500 hover:text-orange-650 rounded border border-slate-100 hover:border-orange-200 transition-colors flex items-center gap-1 font-bold text-[10px]"
                                    title="Edit description in spacious overlay"
                                  >
                                    <Edit2 className="w-3 h-3 text-orange-500" /> Edit
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => deleteBoqItem(item.id)}
                                    className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded border border-slate-100 hover:border-red-105 transition-colors"
                                    title="Delete this item"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {boqItems.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold italic">
                              No BOQ items created yet. Add items in the detailed study panel.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Seamless Full-Page Editor Overlay for Spacious Editing of Item details */}
              <AnimatePresence>
                {editingItemInDialog && (
                  <div className="absolute inset-0 z-[600] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                      onClick={() => setEditingItemInDialog(null)}
                    />
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 15 }}
                      className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                    >
                      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-orange-500" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                            Spacious BOQ Line-Item Editor
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditingItemInDialog(null)}
                          className="p-1 px-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Item Code</label>
                            <input 
                              type="text"
                              value={dialogEditFields.code}
                              onChange={(e) => setDialogEditFields(prev => ({ ...prev, code: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                              placeholder="e.g. 1.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Package Name</label>
                            <input 
                              type="text"
                              value={dialogEditFields.package}
                              onChange={(e) => setDialogEditFields(prev => ({ ...prev, package: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all uppercase"
                              placeholder="e.g. Concrete"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Description Specs (Spacious Editor)</label>
                          <textarea 
                            value={dialogEditFields.description}
                            onChange={(e) => setDialogEditFields(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full min-h-[160px] px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-y"
                            placeholder="Detailed technical specifications or item description..."
                            rows={6}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Unit of Measure</label>
                            <select 
                              value={dialogEditFields.unit}
                              onChange={(e) => setDialogEditFields(prev => ({ ...prev, unit: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all uppercase"
                            >
                              {STANDARD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Quantity</label>
                            <NumericInput 
                              value={dialogEditFields.quantity || 0}
                              onChange={(val) => setDialogEditFields(prev => ({ ...prev, quantity: val }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingItemInDialog(null)}
                          className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateBoqItem(editingItemInDialog.id, dialogEditFields);
                            setEditingItemInDialog(null);
                            setNotification({ message: 'Line item updated successfully.', type: 'success' });
                          }}
                          className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md shadow-orange-100"
                        >
                          Save Changes
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UserGuideModal isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} setNotification={setNotification} />

      {/* Bottom Status Bar */}
      <footer className="h-10 bg-white border-t border-slate-200 text-slate-400 text-[9px] px-6 flex items-center justify-between uppercase font-black tracking-widest shrink-0 z-40 relative">
        <div className="flex gap-8 items-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <CostEngineIcon className="w-4 h-4 text-slate-800" />
            </div>
            <span className="text-slate-900">COST ENGINE v2.8.4</span>
          </div>
          <span className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors cursor-default"><Database className="w-3 h-3" /> Core: IndexedDB Vectorized</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-100 shadow-sm">
            <span className="text-[8px] font-bold text-orange-400 uppercase tracking-widest">Project Valuation</span>
            <span className="text-[10px] font-black text-slate-900 tabular-nums">{formatPrice(totalProjectBudget)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Production Cluster: 04-S</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-900 border-l border-slate-200 pl-6 h-4">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            <span>Auth: Verified Engineer</span>
          </div>
        </div>
      </footer>

      {/* Hidden File Inputs for Portability */}
      <div className="hidden">
        <input 
          type="file" 
          ref={boqExcelInputRef} 
          onChange={handleImportExcel} 
          accept=".xlsx, .xls, .csv" 
        />
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImportLibrary} 
          accept=".json" 
        />
        <input 
          type="file" 
          ref={resourceExcelInputRef} 
          onChange={handleImportResourceExcel} 
          accept=".xlsx, .xls, .csv" 
        />
        <input 
          type="file" 
          ref={projectJsonInputRef} 
          onChange={handleImportProjectJSON} 
          accept=".json" 
        />
        <input 
          type="file" 
          id="excel-upload" 
          accept=".xlsx, .xls" 
          onChange={importActivityTemplatesFromExcel}
        />
      </div>
    </div>
  );
}
