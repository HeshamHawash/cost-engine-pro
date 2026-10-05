import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  BarChart3, 
  LayoutList, 
  Database, 
  RefreshCw, 
  TrendingUp, 
  PieChart as PieChartIcon 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie 
} from 'recharts';

export const MetricCard = ({ title, value, icon, trend, color }: { title: string; value: string; icon: React.ReactNode; trend: string; color: string }) => {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100'
  };

  return (
    <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300 group">
      <div className="flex justify-between items-start mb-2 md:mb-4">
        <div className={`p-2 md:p-3 rounded-lg md:rounded-2xl ring-1 transition-transform group-hover:scale-110 ${colorMap[color]}`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-3.5 h-3.5 md:w-5 md:h-5' })}
        </div>
        <span className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-tighter sm:tracking-widest">{trend}</span>
      </div>
      <div>
        <p className="text-[7px] md:text-[10px] font-black uppercase text-slate-400 tracking-tighter sm:tracking-widest mb-0.5 md:mb-1">{title}</p>
        <p className="text-sm sm:text-lg md:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
      </div>
    </div>
  );
};

export interface DashboardProps {
  stats: any;
  currency: any;
  formatPrice: (v: number) => string;
}

export const Dashboard = React.memo(({ stats, currency, formatPrice }: DashboardProps) => {
  const [viewMode, setViewMode] = useState<'type' | 'category' | 'work'>('type');
  const COLORS = ['#f97316', '#0ea5e9', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#64748b'];

  const currentChartData = useMemo(() => {
    switch (viewMode) {
      case 'category': return stats.chartDataByCategory || [];
      case 'work': return stats.chartDataByWorkItem || [];
      default: return stats.chartDataByType || [];
    }
  }, [viewMode, stats]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 md:p-6 lg:p-8 transition-colors scroll-smooth">
       <div className="max-w-7xl mx-auto space-y-6 md:space-y-10 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end bg-transparent p-0 border-none h-auto gap-4 mb-2">
             <div className="animate-in fade-in slide-in-from-left duration-700">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200/50">
                    <LayoutDashboard className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">Project Analytics</h1>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Insights</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-slate-500 font-medium max-w-lg leading-relaxed">Strategic visibility into BOQ cost distribution, material consumption trends, and financial health metrics.</p>
             </div>
             <div className="bg-white/70 backdrop-blur-md px-5 md:px-7 py-3 md:py-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4 md:gap-5 transition-all hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 w-full sm:w-auto animate-in fade-in slide-in-from-right duration-1000">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                   <Target className="w-6 h-6 md:w-7 md:h-7" />
                </div>
                <div>
                   <p className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] leading-none mb-1.5">Study Outcome</p>
                   <div className="flex items-baseline gap-1">
                     <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">Optimized</p>
                     <p className="text-[10px] font-black text-emerald-500 font-mono">+12.4%</p>
                   </div>
                </div>
             </div>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
             <MetricCard 
                title="Total Valuation" 
                value={formatPrice(stats?.totalBudget || 0)} 
                icon={<BarChart3 />} 
                trend="G. Total" 
                color="orange" 
             />
             <MetricCard 
                title="Active BOQ Items" 
                value={(stats?.chartDataByWorkItem?.length || 0).toString()} 
                icon={<LayoutList />} 
                trend="Work Scope" 
                color="emerald" 
             />
             <MetricCard 
                title="Resource Types" 
                value={(stats?.chartDataByType?.length || 0).toString()} 
                icon={<Database />} 
                trend="Allocation" 
                color="amber" 
             />
             <MetricCard 
                title="Variance Control" 
                value="0.00%" 
                icon={<RefreshCw />} 
                trend="Realtime" 
                color="rose" 
             />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-slate-200 p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50 flex flex-col min-h-[500px]">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 flex items-center gap-2.5">
                       <div className="p-1.5 bg-orange-50 rounded-lg"><TrendingUp className="w-4 h-4 text-orange-500" /></div> Cost Distribution
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 ml-9">Weighted financial split by grouping</p>
                  </div>
                  <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl w-fit border border-slate-200/50">
                    <button
                      onClick={() => setViewMode('type')}
                      className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'type' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Types
                    </button>
                    <button
                      onClick={() => setViewMode('category')}
                      className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'category' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Categories
                    </button>
                    <button
                      onClick={() => setViewMode('work')}
                      className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'work' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Items
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 w-full min-h-0">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentChartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                         <defs>
                           {COLORS.map((color, index) => (
                             <linearGradient key={`grad-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                               <stop offset="0%" stopColor={color} stopOpacity={1} />
                               <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                             </linearGradient>
                           ))}
                         </defs>
                         <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                         <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            fontSize={9} 
                            fontWeight="800" 
                            fontFamily="Inter, sans-serif"
                            dy={15}
                            tick={{ fill: '#94a3b8' }}
                            tickFormatter={(value) => (value && typeof value === 'string' && value.length > 15) ? value.substring(0, 12) + '...' : (value || '')}
                         />
                         <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            fontSize={9} 
                            fontWeight="800" 
                            fontFamily="Inter, sans-serif"
                            tick={{ fill: '#94a3b8' }}
                            tickFormatter={(v) => `${currency?.symbol || '$'} ${v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v.toFixed(0)}`} 
                         />
                         <RechartsTooltip 
                            cursor={{ fill: '#f8fafc', radius: 10 }}
                            formatter={(value: any) => [formatPrice(value), 'Budget Allocation']}
                            contentStyle={{ 
                              borderRadius: '24px', 
                              border: '1px solid #f1f5f9', 
                              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', 
                              background: 'rgba(255, 255, 255, 0.95)', 
                              backdropFilter: 'blur(10px)',
                              padding: '16px',
                              animation: 'fade-in 0.3s ease-out'
                            }}
                            itemStyle={{ color: '#4f46e5', fontWeight: '900', fontSize: '15px', padding: '4px 0' }}
                            labelStyle={{ fontWeight: '900', marginBottom: '8px', color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                         />
                         <Bar dataKey="value" radius={[12, 12, 4, 4]} maxBarSize={45}>
                            {currentChartData.map((_entry: any, index: number) => (
                               <Cell 
                                 key={`cell-${index}`} 
                                 fill={`url(#barGradient-${index})`}
                               />
                            ))}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm transition-colors flex flex-col">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                   <PieChartIcon className="w-4 h-4 text-orange-500" /> Cost Allocation
                </h2>
                <div className="flex-1 w-full min-h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie
                            data={stats.chartDataByType || []}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                         >
                            {(stats.chartDataByType || []).map((_entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                         </Pie>
                         <RechartsTooltip 
                            formatter={(value: any) => [formatPrice(value), 'Total']}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#ffffff' }}
                         />
                      </PieChart>
                   </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {(stats.chartDataByType || []).map((item: any, index: number) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-900">{formatPrice(item.value)}</span>
                    </div>
                  ))}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
});

export default Dashboard;
