import React, { useState } from 'react';
import { SomyaMemory, MemoryCategory } from '../types';
import { Database, Trash2, X, Plus, Search, Tag, Calendar, AlertTriangle } from 'lucide-react';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  memories: SomyaMemory[];
  onAddMemory: (content: string, category: MemoryCategory, importance: number) => void;
  onDeleteMemory: (id: string) => void;
  onClearAll: () => void;
  memoryEnabled: boolean;
  onToggleMemoryEnabled: () => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClearAll,
  memoryEnabled,
  onToggleMemoryEnabled,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [newContent, setNewContent] = useState('');
  const [newCat, setNewCat] = useState<MemoryCategory>('PERSONAL');
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (!isOpen) return null;

  const filteredMemories = memories.filter((mem) => {
    const matchCat = selectedCategory === 'ALL' || mem.category === selectedCategory;
    const matchSearch =
      mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddMemory(newContent.trim(), newCat, 4);
    setNewContent('');
    setIsAdding(false);
  };

  const categories: Array<{ id: string; label: string }> = [
    { id: 'ALL', label: 'All' },
    { id: 'PROFILE', label: 'Profile' },
    { id: 'PREFERENCE', label: 'Preferences' },
    { id: 'INTEREST', label: 'Interests' },
    { id: 'PROJECT', label: 'Projects' },
    { id: 'GOAL', label: 'Goals' },
    { id: 'HABIT', label: 'Habits' },
    { id: 'USER_SETTING', label: 'Settings' },
    { id: 'IMPORTANT_FACT', label: 'Important Facts' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] glass-panel border border-cyan-500/30 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100 uppercase tracking-wider">
                Somya Persistent Memory
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech">
                {memories.length} stored records across short & long-term synapses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recalled memories..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
            <button
              onClick={() => setShowConfirmClear(true)}
              disabled={memories.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 disabled:opacity-40 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-6 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono-tech transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Add Memory Form Dropdown */}
        {isAdding && (
          <form
            onSubmit={handleAddSubmit}
            className="p-4 border-b border-cyan-500/20 bg-slate-900/80 flex flex-col gap-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-300 font-display uppercase tracking-wider">
                Store New Fact in Somya Memory
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. Favorite game is GTA VI, prefers Hinglish explanations, working on Somya AI app..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Category:</span>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as MemoryCategory)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="PROFILE">Profile (Name, Info)</option>
                  <option value="PREFERENCE">Preference (Likes, Favs)</option>
                  <option value="INTEREST">Interest (Hobbies)</option>
                  <option value="PROJECT">Project (Ongoing Work)</option>
                  <option value="GOAL">Goal (Aims, Targets)</option>
                  <option value="HABIT">Habit (Routines)</option>
                  <option value="USER_SETTING">User Setting (Language, Style)</option>
                  <option value="IMPORTANT_FACT">Important Fact</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-medium hover:from-cyan-500 hover:to-blue-500"
              >
                Save to Synapse
              </button>
            </div>
          </form>
        )}

        {/* Clear All Confirmation Modal */}
        {showConfirmClear && (
          <div className="p-4 bg-rose-950/60 border-b border-rose-500/40 flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Are you sure you want to erase all memories? Somya will forget all personal facts.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowConfirmClear(false);
                }}
                className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs hover:bg-rose-500"
              >
                Confirm Delete All
              </button>
            </div>
          </div>
        )}

        {/* Memories List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredMemories.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Database className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p>No memory records found.</p>
              <p className="mt-1 text-slate-600">
                You can say "Somya, remember that..." or click "Add Memory" above.
              </p>
            </div>
          ) : (
            filteredMemories.map((mem) => (
              <div
                key={mem.id}
                className="group p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 hover:border-cyan-500/30 transition-all flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono-tech bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                      {mem.category}
                    </span>
                    {mem.key && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tech bg-slate-950 border border-slate-700/60 text-slate-300">
                        key: {mem.key}
                      </span>
                    )}
                    {mem.importance && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tech bg-purple-950/60 border border-purple-800/40 text-purple-300">
                        {String(mem.importance)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono-tech flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(mem.createdAt || mem.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">{mem.content}</p>
                </div>

                <button
                  onClick={() => onDeleteMemory(mem.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                  title="Delete memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
