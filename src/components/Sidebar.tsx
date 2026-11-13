import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  X,
  Search,
  Edit2,
  Check,
  Share2,
  Star,
  Archive,
  ArchiveRestore,
  FolderPlus,
  Folder,
  AlertOctagon,
  Brain,
  ChevronRight,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  Mail,
  MoreHorizontal,
  Download,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Conversation, PersonaMode, ThemeMode, Project, UserProfile } from '../types/chat';
import { cyberAudio } from '../utils/audio';
import { ThemeSelector } from './ThemeSelector';
import { CyberGearLogo } from './CyberGearLogo';
import { getThemeColors } from '../utils/themeStyles';
import { getPublicNexusUrl } from './Navbar';
import { copyTextToClipboard } from '../utils/clipboard';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onSetProject: (id: string, projectId?: string) => void;
  projects: Project[];
  onCreateProject: (name: string, color: string, conversationIds?: string[]) => void;
  onDeleteProject: (id: string) => void;
  onClearAll: (type?: 'all' | 'archived') => void;
  onExportChat?: () => void;
  hasActiveMessages?: boolean;
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaMode;
  onPersonaChange: (p: PersonaMode) => void;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  userProfile?: UserProfile;
  authUser?: User | null;
  onOpenAccount: () => void;
}

type TabMode = 'all' | 'favorites' | 'projects' | 'archived';

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleFavorite,
  onToggleArchive,
  onSetProject,
  projects,
  onCreateProject,
  onDeleteProject,
  onClearAll,
  onExportChat,
  hasActiveMessages = false,
  isOpen,
  onClose,
  persona,
  onPersonaChange,
  theme,
  onThemeChange,
  userProfile,
  authUser,
  onOpenAccount,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [quickPanelConvId, setQuickPanelConvId] = useState<string | null>(null);
  const quickPanelTimerRef = useRef<number | null>(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectStep, setProjectStep] = useState<1 | 2>(1);
  const [selectedConvIdsForProject, setSelectedConvIdsForProject] = useState<string[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#06b6d4');
  const [assigningConvId, setAssigningConvId] = useState<string | null>(null);
  const [confirmDeleteProjId, setConfirmDeleteProjId] = useState<string | null>(null);

  const colors = getThemeColors(theme);

  useEffect(() => {
    return () => {
      if (quickPanelTimerRef.current) {
        window.clearTimeout(quickPanelTimerRef.current);
      }
    };
  }, []);

  const triggerQuickPanel = (convId: string) => {
    if (quickPanelTimerRef.current) {
      window.clearTimeout(quickPanelTimerRef.current);
    }
    setQuickPanelConvId(convId);
    quickPanelTimerRef.current = window.setTimeout(() => {
      setQuickPanelConvId(null);
      quickPanelTimerRef.current = null;
    }, 3000);
  };

  const dismissQuickPanel = () => {
    if (quickPanelTimerRef.current) {
      window.clearTimeout(quickPanelTimerRef.current);
      quickPanelTimerRef.current = null;
    }
    setQuickPanelConvId(null);
  };

  const openNewProjectWizard = () => {
    cyberAudio.playClick();
    setProjectStep(1);
    setSelectedConvIdsForProject([]);
    setNewProjectName('');
    setNewProjectColor('#06b6d4');
    setShowNewProjectModal(true);
  };

  const toggleConvForProject = (convId: string) => {
    cyberAudio.playClick();
    setSelectedConvIdsForProject((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const handleCopyLink = async () => {
    cyberAudio.playClick();
    const shareUrl = getPublicNexusUrl();
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissQuickPanel();
    setAssigningConvId(null);
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), newProjectColor, selectedConvIdsForProject);
    setNewProjectName('');
    setSelectedConvIdsForProject([]);
    setShowNewProjectModal(false);
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'favorites') {
      return Boolean(c.isFavorite) && !c.isArchived;
    }
    if (activeTab === 'archived') {
      return Boolean(c.isArchived);
    }
    if (activeTab === 'projects') {
      if (selectedProjectId) {
        return c.projectId === selectedProjectId && !c.isArchived;
      }
      return !c.isArchived;
    }
    return !c.isArchived;
  });

  const activeConversationsList = conversations.filter((c) => !c.isArchived);
  const favoritesCount = conversations.filter((c) => c.isFavorite && !c.isArchived).length;
  const archivedCount = conversations.filter((c) => c.isArchived).length;
  const activeCount = activeConversationsList.length;
  const memoriesCount = userProfile?.notes?.length ?? 0;

  const newConvBtnStyle =
    theme === 'simple'
      ? 'bg-white/10 hover:bg-white/15 border-white/30 text-white'
      : theme === 'nebula'
      ? 'bg-gradient-to-r from-purple-950/90 via-[#2a0a54] to-purple-950/90 hover:from-purple-900 hover:to-fuchsia-900 border-purple-400/60 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
      : 'bg-gradient-to-r from-cyan-950/90 via-[#07264d] to-cyan-950/90 hover:from-cyan-900 hover:via-sky-800/80 hover:to-cyan-900 border-cyan-400/60 hover:border-cyan-300 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.22)] hover:shadow-[0_0_26px_rgba(34,211,238,0.45)]';

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      <aside
        className={`absolute md:static inset-y-0 left-0 z-50 h-full min-h-0 w-72 sm:w-80 flex flex-col border-r backdrop-blur-xl transform transition-all duration-300 ease-in-out shrink-0 ${colors.sidebarBg} ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header with Theme-Reactive Cyber Gear Logo */}
        <div className={`p-3.5 border-b flex items-center justify-between shrink-0 ${colors.borderSubtle}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`relative w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-300 shrink-0 ${colors.logoBox}`}
            >
              <CyberGearLogo size={22} spinning glow theme={theme} />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping ${colors.dot}`} />
            </div>
            <div className="min-w-0">
              <span
                className={`font-['Chakra_Petch'] font-bold tracking-wider text-base flex items-center gap-1.5 ${colors.textPrimary}`}
              >
                NEXUS AI
              </span>
              <p className={`text-[10px] font-mono tracking-wide truncate ${colors.accentDim}`}>
                NexusBye • Neural Core
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border border-transparent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account / Email Login & New Chat */}
        <div className="p-3 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              cyberAudio.playClick();
              if (window.innerWidth < 768) onClose();
              onOpenAccount();
            }}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
              authUser
                ? 'bg-emerald-950/45 border-emerald-400/55 text-emerald-200 hover:border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.18)]'
                : `${colors.badgeBg} hover:opacity-90`
            }`}
            title={
              authUser
                ? `Conectado: ${authUser.email} — Ver memória e preferências`
                : 'Entrar com e-mail para memorizar seu perfil'
            }
          >
            <div className="flex items-center gap-2 min-w-0">
              {authUser?.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt=""
                  className="w-4 h-4 rounded-full shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Mail className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate font-medium">
                {authUser?.email || 'Entrar com E-mail'}
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>

          <button
            onClick={() => {
              cyberAudio.playClick();
              onNewConversation();
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full group relative flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border font-medium text-sm transition-all duration-200 ${newConvBtnStyle}`}
          >
            <Plus className={`w-4 h-4 group-hover:rotate-90 transition-transform duration-300 ${colors.accent}`} />
            <span className="font-['Space_Grotesk'] font-semibold tracking-wide">Nova Conversa</span>
          </button>
        </div>

        {/* View Tabs */}
        <div className="px-3 pb-2 shrink-0">
          <div className={`grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/40 border text-[11px] font-mono ${colors.borderSubtle}`}>
            <button
              onClick={() => {
                cyberAudio.playClick();
                setActiveTab('all');
                setSelectedProjectId(null);
                setAssigningConvId(null);
              }}
              className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'all'
                  ? colors.badgeBg
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Todas as conversas ativas"
            >
              <span>Todas</span>
              <span className="text-[9px] opacity-70 tabular-nums">({activeCount})</span>
            </button>

            <button
              onClick={() => {
                cyberAudio.playClick();
                setActiveTab('favorites');
                setSelectedProjectId(null);
                setAssigningConvId(null);
              }}
              className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'favorites'
                  ? 'bg-amber-500/20 border border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
              title="Conversas favoritas"
            >
              <span className="flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-current" />
                <span>Favs</span>
              </span>
              <span className="text-[9px] opacity-70 tabular-nums">({favoritesCount})</span>
            </button>

            <button
              onClick={() => {
                cyberAudio.playClick();
                setActiveTab('projects');
                setAssigningConvId(null);
              }}
              className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'projects'
                  ? 'bg-sky-500/20 border border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                  : 'text-slate-400 hover:text-sky-300'
              }`}
              title="Projetos e pastas"
            >
              <span>Projetos</span>
              <span className="text-[9px] opacity-70 tabular-nums">({projects.length})</span>
            </button>

            <button
              onClick={() => {
                cyberAudio.playClick();
                setActiveTab('archived');
                setSelectedProjectId(null);
                setAssigningConvId(null);
              }}
              className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'archived'
                  ? 'bg-purple-500/20 border border-purple-400 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
              title="Conversas arquivadas"
            >
              <span>Arquivos</span>
              <span className="text-[9px] opacity-70 tabular-nums">({archivedCount})</span>
            </button>
          </div>
        </div>

        {/* Projects Section Bar */}
        {activeTab === 'projects' && (
          <div className="px-3 pb-2">
            <div className="p-2.5 rounded-xl bg-black/40 border border-sky-500/30 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px] text-sky-300">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Folder className="w-3.5 h-3.5 text-sky-400" />
                  Pastas de Projetos
                </span>
                <button
                  onClick={openNewProjectWizard}
                  className="flex items-center gap-1 text-[11px] font-bold text-cyan-200 hover:text-white px-2 py-0.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 transition-all shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                  title="Escolher conversas e criar novo projeto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Projeto</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin pt-0.5">
                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                    setConfirmDeleteProjId(null);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] border transition-all ${
                    selectedProjectId === null
                      ? 'bg-sky-500/30 border-sky-400 text-sky-100 font-semibold'
                      : 'bg-black/30 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({activeCount})
                </button>
                {projects.map((proj) => {
                  const count = conversations.filter(
                    (c) => c.projectId === proj.id && !c.isArchived
                  ).length;
                  const isSel = selectedProjectId === proj.id;
                  const isConfirmingDel = confirmDeleteProjId === proj.id;

                  return (
                    <div key={proj.id} className="inline-flex items-center">
                      <button
                        onClick={() => {
                          setSelectedProjectId(isSel ? null : proj.id);
                          setConfirmDeleteProjId(null);
                        }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border transition-all ${
                          isSel
                            ? 'bg-sky-500/30 border-sky-400 text-sky-100 font-semibold shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                            : 'bg-black/30 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span>{proj.name}</span>
                        <span className="text-[9px] opacity-60">({count})</span>
                      </button>
                      {isSel && (
                        <button
                          onClick={() => {
                            if (isConfirmingDel) {
                              onDeleteProject(proj.id);
                              setSelectedProjectId(null);
                              setConfirmDeleteProjId(null);
                            } else {
                              setConfirmDeleteProjId(proj.id);
                            }
                          }}
                          className={`ml-1 px-1 py-0.5 rounded text-[9px] transition-colors ${
                            isConfirmingDel
                              ? 'bg-red-600/80 text-white'
                              : 'text-slate-500 hover:text-red-400'
                          }`}
                          title={
                            isConfirmingDel ? 'Confirmar exclusão do projeto' : 'Excluir este projeto'
                          }
                        >
                          {isConfirmingDel ? 'Confirmar?' : <X className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Search Conversations Input */}
        <div className="px-3 py-1 shrink-0">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${colors.accentDim}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar conversas..."
              className={`w-full pl-8 pr-3 py-1.5 bg-black/40 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 border focus:outline-none transition-all font-mono ${colors.borderSubtle}`}
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1 space-y-1 scrollbar-thin">
          <div className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 flex items-center justify-between ${colors.accentDim}`}>
            <span>
              {activeTab === 'all' && `Ativas (${filteredConversations.length})`}
              {activeTab === 'favorites' && `Favoritas (${filteredConversations.length})`}
              {activeTab === 'projects' && `Projeto (${filteredConversations.length})`}
              {activeTab === 'archived' && `Arquivadas (${filteredConversations.length})`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={openNewProjectWizard}
                className="text-sky-400 hover:text-sky-200 p-0.5 rounded hover:bg-sky-950/50 transition-colors"
                title="Criar novo projeto com conversas"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              {conversations.length > 0 && (
                <button
                  onClick={() => setShowClearModal(true)}
                  className="hover:text-red-400 text-slate-400 transition-colors lowercase font-mono text-[10px] px-1.5 py-0.5 rounded hover:bg-red-950/30 border border-transparent hover:border-red-500/30"
                  title="Opções de limpeza"
                >
                  limpar...
                </button>
              )}
            </div>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 font-mono">
              {searchQuery
                ? 'Nenhuma conversa encontrada'
                : activeTab === 'favorites'
                ? 'Nenhuma conversa marcada com estrela'
                : activeTab === 'archived'
                ? 'Nenhuma conversa arquivada'
                : 'Nenhuma conversa iniciada'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeId;
              const isEditing = editingId === conv.id;
              const isQuickOpen = quickPanelConvId === conv.id;
              const project = projects.find((p) => p.id === conv.projectId);

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    cyberAudio.playClick();
                    setAssigningConvId(null);
                    if (window.innerWidth < 768 && isActive) {
                      dismissQuickPanel();
                      onClose();
                      return;
                    }
                    onSelectConversation(conv.id);
                    triggerQuickPanel(conv.id);
                  }}
                  className={`group relative flex items-center justify-between gap-1.5 p-2 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? `${colors.badgeBg} font-medium`
                      : `hover:bg-white/5 text-slate-300 hover:text-white border border-transparent`
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? colors.accent : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    {isEditing ? (
                      <form
                        onSubmit={(e) => saveRename(conv.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 flex items-center gap-1"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => saveRename(conv.id)}
                          autoFocus
                          className="w-full bg-black/60 border border-cyan-400 px-1.5 py-0.5 rounded text-xs text-white focus:outline-none"
                        />
                        <button type="submit" className="p-1 hover:text-emerald-400 text-cyan-300">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="block text-xs font-medium truncate">{conv.title}</span>
                          {conv.isFavorite && (
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span>
                            {conv.messages.length}{' '}
                            {conv.messages.length === 1 ? 'msg' : 'msgs'}
                          </span>
                          {project && (
                            <span
                              className="px-1 py-0.5 rounded text-[9px] border border-slate-700 truncate max-w-[80px]"
                              style={{ color: project.color }}
                            >
                              {project.name}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3-Second Quick-Action Floating Panel */}
                  {!isEditing && isQuickOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#040e22]/95 border border-cyan-400/70 shadow-[0_0_18px_rgba(6,182,212,0.45)] backdrop-blur-md animate-fadeIn"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          cyberAudio.playClick();
                          onToggleFavorite(conv.id);
                          dismissQuickPanel();
                        }}
                        className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-mono transition-colors ${
                          conv.isFavorite
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                            : 'text-slate-200 hover:bg-amber-500/20 hover:text-amber-300'
                        }`}
                        title={conv.isFavorite ? 'Desfavoritar' : 'Favoritar'}
                      >
                        <Star className={`w-3 h-3 ${conv.isFavorite ? 'fill-current' : ''}`} />
                        <span>Fav</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          cyberAudio.playClick();
                          onToggleArchive(conv.id);
                          dismissQuickPanel();
                        }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-mono text-slate-200 hover:bg-purple-500/25 hover:text-purple-300 transition-colors"
                        title={conv.isArchived ? 'Desarquivar' : 'Arquivar'}
                      >
                        {conv.isArchived ? (
                          <ArchiveRestore className="w-3 h-3" />
                        ) : (
                          <Archive className="w-3 h-3" />
                        )}
                        <span>Arq</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          cyberAudio.playClick();
                          onDeleteConversation(conv.id);
                          dismissQuickPanel();
                        }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-mono text-rose-300 hover:bg-rose-500/25 hover:text-rose-200 transition-colors"
                        title="Excluir conversa"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excl</span>
                      </button>
                    </div>
                  )}

                  {!isEditing && !isQuickOpen && (
                    <div
                      className={`flex items-center gap-0.5 transition-opacity shrink-0 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cyberAudio.playClick();
                          dismissQuickPanel();
                          setAssigningConvId(assigningConvId === conv.id ? null : conv.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          conv.projectId
                            ? 'text-sky-400 hover:text-sky-300'
                            : 'text-slate-400 hover:text-sky-400'
                        }`}
                        title="Vincular a um Projeto"
                      >
                        <Folder className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => startRename(conv, e)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 transition-colors"
                        title="Renomear"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cyberAudio.playClick();
                          setAssigningConvId(null);
                          triggerQuickPanel(conv.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 transition-colors"
                        title="Favoritar, arquivar ou excluir"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {assigningConvId === conv.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-2 top-8 z-30 p-2 bg-[#050e1e] border border-cyan-400 rounded-xl shadow-xl w-48 text-xs font-mono space-y-1 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-cyan-500/30 text-[10px] text-cyan-300 font-semibold">
                        <span>Definir Projeto</span>
                        <button
                          onClick={() => setAssigningConvId(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          onSetProject(conv.id, undefined);
                          setAssigningConvId(null);
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] ${
                          !conv.projectId
                            ? 'bg-cyan-500/20 text-cyan-200'
                            : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        Sem Projeto
                      </button>
                      {projects.map((proj) => (
                        <button
                          key={proj.id}
                          onClick={() => {
                            onSetProject(conv.id, proj.id);
                            setAssigningConvId(null);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center gap-1.5 ${
                            conv.projectId === proj.id
                              ? 'bg-cyan-500/20 text-cyan-200'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span className="truncate">{proj.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Aligned Global Memory + Adaptive Likes/Dislikes Status */}
        <div className="px-3 pb-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              cyberAudio.playClick();
              if (window.innerWidth < 768) onClose();
              onOpenAccount();
            }}
            className={`w-full px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 border text-[10px] font-mono flex items-center justify-between gap-2 text-slate-300 transition-colors cursor-pointer ${colors.borderSubtle}`}
            title="Abrir Memória Pessoal e Preferências"
          >
            <span className={`flex items-center gap-1.5 font-medium min-w-0 truncate ${colors.accent}`}>
              <Brain className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Memória ({memoriesCount})
              </span>
            </span>
            <div className={`flex items-center gap-2 px-2 py-0.5 rounded-lg bg-black/50 border shrink-0 whitespace-nowrap tabular-nums ${colors.borderSubtle}`}>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                <ThumbsUp className="w-3 h-3" />
                <span>{userProfile?.totalLikes ?? 0}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                <ThumbsDown className="w-3 h-3" />
                <span>{userProfile?.totalDislikes ?? 0}</span>
              </span>
            </div>
          </button>
        </div>

        {/* Personalizar Tema de Fundo */}
        <div className="px-3 pb-2 shrink-0">
          <div className={`p-2 rounded-xl bg-black/35 border ${colors.borderSubtle}`}>
            <ThemeSelector currentTheme={theme} onSelectTheme={onThemeChange} />
          </div>
        </div>

        {/* Footer info & Link */}
        <div className={`p-3 border-t bg-black/50 space-y-2 shrink-0 ${colors.borderSubtle}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-mono transition-all ${
                copiedLink
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : `${colors.badgeBg} hover:opacity-90`
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copiar Link do NEXUS</span>
                </>
              )}
            </button>

            {hasActiveMessages && onExportChat && (
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playClick();
                  onExportChat();
                }}
                className={`p-2 rounded-lg border text-xs font-mono transition-all ${colors.badgeBg} hover:opacity-90`}
                title="Exportar conversa em Markdown"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Opções de Modo Neural (Padrão, Cyber, Dev, Direto) embaixo do link */}
          <div className="pt-0.5">
            <div className={`grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/40 border text-center ${colors.borderSubtle}`}>
              {[
                { id: 'standard', label: 'Padrão' },
                { id: 'cyber', label: 'Cyber' },
                { id: 'code', label: 'Dev' },
                { id: 'concise', label: 'Direto' },
              ].map((p) => {
                const active = persona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      cyberAudio.playClick();
                      onPersonaChange(p.id as PersonaMode);
                    }}
                    className={`py-1 rounded-lg text-[10px] font-mono font-medium transition-all ${
                      active
                        ? colors.badgeBg
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Modo ${p.label}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`text-[10px] font-mono text-center pt-0.5 ${colors.accentDim}`}>
            NexusBye
          </div>
        </div>
      </aside>

      {/* Modal: Limpar Conversas */}
      {showClearModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#061124] border border-cyan-400 rounded-2xl p-5 shadow-[0_0_25px_rgba(6,182,212,0.3)] text-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-cyan-300">
              <AlertOctagon className="w-5 h-5 text-amber-400" />
              <h3 className="font-['Space_Grotesk'] font-bold text-base">Limpar Conversas</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Selecione o tipo de limpeza que deseja executar no histórico do NEXUS AI:
            </p>

            <div className="space-y-2 font-mono text-xs">
              <button
                onClick={() => {
                  onClearAll('archived');
                  setShowClearModal(false);
                }}
                disabled={archivedCount === 0}
                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-colors ${
                  archivedCount > 0
                    ? 'border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40 text-purple-200'
                    : 'border-slate-800 bg-slate-900/30 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div>
                  <p className="font-semibold">Excluir apenas Arquivadas</p>
                  <p className="text-[10px] opacity-70">
                    Remove {archivedCount} {archivedCount === 1 ? 'conversa' : 'conversas'} do arquivo
                  </p>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onClearAll('all');
                  setShowClearModal(false);
                }}
                className="w-full text-left p-3 rounded-xl border border-red-500/40 bg-red-950/30 hover:bg-red-900/40 text-red-200 flex items-center justify-between transition-colors"
              >
                <div>
                  <p className="font-semibold text-red-300">Excluir Todas as Conversas</p>
                  <p className="text-[10px] opacity-70">
                    Limpa todo o histórico ({conversations.length} conversas)
                  </p>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowClearModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-xs font-mono hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2-Passos: (+) Escolher Conversas -> Nome do Projeto */}
      {showNewProjectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowNewProjectModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#061124] border border-sky-400 rounded-2xl p-5 shadow-[0_0_25px_rgba(56,189,248,0.3)] text-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-300">
                <FolderPlus className="w-5 h-5 text-sky-400" />
                <h3 className="font-['Space_Grotesk'] font-bold text-base">
                  {projectStep === 1 ? '1. Escolher Conversas' : '2. Nome do Projeto'}
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                Passo {projectStep}/2
              </span>
            </div>

            {projectStep === 1 ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Marque as conversas para incluir neste projeto:</span>
                  {activeConversationsList.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedConvIdsForProject(
                          selectedConvIdsForProject.length === activeConversationsList.length
                            ? []
                            : activeConversationsList.map((c) => c.id)
                        )
                      }
                      className="text-sky-400 hover:text-sky-200"
                    >
                      {selectedConvIdsForProject.length === activeConversationsList.length
                        ? 'Desmarcar'
                        : 'Todas'}
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {activeConversationsList.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 border border-slate-800 rounded-xl">
                      Nenhuma conversa ativa ainda. Você pode criar a pasta vazia!
                    </div>
                  ) : (
                    activeConversationsList.map((conv) => {
                      const checked = selectedConvIdsForProject.includes(conv.id);
                      return (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => toggleConvForProject(conv.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            checked
                              ? 'bg-sky-950/60 border-sky-400 text-sky-100'
                              : 'bg-[#040a16] border-slate-800 text-slate-300 hover:border-sky-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                checked
                                  ? 'bg-sky-400 border-sky-300 text-slate-950'
                                  : 'border-slate-600'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <span className="truncate">{conv.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {conv.messages.length} msgs
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewProjectModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-xs hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playClick();
                      setProjectStep(2);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-semibold text-xs shadow-md hover:from-sky-500 hover:to-cyan-500"
                  >
                    <span>Avançar ({selectedConvIdsForProject.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateProjectSubmit} className="space-y-3 font-mono text-xs">
                <div className="px-2.5 py-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 text-[11px] text-sky-200">
                  {selectedConvIdsForProject.length}{' '}
                  {selectedConvIdsForProject.length === 1
                    ? 'conversa selecionada'
                    : 'conversas selecionadas'}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nome do Projeto:</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Ex: Trabalho, Estudos, Viagem..."
                    autoFocus
                    required
                    className="w-full px-3 py-2 bg-[#040a16] border border-sky-500/40 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-300"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Cor do Projeto:</label>
                  <div className="flex items-center gap-2">
                    {[
                      '#06b6d4',
                      '#38bdf8',
                      '#a855f7',
                      '#ec4899',
                      '#10b981',
                      '#f59e0b',
                      '#ef4444',
                    ].map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setNewProjectColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          newProjectColor === color
                            ? 'scale-125 border-white shadow-md'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectStep(1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-xs hover:text-white"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Voltar</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewProjectModal(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 text-xs hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-semibold text-xs shadow-md hover:from-sky-500 hover:to-cyan-500"
                    >
                      Criar Projeto
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
