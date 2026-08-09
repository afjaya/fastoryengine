import * as React from 'react';
import React, { useState } from 'react';
import { Save, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { StoryBible } from '../types.js';
import { useLanguage } from './LanguageContext.js';

interface StoryBibleProps {
  initialBible: StoryBible;
  onSave: (bible: StoryBible) => Promise<void>;
}

export const StoryBibleManager: React.FC<StoryBibleProps> = ({ initialBible, onSave }) => {
  const { t, language } = useLanguage();
  const [bible, setBible] = useState<StoryBible>({ ...initialBible });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBible(prev => ({
      ...prev,
      [name]: name === 'episodeLength' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await onSave(bible);
      setMessage({ 
        type: 'success', 
        text: language === 'ID' ? 'Alkitab cerita berhasil diperbarui.' : 'Story Bible updated successfully.' 
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.message || (language === 'ID' ? 'Gagal memperbarui Alkitab cerita.' : 'Failed to update Story Bible.') 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="story-bible-view">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            {t('bibleTitle')}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {t('bibleSubtitle')}
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded border text-xs flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`} id="bible-message">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" id="bible-form">
        
        {/* Core Attributes */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            {language === 'ID' ? 'Konfigurasi Inti Semesta' : 'Core Universe Configuration'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('genre')}</label>
              <input
                type="text"
                name="genre"
                value={bible.genre}
                onChange={handleChange}
                placeholder={t('biblePlaceholderGenre')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('universeName')}</label>
              <input
                type="text"
                name="universeName"
                value={bible.universeName}
                onChange={handleChange}
                placeholder={t('biblePlaceholderUniverse')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('episodeLength')}</label>
              <input
                type="number"
                name="episodeLength"
                value={bible.episodeLength}
                onChange={handleChange}
                min="200"
                max="10000"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('tone')}</label>
              <input
                type="text"
                name="tone"
                value={bible.tone}
                onChange={handleChange}
                placeholder={t('biblePlaceholderTone')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('language')}</label>
              <input
                type="text"
                name="language"
                value={bible.language}
                onChange={handleChange}
                placeholder={t('biblePlaceholderLanguage')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('narratorStyle')}</label>
              <input
                type="text"
                name="narratorStyle"
                value={bible.narratorStyle}
                onChange={handleChange}
                placeholder={t('biblePlaceholderNarrator')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>
        </div>

        {/* Narrative & Writing Directives */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2.5">
            {language === 'ID' ? 'Arahan Naratif & Penulisan' : 'Narrative & Writing Directives'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('storyStyle')}</label>
              <textarea
                name="storyStyle"
                value={bible.storyStyle}
                onChange={handleChange}
                rows={3}
                placeholder={t('biblePlaceholderStyle')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('writingRules')}</label>
              <textarea
                name="writingRules"
                value={bible.writingRules}
                onChange={handleChange}
                rows={3}
                placeholder={t('biblePlaceholderWritingRules')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('promptRules')}</label>
              <textarea
                name="promptRules"
                value={bible.promptRules}
                onChange={handleChange}
                rows={3}
                placeholder={t('biblePlaceholderPromptRules')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                required
              />
            </div>
          </div>
        </div>

        {/* Advanced Guardrails */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2.5">
            {language === 'ID' ? 'Batasan Naratif & Keamanan' : 'Narrative Guardrails & Safety'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('forbiddenRules')}</label>
              <textarea
                name="forbiddenRules"
                value={bible.forbiddenRules}
                onChange={handleChange}
                rows={4}
                placeholder={t('biblePlaceholderForbiddenRules')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{t('customInstructions')}</label>
              <textarea
                name="customInstructions"
                value={bible.customInstructions}
                onChange={handleChange}
                rows={4}
                placeholder={t('biblePlaceholderCustom')}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                required
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className={`px-4 py-2 rounded font-semibold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              isSaving
                ? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
            }`}
            id="save-bible-btn"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? (language === 'ID' ? 'MENYIMPAN...' : 'SAVING CHANGES...') : t('saveBibleSettings')}
          </button>
        </div>

      </form>
    </div>
  );
};
