export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'audio';
  mimeType: string;
  size?: number;
  durationSec?: number;
  dataUrl: string; // for thumbnail/preview/audio playback: data:...
  base64Data: string; // clean base64 for Gemini inlineData
  textContent?: string; // if text-based document
  source?: 'local' | 'drive';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  groundingSources?: GroundingSource[];
  searchQueries?: string[];
  durationMs?: number;
  error?: boolean;
  feedback?: 'like' | 'dislike' | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  isArchived?: boolean;
  projectId?: string;
  tags?: string[];
}

export interface UserProfile {
  email?: string;
  name?: string;
  city?: string;
  humorPreference: boolean;
  technicalDepth: 'high' | 'balanced' | 'simple';
  autonomyDecisiveness: boolean;
  likedTopics: string[];
  dislikedTopics: string[];
  userVibe: 'humorous' | 'technical' | 'direct' | 'balanced';
  totalLikes: number;
  totalDislikes: number;
  notes: string[];
  slangTerms?: string[];
  slangCounts?: Record<string, number>;
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  dueAt?: number | null;
  completed: boolean;
  notifiedAt?: number;
  sourceConvId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CloudAccountSettings {
  theme?: ThemeMode;
  persona?: PersonaMode;
  useSearch?: boolean;
  responsePrefs?: Partial<ResponseCustomization>;
}

export interface ClientLocation {
  lat: number;
  lon: number;
  accuracy?: number;
  label?: string;
  city?: string;
  state?: string;
  country?: string;
  source?: 'gps' | 'ip';
}

export type PersonaMode = 'standard' | 'cyber' | 'code' | 'concise';

export type ThemeMode = 'simple' | 'cyber' | 'nebula';

export type AiVoiceId = 'Kore' | 'Zephyr' | 'Charon' | 'Fenrir';

export interface AiVoiceOption {
  id: AiVoiceId;
  label: string;
  gender: 'female' | 'male';
  genderLabel: string;
  style: string;
  fallbackPitch: number;
  fallbackRate: number;
}

export const AI_VOICE_OPTIONS: AiVoiceOption[] = [
  {
    id: 'Kore',
    label: 'Clara',
    gender: 'female',
    genderLabel: 'Feminina',
    style: 'Suave & natural',
    fallbackPitch: 1.06,
    fallbackRate: 1.03,
  },
  {
    id: 'Zephyr',
    label: 'Aura',
    gender: 'female',
    genderLabel: 'Feminina',
    style: 'Clara & expressiva',
    fallbackPitch: 1.15,
    fallbackRate: 1.06,
  },
  {
    id: 'Charon',
    label: 'Atlas',
    gender: 'male',
    genderLabel: 'Masculina',
    style: 'Grave & serena',
    fallbackPitch: 0.84,
    fallbackRate: 0.99,
  },
  {
    id: 'Fenrir',
    label: 'Orion',
    gender: 'male',
    genderLabel: 'Masculina',
    style: 'Firme & dinâmica',
    fallbackPitch: 0.94,
    fallbackRate: 1.05,
  },
];

export interface ResponseCustomization {
  tone: 'friendly' | 'professional' | 'creative' | 'didactic';
  length: 'short' | 'balanced' | 'detailed';
  format: 'rich' | 'bullets' | 'steps' | 'plain';
  useEmojis: boolean;
  fontSize: 'small' | 'medium' | 'large';
  voiceName?: AiVoiceId;
  customInstructions: string;
}

export interface SystemStatus {
  status: string;
  system: string;
  hasApiKey: boolean;
  model: string;
}
