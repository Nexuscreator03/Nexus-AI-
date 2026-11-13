import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { ArrowDown } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { WelcomeHero } from './components/WelcomeHero';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { AccountModal } from './components/AccountModal';
import { NexusSite } from './components/NexusSite';
import {
  Conversation,
  Message,
  PersonaMode,
  ThemeMode,
  Attachment,
  Project,
  UserProfile,
  ClientLocation,
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
} from './firebase';

const STORAGE_KEY = 'nexus_conversations_v1';
const ACTIVE_CONV_KEY = 'nexus_active_conv_v1';
const THEME_KEY = 'nexus_theme_v1';
const PROJECTS_KEY = 'nexus_projects_v1';
const PROFILE_KEY = 'nexus_user_profile_v1';

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
      totalLikes: typeof parsed.totalLikes === 'number' ? parsed.totalLikes : 0,
      totalDislikes: typeof parsed.totalDislikes === 'number' ? parsed.totalDislikes : 0,
    };
  } catch (e) {
    console.error('Failed to parse profile:', e);
    return DEFAULT_PROFILE;
  }
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
      return safeGetItem(ACTIVE_CONV_KEY);
    } catch {
      return null;
    }
  });

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const [isThinking, setIsThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [persona, setPersona] = useState<PersonaMode>('standard');
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
  const [clientLocation, setClientLocation] = useState<ClientLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [viewMode, setViewMode] = useState<'site' | 'chat'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat')) {
      return 'chat';
    }
    return 'site';
  });

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/chat')) {
        setViewMode('chat');
      } else {
        setViewMode('site');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keep layout height & top locked to visualViewport when mobile virtual keyboard opens/closes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    let rafId: number | null = null;
    let lastHeight = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
    const timers: number[] = [];

    const syncViewportMetrics = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const height = vv ? Math.round(vv.height) : window.innerHeight;
        const offsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;

        root.style.setProperty('--nexus-viewport-height', `${height}px`);
        root.style.setProperty('--nexus-viewport-top', `${offsetTop}px`);

        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
        if (document.documentElement.scrollTop !== 0) {
          document.documentElement.scrollTop = 0;
        }
        if (document.body.scrollTop !== 0) {
          document.body.scrollTop = 0;
        }

        // If keyboard opened (height shrank significantly) and user was near bottom, keep latest message visible
        if (height < lastHeight - 80) {
          const scroller = scrollContainerRef.current;
          if (scroller) {
            const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
            if (dist < 220) {
              messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }
          }
        }
        lastHeight = height;
      });
    };

    const scheduleDelayedSync = () => {
      syncViewportMetrics();
      [100, 280, 480].forEach((delay) => {
        const id = window.setTimeout(syncViewportMetrics, delay);
        timers.push(id);
      });
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
    window.addEventListener('focusout', scheduleDelayedSync);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      timers.forEach((id) => window.clearTimeout(id));
      if (vv) {
        vv.removeEventListener('resize', syncViewportMetrics);
        vv.removeEventListener('scroll', syncViewportMetrics);
      }
      window.removeEventListener('resize', syncViewportMetrics);
      window.removeEventListener('orientationchange', scheduleDelayedSync);
      window.removeEventListener('focusin', scheduleDelayedSync);
      window.removeEventListener('focusout', scheduleDelayedSync);
    };
  }, []);

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestConversationsRef = useRef<Conversation[]>(conversations);
  latestConversationsRef.current = conversations;
  const syncedUidRef = useRef<string | null>(null);
  const profileSyncTimerRef = useRef<number | null>(null);

  // Subscribe to Firebase Auth state & sync cloud memory for logged-in email
  useEffect(() => {
    const unsub = subscribeToAuth(async (user) => {
      setAuthUser(user);
      if (!user) {
        syncedUidRef.current = null;
        return;
      }

      if (syncedUidRef.current === user.uid) return;
      syncedUidRef.current = user.uid;

      try {
        const [cloudProfile, cloudConvs, cloudProjs] = await Promise.all([
          loadCloudUserProfile(user.uid).catch(() => null),
          loadCloudConversations(user.uid).catch(() => [] as Conversation[]),
          loadCloudProjects(user.uid).catch(() => [] as Project[]),
        ]);

        setUserProfile((local) => {
          const merged: UserProfile = {
            ...local,
            ...(cloudProfile || {}),
            email: user.email || cloudProfile?.email || local.email,
            name: cloudProfile?.name || local.name || user.displayName || undefined,
            city: cloudProfile?.city || local.city,
            likedTopics: mergeStringArrays(cloudProfile?.likedTopics, local.likedTopics, 30),
            dislikedTopics: mergeStringArrays(cloudProfile?.dislikedTopics, local.dislikedTopics, 30),
            notes: mergeStringArrays(cloudProfile?.notes, local.notes, 50),
            totalLikes: Math.max(cloudProfile?.totalLikes || 0, local.totalLikes || 0),
            totalDislikes: Math.max(cloudProfile?.totalDislikes || 0, local.totalDislikes || 0),
          };
          saveCloudUserProfile(user, merged).catch(() => {});
          return merged;
        });

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
      } catch (err) {
        console.warn('Cloud sync load warning:', err);
      }
    });

    return () => unsub();
  }, []);

  // Debounced cloud profile save when signed in
  useEffect(() => {
    safeSetItem(PROFILE_KEY, JSON.stringify(userProfile));
    if (!authUser) return;

    if (profileSyncTimerRef.current) {
      window.clearTimeout(profileSyncTimerRef.current);
    }
    profileSyncTimerRef.current = window.setTimeout(() => {
      saveCloudUserProfile(authUser, userProfile).catch(() => {});
    }, 600);

    return () => {
      if (profileSyncTimerRef.current) {
        window.clearTimeout(profileSyncTimerRef.current);
      }
    };
  }, [userProfile, authUser]);

  useEffect(() => {
    safeSetItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    safeSetItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
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
  }, [conversations]);

  useEffect(() => {
    if (activeId) {
      safeSetItem(ACTIVE_CONV_KEY, activeId);
    } else {
      safeRemoveItem(ACTIVE_CONV_KEY);
    }
  }, [activeId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBottom(false);
  };

  const handleMessagesScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 160);
  };

  const activeConversation = conversations.find((c) => c.id === activeId) || null;
  const activeMessageCount = activeConversation?.messages.length ?? 0;

  useEffect(() => {
    if (activeMessageCount > 0 || isThinking) {
      scrollToBottom('smooth');
    } else {
      setShowScrollBottom(false);
    }
  }, [activeId, activeMessageCount, isThinking]);

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
  const handleToggleLocation = async () => {
    if (clientLocation || locationStatus === 'active') {
      setClientLocation(null);
      setLocationStatus('idle');
      setLocationError(null);
      return;
    }

    setLocationStatus('loading');
    setLocationError(null);

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

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const resolved = await resolveCoordinates(
            Number(pos.coords.latitude.toFixed(5)),
            Number(pos.coords.longitude.toFixed(5)),
            Math.round(pos.coords.accuracy)
          );
          setClientLocation(resolved);
          setLocationStatus('active');
          if (resolved.city) {
            setUserProfile((prev) => ({ ...prev, city: resolved.city }));
          }
        },
        async () => {
          const ipLoc = await resolveViaIpFallback();
          if (ipLoc) {
            setClientLocation(ipLoc);
            setLocationStatus('active');
            if (ipLoc.city) {
              setUserProfile((prev) => ({ ...prev, city: ipLoc.city }));
            }
          } else {
            setLocationStatus('error');
            setLocationError(
              'Não foi possível detectar sua localização automaticamente. Permita o GPS ou informe sua cidade no chat.'
            );
          }
        },
        { enableHighAccuracy: true, timeout: 4500 }
      );
    } else {
      const ipLoc = await resolveViaIpFallback();
      if (ipLoc) {
        setClientLocation(ipLoc);
        setLocationStatus('active');
      } else {
        setLocationStatus('error');
        setLocationError('Geolocalização indisponível neste navegador.');
      }
    }
  };

  const handleNewConversation = () => {
    setActiveId(null);
  };

  const handleDeleteConversation = (id: string) => {
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

  const handleClearAll = (type: 'all' | 'archived' = 'all') => {
    if (type === 'archived') {
      const toDelete = conversations.filter((c) => c.isArchived);
      setConversations((prev) => prev.filter((c) => !c.isArchived));
      if (activeConversation?.isArchived) {
        setActiveId(null);
      }
      if (authUser) {
        toDelete.forEach((c) => deleteCloudConversation(authUser.uid, c.id).catch(() => {}));
      }
    } else {
      const toDelete = [...conversations];
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

  const handleSendMessage = async (
    content: string,
    attachments?: Attachment[],
    searchOverride?: boolean,
    personaOverride?: PersonaMode,
    forceNewConv?: boolean
  ) => {
    const hasAttachments = Boolean(attachments && attachments.length > 0);
    const trimmed = content.trim();
    if ((!trimmed && !hasAttachments) || isThinking) return;

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

    let targetConvId = forceNewConv ? null : activeId;
    let currentMessages: Message[] = [];
    let convSnapshot: Conversation | null = null;

    if (!targetConvId || !conversations.some((c) => c.id === targetConvId)) {
      const newId = 'conv-' + Date.now();
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
      currentMessages = [...(activeConversation?.messages || []), userMsg];
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          const updated = {
            ...c,
            messages: currentMessages,
            updatedAt: Date.now(),
          };
          convSnapshot = updated;
          return updated;
        })
      );
    }

    if (convSnapshot) {
      syncConvToCloud(convSnapshot);
    }

    setIsThinking(true);
    cyberAudio.playNeuralPulse();

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        conversations,
        targetConvId
      );

      const formattedHistory = currentMessages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: formattedHistory,
          useSearch: effectiveSearch,
          systemPersona: effectivePersona,
          turboMode: true,
          clientTime,
          clientLocation,
          userProfile: updatedProfile,
          globalMemoryContext,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Erro do servidor (${res.status})`);
      }

      const data = await res.json();

      const modelMsg: Message = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        role: 'model',
        content: data.text || 'Nenhuma resposta recebida do núcleo neural.',
        timestamp: Date.now(),
        groundingSources: data.groundingSources || [],
        searchQueries: data.webSearchQueries || [],
        durationMs: data.durationMs,
      };

      cyberAudio.playReceive();

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          const updated = {
            ...c,
            messages: [...c.messages, modelMsg],
            updatedAt: Date.now(),
          };
          syncConvToCloud(updated);
          return updated;
        })
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: 'msg-err-' + Date.now(),
        role: 'model',
        content:
          err?.message ||
          'Não foi possível estabelecer contato com os servidores neurais do NEXUS AI. Verifique sua conexão e chave de API.',
        timestamp: Date.now(),
        error: true,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          const updated = {
            ...c,
            messages: [...c.messages, errorMsg],
            updatedAt: Date.now(),
          };
          syncConvToCloud(updated);
          return updated;
        })
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsThinking(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
  };

  const handlePollVote = (question: string, option: string) => {
    handleSendMessage(`Minha escolha na enquete ("${question}"): **${option}**`);
  };

  const handleRetryLast = () => {
    if (!activeConversation) return;
    const lastUserMsg = [...activeConversation.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  };

  const handleEnterChatFromSite = (initialPrompt?: string, selectedPersona?: PersonaMode) => {
    if (selectedPersona) {
      setPersona(selectedPersona);
    }
    navigateToView('chat');
    if (initialPrompt && initialPrompt.trim()) {
      handleSendMessage(initialPrompt.trim(), undefined, undefined, selectedPersona, true);
    }
  };

  if (viewMode === 'site') {
    return <NexusSite theme={theme} onEnterChat={handleEnterChatFromSite} />;
  }

  return (
    <div
      className={`relative flex h-full min-h-0 w-full max-w-full overflow-hidden text-slate-100 select-text ${
        theme === 'simple'
          ? 'theme-simple'
          : theme === 'nebula'
          ? 'theme-nebula'
          : 'theme-cyber'
      }`}
    >
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
        authUser={authUser}
        isAuthLoading={isAuthLoading}
        authError={authError}
        onSignIn={handleSignInAccount}
        onSignOut={handleSignOutAccount}
        userProfile={userProfile}
        onUpdateProfile={(updater) => setUserProfile((prev) => updater(prev))}
        theme={theme}
      />

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={(id) => setActiveId(id)}
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        persona={persona}
        onPersonaChange={setPersona}
        theme={theme}
        onThemeChange={setTheme}
        userProfile={userProfile}
        authUser={authUser}
        onOpenAccount={() => setIsAccountOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 w-full max-w-full overflow-hidden h-full relative z-20">
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewConversation={handleNewConversation}
          onExportChat={handleExportChat}
          hasActiveMessages={Boolean(activeConversation && activeConversation.messages.length > 0)}
          useSearch={useSearch}
          onToggleSearch={() => setUseSearch(!useSearch)}
          theme={theme}
          onThemeChange={setTheme}
          onOpenSite={() => navigateToView('site')}
        />

        <div className="relative flex-1 min-h-0 flex flex-col min-w-0">
          <div
            ref={scrollContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 sm:px-6 md:px-8 py-4 space-y-4 scrollbar-thin min-w-0"
          >
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <WelcomeHero
                onSelectPrompt={(prompt, enableSearch) => {
                  if (enableSearch !== undefined) {
                    setUseSearch(enableSearch);
                  }
                  handleSendMessage(prompt, undefined, enableSearch);
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
                    onFeedback={handleFeedback}
                    onPollVote={handlePollVote}
                    theme={theme}
                  />
                ))}

                {isThinking && <ThinkingIndicator useSearch={useSearch} theme={theme} />}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          {showScrollBottom && activeConversation && activeConversation.messages.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
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
          theme={theme}
        />
      </div>
    </div>
  );
}
