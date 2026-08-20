import * as fs from 'fs';
import * as path from 'path';
import { AppDatabase, StoryBible, Character, Episode, AIProvider, DeliveryConfig, SchedulerConfig, GenerationLog } from '../types.js';

const DB_FILE = path.join(process.cwd(), 'db.json');

const defaultStoryBible: StoryBible = {
  genre: 'Epic Fantasy',
  universeName: 'Grande Cosmic',
  storyStyle: 'Immersive, high-stakes epic fantasy with vivid atmospheric worldbuilding, ancient cosmic magic, and deep lore.',
  narratorStyle: 'Third-Person Limited, grounded, atmospheric, and sensory-heavy.',
  language: 'English',
  writingRules: 'Show, don\'t tell. Focus on visceral sensory details—the chill of cosmic mana, heavy plate armor, ancient runes, and tense character dialogue. Avoid info-dumps.',
  episodeLength: 1500,
  promptRules: 'Open with immediate action or a striking atmospheric detail. Use natural, grounded dialogue. End each chapter on high tension, a cosmic revelation, or a cliffhanger.',
  tone: 'Somber, mysterious, high-contrast, epic',
  forbiddenRules: 'No easy resolutions, no sudden generic positive outcomes, do not use overly purple prose, never summarize dramatic scenes that can be experienced through dialogue.',
  customInstructions: 'Weave in subtle atmospheric details like the faint hum of celestial magic, ancient glowing runes, and shifts in atmospheric pressure during magic invocation.',
  updatedAt: new Date().toISOString()
};

const defaultProviders: AIProvider[] = [
  {
    id: 'gemini',
    name: 'Gemini (Google Gen AI)',
    apiKey: '', // Loaded server-side from process.env.GEMINI_API_KEY
    baseUrl: 'https://generativelanguage.googleapis.com',
    modelName: 'gemini-2.5-flash',
    isActive: true
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    isActive: false
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    modelName: 'claude-3-5-haiku-latest',
    isActive: false
  },
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    isActive: false
  },
  {
    id: 'local',
    name: 'Local API (Ollama/LM Studio)',
    apiKey: 'not-needed',
    baseUrl: 'http://localhost:11434/v1',
    modelName: 'mistral',
    isActive: false
  },
  {
    id: 'pollinations-image',
    name: 'Pollinations Image AI',
    baseUrl: 'https://image.pollinations.ai/prompt/',
    modelName: 'flux',
    apiKey: '',
    isActive: false
  }
];

const defaultDelivery: DeliveryConfig = {
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: 'Fastory Story Engine <noreply@gmail.com>',
  smtpTo: 'BangRijal@gmail.com',
  driveFolderId: 'root',
  outputFolder: path.join(process.cwd(), 'stories'),
  backupFolder: path.join(process.cwd(), 'backups')
};

const defaultScheduler: SchedulerConfig = {
  autoGenerate: false,
  frequency: 'daily',
  customTime: '09:00'
};

const defaultDatabase: AppDatabase = {
  storyBible: defaultStoryBible,
  characters: [
    {
      id: 'char-1',
      name: 'Sir Silas Vance',
      age: '42',
      gender: 'Male',
      occupation: 'Disgraced Solar Knight & Cosmic Wanderer',
      personality: 'Cynical, meticulous, fiercely protective of the forgotten sectors, struggling with the corruption of a shattered astral core.',
      status: 'Alive',
      relationships: 'Former sworn brother of Arch-Mage Thai (deceased), deeply distrusts the High Council executives of Aethelgard.',
      biography: 'Dishonorably stripped of his knighthood after refusing orders to purge a starving district during the Mana Eclipse. Now operates as a rogue mercenary in the outer realms.',
      location: 'Underbelly of the Astral Citadel',
      notes: 'Wields a heavy, runic-carved silver broadsword. His left eye glows with a dangerous, unstable cosmic essence from an ancient ritual.'
    }
  ],
  episodes: [],
  providers: defaultProviders,
  delivery: defaultDelivery,
  scheduler: defaultScheduler,
  logs: [
    {
      id: 'log-initial',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Fastory Story Engine initialized.'
    }
  ],
  currentProjectTitle: 'Neon Chronicles: Volume I',
  projects: []
};

export class DatabaseRepository {
  private memoryDb: AppDatabase;

  constructor() {
    this.memoryDb = this.loadFromFile();
    this.ensureDirsExist();
  }

  private loadFromFile(): AppDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Merge with defaults to ensure schema updates don't break existing databases
        const loadedProviders = parsed.providers || [];
        const mergedProviders = [...loadedProviders];
        defaultProviders.forEach(def => {
          if (!mergedProviders.some(p => p.id === def.id)) {
            mergedProviders.push(def);
          }
        });

        return {
          storyBible: { ...defaultStoryBible, ...parsed.storyBible },
          characters: parsed.characters || [],
          episodes: parsed.episodes || [],
          providers: mergedProviders,
          delivery: { ...defaultDelivery, ...parsed.delivery },
          scheduler: { ...defaultScheduler, ...parsed.scheduler },
          logs: parsed.logs || [],
          currentProjectTitle: parsed.currentProjectTitle || parsed.storyBible?.universeName || 'Neon Chronicles: Volume I',
          projects: parsed.projects || []
        };
      }
    } catch (e) {
      console.error('Error loading db.json, resetting to defaults:', e);
    }
    
    // Write defaults if it doesn't exist
    this.saveToFile(defaultDatabase);
    return JSON.parse(JSON.stringify(defaultDatabase));
  }

  private saveToFile(db: AppDatabase) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save database file:', e);
    }
  }

  private ensureDirsExist() {
    try {
      const output = this.memoryDb.delivery.outputFolder;
      const backup = this.memoryDb.delivery.backupFolder;
      if (!fs.existsSync(output)) {
        fs.mkdirSync(output, { recursive: true });
      }
      if (!fs.existsSync(backup)) {
        fs.mkdirSync(backup, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create story directories:', e);
    }
  }

  public get(): AppDatabase {
    return this.memoryDb;
  }

  public updateBible(bible: Partial<StoryBible>): StoryBible {
    this.memoryDb.storyBible = {
      ...this.memoryDb.storyBible,
      ...bible,
      updatedAt: new Date().toISOString()
    };
    this.saveToFile(this.memoryDb);
    return this.memoryDb.storyBible;
  }

  public upsertCharacter(character: Partial<Character>): Character {
    const chars = [...this.memoryDb.characters];
    let index = -1;
    
    if (character.id) {
      index = chars.findIndex(c => c.id === character.id);
    }

    const fullChar: Character = {
      id: character.id || `char-${Date.now()}`,
      name: character.name || 'Unnamed Character',
      age: character.age || 'Unknown',
      gender: character.gender || 'Unknown',
      occupation: character.occupation || 'None',
      personality: character.personality || '',
      status: character.status || 'Alive',
      relationships: character.relationships || '',
      biography: character.biography || '',
      location: character.location || '',
      notes: character.notes || ''
    };

    if (index >= 0) {
      chars[index] = fullChar;
    } else {
      chars.push(fullChar);
    }

    this.memoryDb.characters = chars;
    this.saveToFile(this.memoryDb);
    return fullChar;
  }

  public deleteCharacter(id: string): boolean {
    const originalLength = this.memoryDb.characters.length;
    this.memoryDb.characters = this.memoryDb.characters.filter(c => c.id !== id);
    const deleted = this.memoryDb.characters.length < originalLength;
    if (deleted) {
      this.saveToFile(this.memoryDb);
    }
    return deleted;
  }

  public upsertEpisode(episode: Partial<Episode>): Episode {
    const episodes = [...this.memoryDb.episodes];
    let index = -1;
    
    if (episode.id) {
      index = episodes.findIndex(e => e.id === episode.id);
    }

    const fullEpisode: Episode = {
      id: episode.id || `ep-${Date.now()}`,
      episodeNumber: episode.episodeNumber || (episodes.length + 1),
      title: episode.title || `Episode ${episodes.length + 1}`,
      summary: episode.summary || '',
      wordCount: episode.wordCount || 0,
      generationDate: episode.generationDate || new Date().toISOString(),
      status: episode.status || 'Draft',
      promptUsed: episode.promptUsed || '',
      aiProvider: episode.aiProvider || '',
      modelUsed: episode.modelUsed || '',
      content: episode.content || '',
      outputFile: episode.outputFile,
      coverUrl: episode.coverUrl
    };

    if (index >= 0) {
      episodes[index] = fullEpisode;
    } else {
      episodes.push(fullEpisode);
    }

    // Sort episodes by episodeNumber
    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

    this.memoryDb.episodes = episodes;
    this.saveToFile(this.memoryDb);
    return fullEpisode;
  }

  public deleteEpisode(id: string): boolean {
    const originalLength = this.memoryDb.episodes.length;
    this.memoryDb.episodes = this.memoryDb.episodes.filter(e => e.id !== id);
    const deleted = this.memoryDb.episodes.length < originalLength;
    if (deleted) {
      this.saveToFile(this.memoryDb);
    }
    return deleted;
  }

  public updateSettings(delivery: Partial<DeliveryConfig>, scheduler: Partial<SchedulerConfig>, providers: AIProvider[]): void {
    this.memoryDb.delivery = { ...this.memoryDb.delivery, ...delivery };
    this.memoryDb.scheduler = { ...this.memoryDb.scheduler, ...scheduler };
    if (providers && providers.length) {
      this.memoryDb.providers = providers;
    }
    this.ensureDirsExist();
    this.saveToFile(this.memoryDb);
  }

  public log(level: 'INFO' | 'WARNING' | 'ERROR', message: string, episodeNumber?: number): GenerationLog {
    const newLog: GenerationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      episodeNumber
    };
    
    // Keep last 1000 logs
    const logs = [newLog, ...this.memoryDb.logs].slice(0, 1000);
    this.memoryDb.logs = logs;
    this.saveToFile(this.memoryDb);
    return newLog;
  }

  public clearLogs(): void {
    this.memoryDb.logs = [];
    this.saveToFile(this.memoryDb);
  }

  public overwriteDb(newDb: AppDatabase): void {
    this.memoryDb = {
      storyBible: { ...this.memoryDb.storyBible, ...newDb.storyBible },
      characters: newDb.characters || [],
      episodes: newDb.episodes || [],
      providers: newDb.providers || this.memoryDb.providers,
      delivery: { ...this.memoryDb.delivery, ...newDb.delivery },
      scheduler: { ...this.memoryDb.scheduler, ...newDb.scheduler },
      logs: newDb.logs || this.memoryDb.logs,
      currentProjectTitle: newDb.currentProjectTitle || this.memoryDb.currentProjectTitle || 'Neon Chronicles: Volume I',
      projects: newDb.projects || this.memoryDb.projects || []
    };
    this.ensureDirsExist();
    this.saveToFile(this.memoryDb);
  }

  public createProject(title: string): AppDatabase {
    const currentTitle = this.memoryDb.currentProjectTitle || this.memoryDb.storyBible.universeName || 'Untitled Project';
    
    if (!this.memoryDb.projects) {
      this.memoryDb.projects = [];
    }

    // Filter out any existing archive entry with the same title to avoid duplicate names, replacing it
    this.memoryDb.projects = this.memoryDb.projects.filter(p => p.title.toLowerCase() !== currentTitle.toLowerCase());
    
    this.memoryDb.projects.push({
      title: currentTitle,
      storyBible: JSON.parse(JSON.stringify(this.memoryDb.storyBible)),
      characters: JSON.parse(JSON.stringify(this.memoryDb.characters)),
      episodes: JSON.parse(JSON.stringify(this.memoryDb.episodes)),
      logs: JSON.parse(JSON.stringify(this.memoryDb.logs)),
      archivedAt: new Date().toISOString()
    });

    // Reset active project to a fresh blank slate
    this.memoryDb.currentProjectTitle = title;
    this.memoryDb.storyBible = {
      genre: '',
      universeName: title,
      storyStyle: '',
      narratorStyle: '',
      language: 'English',
      writingRules: '',
      episodeLength: 1500,
      promptRules: '',
      tone: '',
      forbiddenRules: '',
      customInstructions: '',
      updatedAt: new Date().toISOString()
    };
    this.memoryDb.characters = [];
    this.memoryDb.episodes = [];
    this.memoryDb.logs = [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `New story project "${title}" created successfully.`
      }
    ];

    this.saveToFile(this.memoryDb);
    return this.memoryDb;
  }

  public switchProject(title: string): AppDatabase {
    const currentTitle = this.memoryDb.currentProjectTitle || this.memoryDb.storyBible.universeName || 'Untitled Project';
    if (!this.memoryDb.projects) {
      this.memoryDb.projects = [];
    }
    
    // Archive current project
    this.memoryDb.projects = this.memoryDb.projects.filter(p => p.title.toLowerCase() !== currentTitle.toLowerCase());
    this.memoryDb.projects.push({
      title: currentTitle,
      storyBible: JSON.parse(JSON.stringify(this.memoryDb.storyBible)),
      characters: JSON.parse(JSON.stringify(this.memoryDb.characters)),
      episodes: JSON.parse(JSON.stringify(this.memoryDb.episodes)),
      logs: JSON.parse(JSON.stringify(this.memoryDb.logs)),
      archivedAt: new Date().toISOString()
    });

    // Find and load requested project
    const targetProjectIndex = this.memoryDb.projects.findIndex(p => p.title.toLowerCase() === title.toLowerCase());
    if (targetProjectIndex === -1) {
      throw new Error(`Project "${title}" not found in archive.`);
    }

    const targetProject = this.memoryDb.projects[targetProjectIndex];
    
    this.memoryDb.currentProjectTitle = targetProject.title;
    this.memoryDb.storyBible = JSON.parse(JSON.stringify(targetProject.storyBible));
    this.memoryDb.characters = JSON.parse(JSON.stringify(targetProject.characters));
    this.memoryDb.episodes = JSON.parse(JSON.stringify(targetProject.episodes));
    this.memoryDb.logs = JSON.parse(JSON.stringify(targetProject.logs));

    // Remove the loaded project from the archive list since it is now active
    this.memoryDb.projects.splice(targetProjectIndex, 1);

    this.saveToFile(this.memoryDb);
    return this.memoryDb;
  }

  public deleteProject(title: string): AppDatabase {
    if (!this.memoryDb.projects) return this.memoryDb;
    this.memoryDb.projects = this.memoryDb.projects.filter(p => p.title.toLowerCase() !== title.toLowerCase());
    this.saveToFile(this.memoryDb);
    return this.memoryDb;
  }
public updateLastSummary(summary: string): AppDatabase {
    this.memoryDb.lastSummary = summary;
    this.saveToFile(this.memoryDb);
    return this.memoryDb;
  }
}

export const dbInstance = new DatabaseRepository();
