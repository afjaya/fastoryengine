import * as React from 'react';
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Terminal, CheckCircle2, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { AppDatabase } from '../types.js';
import { useLanguage } from './LanguageContext.js';

interface GeneratorProps {
  db: AppDatabase;
  isGenerating: boolean;
  onTriggerGenerate: (snippet: string, length: number, coverUrl?: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  presetSnippet: string;
  presetLength: number;
  presetCoverUrl?: string;
}

export const Generator: React.FC<GeneratorProps> = ({
  db,
  isGenerating,
  onTriggerGenerate,
  presetSnippet,
  presetLength,
  presetCoverUrl,
}) => {
  const { t, language } = useLanguage();
  const [customSnippet, setCustomSnippet] = useState(presetSnippet || '');
  const [targetLength, setTargetLength] = useState(presetLength || db.storyBible.episodeLength || 1500);
  const [coverUrl, setCoverUrl] = useState(presetCoverUrl || '');
  const [activePipelineStep, setActivePipelineStep] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Sync preset props
  useEffect(() => {
    if (presetSnippet) setCustomSnippet(presetSnippet);
    if (presetLength) setTargetLength(presetLength);
    if (presetCoverUrl !== undefined) setCoverUrl(presetCoverUrl);
  }, [presetSnippet, presetLength, presetCoverUrl]);

  // Handle auto-scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [db.logs]);

  // Determine active stepper details based on logs
  useEffect(() => {
    if (!isGenerating) {
      setActivePipelineStep(-1);
      return;
    }

    const latestLogs = db.logs.slice(0, 10).map(l => l.message.toLowerCase());
    
    if (latestLogs.some(m => m.includes('querying ai provider'))) {
      setActivePipelineStep(4); // Generating Prose
    } else if (latestLogs.some(m => m.includes('prompt updated') || m.includes('initiated'))) {
      setActivePipelineStep(3); // Assembling Prompt
    } else if (latestLogs.some(m => m.includes('characters'))) {
      setActivePipelineStep(2); // Compiling Cast
    } else if (latestLogs.some(m => m.includes('bible'))) {
      setActivePipelineStep(1); // Reading Bible
    } else if (latestLogs.some(m => m.includes('saved episode'))) {
      setActivePipelineStep(5); // Saving Story
    } else if (latestLogs.some(m => m.includes('exports'))) {
      setActivePipelineStep(6); // Exporting Files
    } else if (latestLogs.some(m => m.includes('drive'))) {
      setActivePipelineStep(7); // Uploading Drive
    } else {
      setActivePipelineStep(0); // Starting
    }
  }, [db.logs, isGenerating]);

  const handleStartGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onTriggerGenerate(customSnippet, targetLength, coverUrl);
    } catch (err: any) {
      setError(err.message || (language === 'ID' ? 'Pembuatan cerita dibatalkan.' : 'Generation aborted.'));
    }
  };

  const activeProvider = db.providers.find(p => p.isActive) || db.providers[0];
  const lastGeneratedEpisode = db.episodes[db.episodes.length - 1];

  const pipelineSteps = language === 'ID' ? [
    'Inisialisasi Jalur Produksi Cerita',
    'Baca Aturan Alkitab Cerita',
    'Kompilasi Daftar Karakter Aktif',
    'Susun Prompt & Konteks Kontinuitas',
    `Kueri API Penyedia AI (${activeProvider?.name})`,
    'Simpan Cerita ke Arsip SQLite-JSON',
    'Ekspor Plaintext & DOCX Terformat',
    'Kirim Unggahan Google Drive & Email SMTP'
  ] : [
    'Initialize Story Production Pipeline',
    'Read Story Bible Rules',
    'Compile Active Character Cast',
    'Assemble Prompt & Continuity Context',
    `Query AI Provider API (${activeProvider?.name})`,
    'Save Story to SQLite-JSON Archive',
    'Export formatted Plaintext & DOCX',
    'Dispatch Google Drive uploads & SMTP emails'
  ];

  return (
    <div className="space-y-6" id="generator-view">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            {t('generatorTitle')}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {t('generatorSubtitle')}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-4 rounded text-xs flex items-center gap-3" id="generator-error-banner">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start" id="generator-workspace">
        
        {/* Left Column: Pipeline Trigger Form */}
        <div className="space-y-4">
          <form onSubmit={handleStartGeneration} className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4" id="generator-config-form">
            <h2 className="text-xs font-bold text-zinc-200 border-b border-zinc-800 pb-2.5 flex items-center gap-2 uppercase tracking-widest">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${isGenerating ? 'animate-spin' : ''}`} />
              {t('generatorConfig')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  {t('targetLength')}
                </label>
                <input
                  type="number"
                  value={targetLength}
                  onChange={(e) => setTargetLength(Number(e.target.value))}
                  min="200"
                  max="10000"
                  disabled={isGenerating}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  {t('customDirection')}
                </label>
                <textarea
                  value={customSnippet}
                  onChange={(e) => setCustomSnippet(e.target.value)}
                  rows={4}
                  placeholder="e.g. Silas makes a deal with executive Nobu..."
                  disabled={isGenerating}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                />
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-850 text-xs flex justify-between items-center font-mono text-[10px]" id="target-model-badge">
                <span className="text-zinc-500 uppercase tracking-widest">{language === 'ID' ? 'MODEL TARGET:' : 'TARGET MODEL:'}</span>
                <strong className="text-blue-400">
                  {activeProvider?.modelName.toUpperCase()}
                </strong>
              </div>

              {coverUrl && (
                <div className="bg-zinc-950 p-3 rounded border border-zinc-850 space-y-2" id="generated-cover-preview">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">
                    {language === 'ID' ? 'SAMPUL YANG DIHASILKAN:' : 'GENERATED COVER ART:'}
                  </span>
                  <div className="aspect-square w-full max-w-[140px] mx-auto rounded-lg overflow-hidden border border-zinc-800 shadow-inner bg-black/40 relative">
                    <img 
                      src={coverUrl} 
                      alt="Generated Cover Preview" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className={`w-full py-2.5 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg cursor-pointer ${
                  isGenerating
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 active:scale-98 shadow-blue-950/40'
                }`}
                id="execute-pipeline-btn"
              >
                {isGenerating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {language === 'ID' ? 'Menjalankan Pipeline...' : 'Executing Pipeline...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('generateNow')}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Stepper Pipeline Progress */}
          {isGenerating && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 animate-fade-in" id="stepper-progress-box">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2.5">
                {language === 'ID' ? 'Kemajuan Stepper Aktif' : 'Active Stepper Progress'}
              </h2>

              <div className="space-y-3 font-mono text-[10px]">
                {pipelineSteps.map((step, idx) => {
                  const isDone = idx < activePipelineStep;
                  const isActive = idx === activePipelineStep;
                  return (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : isActive ? (
                        <Loader className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-800 text-[9px] font-semibold text-zinc-500 flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                      )}
                      <span className={`${
                        isDone ? 'text-zinc-500 line-through' : isActive ? 'text-zinc-100 font-bold' : 'text-zinc-600'
                      }`}>
                        {step.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pipeline Log Console */}
        <div className="lg:col-span-2 space-y-4 h-full flex flex-col justify-between" id="generator-terminal-panel">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-widest">
                  {language === 'ID' ? 'Log Konsol Story Engine' : 'Story Engine Console Logs'}
                </h3>
              </div>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            </div>

            <div className="flex-grow overflow-y-auto font-mono text-[11px] space-y-1.5 pr-2 custom-scrollbar">
              {db.logs.slice().reverse().map(log => {
                let textClass = 'text-zinc-400';
                if (log.level === 'ERROR') textClass = 'text-rose-400 font-bold';
                if (log.level === 'WARNING') textClass = 'text-amber-400 font-bold';
                if (log.level === 'INFO' && log.message.includes('Success')) textClass = 'text-emerald-400 font-bold';

                return (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-zinc-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={textClass}>
                      [{log.level}] {log.message}
                    </span>
                  </div>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Showcase of last generated episode */}
          {lastGeneratedEpisode && !isGenerating && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 space-y-3.5 animate-fade-in text-xs" id="generator-success-banner">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">
                      {language === 'ID' ? 'Episode Berhasil Dibuat!' : 'Episode Generated Successfully!'}
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      {language === 'ID' ? 'Draf bab disimpan. Siap untuk ditinjau dan diedit secara manual.' : 'Chapter draft saved. Ready for review and manual edits.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded border border-zinc-850/60">
                <h4 className="text-xs font-bold text-zinc-300">
                  {language === 'ID' ? 'Episode' : 'Episode'} #{lastGeneratedEpisode.episodeNumber}: {lastGeneratedEpisode.title}
                </h4>
                <p className="text-xs text-zinc-400 italic mt-1.5 line-clamp-3 leading-relaxed">
                  {lastGeneratedEpisode.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-zinc-500 uppercase tracking-widest">
                  {language === 'ID' ? 'File Output Lokal:' : 'Local Output File:'}
                </span>
                <span className="text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded font-bold">
                  Episode_{String(lastGeneratedEpisode.episodeNumber).padStart(3, '0')}.docx
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
