import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, Plus, Trash2, Check, Box, Database, Save, Ruler } from 'lucide-react';
import { BOQItem, QSTakeoff, TakeoffMeasurement } from './types';

interface QSSectionProps {
  boqItems: BOQItem[];
  qsTakeoffs: QSTakeoff[];
  setQsTakeoffs: React.Dispatch<React.SetStateAction<QSTakeoff[]>>;
  updateResource: (boqId: string, activityId: string, resourceId: string, updates: any) => void;
  formatPrice: (amount: number) => string;
}

export const QSSection: React.FC<QSSectionProps> = ({ boqItems, qsTakeoffs, setQsTakeoffs, updateResource, formatPrice }) => {
  const [selectedBoqId, setSelectedBoqId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  const selectedBoq = useMemo(() => boqItems.find(b => b.id === selectedBoqId) || null, [boqItems, selectedBoqId]);
  const selectedActivity = useMemo(() => selectedBoq?.activities?.find(a => a.id === selectedActivityId) || null, [selectedBoq, selectedActivityId]);
  const selectedResource = useMemo(() => selectedActivity?.resources?.find(r => r.id === selectedResourceId && r.type === 'Material') || null, [selectedActivity, selectedResourceId]);

  const currentTakeoff = useMemo(() => {
    if (!selectedBoqId || !selectedActivityId || !selectedResourceId) return null;
    return qsTakeoffs.find(t => t.boqItemId === selectedBoqId && t.activityId === selectedActivityId && t.resourceId === selectedResourceId);
  }, [qsTakeoffs, selectedBoqId, selectedActivityId, selectedResourceId]);

  const handleCreateTakeoff = () => {
    if (!selectedBoqId || !selectedActivityId || !selectedResourceId || !selectedResource) return;
    const newTakeoff: QSTakeoff = {
      id: crypto.randomUUID(),
      boqItemId: selectedBoqId,
      activityId: selectedActivityId,
      resourceId: selectedResourceId,
      name: `Takeoff for ${selectedResource.name}`,
      measurements: [],
      totalQuantity: 0,
      unit: selectedResource.unit
    };
    setQsTakeoffs(prev => [...prev, newTakeoff]);
  };

  const handleAddMeasurement = () => {
    if (!currentTakeoff) return;
    const newMeasurement: TakeoffMeasurement = {
      id: crypto.randomUUID(),
      description: 'New Measurement',
      count: 1,
      length: 0,
      width: 0,
      height: 0,
      total: 0
    };
    
    const updatedTakeoffs = qsTakeoffs.map(t => {
      if (t.id === currentTakeoff.id) {
        return { ...t, measurements: [...(t.measurements || []), newMeasurement] };
      }
      return t;
    });
    setQsTakeoffs(updatedTakeoffs);
  };

  const handleUpdateMeasurement = (measurementId: string, updates: Partial<TakeoffMeasurement>) => {
    if (!currentTakeoff) return;
    
    const updatedTakeoffs = qsTakeoffs.map(t => {
      if (t.id === currentTakeoff.id) {
        const updatedMeasurements = (t.measurements || []).map(m => {
          if (m.id === measurementId) {
            const up = { ...m, ...updates };
            // Recalculate total: count * length * width * height (treating 0/null as 1 for dims if not applicable, but let's be explicit: 
            // If they are measuring lines, length. Areas: length*width. Volumes: L*W*H. 
            // We can just say count * (length || 1) * (width || 1) * (height || 1), BUT 0 should not make it 1 automatically if the user wants 0?
            // Actually, usually blanks are 1. Let's do:
            const l = up.length || 1;
            const w = up.width || 1;
            const h = up.height || 1;
            // Wait, if all are 0, we just want count ? Yes, count * 1 * 1 * 1 = count.
            up.total = (up.count || 0) * (up.length ? up.length : 1) * (up.width ? up.width : 1) * (up.height ? up.height : 1);
            return up;
          }
          return m;
        });
        const totalQty = updatedMeasurements.reduce((acc, m) => acc + m.total, 0);
        return { ...t, measurements: updatedMeasurements, totalQuantity: totalQty };
      }
      return t;
    });
    setQsTakeoffs(updatedTakeoffs);
  };

  const handleDeleteMeasurement = (measurementId: string) => {
    if (!currentTakeoff) return;
    const updatedTakeoffs = qsTakeoffs.map(t => {
      if (t.id === currentTakeoff.id) {
        const updatedMeasurements = (t.measurements || []).filter(m => m.id !== measurementId);
        const totalQty = updatedMeasurements.reduce((acc, m) => acc + m.total, 0);
        return { ...t, measurements: updatedMeasurements, totalQuantity: totalQty };
      }
      return t;
    });
    setQsTakeoffs(updatedTakeoffs);
  };

  const syncToConsumption = () => {
    if (!currentTakeoff || !selectedBoqId || !selectedActivityId || !selectedResourceId) return;
    updateResource(selectedBoqId, selectedActivityId, selectedResourceId, { consumption: currentTakeoff.totalQuantity });
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50 relative overflow-hidden">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 p-4 md:p-6 lg:px-8 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3 md:gap-4 w-full lg:w-auto">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
            <Ruler className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight truncate">Quantity Surveying</h1>
            <p className="text-slate-500 font-medium tracking-wide text-[10px] md:text-xs uppercase antialiased truncate">Calculate Material Volumes & Areas</p>
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 relative z-10 hidden md:flex h-full overflow-y-auto">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Select Target</h2>
          </div>
          <div className="p-2 space-y-1">
            {boqItems.map(boq => (
              <div key={boq.id} className="flex flex-col">
                <button
                  onClick={() => {
                    setSelectedBoqId(boq.id === selectedBoqId ? null : boq.id);
                    setSelectedActivityId(null);
                    setSelectedResourceId(null);
                  }}
                  className={`flex flex-col items-start w-full text-left p-3 rounded-xl transition-all ${selectedBoqId === boq.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{boq.code}</span>
                  <span className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">{boq.description}</span>
                </button>
                
                {/* Activities */}
                <AnimatePresence>
                  {selectedBoqId === boq.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="ml-4 mt-1 space-y-1 overflow-hidden"
                    >
                      {boq.activities.length === 0 && (
                        <div className="p-2 text-[10px] uppercase font-bold text-slate-400 text-center">No activities</div>
                      )}
                      {boq.activities.map(act => (
                        <div key={act.id} className="flex flex-col">
                          <button
                            onClick={() => {
                              setSelectedActivityId(act.id === selectedActivityId ? null : act.id);
                              setSelectedResourceId(null);
                            }}
                            className={`flex items-center gap-2 w-full text-left p-2 rounded-lg transition-all ${selectedActivityId === act.id ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100/50 text-slate-600 hover:bg-slate-200'}`}
                          >
                            <Box className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            <span className="text-[11px] font-bold truncate">{act.name}</span>
                          </button>
                          
                          {/* Materials */}
                          <AnimatePresence>
                            {selectedActivityId === act.id && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="ml-3 mt-1 space-y-1 border-l-2 border-slate-200 pl-2 overflow-hidden py-1"
                              >
                                {act.resources.filter(r => r.type === 'Material').length === 0 && (
                                  <div className="p-1 px-2 text-[10px] uppercase font-bold text-slate-400">No materials</div>
                                )}
                                {act.resources.filter(r => r.type === 'Material').map(res => (
                                  <button
                                    key={res.id}
                                    onClick={() => setSelectedResourceId(res.id)}
                                    className={`flex items-center justify-between w-full text-left p-2 rounded-md transition-all ${selectedResourceId === res.id ? 'bg-orange-50 text-orange-900 border border-orange-200' : 'hover:bg-slate-100 text-slate-600 border border-transparent'}`}
                                  >
                                    <span className="text-[10px] font-bold truncate pr-2">{res.name}</span>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-white rounded uppercase tracking-widest text-slate-500 shadow-sm shrink-0 border border-slate-100">{res.unit}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
        
        {/* Main Area */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-slate-50 relative">
          {!selectedResourceId ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 max-w-md w-full text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                  <Calculator className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">No Material Selected</h3>
                <p className="text-xs text-slate-500 font-medium">Select a BOQ item, expand an Activity, and choose a Material resource from the sidebar to calculate its takeoff.</p>
              </div>
            </div>
          ) : !currentTakeoff ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto mt-10">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-5 shadow-inner">
                <Database className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Start Taking Off {selectedResource?.name}</h2>
              <p className="text-sm text-slate-500 font-medium mb-8 max-w-md mx-auto">Create a new measurement sheet to calculate lengths, areas, and volumes for this resource.</p>
              <button 
                onClick={handleCreateTakeoff}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create QS Sheet
              </button>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <span className="text-blue-600">{selectedResource?.name}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest border border-slate-200">{selectedResource?.unit}</span>
                  </h2>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>{selectedBoq?.code}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{selectedActivity?.name}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-2 md:p-3 rounded-2xl border border-slate-100 w-full md:w-auto">
                  <div className="flex flex-col px-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Calculated Total</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter leading-none">{currentTakeoff.totalQuantity.toFixed(2)}</span>
                  </div>
                  <div className="h-10 w-px bg-slate-200" />
                  <div className="flex flex-col px-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Current Usage</span>
                    <span className="text-2xl font-black text-slate-500 font-mono tracking-tighter leading-none">{selectedResource?.consumption?.toFixed(2) || '0.00'}</span>
                  </div>
                  <button 
                    onClick={syncToConsumption}
                    className="ml-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 shrink-0"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    Sync Link
                  </button>
                </div>
              </div>

              {/* Measurements Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-slate-400" />
                    Measurement Details
                  </h3>
                  <button 
                    onClick={handleAddMeasurement}
                    className="bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-4 md:px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">#</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 min-w-[200px]">Description / Location</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Count</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Length</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Width</th>
                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Height</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-900 w-32 text-right bg-slate-50">Total</th>
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(currentTakeoff.measurements || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400 border-none">
                            No measurements added. Click "Add Row" to start.
                          </td>
                        </tr>
                      ) : (currentTakeoff.measurements || []).map((m, idx) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 md:px-6 py-2 text-center">
                            <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="text" 
                              value={m.description}
                              onChange={(e) => handleUpdateMeasurement(m.id, { description: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                              placeholder="Location or description..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              value={m.count === 0 ? '' : m.count}
                              onChange={(e) => handleUpdateMeasurement(m.id, { count: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-center"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              value={m.length === 0 ? '' : m.length}
                              onChange={(e) => handleUpdateMeasurement(m.id, { length: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-center"
                              placeholder="-"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              value={m.width === 0 ? '' : m.width}
                              onChange={(e) => handleUpdateMeasurement(m.id, { width: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-center"
                              placeholder="-"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              value={m.height === 0 ? '' : m.height}
                              onChange={(e) => handleUpdateMeasurement(m.id, { height: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-center"
                              placeholder="-"
                            />
                          </td>
                          <td className="px-4 py-2 text-right bg-slate-50 group-hover:bg-blue-50/30 transition-colors">
                            <span className="text-sm font-black font-mono tracking-tighter text-slate-900">{m.total.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button 
                              onClick={() => handleDeleteMeasurement(m.id)}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Delete Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {(currentTakeoff.measurements || []).length > 0 && (
                      <tfoot className="bg-slate-900 text-white">
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total Measured Quantity</td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-lg font-black font-mono tracking-tighter text-white">{currentTakeoff.totalQuantity.toFixed(2)}</span>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
