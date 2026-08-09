import * as React from 'react';
import { useState, useEffect } from 'react';
import { BookOpen, FileText, CheckCircle2, Cloud, Mail, Calendar, Sparkles, Server, RefreshCw, Play, ArrowRight, Check, Image as ImageIcon, Maximize2, X, Download, ExternalLink, Eye } from 'lucide-react';
import { AppDatabase, Episode } from '../types.js';
import { useLanguage } from './LanguageContext.js';

interface DashboardProps {
  db: AppDatabase;
  onNavigate: (tab: string) => void;
  onTriggerGenerate: () => void;
  isGenerating: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ db, onNavigate, onTriggerGenerate, isGenerating }) => {
  const { t, language } = useLanguage();
  const totalEpisodes = db.episodes.length;
  const lastEpisode: Episode | undefined = db.episodes[db.episodes.length - 1];
  const lastLog = db.logs[0];
  const activeProvider = db.providers.find(p => p.isActive) || db.providers[0];

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTime, setSyncTime] = useState<string | null>(null);
  const [selectedVisual, setSelectedVisual] = useState<Episode | null>(null);

  const [exportedFiles, setExportedFiles] = useState<Array<{ name: string; size: number; mtime: string; path: string }>>([]);
  const [folderPath, setFolderPath] = useState<string>('');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [fileSearch, setFileSearch] = useState('');

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/stories');
        if (res.ok) {
          const data = await res.json();
          setExportedFiles(data.files || []);
          setFolderPath(data.folderPath || '');
        }
      } catch (err) {
        console.error('Error fetching exported files:', err);
      }
    };
    fetchFiles();
  }, [db.episodes, isGenerating]);

  const recentVisuals = [...db.episodes]
    .filter(ep => ep.coverUrl)
    .sort((a, b) => new Date(b.generationDate).getTime() - new Date(a.generationDate).getTime())
    .slice(0, 4);

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing) return;
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1500);
  };

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-radial from-neutral-900 via-neutral-950 to-neutral-950 p-6 rounded-xl border border-neutral-800" id="welcome-banner">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
              {t('welcomeBack')}
            </h1>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              {t('tagline')}
            </p>
          </div>
          <button
            onClick={onTriggerGenerate}
            disabled={isGenerating}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-lg cursor-pointer ${
              isGenerating
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-neutral-100 border border-indigo-500 active:scale-98 shadow-indigo-900/20'
            }`}
            id="trigger-generate-btn"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? t('generating') : t('runStoryEngine')}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="metrics-grid">
        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 flex items-start gap-4" id="metric-total-chapters">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">{t('episodesDrafted')}</p>
            <h3 className="text-2xl font-semibold text-neutral-100 mt-1">{totalEpisodes}</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              {language === 'ID' ? 'Arsip draf lokal terenkripsi' : 'Encrypted local draft archive'}
            </p>
          </div>
        </div>

        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 flex items-start gap-4" id="metric-active-engine">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">{t('provider')}</p>
            <h3 className="text-lg font-semibold text-neutral-100 mt-1.5 truncate max-w-[150px]">{activeProvider?.name}</h3>
            <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              {activeProvider?.modelName}
            </p>
          </div>
        </div>

        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between h-auto min-h-[140px]" id="metric-last-file">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                    {language === 'ID' ? 'Status Ekspor' : 'Export Status'}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {language === 'ID' ? 'Penyimpanan lokal di /stories' : 'Local storage in /stories'}
                  </p>
                </div>
              </div>
              
              {folderPath && (
                <button
                  onClick={() => setIsFolderModalOpen(true)}
                  className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/60 rounded transition-all cursor-pointer"
                  title={language === 'ID' ? 'Buka Folder Penyimpanan' : 'Open Storage Folder'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mini-list of last 3 exported files */}
            <div className="space-y-1.5 mt-2">
              {exportedFiles.length > 0 ? (
                exportedFiles.slice(0, 3).map((file, idx) => {
                  const isDocx = file.name.endsWith('.docx');
                  return (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between text-[11px] bg-neutral-950/40 hover:bg-neutral-950/90 border border-neutral-800/50 p-1.5 rounded transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${isDocx ? 'bg-indigo-400' : 'bg-amber-400'}`} />
                        <span className="text-neutral-300 font-mono truncate max-w-[125px]" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <a 
                        href={file.path} 
                        download
                        className="text-[10px] text-amber-400/80 group-hover:text-amber-400 font-medium flex items-center gap-0.5 hover:underline pl-2 shrink-0 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        {(file.size / 1024).toFixed(0)} KB
                      </a>
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-neutral-500 italic py-1">
                  {language === 'ID' ? 'Belum ada berkas yang diekspor.' : 'No exported files found.'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3.5 pt-2 border-t border-neutral-850 flex items-center justify-between">
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="text-[10px] text-amber-400 hover:text-amber-300 font-bold font-mono uppercase tracking-widest flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'ID' ? 'BUKA FOLDER INDUK' : 'OPEN CONTAINING FOLDER'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 flex items-start gap-4" id="metric-delivery">
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">
              {language === 'ID' ? 'Pengiriman Otomatis' : 'Auto-Delivery'}
            </p>
            <h3 className="text-sm font-semibold text-neutral-100 mt-2">
              {db.delivery.smtpUser ? 'Active SMTP' : 'No SMTP configured'}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1 truncate max-w-[150px]">To: {db.delivery.smtpTo || 'BangRijal@gmail.com'}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Bento Grid */}
      <div className="space-y-3.5" id="quick-actions-section">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Manual Generate Now */}
          <div 
            onClick={() => {
              if (!isGenerating) {
                onTriggerGenerate();
              }
            }}
            className="bg-[#18181b] hover:bg-[#1f1f23] border border-[#27272a] hover:border-blue-500/50 transition-all duration-300 p-5 rounded-xl flex flex-col justify-between h-40 group relative overflow-hidden cursor-pointer shadow-sm"
            id="action-generate-now"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">
                {language === 'ID' ? 'SALURAN MANUAL' : 'MANUAL PIPELINE'}
              </span>
              <h3 className="text-sm font-bold text-zinc-100">{t('manualGenerateNow')}</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {t('manualGenerateNowDesc')}
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
              {isGenerating ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-bold font-mono tracking-wide">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('generating')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-blue-400 group-hover:text-blue-300 font-bold font-mono uppercase tracking-widest">
                  {t('runEngine')} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </div>
          </div>

          {/* Card 2: View Last Report */}
          <div 
            onClick={() => onNavigate('archive')}
            className="bg-[#18181b] hover:bg-[#1f1f23] border border-[#27272a] hover:border-zinc-700 transition-all duration-300 p-5 rounded-xl flex flex-col justify-between h-40 group cursor-pointer shadow-sm"
            id="action-view-archive"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">{t('latestProseReport')}</span>
              <h3 className="text-sm font-bold text-zinc-100 truncate">
                {lastEpisode ? `${language === 'ID' ? 'Bab' : 'Ch'} #${lastEpisode.episodeNumber}: ${lastEpisode.title}` : t('noChaptersWritten')}
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2 italic">
                {lastEpisode ? lastEpisode.summary : t('noActiveDrafts')}
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-zinc-200 font-bold font-mono uppercase tracking-widest">
                {t('viewArchive')} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>

          {/* Card 3: Sync Repository */}
          <div 
            onClick={handleSync}
            className="bg-[#18181b] hover:bg-[#1f1f23] border border-[#27272a] hover:border-zinc-700 transition-all duration-300 p-5 rounded-xl flex flex-col justify-between h-40 group cursor-pointer shadow-sm"
            id="action-sync-repo"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">{t('workspaceDataSync')}</span>
              <h3 className="text-sm font-bold text-zinc-100">{t('syncStorageSettings')}</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {isSyncing 
                  ? t('syncing')
                  : syncTime 
                  ? `${t('synced')} ${syncTime}`
                  : t('syncDescDefault')
                }
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
              {isSyncing ? (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold font-mono tracking-wide">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('syncing')}
                </span>
              ) : syncTime ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold font-mono tracking-wide">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> {t('synced').toUpperCase()} {syncTime}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-zinc-200 font-bold font-mono uppercase tracking-widest">
                  {t('syncRepository')} <RefreshCw className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500" />
                </span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Recent Visuals Bento Grid */}
      <div className="space-y-3.5" id="recent-visuals-section">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-indigo-400" />
          {language === 'ID' ? 'Koleksi Visual Terbaru' : 'Recent Cover & Visual Arts'}
        </h2>
        
        {recentVisuals.length === 0 ? (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[160px]">
            <ImageIcon className="w-8 h-8 text-zinc-600 mb-2.5" />
            <p className="text-xs font-semibold text-zinc-300">
              {language === 'ID' ? 'Belum ada ilustrasi visual' : 'No cover arts generated yet'}
            </p>
            <p className="text-[11px] text-zinc-500 max-w-md mt-1">
              {language === 'ID' 
                ? 'Seni sampul kustom bertenaga FLUX AI dapat dibuat langsung dari arsip episode Anda.' 
                : 'Custom cover art powered by FLUX AI can be synthesized directly from your episodes archive.'}
            </p>
            <button
              onClick={() => onNavigate('archive')}
              className="mt-3.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {language === 'ID' ? 'Buka Arsip Episode' : 'Go To Episodes'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recentVisuals.map((ep) => {
              return (
                <div 
                  key={ep.id}
                  onClick={() => setSelectedVisual(ep)}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-[#27272a] hover:border-indigo-500/50 bg-[#18181b] cursor-pointer shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                >
                  <img 
                    src={ep.coverUrl} 
                    alt={`Cover for Chapter ${ep.episodeNumber}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Visual overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity duration-300"></div>
                  
                  {/* Top Badge */}
                  <span className="absolute top-2.5 left-2.5 text-[9px] font-bold text-zinc-300 uppercase tracking-wider bg-zinc-950/80 border border-zinc-800/80 px-2 py-0.5 rounded">
                    {language === 'ID' ? `Bab ${ep.episodeNumber}` : `Ch. ${ep.episodeNumber}`}
                  </span>

                  {/* Hover magnifier icon */}
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Maximize2 className="w-3 h-3 text-zinc-300" />
                  </div>

                  {/* Bottom Text */}
                  <div className="absolute bottom-3 left-3 right-3 space-y-0.5">
                    <h3 className="font-bold text-xs text-zinc-100 truncate group-hover:text-indigo-400 transition-colors">
                      {ep.title}
                    </h3>
                    <p className="text-[10px] text-zinc-400 truncate italic">
                      {ep.summary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Panel Content split into Last Episode & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="main-panel-content">
        
        {/* Last Chapter Preview */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 lg:col-span-2 space-y-4" id="last-chapter-preview-panel">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-neutral-200">
                {language === 'ID' ? 'Detail Episode Hasil Terakhir' : 'Last Generated Episode Details'}
              </h2>
            </div>
            {lastEpisode && (
              <button 
                onClick={() => onNavigate('archive')}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {t('viewArchive')}
              </button>
            )}
          </div>

          {lastEpisode ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-100">
                    #{lastEpisode.episodeNumber}: {lastEpisode.title}
                  </h3>
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3 h-3" />
                    {language === 'ID' ? 'Dihasilkan pada' : 'Generated on'} {new Date(lastEpisode.generationDate).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 bg-neutral-800 text-neutral-300 text-xs px-2.5 py-1 rounded-full border border-neutral-700">
                    {lastEpisode.wordCount} {t('words')}
                  </span>
                </div>
              </div>

              <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800/80">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  {language === 'ID' ? 'Ringkasan Episode' : 'Episode Summary'}
                </p>
                <p className="text-sm text-neutral-300 leading-relaxed italic">{lastEpisode.summary}</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
                <span className="bg-neutral-800/50 px-2 py-1 rounded border border-neutral-800">
                  {t('provider')}: <strong className="text-neutral-300">{lastEpisode.aiProvider}</strong>
                </span>
                <span className="bg-neutral-800/50 px-2 py-1 rounded border border-neutral-800">
                  Model: <strong className="text-neutral-300">{lastEpisode.modelUsed}</strong>
                </span>
                <span className="bg-neutral-800/50 px-2 py-1 rounded border border-neutral-800">
                  Status: <strong className="text-emerald-400">{lastEpisode.status}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <BookOpen className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm text-neutral-400 font-medium">{t('noChaptersWritten')}.</p>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                {language === 'ID' 
                  ? 'Konfigurasikan alkitab cerita Anda, karakter, dan tekan tombol Hasilkan untuk membuat cerita pertama Anda!'
                  : 'Configure your story bible, characters, and press the Generate button to create your first story!'}
              </p>
            </div>
          )}
        </div>

        {/* Live System Status & logs */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 space-y-4 flex flex-col h-full justify-between" id="system-status-panel">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-neutral-200">
                  {language === 'ID' ? 'Status Integrasi Sistem' : 'System Integration Status'}
                </h2>
              </div>
            </div>

            <ul className="space-y-3.5 text-xs text-neutral-300">
              <li className="flex items-center justify-between">
                <span className="text-neutral-400">{language === 'ID' ? 'Integrasi Google Drive' : 'Google Drive Integration'}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                  db.delivery.driveFolderId ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                }`}>
                  {db.delivery.driveFolderId ? 'CONNECTED' : 'INACTIVE'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-neutral-400">{language === 'ID' ? 'Pengiriman Server SMTP' : 'SMTP Server Delivery'}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                  db.delivery.smtpHost && db.delivery.smtpUser ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                }`}>
                  {db.delivery.smtpHost && db.delivery.smtpUser ? 'CONFIGURED' : 'INACTIVE'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-neutral-400">{language === 'ID' ? 'Penjadwal Otonom' : 'Background Scheduler'}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                  db.scheduler.autoGenerate ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                }`}>
                  {db.scheduler.autoGenerate ? `ON (At ${db.scheduler.customTime})` : 'PAUSED'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-neutral-400">{language === 'ID' ? 'Folder Output Aktif' : 'Active Output Folder'}</span>
                <span className="text-neutral-400 font-mono text-[10px] truncate max-w-[150px]" title={db.delivery.outputFolder}>
                  /stories
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 mt-4">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{language === 'ID' ? 'Log Konsol Terakhir' : 'Last Console Log'}</span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            </p>
            {lastLog ? (
              <div className="space-y-1">
                <p className="text-[11px] font-mono text-neutral-500">
                  {new Date(lastLog.timestamp).toLocaleTimeString()}
                </p>
                <p className={`text-xs font-mono font-medium line-clamp-2 ${
                  lastLog.level === 'ERROR' ? 'text-rose-400' : lastLog.level === 'WARNING' ? 'text-amber-400' : 'text-neutral-300'
                }`}>
                  [{lastLog.level}] {lastLog.message}
                </p>
              </div>
            ) : (
              <p className="text-xs font-mono text-neutral-500">{t('noLogsToDisplay')}</p>
            )}
          </div>
        </div>

      </div>

      {/* Lightbox / View Modal */}
      {selectedVisual && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          onClick={() => setSelectedVisual(null)}
        >
          <div 
            className="bg-[#0c0c0e] border border-zinc-800/80 rounded-xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row relative shadow-2xl max-h-[90vh] md:max-h-[80vh] transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedVisual(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-950/80 border border-zinc-800/80 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Image Section */}
            <div className="md:w-1/2 bg-black/40 flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-900 relative min-h-[300px] md:h-auto">
              <img 
                src={selectedVisual.coverUrl} 
                alt={selectedVisual.title}
                className="w-full h-full object-contain max-h-[45vh] md:max-h-[75vh]"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Right Info Section */}
            <div className="md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-[80vh] space-y-6">
              <div className="space-y-4">
                <div>
                  <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2.5 py-0.5 rounded border border-indigo-500/20 uppercase tracking-widest">
                    {language === 'ID' ? `BAB ${selectedVisual.episodeNumber}` : `CHAPTER ${selectedVisual.episodeNumber}`}
                  </span>
                  <h3 className="text-lg font-bold text-zinc-100 mt-2">
                    {selectedVisual.title}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">
                    {language === 'ID' ? 'Dihasilkan pada' : 'Generated on'} {new Date(selectedVisual.generationDate).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono block">
                    {language === 'ID' ? 'Ringkasan Episode' : 'Episode Summary'}
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed italic bg-zinc-950/60 border border-zinc-900 p-3 rounded-lg">
                    {selectedVisual.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">{language === 'ID' ? 'Penyedia AI' : 'AI Provider'}</span>
                    <span className="font-semibold text-zinc-300 mt-0.5 block">Pollinations AI</span>
                  </div>
                  <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">{language === 'ID' ? 'Model Visual' : 'Visual Model'}</span>
                    <span className="font-semibold text-zinc-300 mt-0.5 block truncate" title={selectedVisual.modelUsed}>
                      {selectedVisual.modelUsed || 'FLUX'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-900 flex flex-wrap gap-2 items-center justify-between">
                <a 
                  href={selectedVisual.coverUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {language === 'ID' ? 'Tab Baru' : 'Open Full Res'}
                </a>
                
                <button
                  onClick={() => {
                    setSelectedVisual(null);
                    onNavigate('archive');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {language === 'ID' ? 'Buka Episode' : 'View Episode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Containing Folder / Explorer Modal */}
      {isFolderModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsFolderModalOpen(false)}
        >
          <div 
            className="bg-[#0e0e11] border border-zinc-800/80 rounded-xl max-w-2xl w-full overflow-hidden flex flex-col relative shadow-2xl transition-all duration-300 scale-100 max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
            id="containing-folder-modal"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    {language === 'ID' ? 'Folder Output Cerita' : 'Stories Output Folder'}
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5 flex items-center gap-1 flex-wrap">
                    <span>Path:</span>
                    <span className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 select-all border border-zinc-850 text-[10px]">{folderPath || '/app/applet/stories'}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-zinc-850/60 bg-zinc-900/10">
              <input
                type="text"
                placeholder={language === 'ID' ? 'Cari nama berkas...' : 'Search file name...'}
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Folder Files List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[250px]">
              {exportedFiles.filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase())).length > 0 ? (
                exportedFiles
                  .filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase()))
                  .map((file, idx) => {
                    const isDocx = file.name.endsWith('.docx');
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 bg-zinc-950/40 hover:bg-zinc-950/90 border border-zinc-850 rounded-lg transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded ${isDocx ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-zinc-200 font-mono font-medium truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {language === 'ID' ? 'Diubah:' : 'Modified:'} {new Date(file.mtime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                          <a 
                            href={file.path} 
                            download
                            className="p-1.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-500/20 transition-all font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{language === 'ID' ? 'Unduh' : 'Download'}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 italic">
                    {language === 'ID' ? 'Tidak ada berkas yang cocok ditemukan.' : 'No matching files found.'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/40 flex justify-end">
              <button 
                onClick={() => setIsFolderModalOpen(false)}
                className="px-4 py-2 rounded text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100 transition-all cursor-pointer font-medium"
              >
                {language === 'ID' ? 'Tutup' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
