import React, { useState } from 'react';
import { Terminal, Trash2, Filter, RefreshCw } from 'lucide-react';
import { AppDatabase, GenerationLog } from '../types.js';
import { useLanguage } from './LanguageContext.js';

interface LogsProps {
  logs: GenerationLog[];
  onClearLogs: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const Logs: React.FC<LogsProps> = ({ logs, onClearLogs, onRefresh }) => {
  const { t, language } = useLanguage();
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARNING' | 'ERROR'>('ALL');

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  const handleClear = async () => {
    if (confirm(t('confirmClearLogs'))) {
      try {
        await onClearLogs();
      } catch (e: any) {
        alert((language === 'ID' ? 'Gagal membersihkan log: ' : 'Failed to clear logs: ') + e.message);
      }
    }
  };

  return (
    <div className="space-y-6" id="logs-view">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            {t('logsTitle')}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {t('logsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="bg-neutral-850 hover:bg-neutral-800 text-neutral-300 text-xs px-3 py-2 border border-neutral-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {language === 'ID' ? 'Segarkan' : 'Refresh'}
          </button>
          <button
            onClick={handleClear}
            className="bg-rose-950/25 hover:bg-rose-950/45 text-rose-400 text-xs px-3 py-2 border border-rose-900/30 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            id="clear-logs-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {language === 'ID' ? 'Bersihkan Log' : 'Clear Logs'}
          </button>
        </div>
      </div>

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-neutral-800 pb-3">
          <h2 className="text-sm font-semibold text-neutral-200">
            {language === 'ID' ? 'Terminal Riwayat Eksekusi' : 'Execution History Terminal'}
          </h2>

          {/* Filter options */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400 mr-2">{language === 'ID' ? 'Tingkat:' : 'Level:'}</span>
            {(['ALL', 'INFO', 'WARNING', 'ERROR'] as const).map(level => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider font-mono transition-colors cursor-pointer ${
                  filterLevel === level
                    ? 'bg-indigo-600 text-neutral-100 border border-indigo-500'
                    : 'bg-neutral-950 border border-neutral-850 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {level === 'ALL' && language === 'ID' ? 'SEMUA' : level}
              </button>
            ))}
          </div>
        </div>

        {/* Console view */}
        <div className="bg-neutral-955 border border-neutral-800 rounded-lg p-4 font-mono text-xs h-[450px] overflow-y-auto space-y-2" id="console-logs-scroller">
          {filteredLogs.length > 0 ? (
            filteredLogs.map(log => {
              let badgeColor = 'bg-neutral-850 text-neutral-400 border-neutral-800';
              let textColors = 'text-neutral-300';
              
              if (log.level === 'ERROR') {
                badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                textColors = 'text-rose-400/90 font-medium';
              } else if (log.level === 'WARNING') {
                badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                textColors = 'text-amber-400/90';
              } else if (log.level === 'INFO' && log.message.includes('successfully')) {
                badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                textColors = 'text-emerald-300';
              }

              return (
                <div key={log.id} className="flex items-start gap-3 border-b border-neutral-900/60 pb-1.5 leading-relaxed">
                  <span className="text-neutral-500 shrink-0 select-none">
                    {new Date(log.timestamp).toLocaleString(language === 'ID' ? 'id-ID' : 'en-US')}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeColor}`}>
                    {log.level}
                  </span>
                  {log.episodeNumber && (
                    <span className="text-indigo-400 font-bold shrink-0">
                      [{language === 'ID' ? 'BAB' : 'EP'} #{log.episodeNumber}]
                    </span>
                  )}
                  <span className={textColors}>{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <Terminal className="w-8 h-8 text-neutral-700 mb-2" />
              <p className="text-xs font-mono">
                {language === 'ID' 
                  ? `Tidak ada log yang cocok dengan tingkat filter [${filterLevel === 'ALL' ? 'SEMUA' : filterLevel}].` 
                  : `No logs found matching filter level [${filterLevel}].`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
