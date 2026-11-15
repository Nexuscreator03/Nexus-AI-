import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { ArrowDown, BellRing, Check, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { WelcomeHero } from './components/WelcomeHero';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { AccountModal } from './components/AccountModal';
import { RemindersModal } from './components/RemindersModal';
import { NexusSite } from './components/NexusSite';
import { OfflineIndicator } from './components/OfflineIndicator';
import { exportConversationToPdf } from './utils/pdfExport';
import {
  Conversation,
  Message,
  PersonaMode,
  ThemeMode,
  Attachment,
  Project,
  Reminder,
  UserProfile,
  ClientLocation,
  ResponseCustomization,
} from './types/chat';
import { cyberAudio } from './utils/audio';
import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  pruneStorageToFreeSpace,
} from './utils/storage';
import {
  extractUserKnowledge,
  buildCrossConversationMemory,
  learnFromFeedback,
} from './utils/memory';
import { formatReminderDue, parseReminderBlockItems } from './utils/reminders';
import {
  subscribeToAuth,
  signInWithEmailAccount,
  signOutEmailAccount,
  loadCloudUserProfile,
  saveCloudUserProfile,
  loadCloudConversations,
  saveCloudConversation,
  deleteCloudConversation,
  loadCloudProjects,
  saveCloudProject,
  deleteCloudProject,
  loadCloudReminders,
  saveCloudReminder,
  deleteCloudReminder,
} from './firebase';

const STORAGE_KEY = 'nexus_conversations_v1';
const ACTIVE_CONV_KEY = 'nexus_active_conv_v1';
const THEME_KEY = 'nexus_theme_v1';
const PROJECTS_KEY = 'nexus_projects_v1';
const PROFILE_KEY = 'nexus_user_profile_v1';
const USE_SEARCH_KEY = 'nexus_use_search_v1';
const LOCATION_ENABLED_KEY = 'nexus_location_enabled_v1';
const LOCATION_CACHE_KEY = 'nexus_location_cache_v1';
const PERSONA_KEY = 'nexus_persona_v1';
const RESPONSE_PREFS_KEY = 'nexus_response_prefs_v1';
const REMINDERS_KEY = 'nexus_reminders_v1';

const DEFAULT_RESPONSE_PREFS: ResponseCustomization = {
  tone: 'friendly',
  length: 'balanced',
  format: 'rich',
  useEmojis: true,
  fontSize: 'medium',
  voiceName: 'Kore',
  customInstructions: '',
};

pruneStorageToFreeSpace();

const DEFAULT_PROJECTS: Project[] = [
  { id: 'proj-dev', name: 'Desenvolvimento', color: '#06b6d4', createdAt: Date.now() },
  { id: 'proj-estudos', name: 'Estudos & Ciência', color: '#a855f7', createdAt: Date.now() },
  { id: 'proj-geral', name: 'Geral & Ideias', color: '#10b981', createdAt: Date.now() },
];

const DEFAULT_PROFILE: UserProfile = {
  humorPreference: true,
  technicalDepth: 'high',
  autonomyDecisiveness: true,
  likedTopics: ['explicações claras', 'humor leve e amigável'],
  dislikedTopics: [],
  userVibe: 'humorous',
  totalLikes: 0,
  totalDislikes: 0,
  notes: [],
  slangTerms: [],
  slangCounts: {},
};

function mergeStringArrays(a: string[] = [], b: string[] = [], limit = 30): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...a, ...b]) {
    const clean = (item || '').trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
    if (result.length >= limit) break;
  }
  return result;
}

function safeParseConversations(raw: string | null): Conversation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c): c is Conversation => Boolean(c && typeof c === 'object' && typeof c.id === 'string'))
      .map((c) => ({
        ...c,
        title: typeof c.title === 'string' && c.title.trim() ? c.title : 'Conversa',
        messages: Array.isArray(c.messages)
          ? c.messages.filter(
              (m): m is Message =>
                Boolean(m && typeof m === 'object' && typeof m.id === 'string' && typeof m.content === 'string')
            )
          : [],
        createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      }));
  } catch (e) {
    console.error('Failed to parse conversations:', e);
    return [];
  }
}

function safeParseProjects(raw: string | null): Project[] {
  if (!raw) return DEFAULT_PROJECTS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROJECTS;
    const valid = parsed.filter(
      (p): p is Project =>
        Boolean(p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string')
    );
    return valid.length > 0 ? valid : DEFAULT_PROJECTS;
  } catch (e) {
    console.error('Failed to parse projects:', e);
    return DEFAULT_PROJECTS;
  }
}

function safeParseProfile(raw: string | null): UserProfile {
  if (!raw) return DEFAULT_PROFILE;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_PROFILE;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      likedTopics: Array.isArray(parsed.likedTopics) ? parsed.likedTopics : DEFAULT_PROFILE.likedTopics,
      dislikedTopics: Array.isArray(parsed.dislikedTopics) ? parsed.dislikedTopics : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      slangTerms: Array.isArray(parsed.slangTerms) ? parsed.slangTerms : [],
      slangCounts:
        parsed.slangCounts && typeof parsed.slangCounts === 'object' && !Array.isArray(parsed.slangCounts)
          ? parsed.slangCounts
          : {},
      totalLikes: typeof parsed.totalLikes === 'number' ? parsed.totalLikes : 0,
      totalDislikes: typeof parsed.totalDislikes === 'number' ? parsed.totalDislikes : 0,
    };
  } catch (e) {
    console.error('Failed to parse profile:', e);
    return DEFAULT_PROFILE;
  }
}

function safeParseReminders(raw: string | null): Reminder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Reminder => Boolean(r && typeof r === 'object' && typeof r.id === 'string' && typeof r.title === 'string'))
      .map((r) => ({
        ...r,
        title: r.title.trim().slice(0, 200),
        completed: Boolean(r.completed),
        dueAt: typeof r.dueAt === 'number' ? r.dueAt : null,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function safeParseResponsePrefs(raw: string | null): ResponseCustomization {
  if (!raw) return DEFAULT_RESPONSE_PREFS;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_RESPONSE_PREFS;
    }
    const validTones = new Set(['friendly', 'professional', 'creative', 'didactic']);
    const validLengths = new Set(['short', 'balanced', 'detailed']);
    const validFormats = new Set(['rich', 'bullets', 'steps', 'plain']);
    const validSizes = new Set(['small', 'medium', 'large']);
    const validVoices = new Set(['Kore', 'Zephyr', 'Charon', 'Fenrir']);
    return {
      tone: validTones.has(parsed.tone) ? parsed.tone : DEFAULT_RESPONSE_PREFS.tone,
      length: validLengths.has(parsed.length) ? parsed.length : DEFAULT_RESPONSE_PREFS.length,
      format: validFormats.has(parsed.format) ? parsed.format : DEFAULT_RESPONSE_PREFS.format,
      useEmojis: typeof parsed.useEmojis === 'boolean' ? parsed.useEmojis : DEFAULT_RESPONSE_PREFS.useEmojis,
      fontSize: validSizes.has(parsed.fontSize) ? parsed.fontSize : DEFAULT_RESPONSE_PREFS.fontSize,
      voiceName: validVoices.has(parsed.voiceName) ? parsed.voiceName : DEFAULT_RESPONSE_PREFS.voiceName,
      customInstructions:
        typeof parsed.customInstructions === 'string'
          ? parsed.customInstructions.slice(0, 240)
          : '',
    };
  } catch {
    return DEFAULT_RESPONSE_PREFS;
  }
}

function safeParseCachedLocation(raw: string | null): ClientLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number'
    ) {
      return parsed as ClientLocation;
    }
  } catch {}
  return null;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    safeParseConversations(safeGetItem(STORAGE_KEY))
  );

  const [projects, setProjects] = useState<Project[]>(() =>
    safeParseProjects(safeGetItem(PROJECTS_KEY))
  );

  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    safeParseProfile(safeGetItem(PROFILE_KEY))
  );

  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      const savedProfile = safeParseProfile(safeGetItem(PROFILE_KEY));
      if (savedProfile.email && savedProfile.email.trim()) {
        return null;
      }
      return safeGetItem(ACTIVE_CONV_KEY);
    } catch {
      return null;
    }
  });

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>(() => safeParseReminders(safeGetItem(REMINDERS_KEY)));
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [dueBannerReminders, setDueBannerReminders] = useState<Reminder[]>([]);

  const [thinkingConvIds, setThinkingConvIds] = useState<Set<string>>(() => new Set());
  const [streamingMsgIds, setStreamingMsgIds] = useState<Set<string>>(() => new Set());
  const isThinking = activeId ? thinkingConvIds.has(activeId) : false;
  const [useSearch, setUseSearch] = useState<boolean>(() => {
    return safeGetItem(USE_SEARCH_KEY) === 'true';
  });
  const [persona, setPersona] = useState<PersonaMode>(() => {
    const saved = safeGetItem(PERSONA_KEY);
    if (saved === 'standard' || saved === 'cyber' || saved === 'code' || saved === 'concise') {
      return saved;
    }
    return 'standard';
  });
  const [responsePrefs, setResponsePrefs] = useState<ResponseCustomization>(() =>
    safeParseResponsePrefs(safeGetItem(RESPONSE_PREFS_KEY))
  );
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = safeGetItem(THEME_KEY);
      if (saved === 'simple' || saved === 'cyber' || saved === 'nebula') {
        return saved;
      }
    } catch {}
    return 'cyber';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState<boolean>(() => {
    return safeGetItem(LOCATION_ENABLED_KEY) === 'true';
  });
  const [clientLocation, setClientLocation] = useState<ClientLocation | null>(() => {
    if (safeGetItem(LOCATION_ENABLED_KEY) !== 'true') return null;
    return safeParseCachedLocation(safeGetItem(LOCATION_CACHE_KEY));
  });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'active' | 'error'>(() => {
    if (safeGetItem(LOCATION_ENABLED_KEY) !== 'true') return 'idle';
    const cached = safeParseCachedLocation(safeGetItem(LOCATION_CACHE_KEY));
    return cached ? 'active' : 'loading';
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationEnabledRef = useRef(locationEnabled);
  locationEnabledRef.current = locationEnabled;

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const hasRegisteredEmail = Boolean(authUser?.email || (userProfile.email && userProfile.email.trim()));
  const [allowSiteWhenSignedIn, setAllowSiteWhenSignedIn] = useState(false);
  const [viewMode, setViewMode] = useState<'site' | 'chat'>(() => {
    const savedProfile = safeParseProfile(safeGetItem(PROFILE_KEY));
    if (savedProfile.email && savedProfile.email.trim()) {
      return 'chat';
    }
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat')) {
      return 'chat';
    }
    return 'site';
  });

  const [viewportBox, setViewportBox] = useState<{
    height: number | null;
    offsetTop: number;
    isKeyboardOpen: boolean;
  }>(() => {
    if (typeof window === 'undefined') {
      return { height: null, offsetTop: 0, isKeyboardOpen: false };
    }
    const vv = window.visualViewport;
    const height = vv ? Math.round(vv.height) : window.innerHeight;
    const offsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
    return { height, offsetTop, isKeyboardOpen: false };
  });

  const appShellRef = useRef<HTMLDivElement>(null);
  const mainColRef = useRef<HTMLDivElement>(null);
  const baselineHeightRef = useRef<number>(
    typeof window !== 'undefined'
      ? Math.round(window.visualViewport?.height || window.innerHeight)
      : 0
  );
  const lastWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );
  const pendingScrollToBottomRef = useRef(false);
  const syncViewportRef = useRef<(() => void) | null>(null);
  const userInteractedWithConvRef = useRef(false);
  const hasActiveChatContentRef = useRef(false);

  useEffect(() => {
    if (hasRegisteredEmail && viewMode !== 'chat' && !allowSiteWhenSignedIn) {
      setViewMode('chat');
      if (typeof window !== 'undefined' && window.location.pathname !== '/chat') {
        window.history.replaceState({}, '', '/chat');
      }
    }
  }, [hasRegisteredEmail, viewMode, allowSiteWhenSignedIn]);

  useEffect(() => {
    const handlePopState = () => {
      if ((hasRegisteredEmail && !allowSiteWhenSignedIn) || window.location.pathname.startsWith('/chat')) {
        setViewMode('chat');
      } else {
        setViewMode('site');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasRegisteredEmail, allowSiteWhenSignedIn]);

  // Dynamically bind app height & top to window.visualViewport so mobile virtual keyboard never clips Navbar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;
    let lastHeight = Math.round(window.visualViewport?.height || window.innerHeight);
    const timers: number[] = [];

    const resetAncestorScrolls = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement.scrollTop !== 0 || document.documentElement.scrollLeft !== 0) {
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
      }
      if (document.body.scrollTop !== 0 || document.body.scrollLeft !== 0) {
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      }
      const rootEl = document.getElementById('root');
      if (rootEl && (rootEl.scrollTop !== 0 || rootEl.scrollLeft !== 0)) {
        rootEl.scrollTop = 0;
        rootEl.scrollLeft = 0;
      }
      if (appShellRef.current && (appShellRef.current.scrollTop !== 0 || appShellRef.current.scrollLeft !== 0)) {
        appShellRef.current.scrollTop = 0;
        appShellRef.current.scrollLeft = 0;
      }
      if (mainColRef.current && (mainColRef.current.scrollTop !== 0 || mainColRef.current.scrollLeft !== 0)) {
        mainColRef.current.scrollTop = 0;
        mainColRef.current.scrollLeft = 0;
      }
    };

    const isTextInputFocused = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable;
    };

    const syncViewportMetrics = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const height = Math.round(vv ? vv.height : window.innerHeight);
        const offsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
        const width = window.innerWidth;

        if (Math.abs(width - lastWidthRef.current) > 40) {
          lastWidthRef.current = width;
          baselineHeightRef.current = height;
        } else if (!isTextInputFocused() || height >= baselineHeightRef.current) {
          baselineHeightRef.current = height;
        }

        const isKeyboardOpen = baselineHeightRef.current - height > 110;

        // Track if user was near bottom right as the keyboard shrinks the messages pane
        if (height < lastHeight - 80 && hasActiveChatContentRef.current) {
          const scroller = scrollContainerRef.current;
          if (scroller) {
            const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
            if (dist < 220) {
              pendingScrollToBottomRef.current = true;
            }
          }
        }
        lastHeight = height;

        setViewportBox((prev) =>
          prev.height === height &&
          prev.offsetTop === offsetTop &&
          prev.isKeyboardOpen === isKeyboardOpen
            ? prev
            : { height, offsetTop, isKeyboardOpen }
        );

        resetAncestorScrolls();
      });
    };

    const scheduleDelayedSync = () => {
      syncViewportMetrics();
      [80, 220, 420].forEach((delay) => {
        const id = window.setTimeout(syncViewportMetrics, delay);
        timers.push(id);
      });
    };

    syncViewportRef.current = scheduleDelayedSync;

    const handleCaptureScroll = (e: Event) => {
      const target = e.target;
      const rootEl = document.getElementById('root');
      if (
        target === document ||
        target === document.documentElement ||
        target === document.body ||
        target === rootEl ||
        target === appShellRef.current ||
        target === mainColRef.current
      ) {
        resetAncestorScrolls();
        syncViewportMetrics();
      }
    };

    const handleFocusOut = () => {
      // Allow baseline to restore cleanly once keyboard closes
      scheduleDelayedSync();
    };

    syncViewportMetrics();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', syncViewportMetrics);
      vv.addEventListener('scroll', syncViewportMetrics);
    }
    window.addEventListener('resize', syncViewportMetrics);
    window.addEventListener('orientationchange', scheduleDelayedSync);
    window.addEventListener('focusin', scheduleDelayedSync);
    window.addEventListener('focusout', handleFocusOut);
    document.addEventListener('scroll', handleCaptureScroll, true);

    return () => {
      syncViewportRef.current = null;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      timers.forEach((id) => window.clearTimeout(id));
      if (vv) {
        vv.removeEventListener('resize', syncViewportMetrics);
        vv.removeEventListener('scroll', syncViewportMetrics);
      }
      window.removeEventListener('resize', syncViewportMetrics);
      window.removeEventListener('orientationchange', scheduleDelayedSync);
      window.removeEventListener('focusin', scheduleDelayedSync);
      window.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('scroll', handleCaptureScroll, true);
    };
  }, []);

  useEffect(() => {
    if (!pendingScrollToBottomRef.current) return;
    pendingScrollToBottomRef.current = false;
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    if (!hasActiveChatContentRef.current) {
      scroller.scrollTop = 0;
      return;
    }
    scroller.scrollTop = scroller.scrollHeight;
  }, [viewportBox.height]);

  const navigateToView = (nextView: 'site' | 'chat') => {
    setViewMode(nextView);
    if (typeof window !== 'undefined') {
      const targetPath = nextView === 'chat' ? '/chat' : '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const latestConversationsRef = useRef<Conversation[]>(conversations);
  latestConversationsRef.current = conversations;
  const latestRemindersRef = useRef<Reminder[]>(reminders);
  latestRemindersRef.current = reminders;
  const syncedUidRef = useRef<string | null>(null);
  const cloudProfileLoadedRef = useRef<string | null>(null);
  const profileSyncTimerRef = useRef<number | null>(null);

  // Subscribe to Firebase Auth state & sync cloud memory, settings & reminders for logged-in email
  useEffect(() => {
    const unsub = subscribeToAuth(async (user) => {
      setAuthUser(user);
      if (!user) {
        syncedUidRef.current = null;
        cloudProfileLoadedRef.current = null;
        return;
      }

      if (syncedUidRef.current === user.uid) return;
      syncedUidRef.current = user.uid;

      if (!userInteractedWithConvRef.current && user.email) {
        setActiveId(null);
      }

      try {
        const [cloudProfile, cloudConvs, cloudProjs, cloudReminders] = await Promise.all([
          loadCloudUserProfile(user.uid).catch(() => null),
          loadCloudConversations(user.uid).catch(() => [] as Conversation[]),
          loadCloudProjects(user.uid).catch(() => [] as Project[]),
          loadCloudReminders(user.uid).catch(() => [] as Reminder[]),
        ]);

        const { accountSettings, ...cloudProfileFields } = cloudProfile || {};

        setUserProfile((local) => ({
          ...local,
          ...cloudProfileFields,
          email: user.email || cloudProfileFields?.email || local.email,
          name: cloudProfileFields?.name || local.name || user.displayName || undefined,
          city: cloudProfileFields?.city || local.city,
          likedTopics: mergeStringArrays(cloudProfileFields?.likedTopics, local.likedTopics, 30),
          dislikedTopics: mergeStringArrays(cloudProfileFields?.dislikedTopics, local.dislikedTopics, 30),
          notes: mergeStringArrays(cloudProfileFields?.notes, local.notes, 50),
          slangTerms: mergeStringArrays(cloudProfileFields?.slangTerms, local.slangTerms, 25),
          totalLikes: Math.max(cloudProfileFields?.totalLikes || 0, local.totalLikes || 0),
          totalDislikes: Math.max(cloudProfileFields?.totalDislikes || 0, local.totalDislikes || 0),
        }));

        if (accountSettings) {
          if (accountSettings.theme) {
            setTheme(accountSettings.theme);
          }
          if (accountSettings.persona) {
            setPersona(accountSettings.persona);
          }
          if (typeof accountSettings.useSearch === 'boolean') {
            setUseSearch(accountSettings.useSearch);
          }
          if (accountSettings.responsePrefs) {
            setResponsePrefs((local) => ({
              ...local,
              ...accountSettings.responsePrefs,
            }));
          }
        }

        const cloudIds = new Set(cloudConvs.map((c) => c.id));
        const localOnlyConvs = latestConversationsRef.current.filter((c) => !cloudIds.has(c.id));
        if (localOnlyConvs.length > 0) {
          localOnlyConvs.forEach((c) => saveCloudConversation(user.uid, c).catch(() => {}));
        }

        if (cloudConvs.length > 0) {
          setConversations((local) => {
            const byId = new Map<string, Conversation>();
            for (const c of local) byId.set(c.id, c);
            for (const c of cloudConvs) {
              const existing = byId.get(c.id);
              if (!existing || c.updatedAt >= existing.updatedAt) {
                byId.set(c.id, c);
              }
            }
            return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
          });
        }

        if (cloudProjs.length > 0) {
          setProjects((local) => {
            const byId = new Map<string, Project>();
            for (const p of local) byId.set(p.id, p);
            for (const p of cloudProjs) byId.set(p.id, p);
            return Array.from(byId.values());
          });
        }

        const cloudRemIds = new Set(cloudReminders.map((r) => r.id));
        const localOnlyReminders = latestRemindersRef.current.filter((r) => !cloudRemIds.has(r.id));
        if (localOnlyReminders.length > 0) {
          localOnlyReminders.forEach((r) => saveCloudReminder(user.uid, r).catch(() => {}));
        }
        if (cloudReminders.length > 0) {
          setReminders((local) => {
            const byId = new Map<string, Reminder>();
            for (const r of local) byId.set(r.id, r);
            for (const r of cloudReminders) {
              const existing = byId.get(r.id);
              if (!existing || r.updatedAt >= existing.updatedAt) {
                byId.set(r.id, { ...r, notifiedAt: existing?.notifiedAt });
              }
            }
            return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
          });
        }

        cloudProfileLoadedRef.current = user.uid;
      } catch (err) {
        console.warn('Cloud sync load warning:', err);
        cloudProfileLoadedRef.current = user.uid;
      }
    });

    return () => unsub();
  }, []);

  // Debounced cloud profile & account preferences save when signed in
  useEffect(() => {
    safeSetItem(PROFILE_KEY, JSON.stringify(userProfile));
    if (!authUser || cloudProfileLoadedRef.current !== authUser.uid) return;

    if (profileSyncTimerRef.current) {
      window.clearTimeout(profileSyncTimerRef.current);
    }
    profileSyncTimerRef.current = window.setTimeout(() => {
      saveCloudUserProfile(authUser, userProfile, {
        theme,
        persona,
        useSearch,
        responsePrefs,
      }).catch(() => {});
    }, 600);

    return () => {
      if (profileSyncTimerRef.current) {
        window.clearTimeout(profileSyncTimerRef.current);
      }
    };
  }, [userProfile, theme, persona, useSearch, responsePrefs, authUser]);

  // Persist reminders locally & check due alerts
  useEffect(() => {
    safeSetItem(REMINDERS_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const checkDueReminders = () => {
      const now = Date.now();
      const dueNow = latestRemindersRef.current.filter(
        (r) => !r.completed && typeof r.dueAt === 'number' && r.dueAt <= now && !r.notifiedAt
      );
      if (dueNow.length === 0) return;

      const dueIds = new Set(dueNow.map((r) => r.id));
      cyberAudio.playLike();

      setReminders((prev) =>
        prev.map((r) => (dueIds.has(r.id) ? { ...r, notifiedAt: now } : r))
      );

      setDueBannerReminders((prev) => {
        const existingIds = new Set(prev.map((x) => x.id));
        const additions = dueNow.filter((d) => !existingIds.has(d.id));
        return additions.length > 0 ? [...additions, ...prev].slice(0, 3) : prev;
      });

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        dueNow.slice(0, 2).forEach((r) => {
          try {
            new Notification('NEXUS AI · Lembrete', {
              body: r.title,
            });
          } catch {}
        });
      }
    };

    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    safeSetItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    safeSetItem(USE_SEARCH_KEY, useSearch ? 'true' : 'false');
  }, [useSearch]);

  useEffect(() => {
    safeSetItem(PERSONA_KEY, persona);
  }, [persona]);

  useEffect(() => {
    safeSetItem(RESPONSE_PREFS_KEY, JSON.stringify(responsePrefs));
  }, [responsePrefs]);

  useEffect(() => {
    safeSetItem(LOCATION_ENABLED_KEY, locationEnabled ? 'true' : 'false');
    if (!locationEnabled) {
      safeRemoveItem(LOCATION_CACHE_KEY);
    }
  }, [locationEnabled]);

  useEffect(() => {
    safeSetItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (streamingMsgIds.size > 0) return;
    try {
      const cleanConvs = conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((att) => ({
            id: att.id,
            name: att.name,
            type: att.type,
            mimeType: att.mimeType,
            size: att.size,
            durationSec: att.durationSec,
            source: att.source,
            dataUrl: att.dataUrl && att.dataUrl.length > 50000 ? '' : att.dataUrl,
            base64Data: '',
          })),
        })),
      }));
      safeSetItem(STORAGE_KEY, JSON.stringify(cleanConvs));
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  }, [conversations, streamingMsgIds]);

  useEffect(() => {
    if (activeId) {
      safeSetItem(ACTIVE_CONV_KEY, activeId);
    } else {
      safeRemoveItem(ACTIVE_CONV_KEY);
    }
  }, [activeId]);

  const isNearBottomRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (el) {
      if (behavior === 'auto') {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior });
      }
    }
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
  };

  const handleMessagesScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (!hasActiveChatContentRef.current) {
      isNearBottomRef.current = false;
      setShowScrollBottom(false);
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 180;
    setShowScrollBottom(distanceFromBottom > 160);
  };

  const activeConversation = conversations.find((c) => c.id === activeId) || null;
  const activeMessageCount = activeConversation?.messages.length ?? 0;
  const activeLastMessage = activeConversation?.messages[activeMessageCount - 1];
  const activeLastContentLength = activeLastMessage?.content.length ?? 0;
  const isLastMsgStreaming = Boolean(activeLastMessage && streamingMsgIds.has(activeLastMessage.id));
  hasActiveChatContentRef.current = activeMessageCount > 0 || isThinking;

  useEffect(() => {
    if (activeMessageCount > 0 || isThinking) {
      scrollToBottom('smooth');
    } else {
      pendingScrollToBottomRef.current = false;
      isNearBottomRef.current = false;
      setShowScrollBottom(false);
      const resetTop = () => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      };
      resetTop();
      const rafId = window.requestAnimationFrame(resetTop);
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [activeId, activeMessageCount, isThinking]);

  useEffect(() => {
    if (!isLastMsgStreaming || !isNearBottomRef.current) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeLastContentLength, isLastMsgStreaming]);

  const handleSignInAccount = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAccount();
    } catch (err: any) {
      setAuthError(err?.message || 'Não foi possível entrar com sua conta Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOutAccount = async () => {
    try {
      await signOutEmailAccount();
      setUserProfile((prev) => ({ ...prev, email: undefined }));
    } catch (err: any) {
      setAuthError(err?.message || 'Erro ao sair da conta.');
    }
  };

  const syncConvToCloud = (conv: Conversation) => {
    if (authUser) {
      saveCloudConversation(authUser.uid, conv).catch(() => {});
    }
  };

  // Real Location detection: GPS first -> reverse geocode -> automatic GeoIP fallback
  const resolveViaIpFallback = async (): Promise<ClientLocation | null> => {
    try {
      const res = await fetch('/api/location/ip');
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.lat === 'number' && typeof data.lon === 'number') {
        return {
          lat: data.lat,
          lon: data.lon,
          city: data.city,
          state: data.state,
          country: data.country,
          label:
            data.label ||
            `${data.city || 'Local'}, ${data.state || data.country || ''}`.replace(/,\s*$/, ''),
          source: 'ip',
        };
      }
    } catch {}
    return null;
  };

  const resolveCoordinates = async (
    lat: number,
    lon: number,
    accuracy?: number
  ): Promise<ClientLocation> => {
    try {
      const res = await fetch(`/api/location/reverse?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        return {
          lat,
          lon,
          accuracy,
          city: data.city,
          state: data.state,
          country: data.country,
          label: data.label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
          source: 'gps',
        };
      }
    } catch {}
    return {
      lat,
      lon,
      accuracy,
      label: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      source: 'gps',
    };
  };

  const applyResolvedLocation = (loc: ClientLocation) => {
    if (!locationEnabledRef.current) return;
    setClientLocation(loc);
    setLocationStatus('active');
    setLocationError(null);
    safeSetItem(LOCATION_CACHE_KEY, JSON.stringify(loc));
    if (loc.city) {
      setUserProfile((prev) => (prev.city === loc.city ? prev : { ...prev, city: loc.city }));
    }
  };

  const detectAndStoreLocation = async (silent = false) => {
    if (!silent) {
      setLocationStatus('loading');
      setLocationError(null);
    }

    const fallbackToIp = async () => {
      const ipLoc = await resolveViaIpFallback();
      if (!locationEnabledRef.current) return;
      if (ipLoc) {
        applyResolvedLocation(ipLoc);
      } else if (!silent) {
        setLocationStatus('error');
        setLocationError(
          'Não foi possível detectar sua localização automaticamente. Permita o GPS ou informe sua cidade no chat.'
        );
      }
    };

    // On silent startup restore, avoid triggering an unrequested browser GPS permission prompt
    let canQueryGps = 'geolocation' in navigator;
    if (silent && canQueryGps && navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (perm.state !== 'granted') {
          canQueryGps = false;
        }
      } catch {
        canQueryGps = false;
      }
    } else if (silent) {
      canQueryGps = false;
    }

    if (canQueryGps) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!locationEnabledRef.current) return;
          const resolved = await resolveCoordinates(
            Number(pos.coords.latitude.toFixed(5)),
            Number(pos.coords.longitude.toFixed(5)),
            Math.round(pos.coords.accuracy)
          );
          applyResolvedLocation(resolved);
        },
        fallbackToIp,
        { enableHighAccuracy: !silent, timeout: silent ? 3000 : 4500 }
      );
    } else {
      await fallbackToIp();
    }
  };

  // Auto-restore location on mount if user left it active previously
  useEffect(() => {
    if (locationEnabled) {
      detectAndStoreLocation(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleLocation = async () => {
    if (locationEnabled || clientLocation || locationStatus === 'active' || locationStatus === 'loading') {
      locationEnabledRef.current = false;
      setLocationEnabled(false);
      setClientLocation(null);
      setLocationStatus('idle');
      setLocationError(null);
      safeSetItem(LOCATION_ENABLED_KEY, 'false');
      safeRemoveItem(LOCATION_CACHE_KEY);
      return;
    }

    locationEnabledRef.current = true;
    setLocationEnabled(true);
    safeSetItem(LOCATION_ENABLED_KEY, 'true');
    await detectAndStoreLocation(false);
  };

  const handleNewConversation = () => {
    userInteractedWithConvRef.current = true;
    pendingScrollToBottomRef.current = false;
    isNearBottomRef.current = false;
    setShowScrollBottom(false);
    setActiveId(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    });
  };

  const handleDeleteConversation = (id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
      setThinkingConvIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
    if (authUser) {
      deleteCloudConversation(authUser.uid, id).catch(() => {});
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, title: newTitle, updatedAt: Date.now() };
        syncConvToCloud(updated);
        return updated;
      })
    );
  };

  const handleToggleFavorite = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() };
        syncConvToCloud(updated);
        return updated;
      })
    );
  };

  const handleToggleArchive = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, isArchived: !c.isArchived, updatedAt: Date.now() };
        syncConvToCloud(updated);
        return updated;
      })
    );
  };

  const handleSetProject = (id: string, projectId?: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, projectId, updatedAt: Date.now() };
        syncConvToCloud(updated);
        return updated;
      })
    );
  };

  const handleCreateProject = (name: string, color: string, conversationIds?: string[]) => {
    const newProj: Project = {
      id: 'proj-' + Date.now(),
      name,
      color,
      createdAt: Date.now(),
    };
    setProjects((prev) => [...prev, newProj]);
    if (authUser) {
      saveCloudProject(authUser.uid, newProj).catch(() => {});
    }
    if (conversationIds && conversationIds.length > 0) {
      setConversations((prev) =>
        prev.map((c) => {
          if (!conversationIds.includes(c.id)) return c;
          const updated = { ...c, projectId: newProj.id, updatedAt: Date.now() };
          syncConvToCloud(updated);
          return updated;
        })
      );
    }
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (authUser) {
      deleteCloudProject(authUser.uid, id).catch(() => {});
    }
    setConversations((prev) =>
      prev.map((c) => {
        if (c.projectId !== id) return c;
        const updated = { ...c, projectId: undefined };
        syncConvToCloud(updated);
        return updated;
      })
    );
  };

  const handleAddReminder = (input: {
    title: string;
    dueAt?: number | null;
    notes?: string;
    sourceConvId?: string;
  }) => {
    const cleanTitle = (input.title || '').trim().slice(0, 200);
    if (!cleanTitle) return;

    const existing = latestRemindersRef.current.find(
      (r) => !r.completed && r.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    );
    if (existing) return;

    const now = Date.now();
    const newRem: Reminder = {
      id: 'rem-' + now + '-' + Math.random().toString(36).slice(2, 6),
      title: cleanTitle,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 500) : undefined,
      dueAt: typeof input.dueAt === 'number' ? input.dueAt : null,
      completed: false,
      sourceConvId: input.sourceConvId,
      createdAt: now,
      updatedAt: now,
    };

    setReminders((prev) => [newRem, ...prev]);
    if (authUser) {
      saveCloudReminder(authUser.uid, newRem).catch(() => {});
    }
  };

  const handleToggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated: Reminder = {
          ...r,
          completed: !r.completed,
          updatedAt: Date.now(),
        };
        if (authUser) {
          saveCloudReminder(authUser.uid, updated).catch(() => {});
        }
        return updated;
      })
    );
    setDueBannerReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setDueBannerReminders((prev) => prev.filter((r) => r.id !== id));
    if (authUser) {
      deleteCloudReminder(authUser.uid, id).catch(() => {});
    }
  };

  const handleClearCompletedReminders = () => {
    const completedIds = reminders.filter((r) => r.completed).map((r) => r.id);
    if (completedIds.length === 0) return;
    setReminders((prev) => prev.filter((r) => !r.completed));
    if (authUser) {
      completedIds.forEach((id) => deleteCloudReminder(authUser.uid, id).catch(() => {}));
    }
  };

  const handleClearAll = (type: 'all' | 'archived' = 'all') => {
    if (type === 'archived') {
      const toDelete = conversations.filter((c) => c.isArchived);
      toDelete.forEach((c) => {
        abortControllersRef.current.get(c.id)?.abort();
        abortControllersRef.current.delete(c.id);
      });
      setThinkingConvIds((prev) => {
        const next = new Set(prev);
        toDelete.forEach((c) => next.delete(c.id));
        return next;
      });
      setConversations((prev) => prev.filter((c) => !c.isArchived));
      if (activeConversation?.isArchived) {
        setActiveId(null);
      }
      if (authUser) {
        toDelete.forEach((c) => deleteCloudConversation(authUser.uid, c.id).catch(() => {}));
      }
    } else {
      const toDelete = [...conversations];
      abortControllersRef.current.forEach((ctrl) => ctrl.abort());
      abortControllersRef.current.clear();
      setThinkingConvIds(new Set());
      setConversations([]);
      setActiveId(null);
      if (authUser) {
        toDelete.forEach((c) => deleteCloudConversation(authUser.uid, c.id).catch(() => {}));
      }
    }
  };

  const handleFeedback = (messageId: string, feedback: 'like' | 'dislike' | null) => {
    let targetMsg: Message | undefined;
    let prevFeedback: 'like' | 'dislike' | null | undefined;
    let precedingUserMsg: Message | undefined;

    for (const conv of conversations) {
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        targetMsg = conv.messages[idx];
        prevFeedback = targetMsg.feedback;
        for (let j = idx - 1; j >= 0; j--) {
          if (conv.messages[j].role === 'user') {
            precedingUserMsg = conv.messages[j];
            break;
          }
        }
        break;
      }
    }

    setConversations((prev) =>
      prev.map((conv) => {
        if (!conv.messages.some((m) => m.id === messageId)) return conv;
        const updatedConv: Conversation = {
          ...conv,
          messages: conv.messages.map((m) => (m.id === messageId ? { ...m, feedback } : m)),
        };
        syncConvToCloud(updatedConv);
        return updatedConv;
      })
    );

    if (targetMsg) {
      setUserProfile((prev) =>
        learnFromFeedback(targetMsg!.content, precedingUserMsg?.content, feedback, prevFeedback, prev)
      );
    }
  };

  const handleExportChat = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;

    let md = `# Conversa com NEXUS AI - ${activeConversation.title}\n`;
    md += `Data: ${new Date(activeConversation.createdAt).toLocaleString()}\n\n---\n\n`;

    activeConversation.messages.forEach((m) => {
      const sender = m.role === 'user' ? '👤 Usuário' : '⚡ NEXUS AI';
      const time = new Date(m.timestamp).toLocaleTimeString();
      md += `### ${sender} (${time})\n\n${m.content}\n\n`;
      if (m.groundingSources && m.groundingSources.length > 0) {
        md += `#### Fontes Pesquisadas:\n`;
        m.groundingSources.forEach((s) => {
          md += `- [${s.title}](${s.uri})\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus-ai-${activeConversation.title.slice(0, 20).replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    exportConversationToPdf(activeConversation);
  };

  const handleSendMessage = async (
    content: string,
    attachments?: Attachment[],
    searchOverride?: boolean,
    personaOverride?: PersonaMode,
    forceNewConv?: boolean,
    retryTarget?: { convId: string; baseMessages: Message[] }
  ) => {
    const hasAttachments = Boolean(attachments && attachments.length > 0);
    const trimmed = content.trim();
    if (!trimmed && !hasAttachments) return;

    const effectiveTargetId = retryTarget?.convId || (forceNewConv ? null : activeId);
    if (effectiveTargetId && thinkingConvIds.has(effectiveTargetId)) return;

    const effectiveSearch = searchOverride !== undefined ? searchOverride : useSearch;
    const effectivePersona = personaOverride || persona;

    const fallbackText = hasAttachments
      ? attachments![0].type === 'audio'
        ? 'Mensagem de áudio enviada'
        : attachments![0].type === 'image'
        ? 'Analise esta imagem'
        : 'Analise este arquivo'
      : '';

    const finalContent = trimmed || fallbackText;

    // Automatically learn user facts & preferences from message
    const updatedProfile = extractUserKnowledge(finalContent, {
      ...userProfile,
      email: authUser?.email || userProfile.email,
    });
    if (updatedProfile !== userProfile) {
      setUserProfile(updatedProfile);
    }

    const userMsg: Message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      role: 'user',
      content: finalContent,
      timestamp: Date.now(),
      attachments: hasAttachments ? attachments : undefined,
    };

    userInteractedWithConvRef.current = true;

    let targetConvId = effectiveTargetId;
    let currentMessages: Message[] = [];
    let convSnapshot: Conversation | null = null;

    if (!targetConvId || !latestConversationsRef.current.some((c) => c.id === targetConvId)) {
      const newId = 'conv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
      const titleRaw = finalContent || (hasAttachments ? attachments![0].name : 'Nova Conversa');
      const newTitle = titleRaw.length > 38 ? titleRaw.slice(0, 38) + '...' : titleRaw;
      const newConv: Conversation = {
        id: newId,
        title: newTitle,
        messages: [userMsg],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newId);
      targetConvId = newId;
      currentMessages = [userMsg];
      convSnapshot = newConv;
    } else {
      const existingConv = latestConversationsRef.current.find((c) => c.id === targetConvId);
      const baseMessages = retryTarget ? retryTarget.baseMessages : existingConv?.messages || [];
      currentMessages = [...baseMessages, userMsg];
      if (existingConv) {
        convSnapshot = {
          ...existingConv,
          messages: currentMessages,
          updatedAt: Date.now(),
        };
      }
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          return {
            ...c,
            messages: currentMessages,
            updatedAt: Date.now(),
          };
        })
      );
    }

    if (convSnapshot) {
      syncConvToCloud(convSnapshot);
    }

    const activeConvKey = targetConvId!;
    const streamingMsgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    let targetBuffer = '';
    let revealedLength = 0;
    let placeholderInserted = false;
    let revealTimerId: number | null = null;

    const markStreamingActive = (active: boolean) => {
      setStreamingMsgIds((prev) => {
        const has = prev.has(streamingMsgId);
        if (active && has) return prev;
        if (!active && !has) return prev;
        const next = new Set(prev);
        if (active) next.add(streamingMsgId);
        else next.delete(streamingMsgId);
        return next;
      });
    };

    const upsertStreamingMessage = (textValue: string) => {
      if (!textValue) return;
      placeholderInserted = true;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvKey) return c;
          const exists = c.messages.some((m) => m.id === streamingMsgId);
          const nextMessages = exists
            ? c.messages.map((m) => (m.id === streamingMsgId ? { ...m, content: textValue } : m))
            : [
                ...c.messages,
                {
                  id: streamingMsgId,
                  role: 'model' as const,
                  content: textValue,
                  timestamp: Date.now(),
                },
              ];
          return {
            ...c,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
        })
      );
    };

    const stopRevealLoop = () => {
      if (revealTimerId !== null) {
        window.cancelAnimationFrame(revealTimerId);
        revealTimerId = null;
      }
    };

    const enqueueStreamText = (fullAccumulated: string) => {
      targetBuffer = fullAccumulated;
      if (!targetBuffer) return;
      markStreamingActive(true);
      if (revealTimerId === null) {
        revealTimerId = window.requestAnimationFrame(() => {
          revealTimerId = null;
          if (targetBuffer.length > revealedLength) {
            revealedLength = targetBuffer.length;
            upsertStreamingMessage(targetBuffer);
          }
        });
      }
    };

    const flushRemainingWords = async (finalFullText: string, signal: AbortSignal) => {
      targetBuffer = finalFullText;
      stopRevealLoop();
      if (signal.aborted || !targetBuffer) return;
      if (revealedLength < targetBuffer.length) {
        revealedLength = targetBuffer.length;
        upsertStreamingMessage(targetBuffer);
      }
    };

    setThinkingConvIds((prev) => {
      const next = new Set(prev);
      next.add(activeConvKey);
      return next;
    });
    cyberAudio.playNeuralPulse();

    abortControllersRef.current.get(activeConvKey)?.abort();
    const controller = new AbortController();
    abortControllersRef.current.set(activeConvKey, controller);

    try {
      const now = new Date();
      const days = [
        'domingo',
        'segunda-feira',
        'terça-feira',
        'quarta-feira',
        'quinta-feira',
        'sexta-feira',
        'sábado',
      ];
      const clientTime = {
        iso: now.toISOString(),
        formatted: now.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'medium' }),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        dayOfWeek: days[now.getDay()],
      };

      // Build global cross-conversation memory context from ALL other chats
      const globalMemoryContext = buildCrossConversationMemory(
        finalContent,
        latestConversationsRef.current,
        activeConvKey
      );

      const recentMessages = currentMessages.slice(-24);
      const formattedHistory = recentMessages.map((m, idx) => {
        const keepBinaryData = idx >= recentMessages.length - 2;
        return {
          role: m.role,
          content: m.content,
          attachments: m.attachments?.map((att) => ({
            id: att.id,
            name: att.name,
            type: att.type,
            mimeType: att.mimeType,
            base64Data: keepBinaryData ? att.base64Data : undefined,
            textContent:
              att.textContent ||
              (!keepBinaryData && att.base64Data
                ? att.type === 'audio'
                  ? '[Áudio enviado anteriormente]'
                  : att.type === 'image'
                  ? '[Imagem enviada anteriormente]'
                  : '[Arquivo enviado anteriormente]'
                : undefined),
          })),
        };
      });

      const hasPastConversations = latestConversationsRef.current.some(
        (c) => c.id !== activeConvKey && c.messages && c.messages.length > 0
      );

      const activeRemindersPayload = latestRemindersRef.current
        .filter((r) => !r.completed)
        .slice(0, 15)
        .map((r) => ({
          title: r.title,
          dueAt: r.dueAt || null,
          dueFormatted: r.dueAt ? formatReminderDue(r.dueAt) : undefined,
        }));

      const requestBody = JSON.stringify({
        messages: formattedHistory,
        useSearch: effectiveSearch,
        systemPersona: effectivePersona,
        turboMode: true,
        clientTime,
        clientLocation,
        userProfile: updatedProfile,
        responsePrefs,
        reminders: activeRemindersPayload,
        globalMemoryContext,
        hasPastConversations,
      });

      const fetchFallbackJsonChat = async () => {
        const jsonRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: requestBody,
        });
        if (!jsonRes.ok) {
          const errJson = await jsonRes.json().catch(() => ({}));
          throw new Error(errJson.error || errJson.details || `Erro do servidor (${jsonRes.status})`);
        }
        return jsonRes.json();
      };

      let finalText = '';
      let finalSources: any[] = [];
      let finalQueries: string[] = [];
      let finalDurationMs: number | undefined;
      let streamAccumulated = '';
      let needJsonFallback = false;
      let streamErrorMsg: string | null = null;

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: requestBody,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          streamErrorMsg = errorData.error || errorData.details || `Erro do servidor (${res.status})`;
          needJsonFallback = true;
        } else {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('text/event-stream') || !res.body) {
            const data = await res.json();
            finalText = data.text || '';
            finalSources = data.groundingSources || [];
            finalQueries = data.webSearchQueries || [];
            finalDurationMs = data.durationMs;
            if (!finalText.trim()) {
              needJsonFallback = true;
            }
          } else {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';
            let finalMeta: any = null;

            const processSseEvent = (rawEvent: string) => {
              const dataLines = rawEvent
                .split(/\r?\n/)
                .filter((l) => l.startsWith('data:'))
                .map((l) => l.slice(5).trim());

              for (const rawJson of dataLines) {
                if (!rawJson) continue;
                try {
                  const parsed = JSON.parse(rawJson);
                  if (parsed.type === 'reset') {
                    streamAccumulated = '';
                    targetBuffer = '';
                    revealedLength = 0;
                    streamErrorMsg = null;
                  } else if (parsed.type === 'chunk' && typeof parsed.text === 'string' && parsed.text.length > 0) {
                    streamAccumulated += parsed.text;
                    enqueueStreamText(streamAccumulated);
                  } else if (parsed.type === 'done') {
                    finalMeta = parsed;
                  } else if (parsed.type === 'error') {
                    streamErrorMsg = parsed.error || 'Erro ao processar transmissão neural.';
                  }
                } catch {}
              }
            };

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              sseBuffer += decoder.decode(value, { stream: true });
              const rawEvents = sseBuffer.split(/\r?\n\r?\n/);
              sseBuffer = rawEvents.pop() || '';
              for (const rawEvent of rawEvents) {
                processSseEvent(rawEvent);
              }
            }
            if (sseBuffer.trim()) {
              processSseEvent(sseBuffer);
            }

            if ((streamErrorMsg && !streamAccumulated.trim()) || (!finalMeta?.text?.trim() && !streamAccumulated.trim())) {
              needJsonFallback = true;
            } else {
              finalText = (finalMeta?.text && finalMeta.text.trim()) || streamAccumulated;
              finalSources = finalMeta?.groundingSources || [];
              finalQueries = finalMeta?.webSearchQueries || [];
              finalDurationMs = finalMeta?.durationMs;
            }
          }
        }
      } catch (streamErr: any) {
        if (streamErr?.name === 'AbortError') {
          throw streamErr;
        }
        streamErrorMsg = streamErr?.message || null;
        if (!streamAccumulated.trim()) {
          needJsonFallback = true;
        } else {
          finalText = streamAccumulated;
        }
      }

      if (needJsonFallback) {
        try {
          const data = await fetchFallbackJsonChat();
          finalText = data.text || '';
          finalSources = data.groundingSources || [];
          finalQueries = data.webSearchQueries || [];
          finalDurationMs = data.durationMs;
        } catch (fallbackErr: any) {
          if (fallbackErr?.name === 'AbortError') throw fallbackErr;
          throw new Error(fallbackErr?.message || streamErrorMsg || 'Erro temporário de conexão com o NEXUS AI.');
        }
      }

      if (!finalText.trim()) {
        throw new Error(streamErrorMsg || 'Nenhuma resposta recebida do núcleo neural.');
      }

      // Smoothly flush any remaining buffered words word-by-word before finalizing card
      await flushRemainingWords(finalText, controller.signal);
      if (controller.signal.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      }

      const modelMsg: Message = {
        id: streamingMsgId,
        role: 'model',
        content: finalText,
        timestamp: Date.now(),
        groundingSources: finalSources,
        searchQueries: finalQueries,
        durationMs: finalDurationMs,
      };

      markStreamingActive(false);
      cyberAudio.playReceive();

      // Auto-sync reminder cards when user explicitly asked NEXUS AI to set a reminder
      if (/\b(me\s+lembr[ae]|cri[ae]\s+(?:um\s+)?lembrete|anot[ae]\s+(?:um\s+)?lembrete|agenda(?:r)?\s+(?:um\s+)?lembrete|avisa(?:r)?\s+(?:eu|me))\b/i.test(finalContent)) {
        const reminderMatches = Array.from(
          finalText.matchAll(/```(?:reminder|lembrete)\r?\n([\s\S]*?)```/gi)
        );
        for (const rm of reminderMatches) {
          const parsedItems = parseReminderBlockItems(rm[1] || '');
          for (const item of parsedItems.slice(0, 5)) {
            handleAddReminder({
              title: item.title,
              dueAt: item.dueAt,
              notes: item.notes,
              sourceConvId: activeConvKey,
            });
          }
        }
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvKey) return c;
          const exists = c.messages.some((m) => m.id === streamingMsgId);
          const nextMessages = exists
            ? c.messages.map((m) => (m.id === streamingMsgId ? modelMsg : m))
            : [...c.messages, modelMsg];
          const updated = {
            ...c,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
          syncConvToCloud(updated);
          return updated;
        })
      );
    } catch (err: any) {
      stopRevealLoop();
      markStreamingActive(false);

      if (err?.name === 'AbortError') {
        if (placeholderInserted && revealedLength > 0) {
          const partialText = targetBuffer.slice(0, revealedLength);
          if (partialText.trim().length > 0) {
            upsertStreamingMessage(partialText);
            const targetConv = latestConversationsRef.current.find((c) => c.id === activeConvKey);
            if (targetConv) {
              syncConvToCloud(targetConv);
            }
          }
        }
        return;
      }
      console.error('Chat error:', err);
      cyberAudio.playError();
      const errorMsg: Message = {
        id: placeholderInserted ? streamingMsgId : 'msg-err-' + Date.now(),
        role: 'model',
        content:
          err?.message ||
          'Não foi possível estabelecer contato com os servidores neurais do NEXUS AI. Tente novamente em alguns segundos.',
        timestamp: Date.now(),
        error: true,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvKey) return c;
          const exists = placeholderInserted && c.messages.some((m) => m.id === streamingMsgId);
          const nextMessages = exists
            ? c.messages.map((m) => (m.id === streamingMsgId ? errorMsg : m))
            : [...c.messages, errorMsg];
          const updated = {
            ...c,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
          syncConvToCloud(updated);
          return updated;
        })
      );
    } finally {
      stopRevealLoop();
      markStreamingActive(false);
      if (abortControllersRef.current.get(activeConvKey) === controller) {
        abortControllersRef.current.delete(activeConvKey);
        setThinkingConvIds((prev) => {
          if (!prev.has(activeConvKey)) return prev;
          const next = new Set(prev);
          next.delete(activeConvKey);
          return next;
        });
      }
    }
  };

  const handleStopGeneration = () => {
    if (!activeId) return;
    const controller = abortControllersRef.current.get(activeId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(activeId);
    }
    setThinkingConvIds((prev) => {
      if (!prev.has(activeId)) return prev;
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
  };

  const handlePollVote = (question: string, option: string) => {
    handleSendMessage(`Minha escolha na enquete ("${question}"): **${option}**`);
  };

  const handleRetryLast = () => {
    if (!activeConversation || isThinking) return;
    const msgs = [...activeConversation.messages];
    while (msgs.length > 0 && msgs[msgs.length - 1].error) {
      msgs.pop();
    }
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = msgs.length - 1 - lastUserIdx;
    const lastUserMsg = msgs[actualIdx];
    const baseMessages = msgs.slice(0, actualIdx);
    handleSendMessage(
      lastUserMsg.content,
      lastUserMsg.attachments,
      undefined,
      undefined,
      false,
      { convId: activeConversation.id, baseMessages }
    );
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!activeConversation || isThinking) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId && m.role === 'user');
    if (idx === -1) return;
    const targetMsg = activeConversation.messages[idx];
    const baseMessages = activeConversation.messages.slice(0, idx);
    handleSendMessage(
      newContent,
      targetMsg.attachments,
      undefined,
      undefined,
      false,
      { convId: activeConversation.id, baseMessages }
    );
  };

  const handleRegenerateMessage = (messageId: string) => {
    if (!activeConversation || isThinking) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId && m.role === 'model');
    if (idx === -1) return;
    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (activeConversation.messages[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;
    const userMsg = activeConversation.messages[userIdx];
    const baseMessages = activeConversation.messages.slice(0, userIdx);
    handleSendMessage(
      userMsg.content,
      userMsg.attachments,
      undefined,
      undefined,
      false,
      { convId: activeConversation.id, baseMessages }
    );
  };

  const handleEnterChatFromSite = (initialPrompt?: string, selectedPersona?: PersonaMode) => {
    if (selectedPersona) {
      setPersona(selectedPersona);
    }
    setAllowSiteWhenSignedIn(false);
    navigateToView('chat');
    if (initialPrompt && initialPrompt.trim()) {
      handleSendMessage(initialPrompt.trim(), undefined, undefined, selectedPersona, true);
    }
  };

  const viewportStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    top: `${viewportBox.offsetTop}px`,
    height: viewportBox.height ? `${viewportBox.height}px` : '100dvh',
  };

  const handleSaveEmailFromSite = (email: string) => {
    setUserProfile((prev) => ({ ...prev, email }));
    setActiveId(null);
    setAllowSiteWhenSignedIn(false);
    navigateToView('chat');
  };

  const handleSignInFromSite = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAccount();
      setActiveId(null);
      setAllowSiteWhenSignedIn(false);
      navigateToView('chat');
    } catch (err: any) {
      setAuthError(err?.message || 'Não foi possível entrar com sua conta Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (viewMode === 'site' && (!hasRegisteredEmail || allowSiteWhenSignedIn)) {
    return (
      <>
        <OfflineIndicator />
        <NexusSite
          theme={theme}
          onEnterChat={handleEnterChatFromSite}
          onSaveEmail={handleSaveEmailFromSite}
          onSignInWithGoogle={handleSignInFromSite}
          isReturningAccount={hasRegisteredEmail}
          isAuthLoading={isAuthLoading}
          authError={authError}
          viewportStyle={viewportStyle}
        />
      </>
    );
  }

  const lastMessage = activeConversation?.messages[activeConversation.messages.length - 1];
  const isActivelyStreamingText = Boolean(
    isThinking &&
      lastMessage &&
      lastMessage.role === 'model' &&
      !lastMessage.error &&
      (streamingMsgIds.has(lastMessage.id) || lastMessage.content.length > 0)
  );

  return (
    <div
      ref={appShellRef}
      style={viewportStyle}
      className={`flex w-full max-w-full overflow-clip text-slate-100 select-text ${
        theme === 'simple'
          ? 'theme-simple'
          : theme === 'nebula'
          ? 'theme-nebula'
          : 'theme-cyber'
      }`}
    >
      <OfflineIndicator />
      {/* Ultra-Futuristic Cyber Holographic Ambience */}
      {theme === 'cyber' && (
        <>
          <div className="cyber-grid absolute inset-0 pointer-events-none opacity-65" />
          <div className="absolute -top-24 left-1/4 w-[28rem] h-[28rem] bg-cyan-500/15 rounded-full blur-[130px] pointer-events-none animate-cyber-sweep" />
          <div className="absolute -bottom-24 right-1/4 w-[30rem] h-[30rem] bg-blue-600/18 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent pointer-events-none" />
          <div className="scanlines absolute inset-0 z-10 pointer-events-none opacity-35" />
        </>
      )}

      {theme === 'nebula' && (
        <>
          <div className="nebula-grid absolute inset-0 pointer-events-none opacity-45" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[130px] pointer-events-none animate-nebula-aura" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/12 rounded-full blur-[150px] pointer-events-none animate-nebula-aura" />
          <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
        </>
      )}

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onGoHome={() => {
          setIsAccountOpen(false);
          setAllowSiteWhenSignedIn(true);
          navigateToView('site');
        }}
        authUser={authUser}
        isAuthLoading={isAuthLoading}
        authError={authError}
        onSignIn={handleSignInAccount}
        onSignOut={handleSignOutAccount}
        userProfile={userProfile}
        onUpdateProfile={(updater) => setUserProfile((prev) => updater(prev))}
        responsePrefs={responsePrefs}
        onUpdateResponsePrefs={(updater) => setResponsePrefs((prev) => updater(prev))}
        onResetResponsePrefs={() => setResponsePrefs(DEFAULT_RESPONSE_PREFS)}
        theme={theme}
      />

      <RemindersModal
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        reminders={reminders}
        onAddReminder={handleAddReminder}
        onToggleReminder={handleToggleReminder}
        onDeleteReminder={handleDeleteReminder}
        onClearCompleted={handleClearCompletedReminders}
        theme={theme}
        isSynced={Boolean(authUser)}
      />

      {dueBannerReminders.length > 0 && (
        <div className="fixed top-16 right-3 sm:right-5 z-50 w-72 sm:w-80 space-y-2 animate-fadeIn">
          {dueBannerReminders.map((rem) => (
            <div
              key={rem.id}
              className="rounded-xl border border-amber-400/70 bg-[#0b1326]/95 backdrop-blur-md p-3 shadow-[0_0_24px_rgba(245,158,11,0.3)] flex items-start gap-2.5"
            >
              <BellRing className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-semibold">
                  Lembrete no horário
                </p>
                <p className="text-xs font-medium text-white break-words mt-0.5">{rem.title}</p>
                <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => handleToggleReminder(rem.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/40"
                  >
                    <Check className="w-3 h-3" />
                    <span>Concluir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRemindersOpen(true);
                      setDueBannerReminders((prev) => prev.filter((x) => x.id !== rem.id));
                    }}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-slate-200"
                  >
                    Abrir
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDueBannerReminders((prev) => prev.filter((x) => x.id !== rem.id))}
                className="text-slate-400 hover:text-white shrink-0"
                title="Dispensar alerta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={(id) => {
          userInteractedWithConvRef.current = true;
          setActiveId(id);
        }}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onToggleFavorite={handleToggleFavorite}
        onToggleArchive={handleToggleArchive}
        onSetProject={handleSetProject}
        projects={projects}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onClearAll={handleClearAll}
        onExportChat={handleExportChat}
        onExportPdf={handleExportPdf}
        hasActiveMessages={Boolean(activeConversation && activeConversation.messages.length > 0)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        persona={persona}
        onPersonaChange={setPersona}
        theme={theme}
        onThemeChange={setTheme}
        userProfile={userProfile}
        authUser={authUser}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenReminders={() => setIsRemindersOpen(true)}
        pendingRemindersCount={reminders.filter((r) => !r.completed).length}
        overdueRemindersCount={reminders.filter((r) => !r.completed && r.dueAt && r.dueAt <= Date.now()).length}
      />

      <div
        ref={mainColRef}
        className="flex-1 flex flex-col min-w-0 min-h-0 w-full max-w-full overflow-clip h-full relative z-20"
      >
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewConversation={handleNewConversation}
          onExportChat={handleExportChat}
          onExportPdf={handleExportPdf}
          hasActiveMessages={Boolean(activeConversation && activeConversation.messages.length > 0)}
          useSearch={useSearch}
          onToggleSearch={() => setUseSearch(!useSearch)}
          theme={theme}
          onThemeChange={setTheme}
          onOpenSite={hasRegisteredEmail ? undefined : () => navigateToView('site')}
        />

        <div className="relative flex-1 min-h-0 flex flex-col min-w-0 overflow-clip">
          <div
            ref={scrollContainerRef}
            onScroll={handleMessagesScroll}
            className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 sm:px-6 md:px-8 scrollbar-thin min-w-0 ${
              !activeConversation || activeConversation.messages.length === 0
                ? 'py-0'
                : 'py-4 space-y-4'
            }`}
          >
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <WelcomeHero
                onSelectPrompt={(prompt, enableSearch) => {
                  handleSendMessage(prompt, undefined, enableSearch ? true : undefined);
                }}
                theme={theme}
              />
            ) : (
              <div className="max-w-4xl mx-auto space-y-2 min-w-0 w-full">
                {activeConversation.messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onRetry={message.error ? handleRetryLast : undefined}
                    onRegenerate={!message.error && message.role === 'model' ? handleRegenerateMessage : undefined}
                    onEditMessage={message.role === 'user' ? handleEditMessage : undefined}
                    onFeedback={handleFeedback}
                    onPollVote={handlePollVote}
                    onAddReminder={handleAddReminder}
                    reminders={reminders}
                    isBusy={isThinking}
                    isStreaming={streamingMsgIds.has(message.id)}
                    textSize={responsePrefs.fontSize}
                    voiceName={responsePrefs.voiceName}
                    theme={theme}
                  />
                ))}

                {isThinking && !isActivelyStreamingText && (
                  <ThinkingIndicator useSearch={useSearch} theme={theme} />
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          {showScrollBottom && activeConversation && activeConversation.messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                cyberAudio.playTab();
                scrollToBottom('smooth');
              }}
              title="Ir para o final da conversa"
              className={`absolute bottom-3 right-4 sm:right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border backdrop-blur-md transition-all cursor-pointer animate-fadeIn ${
                theme === 'nebula'
                  ? 'bg-purple-950/90 hover:bg-purple-900/95 border-purple-500/40 text-purple-100'
                  : theme === 'simple'
                  ? 'bg-slate-900/95 hover:bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-cyan-500/40 text-cyan-200 shadow-cyan-500/15'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ir para o final</span>
            </button>
          )}
        </div>

        <ChatInput
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          isLoading={isThinking}
          useSearch={useSearch}
          onToggleSearch={() => setUseSearch(!useSearch)}
          locationStatus={locationStatus}
          locationLabel={clientLocation?.label}
          locationError={locationError}
          onToggleLocation={handleToggleLocation}
          onDismissLocationError={() => {
            setLocationError(null);
            if (locationStatus === 'error') setLocationStatus('idle');
          }}
          onInputFocus={() => syncViewportRef.current?.()}
          isKeyboardOpen={viewportBox.isKeyboardOpen}
          theme={theme}
        />
      </div>
    </div>
  );
}
