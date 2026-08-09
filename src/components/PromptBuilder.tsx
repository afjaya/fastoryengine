import React, { useState, useEffect } from 'react';
import { Sparkles, Terminal, Copy, ArrowRight, Layers, FileText, Compass, Image as ImageIcon } from 'lucide-react';
import { AppDatabase } from '../types.js';
import { useLanguage } from './LanguageContext.js';
import { generatePollinationsImageUrl } from '../utils.js';

interface PromptBuilderProps {
  db: AppDatabase;
  onNavigate: (tab: string) => void;
  onSelectPrompt: (snippet: string, targetLength: number, coverUrl?: string) => void;
}

export const PromptBuilderView: React.FC<PromptBuilderProps> = ({ db, onNavigate, onSelectPrompt }) => {
  const { t, language } = useLanguage();
  const [customSnippet, setCustomSnippet] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [targetLength, setTargetLength] = useState(db.storyBible.episodeLength || 1500);
  const [compiledPrompt, setCompiledPrompt] = useState<{ systemPrompt: string; userPrompt: string } | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [copied, setCopied] = useState<'system' | 'user' | null>(null);

  const assemblePrompt = async () => {
    setIsCompiling(true);
    try {
      const finalSnippet = customSnippet + (imagePrompt ? `\n\n[Visual Guidance: ${imagePrompt}]` : '');
      const response = await fetch('/api/prompt/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customSnippet: finalSnippet, targetLength })
      });
      if (!response.ok) throw new Error('Failed to assemble prompt');
      const data = await response.json();
      setCompiledPrompt(data);
    } catch (e: any) {
      alert(e.message || (language === 'ID' ? 'Kompilasi prompt gagal.' : 'Prompt compilation failed.'));
    } finally {
      setIsCompiling(false);
    }
  };

  // Run automatically on load
  useEffect(() => {
    assemblePrompt();
  }, []);

  const handleCopyToClipboard = (text: string, type: 'system' | 'user') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleProceedToGenerator = () => {
    const finalSnippet = customSnippet + (imagePrompt ? `\n\n[Visual Guidance: ${imagePrompt}]` : '');
    
    let generatedCoverUrl = '';
    const pollinationsProvider = db.providers.find(p => p.id === 'pollinations-image');
    if (imagePrompt && pollinationsProvider) {
      try {
        generatedCoverUrl = generatePollinationsImageUrl(imagePrompt, pollinationsProvider);
      } catch (e) {
        console.error(e);
      }
    }

    onSelectPrompt(finalSnippet, targetLength, generatedCoverUrl);
    onNavigate('generator');
  };

  const activeCharactersCount = db.characters.filter(c => c.status === 'Alive').length;
  const previousEpisode = db.episodes[db.episodes.length - 1];

  return (
    <div className="space-y-6" id="prompt-builder-view">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            {t('builderTitle')}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {t('builderSubtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="prompt-builder-workspace">
        
        {/* Input Configuration Column */}
        <div className="space-y-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200 border-b border-zinc-800 pb-2.5 flex items-center gap-2 uppercase tracking-widest">
              <Compass className="w-4 h-4 text-blue-400" />
              {language === 'ID' ? 'Fokus & Arah' : 'Focus & Direction'}
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
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  {language === 'ID' ? 'Arah Narasi Kustom / Cuplikan' : 'Custom Narrative Focus / Sneak Peek'}
                </label>
                <textarea
                  value={customSnippet}
                  onChange={(e) => setCustomSnippet(e.target.value)}
                  rows={4}
                  placeholder="e.g. Major Silas discovers a broken neon memory cube inside the desk..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors leading-relaxed font-sans"
                />
                <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                  {language === 'ID' 
                    ? 'Masukkan petunjuk terperinci atau sub-plot situasi yang harus terjadi pada bab berikutnya.'
                    : 'Inject detailed prompts or situational sub-plots that must occur during this next chapter.'}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  {language === 'ID' ? 'Petunjuk Gambar (Cover Art)' : 'Image Prompt (Cover Art)'}
                </label>
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder={language === 'ID' ? 'Contoh: kota cyberpunk, lampu neon, gaya lukisan' : 'e.g. cyberpunk city, neon lights, painting style'}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                  {language === 'ID' 
                    ? 'Kata kunci deskriptif untuk menghasilkan seni sampul bab via Pollinations AI (FLUX) dan disematkan ke dalam proses pembuatan cerita.'
                    : 'Descriptive keywords to generate chapter cover art via Pollinations AI (FLUX) and embedded into the story generation process.'}
                </p>
              </div>

              <button
                onClick={assemblePrompt}
                disabled={isCompiling}
                className="w-full bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold py-2 rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                id="compile-prompt-btn"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isCompiling ? (language === 'ID' ? 'Menyusun Kembali...' : 'Recompiling Layout...') : (language === 'ID' ? 'Sintesis Prompt Cerita' : 'Compile Story Prompt')}
              </button>
            </div>
          </div>

          {/* Compilation Stack Indicators */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-3.5">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2.5">
              {language === 'ID' ? 'Tumpukan Data yang Disusun' : 'Assembled Data Stack'}
            </h2>

            <ul className="space-y-3 text-[11px] text-zinc-400 font-mono">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                <span>{language === 'ID' ? 'ALKITAB CERITA' : 'STORY BIBLE'}: <strong className="text-zinc-200">COMPILED</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                <span>{language === 'ID' ? 'ARAHAN' : 'DIRECTIVES'}: <strong className="text-zinc-200">COMPILED</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                <span>{language === 'ID' ? 'KARAKTER' : 'CHARACTERS'}: <strong className="text-zinc-200">{activeCharactersCount} {language === 'ID' ? 'AKTIF' : 'ACTIVE'}</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                <span>{language === 'ID' ? 'KONTINUITAS' : 'CONTINUITY'}: <strong className="text-blue-400">
                  {previousEpisode ? `${language === 'ID' ? 'BAB' : 'CH'} #${previousEpisode.episodeNumber} LOADED` : (language === 'ID' ? 'BAB 01 AWAL' : 'CHAPTER 01 INITIAL')}
                </strong></span>
              </li>
            </ul>
          </div>
        </div>

        {/* compiled Output Column */}
        <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">{t('buildPromptPreview')}</h2>
              </div>

              {compiledPrompt && (
                <button
                  onClick={handleProceedToGenerator}
                  className="bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded flex items-center gap-1 transition-all shadow-lg shadow-blue-900/10 cursor-pointer"
                  id="proceed-to-generator-btn"
                >
                  {language === 'ID' ? 'Lanjutkan ke Generator' : 'Proceed to Generator'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {compiledPrompt ? (
              <div className="space-y-4 text-xs" id="compiled-prompt-blocks">
                {/* System Prompt Block */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                      {t('systemPromptTitle')}
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(compiledPrompt.systemPrompt, 'system')}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      {copied === 'system' ? (language === 'ID' ? 'Tersalin' : 'Copied') : (language === 'ID' ? 'Salin' : 'Copy')}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-400 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap leading-relaxed max-h-[180px] custom-scrollbar">
                    {compiledPrompt.systemPrompt}
                  </pre>
                </div>

                {/* User Prompt Block */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                      {t('userPromptTitle')}
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(compiledPrompt.userPrompt, 'user')}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      {copied === 'user' ? (language === 'ID' ? 'Tersalin' : 'Copied') : (language === 'ID' ? 'Salin' : 'Copy')}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-400 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap leading-relaxed max-h-[220px] custom-scrollbar">
                    {compiledPrompt.userPrompt}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center">
                <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-zinc-500">
                  {language === 'ID' ? 'Menyusun pratinjau data prompt...' : 'Compiling prompt preview data...'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
