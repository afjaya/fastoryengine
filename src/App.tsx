import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Archive, 
  Terminal, 
  Sparkles, 
  Settings as SettingsIcon, 
  FileCode, 
  AlertCircle, 
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { AppDatabase, StoryBible, Character, Episode, AIProvider, DeliveryConfig, SchedulerConfig } from './types.js';

// Subcomponents
import { Dashboard } from './components/Dashboard.js';
import { StoryBibleManager } from './components/StoryBible.js';
import { CharacterManager } from './components/Characters.js';
import { EpisodeArchive } from './components/Episodes.js';
import { PromptBuilderView } from './components/PromptBuilder.js';
import { Generator } from './components/Generator.js';
import { Settings } from './components/Settings.js';
import { Logs } from './components/Logs.js';
import { LanguageProvider, useLanguage } from './components/LanguageContext.js';

function MainApp() {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Language translation hook
  const { language, setLanguage, t } = useLanguage();

  // Preset variables to share prompt configurations between Builder and Generator
  const [presetSnippet, setPresetSnippet] = useState<string>('');
  const [presetLength, setPresetLength] = useState<number>(1500);
  const [presetCoverUrl, setPresetCoverUrl] = useState<string>('');

  // Project management state variables
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Job progress state for export and delivery tasks
  const [jobProgress, setJobProgress] = useState<{
    active: boolean;
    title: string;
    progress: number;
    status: string;
  } | null>(null);

  // Load database on mount
  const fetchDb = async () => {
    try {
      const response = await fetch('/api/db');
      if (!response.ok) throw new Error('Failed to load system database.');
      const data = await response.json();
      setDb(data);
      
      // Determine if a pipeline is currently running
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const health = await healthRes.json();
        setIsGenerating(health.scheduler.isProcessing);
      }
    } catch (e: any) {
      setError(e.message || 'System failed to initialize.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  // Poll database updates when story generation is active to keep logs rolling in real time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isGenerating) {
      interval = setInterval(async () => {
        try {
          const response = await fetch('/api/db');
          if (response.ok) {
            const data = await response.json();
            setDb(data);
          }
          
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) {
            const health = await healthRes.json();
            setIsGenerating(health.scheduler.isProcessing);
          }
        } catch (e: any) {
          // Silent or warn about transient fetch failures during dev server restarts
          if (e && (e.message === 'Failed to fetch' || e.name === 'TypeError')) {
            console.warn('Backend polling temporarily suspended: Server is restarting or offline.');
          } else {
            console.warn('Error polling logs:', e);
          }
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const handleUpdateBible = async (updatedBible: StoryBible) => {
    const response = await fetch('/api/bible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedBible),
    });
    if (!response.ok) throw new Error('Failed to update Story Bible.');
    await fetchDb();
  };

  const handleUpsertCharacter = async (char: Character) => {
    const response = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(char),
    });
    if (!response.ok) throw new Error('Failed to upsert character.');
    await fetchDb();
  };

  const handleDeleteCharacter = async (id: string) => {
    const response = await fetch(`/api/characters/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete character.');
    await fetchDb();
  };

  const handleUpdateEpisode = async (episode: Episode) => {
    const response = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(episode),
    });
    if (!response.ok) throw new Error('Failed to update episode.');
    await fetchDb();
  };

  const handleDeleteEpisode = async (id: string) => {
    const response = await fetch(`/api/episodes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete episode.');
    await fetchDb();
  };

  const handleTriggerGenerate = async (customSnippet: string, length: number, coverUrl?: string) => {
    setError(null);
    setIsGenerating(true);
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customSnippet, targetLength: length, coverUrl }),
    });
    if (!response.ok) {
      const err = await response.json();
      setIsGenerating(false);
      throw new Error(err.error || 'Failed to trigger pipeline.');
    }
  };

  const handleManualDeliver = async (episodeId: string) => {
    setJobProgress({
      active: true,
      title: language === 'ID' ? 'Mengirim Bab Cerita' : 'Delivering Story Chapter',
      progress: 10,
      status: language === 'ID' ? 'Menghubungkan ke server SMTP...' : 'Connecting to SMTP server...'
    });
    
    try {
      await new Promise<any>(resolve => setTimeout(() => {
        setJobProgress(prev => prev ? { ...prev, progress: 35, status: language === 'ID' ? 'Mengotentikasi saluran pengiriman...' : 'Authenticating delivery channels...' } : null);
        resolve(null);
      }, 700));

      await new Promise<any>(resolve => setTimeout(() => {
        setJobProgress(prev => prev ? { ...prev, progress: 60, status: language === 'ID' ? 'Menyusun draf pesan email...' : 'Drafting email message...' } : null);
        resolve(null);
      }, 700));

      const deliverPromise = fetch('/api/deliver-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId }),
      });

      await new Promise<any>(resolve => setTimeout(() => {
        setJobProgress(prev => prev ? { ...prev, progress: 85, status: language === 'ID' ? 'Sinkronisasi naskah ke Google Drive...' : 'Syncing manuscript to Google Drive...' } : null);
        resolve(null);
      }, 800));

      const response = await deliverPromise;

      if (!response.ok) throw new Error('Manual delivery failed.');
      const res = await response.json();

      setJobProgress({
        active: true,
        title: language === 'ID' ? 'Mengirim Bab Cerita' : 'Delivering Story Chapter',
        progress: 100,
        status: language === 'ID' ? 'Pengiriman berhasil!' : 'Delivery successful!'
      });

      // Clear after 1.5 seconds
      setTimeout(() => setJobProgress(null), 1500);
      return res;
    } catch (err: any) {
      setJobProgress(null);
      throw err;
    }
  };

  const handleSaveSettings = async (delivery: DeliveryConfig, scheduler: SchedulerConfig, providers: AIProvider[]) => {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery, scheduler, providers }),
    });
    if (!response.ok) throw new Error('Failed to update system settings.');
    await fetchDb();
  };

  const handleRestoreDb = async (restoredData: AppDatabase) => {
    const response = await fetch('/api/db/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restoredData),
    });
    if (!response.ok) throw new Error('Failed to restore database backup.');
    await fetchDb();
  };

  const handleClearLogs = async () => {
    const response = await fetch('/api/logs/clear', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to clear log history.');
    await fetchDb();
  };

  const handleCreateProject = async (title: string) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create new project.');
    }
    const updatedDb = await response.json();
    setDb(updatedDb);
    setActiveTab('dashboard');
  };

  const handleSwitchProject = async (title: string) => {
    const response = await fetch('/api/projects/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to switch project.');
    }
    const updatedDb = await response.json();
    setDb(updatedDb);
    setActiveTab('dashboard');
  };

  const handleDeleteProject = async (title: string) => {
    const response = await fetch(`/api/projects/${encodeURIComponent(title)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete archived project.');
    }
    const updatedDb = await response.json();
    setDb(updatedDb);
  };

  const handleSelectPromptPreset = (snippet: string, targetLength: number, coverUrl?: string) => {
    setPresetSnippet(snippet);
    setPresetLength(targetLength);
    setPresetCoverUrl(coverUrl || '');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-400 font-sans">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm font-mono font-medium tracking-wide">Assembling Fastory Story Engine...</p>
      </div>
    );
  }

  if (error || !db) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-rose-400 p-6 text-center font-sans">
        <AlertCircle className="w-12 h-12 mb-3 text-rose-500" />
        <h2 className="text-lg font-bold text-zinc-100">Fastory System Malfunction</h2>
        <p className="text-xs text-zinc-500 max-w-sm mt-1">{error || 'Failed to connect to the backing Express server.'}</p>
        <button 
          onClick={fetchDb}
          className="bg-blue-600 text-white hover:bg-blue-500 px-4 py-2 mt-4 rounded-lg text-xs font-semibold shadow-lg shadow-blue-900/20 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const sidebarItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'bible', label: t('storyBible'), icon: BookOpen },
    { id: 'characters', label: t('characters'), icon: Users },
    { id: 'archive', label: t('episodesArchive'), icon: Archive },
    { id: 'builder', label: t('promptBuilder'), icon: FileCode },
    { id: 'generator', label: t('generator'), icon: Sparkles },
    { id: 'logs', label: t('logsConsole'), icon: Terminal },
  ];

  const activeProvider = db.providers.find(p => p.isActive) || db.providers[0];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-400 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white">
      
      {/* Top Navigation Frame */}
      <header className="h-16 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between px-6 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20">F</div>
            <h1 className="font-bold text-zinc-100 tracking-tight hidden sm:block">FASTORY</h1>
          </div>
          <span className="text-zinc-700 hidden sm:inline">/</span>
          <div className="relative" id="project-selector-dropdown">
            <button
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-xs md:text-sm text-zinc-100 font-medium cursor-pointer"
            >
              <span className="text-zinc-500 font-normal">Projects</span>
              <span className="text-zinc-700">/</span>
              <span>{db.currentProjectTitle || 'Neon Chronicles: Volume I'}</span>
              <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isProjectDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProjectDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 rounded-xl border border-zinc-800 bg-[#141417] p-2 shadow-xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/60">
                    {t('activeProject')}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-100 bg-zinc-900/40 rounded-lg my-1 border border-zinc-850">
                    <span className="truncate">{db.currentProjectTitle || 'Neon Chronicles: Volume I'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        setIsNewProjectModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/5 rounded-lg transition-all text-left cursor-pointer"
                      id="create-new-project-btn"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('newProject')}</span>
                    </button>
                  </div>

                  <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-t border-zinc-850 mt-1.5">
                    {t('existingProjects')}
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {db.projects && db.projects.length > 0 ? (
                      db.projects.map((proj) => (
                        <div 
                          key={proj.title}
                          className="group/item flex items-center justify-between p-1 rounded-lg hover:bg-zinc-900 transition-all"
                        >
                          <button
                            onClick={async () => {
                              setIsProjectDropdownOpen(false);
                              try {
                                await handleSwitchProject(proj.title);
                              } catch (e: any) {
                                alert(e.message || 'Error switching project');
                              }
                            }}
                            className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 rounded text-left truncate cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">{proj.title}</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(t('confirmDeleteProject'))) {
                                try {
                                  await handleDeleteProject(proj.title);
                                } catch (e: any) {
                                  alert(e.message || 'Error deleting project');
                                }
                              }
                            }}
                            className="opacity-0 group-hover/item:opacity-100 p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                            title={t('deleteCharacter')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic px-3 py-2">{t('emptyArchive')}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Global Pipeline Running indicator / Status Badge / Language Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Dual Language Switcher Button */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 shrink-0 shadow-inner">
            <button
              onClick={() => setLanguage('EN')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${
                language === 'EN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('ID')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${
                language === 'ID'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              ID
            </button>
          </div>

          <div className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-full border border-zinc-700">
            <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
            <span className="text-xs text-zinc-300 font-medium">
              {isGenerating ? t('processingPipeline') : `${t('provider')}: ${activeProvider?.name || 'OpenAI'}`}
            </span>
          </div>
          <button 
            onClick={() => setActiveTab('generator')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md font-semibold text-xs shadow-lg shadow-blue-900/20 transition-all active:scale-95 cursor-pointer"
          >
            {t('runGenerator')}
          </button>
        </div>
      </header>

      {/* Main Structural Frame */}
      <div className="flex flex-1 h-[calc(100vh-64px-32px)] overflow-hidden">
        
        {/* Navigation Sidebar */}
        <nav className="w-56 bg-[#18181b] border-r border-[#27272a] flex flex-col justify-between h-full shrink-0">
          <div className="py-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-6 mb-2">Navigation</p>
            <div className="space-y-0.5">
              {sidebarItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-6 py-3 text-xs font-medium transition-all duration-150 text-left ${
                      isActive 
                        ? 'bg-[#27272a] text-white border-r-2 border-blue-500 font-semibold' 
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-800 space-y-2">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded text-xs font-medium transition-all duration-150 text-left cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#27272a] text-white border-r-2 border-blue-500 font-semibold'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <SettingsIcon className={`w-4 h-4 ${activeTab === 'settings' ? 'text-blue-400' : 'text-zinc-500'}`} />
              <span>{t('settings')}</span>
            </button>
            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 text-center">
              <p className="text-[9px] text-zinc-500 font-medium">{t('sessionOperator')}</p>
              <p className="text-[10px] font-semibold text-zinc-300 mt-0.5 truncate" title="BangRijal@gmail.com">
                BangRijal@gmail.com
              </p>
            </div>
          </div>
        </nav>

        {/* Content View Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#09090b]">
          <div className="max-w-6xl mx-auto h-full">
            {activeTab === 'dashboard' && (
              <Dashboard 
                db={db} 
                onNavigate={setActiveTab} 
                onTriggerGenerate={() => setActiveTab('generator')}
                isGenerating={isGenerating}
              />
            )}
            {activeTab === 'bible' && (
              <StoryBibleManager 
                initialBible={db.storyBible} 
                onSave={handleUpdateBible} 
              />
            )}
            {activeTab === 'characters' && (
              <CharacterManager 
                characters={db.characters} 
                onUpsert={handleUpsertCharacter} 
                onDelete={handleDeleteCharacter} 
              />
            )}
            {activeTab === 'archive' && (
              <EpisodeArchive 
                episodes={db.episodes} 
                storyBible={db.storyBible}
                characters={db.characters}
                providers={db.providers}
                onUpdateEpisode={handleUpdateEpisode} 
                onDeleteEpisode={handleDeleteEpisode}
                onManualDeliver={handleManualDeliver}
              />
            )}
            {activeTab === 'builder' && (
              <PromptBuilderView 
                db={db} 
                onNavigate={setActiveTab} 
                onSelectPrompt={handleSelectPromptPreset}
              />
            )}
            {activeTab === 'generator' && (
              <Generator 
                db={db} 
                isGenerating={isGenerating} 
                onTriggerGenerate={handleTriggerGenerate} 
                onRefreshData={fetchDb}
                presetSnippet={presetSnippet}
                presetLength={presetLength}
                presetCoverUrl={presetCoverUrl}
              />
            )}
            {activeTab === 'settings' && (
              <Settings 
                db={db} 
                onSaveSettings={handleSaveSettings} 
                onRestoreDb={handleRestoreDb}
                onTrackJob={setJobProgress}
              />
            )}
            {activeTab === 'logs' && (
              <Logs 
                logs={db.logs} 
                onClearLogs={handleClearLogs} 
                onRefresh={fetchDb}
              />
            )}
          </div>
        </main>

      </div>

      {/* STATUS BAR FOOTER */}
      <footer className="h-9 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between px-6 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 shrink-0 select-none">
        {jobProgress && jobProgress.active ? (
          <div className="flex items-center justify-between w-full h-full gap-4" id="footer-job-progress">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
              <span className="font-bold text-zinc-300 tracking-wider text-[9px] shrink-0">{jobProgress.title}</span>
              <span className="text-zinc-700 shrink-0">|</span>
              <span className="text-zinc-400 normal-case font-medium truncate text-[10px]">{jobProgress.status}</span>
            </div>
            
            <div className="flex items-center gap-3 w-40 sm:w-60 md:w-80 shrink-0">
              <div className="flex-1 bg-zinc-900 border border-zinc-850 h-1.5 rounded-full overflow-hidden relative">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  style={{ width: `${jobProgress.progress}%` }}
                />
              </div>
              <span className="font-mono text-zinc-300 text-[10px] w-8 text-right font-bold tracking-normal">{jobProgress.progress}%</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-6">
              <span>{t('apiLatency')}: <span className="text-zinc-400">142ms</span></span>
              <span>{t('database')}: <span className="text-emerald-500 uppercase">{t('online')}</span></span>
            </div>
            <div className="flex gap-6">
              <span>{t('autoSave')}: <span className="text-zinc-400">{t('enabled')}</span></span>
              <span>v1.0.0 Stable</span>
            </div>
          </>
        )}
      </footer>

      {/* Create New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-black/60">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-100">{t('createNewStory')}</h3>
              <p className="text-xs text-zinc-400">
                {language === 'ID' 
                  ? 'Masukkan draf cerita otonom baru Anda. Cerita saat ini akan diarsip secara otomatis.'
                  : 'Establish a new autonomous story architecture. The current active story project will be automatically saved to the stories archive.'}
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setModalError(null);
              if (!newProjectName.trim()) {
                setModalError(t('projectTitleRequired'));
                return;
              }
              try {
                await handleCreateProject(newProjectName);
                setIsNewProjectModalOpen(false);
                setNewProjectName('');
              } catch (err: any) {
                setModalError(err.message || 'Failed to create project');
              }
            }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {t('storyTitle')}
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={t('projectNamePlaceholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600"
                  autoFocus
                />
              </div>

              {modalError && (
                <p className="text-xs text-rose-400 font-semibold">{modalError}</p>
              )}

              <div className="flex items-center justify-end gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewProjectModalOpen(false);
                    setNewProjectName('');
                    setModalError(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-md shadow-blue-900/10 cursor-pointer"
                >
                  {t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
