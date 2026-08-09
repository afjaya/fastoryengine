import React, { useState, useEffect } from 'react';
import { BookOpen, Search, FileText, Send, Trash2, Save, CheckSquare, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, Eye, Check, RefreshCw, Image, Wand2, Download, Copy, ExternalLink } from 'lucide-react';
import { Episode, StoryBible, Character, ContinuityIssue, AIProvider } from '../types.js';
import { generatePollinationsImageUrl, exportEpisodeToDocx } from '../utils.js';
import { useLanguage } from './LanguageContext.js';

interface EpisodesProps {
  episodes: Episode[];
  storyBible?: StoryBible;
  characters?: Character[];
  providers?: AIProvider[];
  onUpdateEpisode: (episode: Episode) => Promise<void>;
  onDeleteEpisode: (id: string) => Promise<void>;
  onManualDeliver: (episodeId: string) => Promise<{ email: string; drive: string }>;
}

export const EpisodeArchive: React.FC<EpisodesProps> = ({
  episodes,
  storyBible,
  characters,
  providers = [],
  onUpdateEpisode,
  onDeleteEpisode,
  onManualDeliver,
}) => {
  const { t, language } = useLanguage();
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<{ email: string; drive: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'Saved' | 'Unsaved' | 'Saving'>('Saved');
  const [localBackup, setLocalBackup] = useState<Episode | null>(null);

  // Continuity Auditor States
  const [auditIssues, setAuditIssues] = useState<ContinuityIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [ignoredIssues, setIgnoredIssues] = useState<string[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(true);

  // Cover / Illustration Generator States
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageWidth, setImageWidth] = useState(1024);
  const [imageHeight, setImageHeight] = useState(1024);
  const [imageSeed, setImageSeed] = useState<number | undefined>(undefined);
  const [imageNoLogo, setImageNoLogo] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showImagePanel, setShowImagePanel] = useState(false);

  // Synchronize image prompt when selecting a different episode
  useEffect(() => {
    if (selectedEp) {
      const genre = storyBible?.genre || '';
      const style = storyBible?.storyStyle || '';
      const basePrompt = `${genre} genre style cover art, ${selectedEp.title}. ${selectedEp.summary}. ${style}`;
      setImagePrompt(basePrompt.slice(0, 400));
      setGeneratedImageUrl(selectedEp.coverUrl || null);
      setImageError(null);
    } else {
      setImagePrompt('');
      setGeneratedImageUrl(null);
    }
  }, [selectedEp?.id]);

  const handleGenerateCover = async () => {
    if (!selectedEp) return;
    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const pollinationsProvider = providers.find(p => p.id === 'pollinations-image');
      if (!pollinationsProvider) {
        throw new Error(
          language === 'ID'
            ? "Penyedia Pollinations AI belum dikonfigurasi di Pengaturan."
            : "Pollinations AI provider is not configured in Settings."
        );
      }

      // Generate random seed if not specified
      const seed = imageSeed || Math.floor(Math.random() * 10000000);
      
      const generatedUrl = generatePollinationsImageUrl(imagePrompt, pollinationsProvider, {
        width: imageWidth,
        height: imageHeight,
        seed,
        nologo: imageNoLogo
      });

      // Pre-load the image to make sure the endpoint builds it successfully
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.referrerPolicy = "no-referrer";
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(language === 'ID' ? "Gagal memuat atau memproses gambar dari Pollinations." : "Failed to load or process image from Pollinations."));
        img.src = generatedUrl;
      });

      setGeneratedImageUrl(generatedUrl);
      
      // Update local episode coverUrl state
      const updatedEpisode = { ...selectedEp, coverUrl: generatedUrl };
      setSelectedEp(updatedEpisode);
      
      // Auto save the coverUrl to database
      await onUpdateEpisode(updatedEpisode);
    } catch (e: any) {
      console.error("Cover generation failed:", e);
      setImageError(e.message || "Failed to generate cover.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRemoveCover = async () => {
    if (!selectedEp) return;
    try {
      const updatedEpisode = { ...selectedEp, coverUrl: undefined };
      setSelectedEp(updatedEpisode);
      setGeneratedImageUrl(null);
      await onUpdateEpisode(updatedEpisode);
    } catch (e: any) {
      alert("Failed to remove cover: " + e.message);
    }
  };

  const runLocalScan = (proseContent: string): ContinuityIssue[] => {
    if (!proseContent || !characters) return [];
    
    const localIssues: ContinuityIssue[] = [];
    
    // Character Status Check
    characters.forEach(char => {
      if (char.status === 'Dead') {
        const nameEscaped = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${nameEscaped}\\b`, 'gi');
        const match = regex.exec(proseContent);
        if (match) {
          const matchIdx = match.index;
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(proseContent.length, matchIdx + char.name.length + 40);
          const snippetText = proseContent.slice(start, end).replace(/\n/g, ' ').trim();
          
          localIssues.push({
            id: `char-status-${char.id}`,
            type: 'CHARACTER_STATUS',
            severity: 'HIGH',
            ruleOrCharacter: char.name,
            snippet: `...${snippetText}...`,
            description: language === 'ID' 
              ? `Karakter "${char.name}" terdaftar dengan status MATI (Dead) di Story Bible, tetapi namanya muncul dalam bab ini.`
              : `Character "${char.name}" is listed as DEAD in the Story Bible, but their name is appearing in this chapter.`,
            suggestion: language === 'ID'
              ? `Pastikan jika ini adalah kilas balik, atau jika karakter tersebut seharusnya hidup.`
              : `Check if this is a flashback/recollection, or if they are alive by mistake.`
          });
        }
      }
    });

    // Story Bible Forbidden Rules Check
    if (storyBible?.forbiddenRules) {
      const rules = storyBible.forbiddenRules.split('\n').map(r => r.trim()).filter(r => r.length > 0);
      rules.forEach((rule, idx) => {
        const quotedTerms = rule.match(/"([^"]+)"/g);
        if (quotedTerms) {
          quotedTerms.forEach(termStr => {
            const term = termStr.slice(1, -1).trim();
            if (term.length > 1) {
              const termEscaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\b${termEscaped}\\b`, 'gi');
              const match = regex.exec(proseContent);
              if (match) {
                const matchIdx = match.index;
                const start = Math.max(0, matchIdx - 40);
                const end = Math.min(proseContent.length, matchIdx + term.length + 40);
                const snippetText = proseContent.slice(start, end).replace(/\n/g, ' ').trim();

                localIssues.push({
                  id: `rule-keyword-${idx}-${term}`,
                  type: 'FORBIDDEN_RULE',
                  severity: 'HIGH',
                  ruleOrCharacter: `Aturan Larangan: "${term}"`,
                  snippet: `...${snippetText}...`,
                  description: language === 'ID'
                    ? `Kata terlarang "${term}" dari Story Bible terdeteksi di dalam bab ini.`
                    : `The forbidden word "${term}" from the Story Bible was detected in this chapter.`,
                  suggestion: language === 'ID'
                    ? `Aturan cerita melarang kata ini. Hapus atau ganti dengan istilah naratif lain.`
                    : `Story rules forbid this word. Remove it or replace it with a compliant term.`
                });
              }
            }
          });
        }
      });
    }

    return localIssues;
  };

  const handleAIDeepAudit = async () => {
    if (!selectedEp) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      const response = await fetch('/api/audit-continuity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedEp.content,
          characters,
          storyBible
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server returned an error.');
      }

      const data = await response.json();
      const aiIssues = (data.issues || []).map((issue: any, index: number) => ({
        ...issue,
        id: `ai-${issue.id || index}`
      }));

      setAuditIssues(prev => {
        const localOnly = prev.filter(i => !i.id.startsWith('ai-'));
        return [...localOnly, ...aiIssues];
      });

      alert(language === 'ID' 
        ? `Audit AI selesai! Menemukan ${aiIssues.length} potensi masalah kontinuitas.` 
        : `AI Audit complete! Found ${aiIssues.length} potential continuity issues.`
      );
    } catch (e: any) {
      console.error('AI Audit failed:', e);
      setAuditError(e.message || 'Audit failed');
    } finally {
      setIsAuditing(false);
    }
  };

  // Automatically run local scan when content changes
  useEffect(() => {
    if (selectedEp) {
      const localResults = runLocalScan(selectedEp.content);
      setAuditIssues(prev => {
        const aiOnly = prev.filter(i => i.id.startsWith('ai-'));
        return [...localResults, ...aiOnly];
      });
    } else {
      setAuditIssues([]);
    }
  }, [selectedEp?.id, selectedEp?.content, characters]);

  // Load first episode initially if exists
  useEffect(() => {
    if (episodes.length > 0 && !selectedEp) {
      setSelectedEp({ ...episodes[0] });
    }
  }, [episodes]);

  // Sync / check for local storage backup when selected episode changes
  useEffect(() => {
    if (selectedEp) {
      const saved = localStorage.getItem(`fastory_draft_${selectedEp.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Episode;
          if (
            parsed.content !== selectedEp.content || 
            parsed.title !== selectedEp.title || 
            parsed.summary !== selectedEp.summary
          ) {
            setLocalBackup(parsed);
          } else {
            setLocalBackup(null);
          }
        } catch (e) {
          console.error('Error parsing local storage draft:', e);
        }
      } else {
        setLocalBackup(null);
      }
    } else {
      setLocalBackup(null);
    }
  }, [selectedEp?.id]);

  // Auto-save edited episode to localStorage
  useEffect(() => {
    if (selectedEp && autoSaveStatus === 'Unsaved') {
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(`fastory_draft_${selectedEp.id}`, JSON.stringify(selectedEp));
        } catch (e) {
          console.error('Error saving draft to localStorage:', e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedEp, autoSaveStatus]);

  const handleRestoreBackup = () => {
    if (localBackup) {
      setSelectedEp({ ...localBackup });
      setAutoSaveStatus('Unsaved');
      setLocalBackup(null);
    }
  };

  const handleDismissBackup = () => {
    if (selectedEp) {
      localStorage.removeItem(`fastory_draft_${selectedEp.id}`);
      setLocalBackup(null);
    }
  };

  const handleSelectEpisode = (ep: Episode) => {
    setSelectedEp({ ...ep });
    setDeliveryResult(null);
    setAutoSaveStatus('Saved');
  };

  const handleFieldChange = (field: keyof Episode, value: any) => {
    if (!selectedEp) return;
    setSelectedEp(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      if (field === 'content') {
        updated.wordCount = value.split(/\s+/).filter(Boolean).length;
      }
      return updated;
    });
    setAutoSaveStatus('Unsaved');
  };

  const handleSaveChanges = async () => {
    if (!selectedEp) return;
    setIsSaving(true);
    setAutoSaveStatus('Saving');
    try {
      await onUpdateEpisode(selectedEp);
      localStorage.setItem(`fastory_draft_${selectedEp.id}`, JSON.stringify(selectedEp));
      setLocalBackup(null);
      setAutoSaveStatus('Saved');
    } catch (e: any) {
      alert((language === 'ID' ? 'Gagal menyimpan perubahan: ' : 'Failed to save changes: ') + e.message);
      setAutoSaveStatus('Unsaved');
    } finally {
      setIsSaving(false);
    }
  };

  // Implement Search & Replace inside prose editor
  const handleSearchAndReplace = () => {
    if (!selectedEp || !searchQuery) return;
    const regex = new RegExp(searchQuery, 'g');
    const content = selectedEp.content;
    const occurrences = (content.match(regex) || []).length;

    if (occurrences === 0) {
      alert(language === 'ID' ? `Tidak ada kata "${searchQuery}" yang ditemukan.` : `No occurrences of "${searchQuery}" found.`);
      return;
    }

    const newContent = content.replace(regex, replaceQuery);
    handleFieldChange('content', newContent);
    alert(language === 'ID' 
      ? `Berhasil mengganti ${occurrences} kata "${searchQuery}" dengan "${replaceQuery}".` 
      : `Replaced ${occurrences} occurrences of "${searchQuery}" with "${replaceQuery}".`
    );
  };

  const handleFindInProse = (term: string) => {
    const cleanTerm = term.replace(/^["']|["']$/g, '').trim();
    setSearchQuery(cleanTerm);
    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  const handleManualDelivery = async () => {
    if (!selectedEp) return;
    setIsDelivering(true);
    setDeliveryResult(null);
    try {
      const res = await onManualDeliver(selectedEp.id);
      setDeliveryResult(res);
    } catch (e: any) {
      alert((language === 'ID' ? 'Kesalahan pengiriman manual: ' : 'Manual delivery error: ') + e.message);
    } finally {
      setIsDelivering(false);
    }
  };

  const handleExport = async (format: 'docx' | 'txt') => {
    if (!selectedEp) return;
    setIsExporting(format);
    try {
      // Small artificial delay to let spinner be visible and give great user feedback
      await new Promise(resolve => setTimeout(resolve, 500));

      const cleanTitle = selectedEp.title.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_');
      const filename = `Episode_${String(selectedEp.episodeNumber).padStart(3, '0')}_${cleanTitle || 'Draft'}.${format}`;

      let blob: Blob;
      if (format === 'txt') {
        const textContent = `${selectedEp.title}\nEpisode ${selectedEp.episodeNumber}\n\n${selectedEp.content || ''}`;
        blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      } else {
        // Generate professional .docx document using the 'docx' library utility
        blob = await exportEpisodeToDocx(selectedEp);
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Export failed:', e);
      alert((language === 'ID' ? 'Gagal mengekspor berkas draf: ' : 'Failed to export draft file: ') + e.message);
    } finally {
      setIsExporting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDeleteEp'))) {
      try {
        await onDeleteEpisode(id);
        setSelectedEp(null);
      } catch (e: any) {
        alert((language === 'ID' ? 'Gagal menghapus: ' : 'Failed to delete: ') + e.message);
      }
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col" id="episodes-archive-view">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            {t('archiveTitle')}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {t('archiveSubtitle')}
          </p>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="py-20 text-center bg-zinc-900/20 border border-zinc-850 border-dashed rounded-xl" id="episodes-empty-state">
          <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-zinc-400 font-medium">{t('noEpisodes')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full flex-grow" id="episodes-content-grid">
          
          {/* Episode List Sidebar */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-4 h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">
              {language === 'ID' ? `Daftar Bab Cerita (${episodes.length})` : `Story Volume Chapters (${episodes.length})`}
            </h2>

            <div className="space-y-2">
              {episodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep)}
                  className={`w-full text-left p-3.5 rounded border transition-all text-xs flex flex-col gap-1.5 active:scale-99 cursor-pointer ${
                    selectedEp?.id === ep.id
                      ? 'bg-blue-600/10 border-blue-500/50 text-white font-medium shadow-sm'
                      : 'bg-zinc-950 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-750 text-zinc-400'
                  }`}
                >
                  <div className="flex gap-3 items-start w-full">
                    {ep.coverUrl && (
                      <div className="w-12 h-12 rounded border border-zinc-800/80 overflow-hidden shrink-0">
                        <img 
                          src={ep.coverUrl} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-[9px] uppercase tracking-widest text-zinc-500">
                          {language === 'ID' ? `Bab ${String(ep.episodeNumber).padStart(2, '0')}` : `Chapter ${String(ep.episodeNumber).padStart(2, '0')}`}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(ep.generationDate).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs text-zinc-200 truncate w-full">
                        {ep.title}
                      </h3>
                      <p className="text-[11px] text-zinc-500 truncate w-full italic">
                        {ep.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full mt-1 border-t border-zinc-900/80 pt-1.5 text-[9px] text-zinc-500 font-mono uppercase">
                    <span>{ep.wordCount} {t('words')}</span>
                    <span>{ep.aiProvider}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor Canvas */}
          <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 h-[calc(100vh-280px)] overflow-y-auto flex flex-col custom-scrollbar">
            {selectedEp ? (
              <div className="space-y-4 flex flex-col h-full justify-between" id="active-prose-editor">
                
                {localBackup && (
                  <div className="bg-amber-500/10 text-amber-400 border border-amber-500/20 p-4 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shrink-0" id="unsaved-backup-notice">
                    <div>
                      <p className="font-bold flex items-center gap-1.5 text-amber-300">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        ⚠️ {t('unsavedBackupDetected')}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        {t('backupDesc')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleRestoreBackup}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded transition-all active:scale-95 text-[11px] cursor-pointer"
                      >
                        {t('restoreDraft')}
                      </button>
                      <button
                        onClick={handleDismissBackup}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded transition-all text-[11px] cursor-pointer"
                      >
                        {t('dismiss')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Editor Header Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3" id="editor-header-metadata">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-blue-400 uppercase font-mono bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20 text-[10px]">
                        {language === 'ID' ? 'BAB' : 'EPISODE'} {selectedEp.episodeNumber}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 font-mono text-[10px]">{selectedEp.wordCount} {t('words')}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400 font-mono text-[10px]">{t('provider')}: {selectedEp.aiProvider}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-mono font-bold ${
                        autoSaveStatus === 'Saved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : autoSaveStatus === 'Saving'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {autoSaveStatus === 'Saved' ? t('online').toUpperCase() : autoSaveStatus === 'Saving' ? (language === 'ID' ? 'MENYIMPAN...' : 'SAVING...') : 'UNSAVED'}
                      </span>
                      <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3.5 py-1.5 rounded font-semibold flex items-center gap-1 transition-all shadow-md shadow-blue-900/10 cursor-pointer"
                        id="save-prose-btn"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? (language === 'ID' ? 'Menyimpan...' : 'Saving...') : t('saveChanges')}
                      </button>
                      
                      {/* Export buttons */}
                      <button
                        onClick={() => handleExport('docx')}
                        disabled={isExporting !== null}
                        className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/35 text-indigo-300 text-xs px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title={language === 'ID' ? 'Ekspor Word (.docx)' : 'Export Word (.docx)'}
                      >
                        {isExporting === 'docx' ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>DOCX</span>
                      </button>
                      <button
                        onClick={() => handleExport('txt')}
                        disabled={isExporting !== null}
                        className="bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/35 text-amber-300 text-xs px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title={language === 'ID' ? 'Ekspor Teks (.txt)' : 'Export Text (.txt)'}
                      >
                        {isExporting === 'txt' ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>TXT</span>
                      </button>

                      <button
                        onClick={() => handleDelete(selectedEp.id)}
                        className="bg-rose-950/10 hover:bg-rose-950/30 border border-rose-900/30 text-rose-400 p-1.5 rounded cursor-pointer"
                        title={t('deleteEpisode')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title and Summary Editor fields & Cover Thumbnail Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {selectedEp.coverUrl && (
                      <div className="md:col-span-3 flex flex-col justify-between bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 relative group overflow-hidden min-h-[120px] transition-all hover:border-zinc-700/60 shadow-inner">
                        <div className="absolute inset-0 z-0">
                          <img 
                            src={selectedEp.coverUrl} 
                            alt="Episode Cover" 
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
                        </div>
                        
                        <div className="relative z-10 flex flex-col justify-between h-full w-full">
                          <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider bg-zinc-950/80 border border-zinc-800/80 px-2 py-0.5 rounded self-start">
                            {language === 'ID' ? 'Seni Sampul' : 'Cover Art'}
                          </span>
                          
                          <div className="flex items-center justify-between mt-6">
                            <span className="text-[9px] font-medium text-zinc-400 font-mono">
                              FLUX AI
                            </span>
                            <div className="flex gap-1.5">
                              <a 
                                href={selectedEp.coverUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-1 rounded bg-zinc-950/90 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 transition-colors"
                                title={language === 'ID' ? 'Buka Gambar' : 'Open Image'}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowImagePanel(true);
                                  setTimeout(() => {
                                    const targetElem = document.getElementById('cover-art-generator');
                                    if (targetElem) {
                                      targetElem.scrollIntoView({ behavior: 'smooth' });
                                    }
                                  }, 100);
                                }}
                                className="p-1 rounded bg-zinc-950/90 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 transition-colors cursor-pointer"
                                title={language === 'ID' ? 'Pengaturan Sampul' : 'Cover Settings'}
                              >
                                <Wand2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className={selectedEp.coverUrl ? "md:col-span-9 space-y-4" : "md:col-span-12 space-y-4"}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            {language === 'ID' ? 'Judul Episode' : 'Episode Title'}
                          </label>
                          <input
                            type="text"
                            value={selectedEp.title}
                            onChange={(e) => handleFieldChange('title', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs font-semibold text-zinc-100 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            {language === 'ID' ? 'Status Bab' : 'Publish Status'}
                          </label>
                          <select
                            value={selectedEp.status}
                            onChange={(e) => handleFieldChange('status', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
                          >
                            <option value="Draft">{t('draft')}</option>
                            <option value="Published">{t('published')}</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                          {language === 'ID' ? 'Ringkasan Narasi' : 'Narrative Summary'}
                        </label>
                        <textarea
                          value={selectedEp.summary}
                          onChange={(e) => handleFieldChange('summary', e.target.value)}
                          rows={2}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-300 focus:outline-none italic font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Search and Replace Box */}
                  <div className="bg-zinc-950 p-3 rounded border border-zinc-850 grid grid-cols-1 md:grid-cols-3 gap-2 items-center" id="search-replace-module">
                    <div>
                      <input
                        type="text"
                        placeholder={language === 'ID' ? 'Cari kata...' : 'Search word...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder={language === 'ID' ? 'Ganti dengan...' : 'Replace with...'}
                        value={replaceQuery}
                        onChange={(e) => setReplaceQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleSearchAndReplace}
                        className="w-full bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[11px] font-semibold py-1 rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        {language === 'ID' ? 'Ganti Semua' : 'Replace All'}
                      </button>
                    </div>
                  </div>

                  {/* Cover Art & Visual Illustration Generator */}
                  <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl overflow-hidden" id="cover-art-generator">
                    {/* Panel Header */}
                    <div 
                      onClick={() => setShowImagePanel(!showImagePanel)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${
                          generatedImageUrl 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-zinc-805 text-zinc-400'
                        }`}>
                          <Image className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200">
                            {language === 'ID' ? 'Seni Sampul & Ilustrasi Bab' : 'Cover Art & Chapter Illustration'}
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {language === 'ID' 
                              ? 'Hasilkan ilustrasi berkualitas tinggi dari sinopsis menggunakan Pollinations AI' 
                              : 'Generate high-quality visuals of the chapter summary using Pollinations AI'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {generatedImageUrl && (
                          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded">
                            {language === 'ID' ? 'Ada Sampul' : 'Cover Active'}
                          </span>
                        )}
                        <span className="text-zinc-500 text-xs">
                          {showImagePanel ? '▼' : '▲'}
                        </span>
                      </div>
                    </div>

                    {showImagePanel && (
                      <div className="p-4 border-t border-zinc-900 bg-zinc-950/80 space-y-4 animate-fade-in">
                        {imageError && (
                          <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-3 rounded text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{imageError}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Left Column: Image Controls (7 cols) */}
                          <div className="lg:col-span-7 space-y-4">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 font-mono">
                                {language === 'ID' ? 'Prompt Visual (Modifikasi sesuka hati)' : 'Visual Prompt (Modify as you wish)'}
                              </label>
                              <textarea
                                value={imagePrompt}
                                onChange={(e) => setImagePrompt(e.target.value)}
                                rows={3}
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none font-sans leading-relaxed"
                                placeholder={language === 'ID' ? 'Ketik deskripsi visual di sini...' : 'Enter visual description here...'}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 font-mono">
                                  {language === 'ID' ? 'Rasio Aspek & Ukuran' : 'Aspect Ratio & Size'}
                                </label>
                                <select
                                  value={`${imageWidth}x${imageHeight}`}
                                  onChange={(e) => {
                                    const [w, h] = e.target.value.split('x').map(Number);
                                    setImageWidth(w);
                                    setImageHeight(h);
                                  }}
                                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                                >
                                  <option value="1024x1024">Square 1:1 (1024 x 1024)</option>
                                  <option value="832x1216">Portrait Cover 2:3 (832 x 1216)</option>
                                  <option value="1216x832">Landscape 3:2 (1216 x 832)</option>
                                  <option value="1024x576">Widescreen Cinematic 16:9 (1024 x 576)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 font-mono">
                                  {language === 'ID' ? 'Custom Seed (Opsional)' : 'Custom Seed (Optional)'}
                                </label>
                                <input
                                  type="number"
                                  value={imageSeed || ''}
                                  onChange={(e) => setImageSeed(e.target.value ? Number(e.target.value) : undefined)}
                                  placeholder={language === 'ID' ? 'Kosongkan untuk acak' : 'Leave empty for random'}
                                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="remove-logo-toggle"
                                checked={imageNoLogo}
                                onChange={(e) => setImageNoLogo(e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-zinc-800 rounded focus:ring-blue-500 bg-zinc-950 accent-blue-600 cursor-pointer"
                              />
                              <label htmlFor="remove-logo-toggle" className="text-[11px] font-semibold text-zinc-400 cursor-pointer select-none">
                                {language === 'ID' ? 'Hapus Watermark Logo Pollinations' : 'Remove Pollinations Watermark Logo'}
                              </label>
                            </div>

                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={handleGenerateCover}
                                disabled={isGeneratingImage}
                                className={`w-full py-2 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                                  isGeneratingImage
                                    ? 'bg-zinc-850 text-zinc-500 border-zinc-800 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 active:scale-98 shadow-md'
                                }`}
                              >
                                {isGeneratingImage ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {language === 'ID' ? 'Merender Sampul Gambar...' : 'Rendering Cover Art...'}
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="w-4 h-4" />
                                    {language === 'ID' ? 'Hasilkan Gambar Sekarang' : 'Generate Artwork Now'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Right Column: Visual Preview (5 cols) */}
                          <div className="lg:col-span-5 flex flex-col justify-center items-center bg-zinc-950 border border-zinc-900 rounded-lg p-3 min-h-[220px]">
                            {generatedImageUrl ? (
                              <div className="w-full space-y-3 flex flex-col items-center">
                                <div className="relative group overflow-hidden rounded border border-zinc-800 max-h-[280px]">
                                  <img 
                                    src={generatedImageUrl} 
                                    alt="Chapter Illustration Preview" 
                                    className="object-contain w-full max-h-[280px]"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <a 
                                      href={generatedImageUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition-all"
                                      title={language === 'ID' ? 'Buka Gambar Asli' : 'Open original image'}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(generatedImageUrl);
                                        alert(language === 'ID' ? "Tautan gambar disalin ke clipboard!" : "Image link copied to clipboard!");
                                      }}
                                      className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition-all"
                                      title={language === 'ID' ? 'Salin Tautan' : 'Copy link'}
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 w-full">
                                  <button
                                    type="button"
                                    onClick={handleRemoveCover}
                                    className="flex-1 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    {language === 'ID' ? 'Hapus Sampul' : 'Remove Cover'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center p-6 space-y-2">
                                <Image className="w-10 h-10 text-zinc-700 mx-auto" />
                                <p className="text-[11px] font-bold text-zinc-400">
                                  {language === 'ID' ? 'Belum Ada Seni Sampul' : 'No Cover Art Yet'}
                                </p>
                                <p className="text-[10px] text-zinc-600 max-w-[180px] mx-auto leading-relaxed">
                                  {language === 'ID' 
                                    ? 'Klik tombol Hasilkan untuk memvisualisasikan bab cerita ini' 
                                    : 'Click the Generate button to visualize this chapter narrative'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Continuity & Story Bible Guardrails Audit Panel */}
                  <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl overflow-hidden" id="continuity-guardrails-auditor">
                    {/* Panel Header */}
                    <div 
                      onClick={() => setShowAuditPanel(!showAuditPanel)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/40 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${
                          auditIssues.filter(i => !ignoredIssues.includes(i.id)).length > 0 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200">
                            {language === 'ID' ? 'Audit Kontinuitas & Aturan Story Bible' : 'Continuity & Story Bible Audit'}
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {language === 'ID' 
                              ? `Memindai aturan terlarang & status karakter yang mati secara otomatis.` 
                              : `Automated scan for forbidden rules and deceased character statuses.`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          auditIssues.filter(i => !ignoredIssues.includes(i.id)).length > 0
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {auditIssues.filter(i => !ignoredIssues.includes(i.id)).length}{' '}
                          {language === 'ID' ? 'Masalah' : 'Issues'}
                        </span>
                        <span className="text-zinc-500 text-xs font-bold font-mono">
                          {showAuditPanel ? '−' : '+'}
                        </span>
                      </div>
                    </div>

                    {showAuditPanel && (
                      <div className="p-4 border-t border-zinc-900 bg-zinc-950/20 space-y-3.5">
                        {/* Audit Action Panel */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-850">
                          <div className="text-[11px] text-zinc-400">
                            {language === 'ID' 
                              ? 'Jalankan Audit Mendalam AI untuk mendeteksi kontradiksi naratif yang kompleks menggunakan model Gemini.' 
                              : 'Run an AI Deep Audit to analyze complex semantic contradictions using Gemini.'}
                          </div>
                          <button
                            type="button"
                            onClick={handleAIDeepAudit}
                            disabled={isAuditing}
                            className="bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors border border-zinc-700 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {isAuditing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                {language === 'ID' ? 'Menganalisis...' : 'Analyzing...'}
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                                {language === 'ID' ? 'Audit Mendalam AI' : 'AI Deep Audit'}
                              </>
                            )}
                          </button>
                        </div>

                        {auditError && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[11px] flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{auditError}</span>
                          </div>
                        )}

                        {/* List of Issues */}
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                          {auditIssues.filter(i => !ignoredIssues.includes(i.id)).length === 0 ? (
                            <div className="text-center py-5 text-zinc-500 text-xs flex flex-col items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-7 h-7 text-emerald-500/80" />
                              <p className="font-semibold text-zinc-400">
                                {language === 'ID' ? 'Semua Berjalan Lancar!' : 'All Clear & Compliant!'}
                              </p>
                              <p className="text-[10px] text-zinc-600 max-w-sm">
                                {language === 'ID' 
                                  ? 'Tidak ada pelanggaran kontinuitas atau aturan terlarang yang terdeteksi di bagian prosa ini.' 
                                  : 'No active character status clashes or forbidden rules detected in this chapter draft.'}
                              </p>
                            </div>
                          ) : (
                            auditIssues
                              .filter(i => !ignoredIssues.includes(i.id))
                              .map((issue) => (
                                <div 
                                  key={issue.id} 
                                  className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-lg flex flex-col gap-2 relative group hover:border-zinc-800 transition-colors"
                                >
                                  {/* Badges / Header */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                        issue.severity === 'HIGH' 
                                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                          : issue.severity === 'MEDIUM' 
                                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                      }`}>
                                        {issue.severity}
                                      </span>
                                      <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">
                                        {issue.type === 'CHARACTER_STATUS' 
                                          ? (language === 'ID' ? 'STATUS KARAKTER' : 'CHARACTER STATUS')
                                          : issue.type === 'FORBIDDEN_RULE'
                                          ? (language === 'ID' ? 'ATURAN TERLARANG' : 'FORBIDDEN RULE')
                                          : (language === 'ID' ? 'LAINNYA' : 'OTHER')}
                                      </span>
                                      <span className="text-zinc-300 text-xs font-bold">
                                        {issue.ruleOrCharacter}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleFindInProse(issue.ruleOrCharacter)}
                                        className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                                        title={language === 'ID' ? 'Cari di Teks' : 'Find in Text'}
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setIgnoredIssues(prev => [...prev, issue.id])}
                                        className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                                        title={language === 'ID' ? 'Abaikan' : 'Ignore'}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Description & Suggestion */}
                                  <div className="text-xs text-zinc-300 leading-relaxed font-sans mt-0.5">
                                    <p className="font-semibold text-zinc-200">{issue.description}</p>
                                    {issue.suggestion && (
                                      <p className="text-[11px] text-zinc-400 mt-1 italic">
                                        💡 {language === 'ID' ? 'Saran: ' : 'Suggestion: '}{issue.suggestion}
                                      </p>
                                    )}
                                  </div>

                                  {/* Snippet Context Callout */}
                                  {issue.snippet && (
                                    <div className="bg-zinc-950 p-2 rounded border border-zinc-900 text-[10px] font-mono text-zinc-500 whitespace-pre-wrap leading-normal mt-1">
                                      <span className="text-zinc-600 block text-[9px] uppercase tracking-wider mb-0.5">Context Snippet:</span>
                                      {issue.snippet}
                                    </div>
                                  )}
                                </div>
                              ))
                          )}
                        </div>

                        {ignoredIssues.length > 0 && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setIgnoredIssues([])}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono cursor-pointer"
                            >
                              ↺ {language === 'ID' ? 'Pulihkan Masalah yang Diabaikan' : 'Restore Ignored Issues'} ({ignoredIssues.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rich Story Prose writing area */}
                  <div className="flex-grow">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                      {language === 'ID' ? 'Prosa Bab Cerita' : 'Story Chapter Prose'}
                    </label>
                    <textarea
                      value={selectedEp.content}
                      onChange={(e) => handleFieldChange('content', e.target.value)}
                      rows={12}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded p-4 text-xs text-zinc-200 focus:outline-none font-serif leading-relaxed h-[300px] overflow-y-auto"
                      placeholder={language === 'ID' ? 'Tulis prosa cerita Anda di sini...' : 'Write your story prose here...'}
                    />
                  </div>

                  {/* Prompt details section */}
                  <details className="bg-zinc-950 rounded border border-zinc-850 p-2.5 text-xs" id="prompt-debug-details">
                    <summary className="cursor-pointer font-bold text-zinc-400 select-none uppercase text-[10px] tracking-widest">
                      {language === 'ID' ? 'Periksa Seluruh Prompt yang Digunakan untuk Bab Ini' : 'Inspect Complete Prompt Used to Generate This Chapter'}
                    </summary>
                    <pre className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded font-mono text-[10px] text-zinc-500 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[250px]">
                      {selectedEp.promptUsed || (language === 'ID' ? 'Tidak ada prompt yang disimpan untuk episode ini.' : 'No prompt stored for this episode.')}
                    </pre>
                  </details>
                     {/* Delivery & Export Actions Footer */}
                <div className="border-t border-zinc-850 pt-5 mt-6 space-y-4" id="delivery-footer">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Local Export Card */}
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850/80 flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-1.5">
                          <Download className="w-4 h-4 text-blue-400" />
                          {language === 'ID' ? 'Ekspor & Unduh Berkas' : 'Local File Export & Download'}
                        </h4>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                          {language === 'ID' 
                            ? 'Ekspor draf bab aktif langsung ke komputer Anda dalam format Microsoft Word (.docx) atau Plaintext (.txt).' 
                            : 'Export the active chapter draft directly to your machine in Microsoft Word (.docx) or Plaintext (.txt) formats.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleExport('docx')}
                          disabled={isExporting !== null}
                          className={`flex-1 min-w-[120px] px-3.5 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                            isExporting === 'docx'
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-md active:scale-98 shadow-indigo-950/20'
                          }`}
                        >
                          {isExporting === 'docx' ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          <span>Word Document (.docx)</span>
                        </button>

                        <button
                          onClick={() => handleExport('txt')}
                          disabled={isExporting !== null}
                          className={`flex-1 min-w-[120px] px-3.5 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                            isExporting === 'txt'
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-300 border-amber-500/35 active:scale-98'
                          }`}
                        >
                          {isExporting === 'txt' ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          <span>Plaintext (.txt)</span>
                        </button>
                      </div>
                    </div>

                    {/* Delivery Card */}
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850/80 flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-1.5">
                          <Send className="w-4 h-4 text-emerald-400" />
                          {language === 'ID' ? 'Pengiriman SMTP & Drive Manual' : 'Manual SMTP & Drive Delivery'}
                        </h4>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                          {language === 'ID' 
                            ? 'Kirimkan email SMTP manual dan unggah hasil bab langsung ke draf pencadangan awan Anda.' 
                            : 'Trigger SMTP email delivery and upload/backup outputs directly to your cloud backups.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleManualDelivery}
                          disabled={isDelivering}
                          className={`w-full px-3.5 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isDelivering
                              ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-md active:scale-98 shadow-emerald-950/20'
                          }`}
                          id="manual-deliver-btn"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isDelivering ? t('delivering') : t('deliverNow')}
                        </button>
                      </div>
                    </div>

                  </div>

                  {deliveryResult && (
                    <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-3.5 rounded text-xs space-y-1 mt-3" id="delivery-dispatch-result">
                      <p className="font-semibold flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        {t('deliverySuccess')}
                      </p>
                      <ul className="list-disc pl-5 mt-1 text-zinc-300 space-y-0.5 font-mono text-[11px]">
                        <li>Email: {deliveryResult.email}</li>
                        <li>Drive: {deliveryResult.drive}</li>
                      </ul>
                    </div>
                  )}
                </div>             </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <FileText className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-500">
                  {language === 'ID' 
                    ? 'Pilih bab dari daftar untuk memuatnya ke dalam panel penulis aktif.' 
                    : 'Select a chapter from the list to load it into the active writer panel.'}
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
