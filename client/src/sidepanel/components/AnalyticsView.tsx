import React, { useState, useEffect } from 'react';
import { getPomodoroState, getAnalyticsData, AnalyticsData } from '../../services/storage';
import { Activity, Clock, ShieldAlert, TrendingUp } from 'lucide-react';
import { PomodoroState } from '../../types';

export const AnalyticsView: React.FC = () => {
  const [pomodoroState, setPomodoroState] = useState<PomodoroState | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const pState = await getPomodoroState();
      const aData = await getAnalyticsData();
      setPomodoroState(pState);
      setAnalytics(aData);
    };
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!pomodoroState || !analytics) return <div className="p-4 text-center text-slate-500">Loading Analytics...</div>;

  const totalFocusMinutes = pomodoroState.totalSessions * 25;
  const hours = Math.floor(totalFocusMinutes / 60);
  const minutes = totalFocusMinutes % 60;

  // Mock past days for the chart
  const mockChartData = [30, 45, 20, 80, 120, 90, totalFocusMinutes];
  const maxMins = Math.max(...mockChartData, 1);

  return (
    <div className="p-4 space-y-4 pb-12">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-indigo-400" />
        <h2 className="text-sm font-bold text-slate-200">Self-Awareness Analytics</h2>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/20">
          <div className="flex items-center gap-1.5 text-indigo-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold">Focus Time</span>
          </div>
          <div className="text-2xl font-black text-white">
            {hours > 0 ? `${hours}h ` : ''}{minutes}m
          </div>
          <div className="text-[10px] text-indigo-300/70 mt-1">
            Across {pomodoroState.totalSessions} sessions
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-slate-900/60 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-emerald-400 mb-2">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-xs font-semibold">Distractions Blocked</span>
          </div>
          <div className="text-2xl font-black text-white">
            {analytics.distractionsBlocked}
          </div>
          <div className="text-[10px] text-emerald-300/70 mt-1">
            Times you stayed on track
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-slate-300">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold">This Week</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Minutes</div>
        </div>

        <div className="flex items-end justify-between h-32 gap-1.5 mt-2">
          {mockChartData.map((mins, i) => {
            const heightPct = Math.max((mins / maxMins) * 100, 5);
            const isToday = i === mockChartData.length - 1;
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-2">
                <div 
                  className="w-full rounded-sm relative group cursor-pointer transition-all duration-300"
                  style={{ 
                    height: `${heightPct}%`, 
                    backgroundColor: isToday ? '#6366f1' : '#1e293b' 
                  }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-200 text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {mins}m
                  </div>
                </div>
                <div className={`text-[9px] font-medium ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {days[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Footer Insight */}
      <div className="text-center text-[11px] text-slate-500 italic mt-4">
        "Your focus is improving. Keep up the deep work!"
      </div>
    </div>
  );
};
