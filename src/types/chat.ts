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

export interface SystemStatus {
  status: string;
  system: string;
  hasApiKey: boolean;
  model: string;
}
