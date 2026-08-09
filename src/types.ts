/**
 * Domain Models & Types for Fastory Story Engine
 */

export interface StoryBible {
  genre: string;
  universeName: string;
  storyStyle: string;
  narratorStyle: string;
  language: string;
  writingRules: string;
  episodeLength: number; // Target word count
  promptRules: string;
  tone: string;
  forbiddenRules: string;
  customInstructions: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  name: string;
  age: string;
  gender: string;
  occupation: string;
  personality: string;
  status: 'Alive' | 'Dead';
  relationships: string;
  biography: string;
  location: string;
  notes: string;
}

export interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  summary: string;
  wordCount: number;
  generationDate: string;
  status: 'Draft' | 'Published';
  promptUsed: string;
  aiProvider: string;
  modelUsed: string;
  content: string;
  outputFile?: string;
  coverUrl?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  isActive: boolean;
}

export interface DeliveryConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpTo: string;
  driveFolderId: string;
  
  // Google Drive OAuth Credentials
  driveClientId?: string;
  driveClientSecret?: string;
  driveRefreshToken?: string;
  
  outputFolder: string;
  backupFolder: string;
}

export interface SchedulerConfig {
  autoGenerate: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  customTime: string; // HH:MM
}

export interface GenerationLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  episodeNumber?: number;
}

export interface ArchivedProject {
  title: string;
  storyBible: StoryBible;
  characters: Character[];
  episodes: Episode[];
  logs: GenerationLog[];
  archivedAt: string;
}

export interface ContinuityIssue {
  id: string;
  type: 'FORBIDDEN_RULE' | 'CHARACTER_STATUS' | 'OTHER';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  ruleOrCharacter: string;
  snippet?: string;
  description: string;
  suggestion: string;
  ignored?: boolean;
}

export interface AppDatabase {
  storyBible: StoryBible;
  characters: Character[];
  episodes: Episode[];
  providers: AIProvider[];
  delivery: DeliveryConfig;
  scheduler: SchedulerConfig;
  logs: GenerationLog[];
  currentProjectTitle: string;
  projects: ArchivedProject[];
}