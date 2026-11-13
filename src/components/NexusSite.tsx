import React, { useState } from 'react';
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
} from 'lucide-react';
import { CyberGearLogo } from './CyberGearLogo';
import { PersonaMode, ThemeMode } from '../types/chat';
import { getPublicNexusUrl } from './Navbar';
import heroGearImg from '../assets/images/hero_nexus_gear_1794526153247.jpg';
import researchCoreImg from '../assets/images/nexus_research_core_1794526153590.jpg';

interface NexusSiteProps {
  theme: ThemeMode;
  onEnterChat: (initialPrompt?: string, persona?: PersonaMode) => void;
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

export const NexusSite: React.FC<NexusSiteProps> = ({ theme, onEnterChat }) => {
  const [quickPrompt, setQuickPrompt] = useState('');
  const [activePersona, setActivePersona] = useState<PersonaMode>('standard');
  const [copiedLink, setCopiedLink] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [coreImgFailed, setCoreImgFailed] = useState(false);

  const selectedPersonaData =
    PERSONA_PREVIEWS.find((p) => p.id === activePersona) || PERSONA_PREVIEWS[0];

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickPrompt.trim();
    onEnterChat(cleaned || undefined, activePersona);
  };

  const handleCopyPublicLink = async () => {
    const publicUrl = getPublicNexusUrl();
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2600);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2600);
    }
  };

  const publicUrl = getPublicNexusUrl();

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#070A12] text-slate-100 font-['Plus_Jakarta_Sans'] antialiased selection:bg-sky-500/30 selection:text-sky-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070A12]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand lockup with Gear Logo + single-line wordmark */}
          <a
            href="#inicio"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md"
          >
            <CyberGearLogo size={26} glow={false} theme={theme} />
            <span>Nexus AI</span>
          </a>

          {/* Zone 2: 4 single-line text links */}
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
              Arquitetura
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

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onEnterChat()}
              className="px-4 py-2 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Abrir Chat
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section id="inicio" className="border-b border-slate-800/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Column: Value Proposition + Interactive Quick-Ask */}
              <div className="lg:col-span-6 flex flex-col justify-between gap-8">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <span>Nexus AI</span>
                    <span aria-hidden="true">·</span>
                    <span>Desenvolvido pela NexusBye</span>
                    <span aria-hidden="true">·</span>
                    <span>Acesso gratuito no navegador</span>
                  </div>

                  <h1
                    className="font-bold tracking-tight text-white leading-[1.08]"
                    style={{
                      fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                      textWrap: 'balance',
                    }}
                  >
                    Inteligência artificial rápida, amigável e com memória contínua.
                  </h1>

                  <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                    O Nexus AI conversa de forma natural em português, pesquisa em múltiplas fontes
                    em tempo real, entende mensagens de áudio, lê arquivos do seu Google Drive e
                    lembra do que você gosta entre uma conversa e outra.
                  </p>
                </div>

                {/* Quick Ask Interactive Launcher */}
                <div className="space-y-4">
                  <form
                    onSubmit={handleQuickSubmit}
                    className="flex flex-col sm:flex-row gap-2.5 p-2 bg-[#0D1322] border border-slate-800 rounded-xl focus-within:border-sky-500/60 transition-colors"
                  >
                    <input
                      type="text"
                      value={quickPrompt}
                      onChange={(e) => setQuickPrompt(e.target.value)}
                      placeholder="Pergunte qualquer coisa ao Nexus AI..."
                      aria-label="Pergunte qualquer coisa ao Nexus AI"
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none min-w-0"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>{quickPrompt.trim() ? 'Enviar pergunta' : 'Conversar agora'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <p className="text-xs text-slate-400">
                    Não exige cadastro obrigatório para começar. Você pode conectar seu e-mail
                    quando quiser salvar suas memórias na nuvem.
                  </p>
                </div>
              </div>

              {/* Right Column: Precision Gear Artwork */}
              <div className="lg:col-span-6 flex">
                <div className="relative w-full rounded-xl overflow-hidden border border-slate-800/90 bg-[#0B101D] min-h-[260px] lg:min-h-[380px]">
                  {!heroImgFailed ? (
                    <img
                      src={heroGearImg}
                      alt="Engrenagem central de precisão representando o núcleo do Nexus AI"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-slate-900 to-slate-950">
                      <CyberGearLogo size={96} spinning theme={theme} />
                      <span className="text-sm font-medium text-slate-300">
                        Núcleo Neural Nexus AI
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070A12]/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <CyberGearLogo size={24} spinning theme={theme} />
                      <span className="text-sm font-medium text-slate-100">
                        Núcleo de Engrenagem Neural NexusBye
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-width 4-column summary strip below hero */}
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
        <section id="recursos" className="border-b border-slate-800/80 bg-[#090D18]">
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
                Cada engrenagem do sistema trabalha em conjunto para entregar respostas precisas,
                fáceis de ler e adaptadas ao seu jeito de conversar.
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
                    Para perguntas simples, o Nexus AI responde em instantes. Quando você pede um
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
                    Grave mensagens de áudio direto pelo microfone para o Nexus AI ouvir e
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
                  Sincronização por conta opcional
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
        <section id="arquitetura" className="border-b border-slate-800/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-5 flex">
                <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-[#0B101D] min-h-[260px]">
                  {!coreImgFailed ? (
                    <img
                      src={researchCoreImg}
                      alt="Camadas ópticas e estruturais da arquitetura do Nexus AI"
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
                <div className="text-xs font-mono text-sky-400">Sobre o Nexus AI</div>
                <h2
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                  style={{ textWrap: 'balance' }}
                >
                  Um assistente feito para ser útil, leve de ler e sempre atualizado.
                </h2>
                <p className="text-slate-300 text-base leading-relaxed">
                  Criado pela NexusBye com foco em clareza e velocidade, o Nexus AI evita respostas
                  genéricas e burocráticas. Ele organiza informações importantes com destaques,
                  tabelas e enquetes interativas, e só faz perguntas quando realmente falta um
                  detalhe do assunto que você está resolvendo.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Três visuais para o seu estilo
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                      Alterne entre os temas Cyber, Nebulosa e Simples direto na barra superior —
                      inclusive mudando as cores da engrenagem.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Atualizações em tempo real no site
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                      Este site e o chat funcionam no mesmo sistema: qualquer melhoria feita no
                      projeto passa a valer aqui automaticamente após publicar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Persona Modes Section */}
        <section id="modos" className="border-b border-slate-800/80 bg-[#090D18]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div className="space-y-2 max-w-xl">
                <div className="text-xs font-mono text-sky-400">Modos de personalidade</div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Escolha como o Nexus AI responde você.
                </h2>
              </div>

              {/* Interactive segmented control */}
              <div
                role="tablist"
                aria-label="Modos de resposta do Nexus AI"
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
        <section id="acesso">
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
                  Pronto para conversar ou compartilhar o Nexus AI com outras pessoas.
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Compartilhe o endereço público abaixo com amigos ou equipe depois de publicar o
                  aplicativo no AI Studio. Todos podem abrir o site diretamente pelo navegador.
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
                  onClick={() => onEnterChat()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Acessar Nexus AI</span>
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
            <span>Nexus AI</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400 font-normal">Desenvolvido pela NexusBye</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#recursos" className="hover:text-white transition-colors">
              Recursos
            </a>
            <a href="#arquitetura" className="hover:text-white transition-colors">
              Arquitetura
            </a>
            <a href="#modos" className="hover:text-white transition-colors">
              Modos
            </a>
            <button
              type="button"
              onClick={() => onEnterChat()}
              className="text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
            >
              Abrir Chat
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
