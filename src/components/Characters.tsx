import * as React from 'react';
import React, { useState } from 'react';
import { User, Trash2, Edit3, Plus, Save, X, AlertCircle, Network } from 'lucide-react';
import { Character } from '../types.js';
import { useLanguage } from './LanguageContext.js';
import { RelationshipGraph } from './RelationshipGraph.js';

interface CharactersProps {
  characters: Character[];
  onUpsert: (character: Character) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const CharacterManager: React.FC<CharactersProps> = ({ characters, onUpsert, onDelete }) => {
  const { t, language } = useLanguage();
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'list'>('graph');

  const handleEditFromGraph = (char: Character) => {
    handleEditClick(char);
    setActiveTab('list');
  };

  const emptyCharacter = (): Character => ({
    id: '',
    name: '',
    age: '',
    gender: '',
    occupation: '',
    personality: '',
    status: 'Alive',
    relationships: '',
    biography: '',
    location: '',
    notes: ''
  });

  const handleEditClick = (char: Character) => {
    setEditingChar({ ...char });
    setIsFormOpen(true);
    setError(null);
  };

  const handleAddNewClick = () => {
    setEditingChar(emptyCharacter());
    setIsFormOpen(true);
    setError(null);
  };

  const handleCloseForm = () => {
    setEditingChar(null);
    setIsFormOpen(false);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editingChar) return;
    const { name, value } = e.target;
    setEditingChar(prev => prev ? ({ ...prev, [name]: value }) : null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChar) return;
    if (!editingChar.name.trim()) {
      setError(language === 'ID' ? 'Nama karakter wajib diisi.' : 'Character name is required.');
      return;
    }

    try {
      await onUpsert(editingChar);
      handleCloseForm();
    } catch (err: any) {
      setError(err.message || (language === 'ID' ? 'Gagal menyimpan karakter.' : 'Failed to save character.'));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDeleteChar'))) {
      try {
         await onDelete(id);
      } catch (err: any) {
         alert(err.message || (language === 'ID' ? 'Gagal menghapus karakter.' : 'Failed to delete character.'));
      }
    }
  };

  return (
    <div className="space-y-6" id="character-manager-view">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            {t('charactersDatabase')}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {t('charactersSubtitle')}
          </p>
        </div>
        <button
          onClick={handleAddNewClick}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-900/20 active:scale-98 cursor-pointer"
          id="add-character-btn"
        >
          <Plus className="w-4 h-4" />
          {t('addCharacter')}
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-zinc-850" id="character-view-tabs">
        <button
          onClick={() => setActiveTab('graph')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 tracking-wide transition-all duration-150 cursor-pointer ${
            activeTab === 'graph'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10'
          }`}
          id="tab-graph-view"
        >
          <Network className="w-4 h-4" />
          {t('relationshipNetwork')}
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 tracking-wide transition-all duration-150 cursor-pointer ${
            activeTab === 'list'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10'
          }`}
          id="tab-list-view"
        >
          <User className="w-4 h-4" />
          {language === 'ID' ? 'Basis Data Casting' : 'Casting Database'}
        </button>
      </div>

      {isFormOpen && editingChar && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4" id="character-edit-form-panel">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">
              {editingChar.id ? `${language === 'ID' ? 'Ubah' : 'Edit'} ${editingChar.name}` : t('addCharacter')}
            </h2>
            <button onClick={handleCloseForm} className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-3 rounded text-xs flex items-center gap-2" id="character-form-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4" id="character-form">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charName')}</label>
                <input
                  type="text"
                  name="name"
                  value={editingChar.name}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charAge')}</label>
                <input
                  type="text"
                  name="age"
                  value={editingChar.age}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charGender')}</label>
                <input
                  type="text"
                  name="gender"
                  value={editingChar.gender}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charOccupation')}</label>
                <input
                  type="text"
                  name="occupation"
                  value={editingChar.occupation}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charLocation')}</label>
                <input
                  type="text"
                  name="location"
                  value={editingChar.location}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charStatus')}</label>
                <select
                  name="status"
                  value={editingChar.status}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="Alive">{t('alive')}</option>
                  <option value="Dead">{t('dead')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charPersonality')}</label>
              <textarea
                name="personality"
                value={editingChar.personality}
                onChange={handleInputChange}
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charRelationships')}</label>
              <textarea
                name="relationships"
                value={editingChar.relationships}
                onChange={handleInputChange}
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charBiography')}</label>
                <textarea
                  name="biography"
                  value={editingChar.biography}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t('charNotes')}</label>
                <textarea
                  name="notes"
                  value={editingChar.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={handleCloseForm}
                className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer"
              >
                {language === 'ID' ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                id="submit-character-btn"
              >
                <Save className="w-3.5 h-3.5" />
                {t('saveCharacter')}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'graph' && (
        <RelationshipGraph characters={characters} onEdit={handleEditFromGraph} />
      )}

      {activeTab === 'list' && (
        characters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="characters-list-grid">
            {characters.map(char => (
              <div
                key={char.id}
                className={`bg-[#18181b] border p-5 rounded-xl flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-all duration-200 ${
                  char.status === 'Dead' ? 'border-rose-950 bg-rose-950/5' : 'border-[#27272a]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">{char.name}</h3>
                      <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                        {char.occupation || (language === 'ID' ? 'Tidak Ada Pekerjaan' : 'No Occupation')}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                      char.status === 'Alive' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {char.status === 'Alive' ? t('alive') : t('dead')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 py-1.5 border-y border-zinc-800/80 font-mono">
                    <div>{language === 'ID' ? 'USIA' : 'AGE'}: <strong className="text-zinc-300">{char.age || 'N/A'}</strong></div>
                    <div>{language === 'ID' ? 'GENDER' : 'GENDER'}: <strong className="text-zinc-300">{char.gender || 'N/A'}</strong></div>
                    <div className="col-span-2 truncate">{language === 'ID' ? 'LOKASI' : 'LOCATION'}: <strong className="text-zinc-300">{char.location || 'N/A'}</strong></div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono"># {t('charPersonality').toUpperCase()}</span>
                    <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{char.personality || (language === 'ID' ? 'Belum disediakan.' : 'None provided.')}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono"># {t('charBiography').toUpperCase()}</span>
                    <p className="text-xs text-zinc-300 line-clamp-3 italic leading-relaxed">{char.biography || (language === 'ID' ? 'Belum disediakan.' : 'None provided.')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-3">
                  <button
                    onClick={() => handleEditClick(char)}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Edit Character"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {language === 'ID' ? 'Ubah' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(char.id)}
                    className="bg-rose-950/10 hover:bg-rose-950/30 border border-rose-900/30 text-rose-400 px-3 py-1.5 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Delete Character"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {language === 'ID' ? 'Hapus' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-zinc-900/20 border border-zinc-850 border-dashed rounded-xl" id="characters-empty-state">
            <User className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 font-medium">{t('noCharacters')}</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1">
              {language === 'ID'
                ? 'Buat protagonis dan antagonis utama Anda di sini agar generator cerita mempertahankan kontinuitas biologis yang mendalam!'
                : 'Create your primary protagonists and antagonists here so that the story generator maintains deep biological continuity!'}
            </p>
          </div>
        )
      )}
    </div>
  );
};
