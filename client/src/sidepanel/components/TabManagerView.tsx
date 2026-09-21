import React, { useState, useEffect } from 'react';
import { TabInfo } from '../../types';
import { getAllTabs, closeTab, deduplicateTabs, switchToTab, groupTabsByDomain, groupTabsInBrowser } from '../../services/tabs';
import { analyzeTabsWithAI } from '../../services/api';
import { Trash2, Sparkles, ExternalLink, Search, RefreshCw, Layers, CopyX, FolderTree } from 'lucide-react';

export const TabManagerView: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiCategories, setAiCategories] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const loadTabs = async () => {
    const currentTabs = await getAllTabs();
    setTabs(currentTabs);
  };

  useEffect(() => {
    loadTabs();
    // Poll for tab updates every 3 seconds or listen to Chrome Tab events
    const interval = setInterval(loadTabs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseTab = async (tabId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await closeTab(tabId);
    setTabs(tabs.filter(t => t.id !== tabId));
  };

  const handleDeduplicate = async () => {
    const closedCount = await deduplicateTabs();
    showNotify(closedCount > 0 ? `Closed ${closedCount} duplicate tabs` : 'No duplicate tabs found');
    await loadTabs();
  };

  const handleAIAnalyze = async () => {
    setIsAnalyzing(true);
    setNotification(null);
    try {
      const res = await analyzeTabsWithAI(tabs);
      setAiSummary(res.summary);
      if (res.categories) {
        setAiCategories(res.categories);
      }
    } catch (err) {
      showNotify('AI analysis failed. Check backend connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGroupInBrowser = async () => {
    if (!aiCategories || aiCategories.length === 0) return;
    setIsGrouping(true);
    try {
      const groups = aiCategories.map((cat, index) => {
        const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
        return {
          name: cat.categoryName,
          tabIds: cat.tabIds,
          color: colors[index % colors.length]
        };
      });
      await groupTabsInBrowser(groups);
      showNotify('Tabs grouped successfully in Chrome!');
    } catch (err) {
      showNotify('Failed to group tabs.');
    } finally {
      setIsGrouping(false);
    }
  };

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredTabs = tabs.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedTabs = groupTabsByDomain(filteredTabs);
  const duplicatesCount = tabs.filter((t) => t.isDuplicate).length;

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-2.5 rounded-xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-medium">Total Tabs</div>
          <div className="text-xl font-bold text-white mt-0.5">{tabs.length}</div>
        </div>

        <div className="glass-card p-2.5 rounded-xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-medium">Duplicates</div>
          <div className={`text-xl font-bold mt-0.5 ${duplicatesCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {duplicatesCount}
          </div>
        </div>

        <div className="glass-card p-2.5 rounded-xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-medium">Domains</div>
          <div className="text-xl font-bold text-indigo-400 mt-0.5">{groupedTabs.length}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDeduplicate}
          disabled={duplicatesCount === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-slate-200 border border-slate-700/80 transition-all"
        >
          <CopyX className="w-3.5 h-3.5 text-amber-400" />
          <span>Remove Duplicates</span>
        </button>

        <button
          onClick={handleAIAnalyze}
          disabled={isAnalyzing || tabs.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          )}
          <span>AI Categorize</span>
        </button>

        {aiCategories.length > 0 && (
          <button
            onClick={handleGroupInBrowser}
            disabled={isGrouping}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition-all"
          >
            {isGrouping ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderTree className="w-3.5 h-3.5" />
            )}
            <span>Group in Browser</span>
          </button>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="px-3 py-2 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-xs text-center font-medium animate-fadeIn">
          {notification}
        </div>
      )}

      {/* AI Summary Box */}
      {aiSummary && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Overview</span>
          </div>
          {aiSummary}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter tabs by title or domain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Grouped Tab List */}
      <div className="space-y-4">
        {groupedTabs.map((group) => (
          <div key={group.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-indigo-400" />
                <span>{group.name}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {group.tabs.length} {group.tabs.length === 1 ? 'tab' : 'tabs'}
              </span>
            </div>

            <div className="space-y-1">
              {group.tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => switchToTab(tab.id, tab.windowId)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl glass-card hover:bg-slate-800/80 cursor-pointer transition-all border ${
                    tab.active ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                    {tab.favIconUrl ? (
                      <img
                        src={tab.favIconUrl}
                        alt=""
                        className="w-4 h-4 rounded shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded bg-slate-700 shrink-0" />
                    )}

                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-200 truncate flex items-center gap-1.5">
                        <span className="truncate">{tab.title}</span>
                        {tab.isDuplicate && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                            Dup
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{tab.url}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        switchToTab(tab.id, tab.windowId);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/20"
                      title="Switch to tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20"
                      title="Close tab"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {groupedTabs.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">No matching tabs found</div>
        )}
      </div>
    </div>
  );
};
