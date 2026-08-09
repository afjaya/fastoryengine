import * as React from 'react';
import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Server, Mail, FolderHeart, Globe, Check, Download, RefreshCw, FileJson } from 'lucide-react';
import { AppDatabase, AIProvider, DeliveryConfig, SchedulerConfig } from '../types.js';
import { useLanguage } from './LanguageContext.js';

interface SettingsProps {
  db: AppDatabase;
  onSaveSettings: (delivery: DeliveryConfig, scheduler: SchedulerConfig, providers: AIProvider[]) => Promise<void>;
  onRestoreDb: (restoredData: AppDatabase) => Promise<void>;
  onTrackJob?: (job: { active: boolean; title: string; progress: number; status: string } | null) => void;
}

export const Settings: React.FC<SettingsProps> = ({ db, onSaveSettings, onRestoreDb, onTrackJob }) => {
  const { t, language } = useLanguage();
  const [providers, setProviders] = useState<AIProvider[]>(db.providers.map(p => ({ ...p })));
  const [delivery, setDelivery] = useState<DeliveryConfig>({ ...db.delivery });
  const [scheduler, setScheduler] = useState<SchedulerConfig>({ ...db.scheduler });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Local storage backup states
  const [localBackupInfo, setLocalBackupInfo] = useState<string | null>(null);
  const [backupActionStatus, setBackupActionStatus] = useState<string | null>(null);

  // Check for existing full backup in localStorage on mount
  useEffect(() => {
    checkLocalBackup();
  }, []);

  const checkLocalBackup = () => {
    try {
      const backupStr = localStorage.getItem('fastory_full_database_backup');
      if (backupStr) {
        const parsed = JSON.parse(backupStr);
        const timestamp = localStorage.getItem('fastory_full_database_backup_time');
        const formattedTime = timestamp ? new Date(timestamp).toLocaleString(language === 'ID' ? 'id-ID' : 'en-US') : 'Unknown';
        
        const episodesCount = parsed.episodes?.length || 0;
        const charactersCount = parsed.characters?.length || 0;
        setLocalBackupInfo(`${episodesCount} ${language === 'ID' ? 'Episode' : 'Episodes'}, ${charactersCount} ${language === 'ID' ? 'Karakter' : 'Characters'} (Saved: ${formattedTime})`);
      } else {
        setLocalBackupInfo(null);
      }
    } catch (e) {
      console.error(e);
      setLocalBackupInfo(null);
    }
  };

  const handleBackupToLocalStorage = () => {
    try {
      localStorage.setItem('fastory_full_database_backup', JSON.stringify(db));
      localStorage.setItem('fastory_full_database_backup_time', new Date().toISOString());
      checkLocalBackup();
      showStatusMessage(language === 'ID' ? 'Database berhasil dicadangkan ke penyimpanan lokal browser!' : 'Database successfully backed up to browser local storage!');
    } catch (e: any) {
      alert((language === 'ID' ? 'Pencadangan Gagal: ' : 'Local Storage Backup Failed: ') + (e.message || e));
    }
  };

  const handleRestoreFromLocalStorage = async () => {
    try {
      const backupStr = localStorage.getItem('fastory_full_database_backup');
      if (!backupStr) {
        alert(language === 'ID' ? 'Tidak ada data cadangan di penyimpanan lokal browser Anda. Silakan buat cadangan terlebih dahulu.' : 'No backup found in your browser local storage. Please create a backup first.');
        return;
      }
      
      const confirmMessage = language === 'ID' 
        ? 'Apakah Anda yakin ingin memulihkan seluruh database dari penyimpanan lokal browser Anda? Ini akan menimpa Alkitab Cerita, Lembar Karakter, dan Arsip Episode saat ini.'
        : 'Are you sure you want to restore the entire database from your browser local storage? This will overwrite your current settings, character sheets, and episodes archive.';

      if (confirm(confirmMessage)) {
        if (onTrackJob) {
          onTrackJob({
            active: true,
            title: language === 'ID' ? 'Memulihkan Basis Data' : 'Restoring Database',
            progress: 20,
            status: language === 'ID' ? 'Membaca data cadangan...' : 'Reading backup data...'
          });
          await new Promise(r => setTimeout(r, 500));
        }

        const parsed = JSON.parse(backupStr) as AppDatabase;

        if (onTrackJob) {
          onTrackJob({
            active: true,
            title: language === 'ID' ? 'Memulihkan Basis Data' : 'Restoring Database',
            progress: 60,
            status: language === 'ID' ? 'Menulis ke penyimpanan...' : 'Writing state updates...'
          });
          await new Promise(r => setTimeout(r, 600));
        }

        await onRestoreDb(parsed);

        if (onTrackJob) {
          onTrackJob({
            active: true,
            title: language === 'ID' ? 'Memulihkan Basis Data' : 'Restoring Database',
            progress: 100,
            status: language === 'ID' ? 'Sinkronisasi pemulihan selesai!' : 'Restoration sync complete!'
          });
          await new Promise(r => setTimeout(r, 500));
          onTrackJob(null);
        }

        // Sync component state with new data
        setProviders(parsed.providers.map(p => ({ ...p })));
        setDelivery({ ...parsed.delivery });
        setScheduler({ ...parsed.scheduler });
        showStatusMessage(language === 'ID' ? 'Database berhasil dipulihkan dan disinkronkan dari cadangan lokal browser!' : 'Database successfully restored and synchronized from browser backup!');
      }
    } catch (e: any) {
      if (onTrackJob) onTrackJob(null);
      alert((language === 'ID' ? 'Pemulihan Gagal: ' : 'Local Storage Restoration Failed: ') + (e.message || e));
    }
  };

  const handleDownloadBackupFile = async () => {
    if (onTrackJob) {
      onTrackJob({
        active: true,
        title: language === 'ID' ? 'Mengekspor Cadangan Basis Data' : 'Exporting Database Backup',
        progress: 15,
        status: language === 'ID' ? 'Menganalisis tabel basis data...' : 'Analyzing database tables...'
      });
      await new Promise(r => setTimeout(r, 500));
      
      onTrackJob({
        active: true,
        title: language === 'ID' ? 'Mengekspor Cadangan Basis Data' : 'Exporting Database Backup',
        progress: 45,
        status: language === 'ID' ? 'Menserialisasi naskah dan karakter...' : 'Serializing manuscripts and characters...'
      });
      await new Promise(r => setTimeout(r, 500));

      onTrackJob({
        active: true,
        title: language === 'ID' ? 'Mengekspor Cadangan Basis Data' : 'Exporting Database Backup',
        progress: 80,
        status: language === 'ID' ? 'Membuat berkas JSON portabel...' : 'Generating portable JSON file...'
      });
      await new Promise(r => setTimeout(r, 450));

      onTrackJob({
        active: true,
        title: language === 'ID' ? 'Mengekspor Cadangan Basis Data' : 'Exporting Database Backup',
        progress: 100,
        status: language === 'ID' ? 'Pengeksporan selesai!' : 'Export complete!'
      });
      await new Promise(r => setTimeout(r, 350));
      onTrackJob(null);
    }

    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `fastory_database_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showStatusMessage(language === 'ID' ? 'Cadangan file JSON portabel berhasil diunduh!' : 'Portable JSON backup downloaded successfully!');
    } catch (e: any) {
      alert((language === 'ID' ? 'Pengunduhan Gagal: ' : 'JSON Download Failed: ') + (e.message || e));
    }
  };

  const showStatusMessage = (msg: string) => {
    setBackupActionStatus(msg);
    setTimeout(() => setBackupActionStatus(null), 4000);
  };

  const handleProviderChange = (index: number, field: keyof AIProvider, value: any) => {
    const updated = [...providers];
    updated[index] = { ...updated[index], [field]: value };
    
    // If setting active, deactivate all other providers of the same type (text vs image)
    if (field === 'isActive' && value === true) {
      const isImageProvider = updated[index].id === 'pollinations-image';
      updated.forEach((p, idx) => {
        if (idx !== index) {
          const otherIsImageProvider = p.id === 'pollinations-image';
          if (isImageProvider === otherIsImageProvider) {
            p.isActive = false;
          }
        }
      });
    }
    setProviders(updated);
  };

  const handleDeliveryChange = (field: keyof DeliveryConfig, value: any) => {
    setDelivery(prev => ({ ...prev, [field]: value }));
  };

  const handleSchedulerChange = (field: keyof SchedulerConfig, value: any) => {
    setScheduler(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Ensure at least one text provider remains active
      const activeTextIdx = providers.findIndex(p => p.isActive && p.id !== 'pollinations-image');
      if (activeTextIdx === -1) {
        const firstTextProvider = providers.find(p => p.id !== 'pollinations-image');
        if (firstTextProvider) firstTextProvider.isActive = true;
      }
      await onSaveSettings(delivery, scheduler, providers);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert((language === 'ID' ? 'Gagal menyimpan pengaturan: ' : 'Failed to save settings: ') + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="settings-view">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-400" />
            {t('settingsTitle')}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {t('settingsSubtitle')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" id="settings-config-form">
        
        {/* AI Providers Settings */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-zinc-200 border-b border-zinc-800 pb-2.5 flex items-center gap-2 uppercase tracking-widest">
            <Server className="w-4 h-4 text-blue-400" />
            {t('engineConfig')}
          </h2>

          <div className="space-y-6">
            {/* Text Story Generation Engines Section */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                {language === 'ID' ? 'Mesin Pembuat Cerita (Teks-ke-Teks)' : 'Story Generation Engines (Text-to-Text)'}
              </h3>
              <div className="space-y-4">
                {providers.filter(p => p.id !== 'pollinations-image').map((provider) => {
                  const originalIndex = providers.findIndex(p => p.id === provider.id);
                  return (
                    <div 
                      key={provider.id}
                      className={`p-4 rounded border text-xs space-y-3.5 transition-colors ${
                        provider.isActive 
                          ? 'bg-blue-600/5 border-blue-500/30' 
                          : 'bg-zinc-950/80 border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={provider.isActive}
                            onChange={(e) => handleProviderChange(originalIndex, 'isActive', e.target.checked)}
                            id={`active-${provider.id}`}
                            className="w-4 h-4 text-blue-600 border-zinc-800 rounded focus:ring-blue-500 bg-zinc-950 accent-blue-600 cursor-pointer"
                          />
                          <label htmlFor={`active-${provider.id}`} className="font-bold text-zinc-200 text-xs uppercase tracking-widest cursor-pointer select-none">
                            {provider.name}
                          </label>
                        </div>
                        {provider.isActive && (
                          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded">
                            {language === 'ID' ? 'Penyedia Aktif' : 'Active Provider'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">Base Endpoint URL</label>
                          <input
                            type="text"
                            value={provider.baseUrl}
                            onChange={(e) => handleProviderChange(originalIndex, 'baseUrl', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">Model Spec Name</label>
                          <input
                            type="text"
                            value={provider.modelName}
                            onChange={(e) => handleProviderChange(originalIndex, 'modelName', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">Private Secret API Key</label>
                          <input
                            type="password"
                            value={provider.apiKey}
                            onChange={(e) => handleProviderChange(originalIndex, 'apiKey', e.target.value)}
                            placeholder={provider.id === 'gemini' ? 'Configured from process.env.GEMINI_API_KEY' : 'Input Key...'}
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub-section for Pollinations Image AI under the list */}
            {providers.filter(p => p.id === 'pollinations-image').map((provider) => {
              const originalIndex = providers.findIndex(p => p.id === provider.id);
              return (
                <div key={provider.id} className="pt-4 border-t border-zinc-800/60">
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    {language === 'ID' ? 'Kreator Sampul & Ilustrasi Visual' : 'Visual Cover Art & Illustration Creator'}
                  </h3>
                  
                  <div 
                    className={`p-4 rounded border text-xs space-y-3.5 transition-colors ${
                      provider.isActive 
                        ? 'bg-indigo-600/5 border-indigo-500/30' 
                        : 'bg-zinc-950/80 border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={provider.isActive}
                          onChange={(e) => handleProviderChange(originalIndex, 'isActive', e.target.checked)}
                          id={`active-${provider.id}`}
                          className="w-4 h-4 text-indigo-600 border-zinc-800 rounded focus:ring-indigo-500 bg-zinc-950 accent-indigo-600 cursor-pointer"
                        />
                        <label htmlFor={`active-${provider.id}`} className="font-bold text-zinc-200 text-xs uppercase tracking-widest cursor-pointer select-none">
                          {provider.name}
                        </label>
                      </div>
                      {provider.isActive ? (
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded">
                          {language === 'ID' ? 'Kreator Sampul Aktif' : 'Cover Creator Active'}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded">
                          {language === 'ID' ? 'Nonaktif' : 'Disabled'}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {language === 'ID' 
                        ? 'Pollinations Image AI menyediakan generator gambar bertenaga FLUX secara gratis dan cepat untuk membuat seni sampul novel per episode secara instan.' 
                        : 'Pollinations Image AI provides free, lightning-fast FLUX-powered image generation to instantly synthesize beautiful cover art for your story episodes.'}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">Base Endpoint URL</label>
                        <input
                          type="text"
                          value={provider.baseUrl}
                          onChange={(e) => handleProviderChange(originalIndex, 'baseUrl', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono font-mono">Model Spec Name</label>
                        <select
                          value={provider.modelName}
                          onChange={(e) => handleProviderChange(originalIndex, 'modelName', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none cursor-pointer h-[26px]"
                        >
                          <option value="flux">flux (Standard Detail)</option>
                          <option value="flux-realism">flux-realism (Photo Realism)</option>
                          <option value="any-dark">any-dark (Cinematic Dark Mood)</option>
                          <option value="turbo">turbo (Fast, High Contrast)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">Private Secret API Key</label>
                        <input
                          type="password"
                          value={provider.apiKey}
                          onChange={(e) => handleProviderChange(originalIndex, 'apiKey', e.target.value)}
                          placeholder={language === 'ID' ? 'Opsional (Gratis & Tanpa Kunci)' : 'Optional (Free & No Key Required)'}
                          className="w-full bg-zinc-950/40 border border-zinc-900 rounded px-2.5 py-1 text-xs text-zinc-500 focus:outline-none cursor-not-allowed"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SMTP Configuration */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-zinc-200 border-b border-zinc-800 pb-2.5 flex items-center gap-2 uppercase tracking-widest">
            <Mail className="w-4 h-4 text-blue-400" />
            {t('smtpConfig')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">SMTP Outgoing Host</label>
              <input
                type="text"
                value={delivery.smtpHost}
                onChange={(e) => handleDeliveryChange('smtpHost', e.target.value)}
                placeholder="e.g. smtp.gmail.com"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">SMTP Host Port</label>
              <input
                type="number"
                value={delivery.smtpPort}
                onChange={(e) => handleDeliveryChange('smtpPort', Number(e.target.value))}
                placeholder="e.g. 465 or 587"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sender Address (From)</label>
              <input
                type="text"
                value={delivery.smtpFrom}
                onChange={(e) => handleDeliveryChange('smtpFrom', e.target.value)}
                placeholder="Fastory Story Engine <noreply@gmail.com>"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sender Username (Auth User)</label>
              <input
                type="text"
                value={delivery.smtpUser}
                onChange={(e) => handleDeliveryChange('smtpUser', e.target.value)}
                placeholder="user@gmail.com"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sender Password / App Key</label>
              <input
                type="password"
                value={delivery.smtpPass}
                onChange={(e) => handleDeliveryChange('smtpPass', e.target.value)}
                placeholder="App passwords recommended"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Recipient Address (To)</label>
              <input
                type="text"
                value={delivery.smtpTo}
                onChange={(e) => handleDeliveryChange('smtpTo', e.target.value)}
                placeholder="Recipient email address"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Backups & Storage */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-zinc-200 border-b border-zinc-800 pb-2.5 flex items-center gap-2 uppercase tracking-widest">
            <FolderHeart className="w-4 h-4 text-blue-400" />
            {t('storageConfig')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Google Drive Target Folder ID</label>
              <input
                type="text"
                value={delivery.driveFolderId}
                onChange={(e) => handleDeliveryChange('driveFolderId', e.target.value)}
                placeholder="Google Drive Folder Id"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Local Output Stories Directory</label>
              <input
                type="text"
                value={delivery.outputFolder}
                onChange={(e) => handleDeliveryChange('outputFolder', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Scheduler Config */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-zinc-200 border-b border-zinc-800 pb-2.5 flex items-center gap-2 uppercase tracking-widest">
            <Globe className="w-4 h-4 text-blue-400" />
            {t('schedulerConfig')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center font-mono text-[10px]">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={scheduler.autoGenerate}
                onChange={(e) => handleSchedulerChange('autoGenerate', e.target.checked)}
                id="auto-generate"
                className="w-4 h-4 text-blue-600 border-zinc-800 rounded focus:ring-blue-500 bg-zinc-950 accent-blue-600 cursor-pointer"
              />
              <label htmlFor="auto-generate" className="text-xs font-bold text-zinc-300 cursor-pointer select-none uppercase tracking-widest">
                {language === 'ID' ? 'Aktifkan cron latar belakang' : 'Enable background cron'}
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{language === 'ID' ? 'Interval Pemicu' : 'Trigger Interval'}</label>
              <select
                value={scheduler.frequency}
                onChange={(e) => handleSchedulerChange('frequency', e.target.value)}
                disabled={!scheduler.autoGenerate}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none disabled:text-zinc-600 disabled:border-zinc-900"
              >
                <option value="daily">{language === 'ID' ? 'Setiap Hari' : 'Every Day'}</option>
                <option value="weekly">{language === 'ID' ? 'Setiap Minggu' : 'Weekly'}</option>
                <option value="monthly">{language === 'ID' ? 'Setiap Bulan' : 'Monthly'}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{language === 'ID' ? 'Waktu Pemicu (JJ:MM)' : 'Trigger Time (HH:MM)'}</label>
              <input
                type="text"
                value={scheduler.customTime}
                onChange={(e) => handleSchedulerChange('customTime', e.target.value)}
                disabled={!scheduler.autoGenerate}
                placeholder="09:00"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono disabled:text-zinc-600 disabled:border-zinc-900"
              />
            </div>
          </div>
        </div>

        {/* Browser Local Storage Backup Center */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
            <h2 className="text-xs font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-widest">
              <FolderHeart className="w-4 h-4 text-blue-400" />
              {language === 'ID' ? 'Pusat Pencadangan LocalStorage Browser' : 'Browser Local Storage Backup Center'}
            </h2>
            {localBackupInfo ? (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {language === 'ID' ? 'BACKUP AKTIF DITEMUKAN' : 'ACTIVE BACKUP FOUND'}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {language === 'ID' ? 'TIDAK ADA CADANGAN YANG DISIMPAN' : 'NO BACKUP STORED'}
              </span>
            )}
          </div>
          
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {language === 'ID' 
              ? 'Kelola file pencadangan lokal Anda. Anda dapat mengambil snapshot dari seluruh status sistem (Alkitab Cerita, Lembar Karakter, Arsip Episode, dan konfigurasi) langsung ke penyimpanan localStorage browser yang aman, memulihkannya secara instan ke server aktif, atau mengekspor file cadangan JSON fisik.'
              : 'Manage localized backup files. You can snapshot the entire system state (Story Bible, Character Cast, Episodes Archive, and configurations) directly to your browser\'s secure localStorage container, instantly restore snapshots to the active system server, or export a physical JSON backup.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2" id="backup-actions-grid">
            <button
              type="button"
              onClick={handleBackupToLocalStorage}
              className="bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 hover:border-blue-500/50 text-blue-400 text-xs font-semibold py-2.5 px-3 rounded transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-97"
              id="backup-now-btn"
            >
              <Save className="w-4 h-4" />
              {t('backupOutput')}
            </button>

            <button
              type="button"
              onClick={handleRestoreFromLocalStorage}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 hover:border-emerald-500/50 text-emerald-400 text-xs font-semibold py-2.5 px-3 rounded transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-97"
              id="restore-now-btn"
            >
              <RefreshCw className="w-4 h-4" />
              {t('restoreBackup')}
            </button>

            <button
              type="button"
              onClick={handleDownloadBackupFile}
              className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 text-xs font-semibold py-2.5 px-3 rounded transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-97"
              id="download-backup-btn"
            >
              <Download className="w-4 h-4" />
              {t('downloadBackupFile')}
            </button>
          </div>

          {(localBackupInfo || backupActionStatus) && (
            <div className="bg-zinc-950 p-3.5 rounded border border-zinc-900 space-y-2 animate-fade-in" id="backup-metadata-card">
              {localBackupInfo && (
                <div className="flex flex-wrap items-center justify-between text-[10px] font-mono gap-1">
                  <span className="text-zinc-500">{language === 'ID' ? 'METADATA CADANGAN TERSEBUT:' : 'SAVED SNAPSHOT METADATA:'}</span>
                  <span className="text-zinc-300 font-bold">{localBackupInfo}</span>
                </div>
              )}
              {backupActionStatus && (
                <div className="text-[11px] font-medium text-blue-400 flex items-center gap-1.5 pt-1 border-t border-zinc-900/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {backupActionStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4" id="settings-actions-footer">
          {saveSuccess ? (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" />
              {language === 'ID' ? 'Pengaturan berhasil diperbarui!' : 'Settings updated successfully!'}
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={isSaving}
            className={`px-4 py-2 rounded text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              isSaving
                ? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-lg shadow-blue-900/10'
            }`}
            id="save-settings-btn"
          >
            <Save className="w-4 h-4" />
            {isSaving ? (language === 'ID' ? 'Memperbarui...' : 'Updating...') : t('saveChanges')}
          </button>
        </div>

      </form>
    </div>
  );
};
