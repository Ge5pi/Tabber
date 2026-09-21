import React, { useState, useEffect } from 'react';
import { TaskItem } from '../../types';
import { getTasks, saveTasks, getPomodoroState, savePomodoroState } from '../../services/storage';
import { getGoogleAuthToken } from '../../services/auth';
import { createCalendarEvent } from '../../services/calendar';
import { CheckCircle2, Circle, Trash2, Plus, Sparkles, ExternalLink, Clock, Tag, Calendar, CalendarCheck, Target, Star } from 'lucide-react';

interface TasksViewProps {
  onSwitchToFocus?: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onSwitchToFocus }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'focus'>('all');
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());

  const loadTasks = async () => {
    const current = await getTasks();
    setTasks(current);
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: `task_${Date.now()}`,
      title: newTaskTitle.trim(),
      category: 'General',
      priority: 'medium',
      estimateMinutes: 20,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const updated = [newTask, ...tasks];
    setTasks(updated);
    await saveTasks(updated);
    setNewTaskTitle('');
  };

  const handleToggleTask = async (taskId: string) => {
    const updated = tasks.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    await saveTasks(updated);
  };

  const handleToggleFocus = async (taskId: string) => {
    const updated = tasks.map(t => (t.id === taskId ? { ...t, isFocus: !t.isFocus } : t));
    setTasks(updated);
    await saveTasks(updated);
  };

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    await saveTasks(updated);
  };

  const handleSyncToCalendar = async (task: TaskItem) => {
    const authRes = await getGoogleAuthToken(true);
    const result = await createCalendarEvent(authRes.token, {
      title: task.title,
      description: task.originalText || task.title,
      startDateTime: task.deadline || undefined,
      durationMinutes: task.estimateMinutes || 30
    });

    if (result.success) {
      const updatedSet = new Set(syncedIds);
      updatedSet.add(task.id);
      setSyncedIds(updatedSet);

      const updated = tasks.map(t => t.id === task.id ? { ...t, inCalendar: true } : t);
      setTasks(updated);
      await saveTasks(updated);
    }
  };

  const handleSelectFocusTask = async (task: TaskItem) => {
    const pState = await getPomodoroState();
    await savePomodoroState({ ...pState, taskName: task.title });
    if (onSwitchToFocus) {
      onSwitchToFocus();
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    if (filter === 'focus') return t.isFocus;
    return true;
  }).sort((a, b) => {
    if (a.isFocus && !b.isFocus) return -1;
    if (!a.isFocus && b.isFocus) return 1;
    return 0;
  });

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Quick Add Task Form */}
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </form>

      {/* Filter Segmented Control */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1 rounded-lg font-medium transition-all ${
            filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('focus')}
          className={`flex-1 py-1 rounded-lg font-medium transition-all ${
            filter === 'focus' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Focus ({tasks.filter(t => t.isFocus).length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-1 rounded-lg font-medium transition-all ${
            filter === 'active' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Active ({tasks.filter(t => !t.completed).length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`flex-1 py-1 rounded-lg font-medium transition-all ${
            filter === 'completed' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Completed ({tasks.filter(t => t.completed).length})
        </button>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`p-3 rounded-xl glass-card border transition-all space-y-2 ${
              task.completed ? 'opacity-60 border-slate-900 bg-slate-900/30' : 
              task.isFocus ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 flex-1 cursor-pointer" onClick={() => handleToggleTask(task.id)}>
                <button className="mt-0.5 text-slate-400 hover:text-indigo-400 transition-colors">
                  {task.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-500/20" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                <div>
                  <span className={`text-xs font-semibold block leading-tight ${
                    task.completed ? 'line-through text-slate-400' : 'text-slate-200'
                  }`}>
                    {task.title}
                  </span>

                  {task.originalText && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-3 italic bg-slate-900/60 p-1.5 rounded border border-slate-800 whitespace-pre-wrap">
                      "{task.originalText}"
                    </p>
                  )}

                  {/* Render Enriched Quick Actions (from MERGE/RECONCILE) */}
                  {task.actions && task.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {task.actions.map((act, actIdx) => (
                        <a
                          key={actIdx}
                          href={act.url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!act.url) e.preventDefault();
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/80 transition-all flex items-center gap-1"
                        >
                          <span>{act.label}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleFocus(task.id)}
                  className={`p-1.5 rounded-lg transition-all shrink-0 ${
                    task.isFocus ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                  title={task.isFocus ? 'Remove from Focus list' : 'Add to Focus list'}
                >
                  <Star className="w-4 h-4" fill={task.isFocus ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={() => handleSelectFocusTask(task)}
                  className="px-2 py-1 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all shrink-0 shadow-sm ml-1"
                  title="Start Pomodoro Session"
                >
                  <Target className="w-3 h-3 text-indigo-200" />
                  <span>Start</span>
                </button>

                <button
                  onClick={() => handleSyncToCalendar(task)}
                  disabled={syncedIds.has(task.id) || task.inCalendar}
                  className="p-1 text-slate-400 hover:text-emerald-400 disabled:text-emerald-500 rounded-lg hover:bg-emerald-500/10 transition-all shrink-0"
                  title="Add to Google Calendar"
                >
                  {syncedIds.has(task.id) || task.inCalendar ? (
                    <CalendarCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Badges & Context URL */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                  <Tag className="w-2.5 h-2.5 text-indigo-400" />
                  {task.category}
                </span>

                <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                  {task.estimateMinutes}m
                </span>

                {task.priority === 'high' && (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded font-bold">
                    High
                  </span>
                )}
              </div>

              {task.contextUrl && (
                <a
                  href={task.contextUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  <span>Source Page</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400">No tasks yet.</div>
            <div className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Highlight text on any website to automatically convert it into an AI Task!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
