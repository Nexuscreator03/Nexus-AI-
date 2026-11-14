import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Globe,
  Mic,
  Brain,
  MapPin,
  FolderOpen,
  MessageSquare,
  Mail,
  X,
  Loader2,
} from 'lucide-react';
import { CyberGearLogo } from './CyberGearLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { PersonaMode, ThemeMode } from '../types/chat';
import { getPublicNexusUrl } from './Navbar';
import { copyTextToClipboard } from '../utils/clipboard';
import nexusbyeEmblemImg from '../assets/images/nexusbye_ai_emblem_1794588026138.jpg';
import researchCoreImg from '../assets/images/nexus_research_core_1794526153590.jpg';

interface NexusSiteProps {
  theme: ThemeMode;
  onEnterChat: (initialPrompt?: string, persona?: PersonaMode) => void;
  onSaveEmail: (email: string) => void;
  onSignInWithGoogle: () => Promise<void>;
  isAuthLoading?: boolean;
  authError?: string | null;
  viewportStyle?: React.CSSProperties;
}

interface PersonaPreview {
  id: PersonaMode;
  label: string;
  title: string;
  summary: string;
  sampleQuestion: string;
  sampleAnswer: string;
}

const PERSONA_PREVIEWS: PersonaPreview[] = [
  {
    id: 'standard',
    label: 'Padrão',
    title: 'Equilibrado, amigável e claro',
    summary:
      'Combina explicações bem estruturadas, leitura leve com destaques visuais, humor saudável e adaptação contínua aos seus gostos.',
    sampleQuestion: 'Como organizar meus estudos de tecnologia em 30 minutos por dia?',
    sampleAnswer:
      'Divida o bloco em 10 min de revisão ativa, 15 min de prática direta em um mini-projeto e 5 min anotando o que travou. Quer montar um cronograma para esta semana?',
  },
  {
    id: 'cyber',
    label: 'Cyber',
    title: 'Tecnológico, criativo e futurista',
    summary:
      'Linguagem inspirada em sistemas avançados, computação de ponta e telemetria neural, mantendo clareza total e bom humor.',
    sampleQuestion: 'Como funciona a computação quântica na prática?',
    sampleAnswer:
      'Enquanto bits clássicos operam em estados binários fixos, qubits exploram superposição e entrelaçamento para avaliar múltiplos caminhos simultâneos em problemas específicos.',
  },
  {
    id: 'code',
    label: 'Dev',
    title: 'Engenharia profunda e passo a passo',
    summary:
      'Respostas técnicas completas explicando arquitetura, fluxo de execução, casos de borda, segurança e código limpo pronto para produção.',
    sampleQuestion: 'Qual a diferença prática entre debounce e throttle?',
    sampleAnswer:
      'Debounce aguarda o fim da sequência de eventos antes de disparar (ideal para buscas); throttle garante execução periódica em intervalos fixos (ideal para scroll e resize).',
  },
  {
    id: 'concise',
    label: 'Direto',
    title: 'Objetivo e sem rodeios',
    summary:
      'Entrega apenas o essencial com máxima precisão e velocidade, ideal para consultas rápidas durante o trabalho ou estudo.',
    sampleQuestion: 'Qual comando cria e muda para uma nova branch no Git?',
    sampleAnswer: 'git checkout -b nome-da-branch (ou git switch -c nome-da-branch).',
  },
];

export const NexusSite: React.FC<NexusSiteProps> = ({
  theme,
  onEnterChat,
  onSaveEmail,
  onSignInWithGoogle,
  isAuthLoading = false,
  authError = null,
  viewportStyle,
}) => {
  const [quickPrompt, setQuickPrompt] = useState('');
  const [activePersona, setActivePersona] = useState<PersonaMode>('standard');
  const [copiedLink, setCopiedLink] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [coreImgFailed, setCoreImgFailed] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const selectedPersonaData =
    PERSONA_PREVIEWS.find((p) => p.id === activePersona) || PERSONA_PREVIEWS[0];

  useEffect(() => {
    if (!isLauncherOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLauncherOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLauncherOpen]);

  const openChatLauncher = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEmailError(null);
    setIsLauncherOpen(true);
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cleaned = quickPrompt.trim();
    if (cleaned) {
      onEnterChat(cleaned, activePersona);
    } else {
      openChatLauncher();
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = emailInput.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalized)) {
      setEmailError('Digite um endereço de e-mail válido (ex.: nome@email.com).');
      return;
    }
    setEmailError(null);
    onSaveEmail(normalized);
  };

  const handleCopyPublicLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const publicUrl = getPublicNexusUrl();
    const ok = await copyTextToClipboard(publicUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2600);
    }
  };

  const publicUrl = getPublicNexusUrl();

  return (
    <div
      style={viewportStyle}
      className="w-full overflow-y-auto overflow-x-clip overscroll-y-contain bg-[#070A12] text-slate-100 font-['Plus_Jakarta_Sans'] antialiased selection:bg-sky-500/30 selection:text-sky-100"
    >
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070A12]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#inicio"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md"
          >
            <CyberGearLogo size={26} glow={false} theme={theme} />
            <span>NexusBye AI</span>
          </a>

          {/* Zone 2: 4 single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#recursos"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Recursos
            </a>
            <a
              href="#arquitetura"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sobre
            </a>
            <a
              href="#modos"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Modos
            </a>
            <a
              href="#acesso"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Acesso
            </a>
          </nav>

          {/* Zone 3: 1 primary CTA + optional PWA install */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton theme={theme} variant="site" compact />
            <button
              type="button"
              onClick={openChatLauncher}
              className="px-4 py-2 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Abrir Chat
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section: Clicking the showcase opens the chat launcher */}
        <section
          id="inicio"
          onClick={openChatLauncher}
          className="scroll-mt-16 border-b border-slate-800/80 cursor-pointer group/hero"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Column: NexusBye AI Name + Concise Description + Click Cue */}
              <div className="lg:col-span-6 flex flex-col justify-between gap-8">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                    <span>NexusBye AI</span>
                    <span aria-hidden="true">·</span>
                    <span>Criado por Paulo Victor</span>
                    <span aria-hidden="true">·</span>
                    <span>Acesso online</span>
                  </div>

                  <h1
                    className="font-bold tracking-tight text-white leading-[1.08]"
                    style={{
                      fontSize: 'clamp(2.25rem, 4.2vw, 3.75rem)',
                      textWrap: 'balance',
                    }}
                  >
                    NexusBye AI
                  </h1>

                  <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                    Inteligência artificial rápida e amigável criada por Paulo Victor. Converse em
                    português natural, pesquise na web em tempo real, envie áudios, leia arquivos do
                    Google Drive e salve suas memórias entre conversas.
                  </p>

                  <p className="text-sm font-medium text-sky-400">
                    Clique em qualquer ponto desta página para abrir o chat agora.
                  </p>
                </div>

                {/* Primary Click Action */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={openChatLauncher}
                      className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm sm:text-base font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Abrir Chat do NexusBye AI</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Se preferir, informe seu e-mail ao abrir o chat para pular esta tela nas
                    próximas visitas.
                  </p>
                </div>
              </div>

              {/* Right Column: Official NexusBye AI Artwork */}
              <div className="lg:col-span-6 flex">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openChatLauncher}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openChatLauncher();
                    }
                  }}
                  aria-label="Abrir painel de chat do NexusBye AI"
                  className="relative w-full rounded-2xl overflow-hidden border border-slate-800 group-hover/hero:border-sky-500/60 transition-colors bg-[#0B101D] min-h-[260px] lg:min-h-[380px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {!heroImgFailed ? (
                    <img
                      src={nexusbyeEmblemImg}
                      alt="Emblema oficial do NexusBye AI"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/hero:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-slate-900 to-slate-950">
                      <CyberGearLogo size={96} spinning theme={theme} />
                      <span className="text-sm font-medium text-slate-300">NexusBye AI</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070A12]/85 via-black/15 to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CyberGearLogo size={24} spinning theme={theme} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">NexusBye AI</p>
                        <p className="text-xs text-slate-300 truncate">
                          Clique para abrir o chat
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-400/90 text-slate-950 text-xs font-semibold shrink-0">
                      <span>Entrar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-width 4-column summary strip */}
            <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="font-mono tabular-nums text-2xl font-bold text-white">4 modos</div>
                <p className="mt-1 text-sm text-slate-400">
                  Padrão, Cyber, Dev detalhado e Direto
                </p>
              </div>
              <div>
                <div className="font-mono tabular-nums text-2xl font-bold text-white">5+ fontes</div>
                <p className="mt-1 text-sm text-slate-400">
                  Busca paralela em web, artigos e mapas
                </p>
              </div>
              <div>
                <div className="font-mono tabular-nums text-2xl font-bold text-white">Voz real</div>
                <p className="mt-1 text-sm text-slate-400">
                  Envio de áudio pelo microfone e narração
                </p>
              </div>
              <div>
                <div className="font-mono tabular-nums text-2xl font-bold text-white">
                  Memória global
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Lembra conversas antigas e seus gostos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Bento Grid */}
        <section id="recursos" className="scroll-mt-16 border-b border-slate-800/80 bg-[#090D18]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="max-w-2xl mb-12 space-y-3">
              <div className="text-xs font-mono text-sky-400">Recursos principais</div>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                style={{ textWrap: 'balance' }}
              >
                Projetado para resolver dúvidas do dia a dia e projetos complexos.
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Cada engrenagem do NexusBye AI trabalha em conjunto para entregar respostas
                precisas, fáceis de ler e adaptadas ao seu jeito de conversar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Wide Card 01 */}
              <div className="md:col-span-2 p-6 sm:p-8 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      01 · Pesquisa e Tempo Real
                    </span>
                    <Globe className="w-5 h-5 text-sky-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Pesquisa multi-sites com profundidade automática
                  </h3>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                    Para perguntas simples, o NexusBye AI responde em instantes. Quando você pede um
                    estudo avançado, ele consulta Wikipédia, artigos acadêmicos, repositórios de
                    código, clima e coordenadas geográficas com fontes clicáveis.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                  <span>Previsão do tempo real</span>
                  <span aria-hidden="true">·</span>
                  <span>Distâncias e coordenadas geográficas</span>
                  <span aria-hidden="true">·</span>
                  <span>Referências verificadas</span>
                </div>
              </div>

              {/* Card 02 */}
              <div className="p-6 sm:p-8 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      02 · Voz e Áudio
                    </span>
                    <Mic className="w-5 h-5 text-sky-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Escuta sua voz e narra respostas
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Grave mensagens de áudio direto pelo microfone para o NexusBye AI ouvir e
                    responder em português natural, ou clique em ouvir em qualquer resposta.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                  Microfone com permissão guiada no navegador
                </div>
              </div>

              {/* Card 03 */}
              <div className="p-6 sm:p-8 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      03 · Memória Contínua
                    </span>
                    <Brain className="w-5 h-5 text-sky-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Aprende com suas conversas e gostos
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Lembra assuntos de chats anteriores, entende o que você prefere pelos seus
                    likes e dislikes e sincroniza tudo na nuvem ao conectar seu e-mail.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                  Sincronização por e-mail
                </div>
              </div>

              {/* Wide Card 04 */}
              <div className="md:col-span-2 p-6 sm:p-8 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      04 · Arquivos, Câmera e Localização
                    </span>
                    <div className="flex items-center gap-3 text-sky-400">
                      <FolderOpen className="w-5 h-5" />
                      <MapPin className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Leitura de documentos, Google Drive e contexto local
                  </h3>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                    Envie PDFs, códigos, imagens da câmera ou importe arquivos diretamente do seu
                    Google Drive. Ative o botão de localização quando quiser respostas adaptadas à
                    sua cidade, clima e fuso horário.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                  <span>Google Drive integrado</span>
                  <span aria-hidden="true">·</span>
                  <span>Enquetes interativas e tabelas</span>
                  <span aria-hidden="true">·</span>
                  <span>Organização por projetos</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture & Description Section */}
        <section id="arquitetura" className="scroll-mt-16 border-b border-slate-800/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-5 flex">
                <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-[#0B101D] min-h-[260px]">
                  {!coreImgFailed ? (
                    <img
                      src={researchCoreImg}
                      alt="Camadas estruturais da arquitetura do NexusBye AI"
                      referrerPolicy="no-referrer"
                      onError={() => setCoreImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-8 bg-slate-900">
                      <CyberGearLogo size={80} theme={theme} />
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <div className="text-xs font-mono text-sky-400">Sobre o NexusBye AI</div>
                <h2
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                  style={{ textWrap: 'balance' }}
                >
                  Um assistente feito para ser útil, leve de ler e sempre atualizado.
                </h2>
                <p className="text-slate-300 text-base leading-relaxed">
                  Criado por Paulo Victor na NexusBye com foco em clareza e velocidade, o NexusBye
                  AI evita respostas genéricas e burocráticas. Ele organiza informações importantes
                  com destaques, tabelas e enquetes interativas, e só faz perguntas quando realmente
                  falta um detalhe do assunto.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Três visuais para o seu estilo
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                      Alterne entre os temas Cyber, Nebulosa e Simples direto na barra superior —
                      mudando inclusive as cores da engrenagem.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Acesso direto com seu e-mail
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                      Depois que você informa seu e-mail uma vez, o NexusBye AI abre direto na área
                      de conversa nas próximas visitas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Persona Modes Section */}
        <section id="modos" className="scroll-mt-16 border-b border-slate-800/80 bg-[#090D18]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div className="space-y-2 max-w-xl">
                <div className="text-xs font-mono text-sky-400">Modos de personalidade</div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Escolha como o NexusBye AI responde você.
                </h2>
              </div>

              {/* Interactive segmented control */}
              <div
                role="tablist"
                aria-label="Modos de resposta do NexusBye AI"
                className="inline-flex items-center gap-1 p-1 bg-[#0D1322] border border-slate-800 rounded-lg self-start"
              >
                {PERSONA_PREVIEWS.map((item) => {
                  const isActive = item.id === activePersona;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActivePersona(item.id)}
                      className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-sky-400 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-5 p-6 sm:p-8 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="text-xs font-mono text-sky-400">
                    Modo {selectedPersonaData.label}
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {selectedPersonaData.title}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    {selectedPersonaData.summary}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onEnterChat(selectedPersonaData.sampleQuestion, selectedPersonaData.id)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Testar modo {selectedPersonaData.label}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 p-6 sm:p-8 rounded-xl bg-[#0D1322] border border-slate-800 flex flex-col justify-center gap-5">
                <div className="space-y-1.5">
                  <div className="text-xs font-mono text-slate-400">Pergunta de exemplo</div>
                  <p className="text-sm sm:text-base font-medium text-white">
                    “{selectedPersonaData.sampleQuestion}”
                  </p>
                </div>

                <div className="h-px bg-slate-800" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-sky-400">
                    <CyberGearLogo size={16} glow={false} theme={theme} />
                    <span>Resposta no estilo {selectedPersonaData.label}</span>
                  </div>
                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                    {selectedPersonaData.sampleAnswer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Public Access & Share Section */}
        <section id="acesso" className="scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <div className="p-8 sm:p-12 rounded-2xl bg-[#0D1322] border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <CyberGearLogo size={24} glow={false} theme={theme} />
                  <span className="text-xs font-mono text-sky-400">Acesso público direto</span>
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                  style={{ textWrap: 'balance' }}
                >
                  Pronto para conversar ou compartilhar o NexusBye AI.
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Compartilhe o endereço abaixo ou clique em acessar para abrir a tela do chat do
                  NexusBye AI agora mesmo.
                </p>
                {publicUrl && (
                  <p className="text-xs font-mono text-slate-400 break-all pt-1">{publicUrl}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPublicLink}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Link copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar link público</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={openChatLauncher}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Abrir Chat</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060911]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2.5 text-slate-200 font-medium">
            <CyberGearLogo size={18} glow={false} theme={theme} />
            <span>NexusBye AI</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400 font-normal">Criado por Paulo Victor</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#recursos" className="hover:text-white transition-colors">
              Recursos
            </a>
            <a href="#arquitetura" className="hover:text-white transition-colors">
              Sobre
            </a>
            <a href="#modos" className="hover:text-white transition-colors">
              Modos
            </a>
            <button
              type="button"
              onClick={openChatLauncher}
              className="text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
            >
              Abrir Chat
            </button>
          </div>
        </div>
      </footer>

      {/* Chat Launcher Modal (revealed when visitor clicks on the site) */}
      {isLauncherOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nexusbye-launcher-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsLauncherOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#0B111E] border border-slate-700/80 shadow-2xl overflow-hidden"
          >
            {/* Visual Banner inside launcher */}
            <div className="relative h-36 bg-[#070A12] overflow-hidden border-b border-slate-800">
              {!heroImgFailed ? (
                <img
                  src={nexusbyeEmblemImg}
                  alt="NexusBye AI"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-85"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CyberGearLogo size={56} spinning theme={theme} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B111E] via-[#0B111E]/35 to-transparent" />

              <button
                type="button"
                onClick={() => setIsLauncherOpen(false)}
                aria-label="Fechar"
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3 left-5 right-12 flex items-center gap-2.5">
                <CyberGearLogo size={26} spinning theme={theme} />
                <div>
                  <h2 id="nexusbye-launcher-title" className="text-lg font-bold text-white leading-tight">
                    NexusBye AI
                  </h2>
                  <p className="text-xs text-slate-300">
                    Entre com seu e-mail ou abra o chat direto
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Quick Ask & Open Chat directly */}
              <form onSubmit={handleQuickSubmit} className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  Abrir conversa agora
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    placeholder="Escreva uma pergunta opcional..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#070A12] border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => onEnterChat(quickPrompt.trim() || undefined, activePersona)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Abrir Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="h-px bg-slate-800" />

              {/* Email Input to permanently go straight to chat */}
              <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
                <div className="space-y-1">
                  <label
                    htmlFor="nexusbye-email-input"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Ou coloque seu e-mail para ir direto só para o chat nas próximas vezes
                  </label>
                  <p className="text-xs text-slate-400">
                    Ao salvar seu e-mail, esta tela de apresentação deixa de aparecer e abre apenas
                    o chat.
                  </p>
                </div>

                {(emailError || authError) && (
                  <div className="px-3 py-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                    {emailError || authError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="nexusbye-email-input"
                      type="email"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      placeholder="seuemail@exemplo.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#070A12] border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Confirmar e-mail</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  disabled={isAuthLoading}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-medium text-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                  ) : (
                    <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  )}
                  <span>{isAuthLoading ? 'Conectando...' : 'Entrar com E-mail Google'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
