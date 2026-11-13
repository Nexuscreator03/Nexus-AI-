import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Globe,
  Mic,
  Square,
  Sparkles,
  X,
  Paperclip,
  Camera,
  Image as ImageIcon,
  FileText,
  MapPin,
  Trash2,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { cyberAudio } from '../utils/audio';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage';
import { ThemeMode, Attachment } from '../types/chat';
import { getThemeColors } from '../utils/themeStyles';
import { CameraModal } from './CameraModal';
import { GoogleDriveModal } from './GoogleDriveModal';

const MIC_PERM_KEY = 'nexus_mic_permission_v1';

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  onStopGeneration?: () => void;
  isLoading: boolean;
  useSearch: boolean;
  onToggleSearch: () => void;
  locationStatus?: 'idle' | 'loading' | 'active' | 'error';
  locationLabel?: string;
  locationError?: string | null;
  onToggleLocation?: () => void;
  onDismissLocationError?: () => void;
  theme?: ThemeMode;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopGeneration,
  isLoading,
  useSearch,
  onToggleSearch,
  locationStatus = 'idle',
  locationLabel,
  locationError,
  onToggleLocation,
  onDismissLocationError,
  theme = 'cyber',
}) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [inputError, setInputError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMicPrompt, setShowMicPrompt] = useState(false);
  const [micPermState, setMicPermState] = useState<'unknown' | 'granted' | 'denied'>(() => {
    return safeGetItem(MIC_PERM_KEY) === 'granted' ? 'granted' : 'unknown';
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingSecRef = useRef(0);
  const recordActionRef = useRef<'attach' | 'send' | 'cancel'>('attach');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const colors = getThemeColors(theme);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(52, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachMenu]);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (status.state === 'granted') {
            setMicPermState('granted');
            safeSetItem(MIC_PERM_KEY, 'granted');
          } else if (status.state === 'denied') {
            setMicPermState('denied');
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              setMicPermState('granted');
              safeSetItem(MIC_PERM_KEY, 'granted');
            } else if (status.state === 'denied') {
              setMicPermState('denied');
              safeRemoveItem(MIC_PERM_KEY);
            } else {
              setMicPermState('unknown');
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopStreamTracks = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleMicButtonClick = () => {
    setInputError(null);
    if (micPermState === 'granted') {
      startRecording();
      return;
    }
    cyberAudio.playClick();
    setShowMicPrompt(true);
  };

  const startRecording = async () => {
    setInputError(null);
    setShowMicPrompt(false);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setInputError('Seu navegador ou ambiente não permite captura de microfone.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermState('granted');
      safeSetItem(MIC_PERM_KEY, 'granted');
      streamRef.current = stream;
      chunksRef.current = [];

      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let chosenMime = '';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        chosenMime = candidateTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      }

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingSecRef.current = 0;
      setRecordingSec(0);
      recordActionRef.current = 'attach';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalDuration = Math.max(1, recordingSecRef.current);
        const action = recordActionRef.current;
        const mimeType = recorder.mimeType || chosenMime || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        stopStreamTracks();

        if (action === 'cancel' || audioBlob.size === 0) {
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
          const audioAtt: Attachment = {
            id: 'att-aud-' + Date.now(),
            name: `Audio_${new Date().toLocaleTimeString().replace(/:/g, '-')}.${ext}`,
            type: 'audio',
            mimeType: mimeType.split(';')[0],
            size: audioBlob.size,
            durationSec: finalDuration,
            dataUrl,
            base64Data: cleanBase64,
            source: 'local',
          };

          if (action === 'send') {
            cyberAudio.playSend();
            onSendMessage(input.trim(), [...attachments, audioAtt]);
            setInput('');
            setAttachments([]);
          } else {
            cyberAudio.playClick();
            setAttachments((prev) => [...prev, audioAtt]);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      cyberAudio.playClick();

      timerRef.current = window.setInterval(() => {
        recordingSecRef.current += 1;
        setRecordingSec(recordingSecRef.current);
        if (recordingSecRef.current >= 120) {
          finishRecording('attach');
        }
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '').toLowerCase().includes('denied');
      if (isDenied) {
        setMicPermState('denied');
        safeRemoveItem(MIC_PERM_KEY);
        setInputError(
          'Permissão do microfone bloqueada. Clique no ícone de cadeado na barra do navegador para permitir o microfone e tente novamente.'
        );
      } else {
        setInputError('Microfone indisponível neste dispositivo ou navegador.');
      }
      stopStreamTracks();
    }
  };

  const finishRecording = (mode: 'attach' | 'send' | 'cancel') => {
    recordActionRef.current = mode;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopStreamTracks();
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  // Unified robust file processor supporting Images, PDFs, Audio, Text, Code, JSON, CSV, and generic files
  const processLocalFiles = (files: FileList | File[]) => {
    setInputError(null);
    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        setInputError(`O arquivo "${file.name}" excede o limite de 15 MB.`);
        return;
      }

      const lowerName = file.name.toLowerCase();
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName);
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm|aac)$/i.test(lowerName);
      const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
      const isTextLike =
        file.type.startsWith('text/') ||
        /\.(txt|md|json|csv|xml|yaml|yml|log|js|jsx|ts|tsx|py|java|c|cpp|h|cs|go|rs|php|rb|sql|html|css|env|ini|toml)$/i.test(
          lowerName
        );

      if (isImage || isPdf || isAudio) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          const mime =
            file.type ||
            (isPdf ? 'application/pdf' : isImage ? 'image/jpeg' : 'audio/mpeg');
          const newAttachment: Attachment = {
            id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: file.name,
            type: isImage ? 'image' : isAudio ? 'audio' : 'document',
            mimeType: mime,
            size: file.size,
            dataUrl,
            base64Data: cleanBase64,
            source: 'local',
          };
          cyberAudio.playClick();
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.onerror = () => {
          setInputError(`Falha ao ler o arquivo "${file.name}".`);
        };
        reader.readAsDataURL(file);
      } else if (isTextLike) {
        const reader = new FileReader();
        reader.onload = () => {
          const textContent = ((reader.result as string) || '').slice(0, 80000);
          const newAttachment: Attachment = {
            id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: file.name,
            type: 'document',
            mimeType: file.type || 'text/plain',
            size: file.size,
            dataUrl: '',
            base64Data: '',
            textContent,
            source: 'local',
          };
          cyberAudio.playClick();
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.onerror = () => {
          setInputError(`Falha ao ler texto de "${file.name}".`);
        };
        reader.readAsText(file);
      } else {
        // Other document / binary files (e.g., .docx, .xlsx): try reading as DataURL + metadata fallback
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          const newAttachment: Attachment = {
            id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: file.name,
            type: 'document',
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl,
            base64Data: cleanBase64,
            source: 'local',
          };
          cyberAudio.playClick();
          setAttachments((prev) => [...prev, newAttachment]);
        };
        reader.onerror = () => {
          setInputError(`Formato não suportado para "${file.name}".`);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processLocalFiles(e.target.files);
    }
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processLocalFiles(e.target.files);
    }
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleCameraCapture = (dataUrl: string, base64: string) => {
    const newAttachment: Attachment = {
      id: 'att-cam-' + Date.now(),
      name: `Foto_Camera_${new Date().toLocaleTimeString().replace(/:/g, '-')}.jpg`,
      type: 'image',
      mimeType: 'image/jpeg',
      dataUrl,
      base64Data: base64,
      source: 'local',
    };
    setAttachments((prev) => [...prev, newAttachment]);
    cyberAudio.playClick();
  };

  const removeAttachment = (id: string) => {
    cyberAudio.playClick();
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    cyberAudio.playSend();
    onSendMessage(input.trim(), attachments);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const containerThemeClass =
    theme === 'simple'
      ? 'bg-[#141824]/95 border-white/20 shadow-md focus-within:border-white/50 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.12)]'
      : theme === 'nebula'
      ? 'bg-gradient-to-b from-[#13052c]/95 to-[#0a0217]/95 border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.22)] focus-within:border-purple-400 focus-within:shadow-[0_0_30px_rgba(168,85,247,0.45)]'
      : 'bg-gradient-to-b from-[#04142b]/95 to-[#020917]/95 border-cyan-400/45 shadow-[0_0_28px_rgba(34,211,238,0.2)] focus-within:border-cyan-300 focus-within:shadow-[0_0_32px_rgba(34,211,238,0.38)] backdrop-blur-xl';

  const searchToggleClass = useSearch
    ? theme === 'simple'
      ? 'bg-white/15 text-white border-white/40 shadow-sm'
      : theme === 'nebula'
      ? 'bg-purple-500/25 text-purple-200 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
      : 'bg-cyan-500/25 text-cyan-100 border-cyan-300/80 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
    : 'bg-black/30 text-slate-400 border-white/10 hover:text-slate-200';

  const locationToggleClass =
    locationStatus === 'active'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
      : locationStatus === 'loading'
      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60'
      : 'bg-black/30 text-slate-400 border-white/10 hover:text-slate-200';

  const attachBtnClass =
    theme === 'simple'
      ? 'bg-[#181d28] border-white/15 text-slate-300 hover:text-white hover:border-white/30'
      : theme === 'nebula'
      ? 'bg-[#160633] border-purple-500/30 text-purple-300 hover:text-purple-100 hover:border-purple-400/60'
      : 'bg-[#041226] border-cyan-400/30 text-cyan-300/80 hover:text-cyan-200 hover:border-cyan-300/60';

  const micBtnClass = isRecording
    ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]'
    : attachBtnClass;

  return (
    <div
      className="w-full max-w-4xl mx-auto p-2 sm:p-3 md:p-4 min-w-0 shrink-0"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processLocalFiles(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        onChange={handleDocumentSelect}
      />

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        theme={theme}
      />

      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        onAttachFile={(att) => setAttachments((prev) => [...prev, att])}
        theme={theme}
      />

      <div
        className={`relative rounded-2xl border transition-all duration-200 min-w-0 ${containerThemeClass} ${
          isDragging ? 'ring-2 ring-cyan-400 scale-[1.01]' : ''
        }`}
      >
        {/* Top input tools bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 pb-1.5 border-b border-white/10 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                cyberAudio.playClick();
                onToggleSearch();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono transition-all border ${searchToggleClass}`}
              title={useSearch ? 'Pesquisa Web Multi-Sites ativada' : 'Pesquisa Web desativada'}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Pesquisa:</span>
              <span className="font-bold">{useSearch ? 'ON' : 'OFF'}</span>
            </button>

            {onToggleLocation && (
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playClick();
                  onToggleLocation();
                }}
                disabled={locationStatus === 'loading'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono transition-all border max-w-[190px] ${locationToggleClass}`}
                title={
                  locationStatus === 'active'
                    ? `Localização ativa: ${locationLabel || 'Detectada'} (clique para desativar)`
                    : 'Detectar sua localização real para clima e mapas'
                }
              >
                {locationStatus === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {locationStatus === 'loading'
                    ? 'Detectando...'
                    : locationStatus === 'active'
                    ? locationLabel || 'GPS ON'
                    : 'Localização'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                cyberAudio.playClick();
                setIsDriveOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono transition-all border bg-black/30 text-slate-300 border-white/15 hover:border-cyan-400/60 hover:text-white"
              title="Anexar arquivos diretamente do Google Drive"
            >
              <HardDrive className={`w-3.5 h-3.5 ${colors.accent}`} />
              <span>Drive</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            {attachments.length > 0 && (
              <span className={`font-semibold ${colors.accent}`}>
                {attachments.length} {attachments.length === 1 ? 'anexo' : 'anexos'}
              </span>
            )}
            {input.length > 0 && <span>{input.length} chars</span>}
            <span className="hidden md:inline">Shift+Enter linha</span>
          </div>
        </div>

        {/* First-time Microphone Permission Prompt */}
        {showMicPrompt && !isRecording && (
          <div className="mx-3 mt-2 p-3 rounded-xl bg-cyan-950/60 border border-cyan-400/50 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn shadow-[0_0_16px_rgba(34,211,238,0.18)]">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-cyan-100">
                  Permitir acesso ao microfone?
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  Na primeira vez, confirme a permissão para deixar o microfone disponível e enviar áudios para o NEXUS AI.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                type="button"
                onClick={() => setShowMicPrompt(false)}
                className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-black/30 text-slate-300 hover:text-white text-[11px]"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playClick();
                  startRecording();
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${colors.sendBtn}`}
              >
                Permitir Microfone
              </button>
            </div>
          </div>
        )}

        {/* Inline Error Banners */}
        {(inputError || locationError) && (
          <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[11px] font-mono flex items-center justify-between gap-2">
            <span>{inputError || locationError}</span>
            <button
              type="button"
              onClick={() => {
                setInputError(null);
                onDismissLocationError?.();
              }}
              className="text-rose-300 hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attached Files Preview Strip */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2.5 px-3 pt-2.5 overflow-x-auto scrollbar-thin">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group shrink-0 flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-slate-200"
              >
                {att.type === 'image' && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                  />
                ) : att.type === 'audio' ? (
                  <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4 text-cyan-300" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {att.source === 'drive' ? (
                      <HardDrive className={`w-5 h-5 ${colors.accent}`} />
                    ) : (
                      <FileText className={`w-5 h-5 ${colors.accent}`} />
                    )}
                  </div>
                )}

                <div className="max-w-[140px] truncate text-[11px]">
                  <p className="truncate font-semibold">
                    {att.type === 'audio' ? 'Mensagem de Áudio' : att.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {att.source === 'drive' ? 'Google Drive • ' : ''}
                    {att.type === 'audio' && att.durationSec !== undefined
                      ? `${formatTimer(att.durationSec)}`
                      : att.size
                      ? `${Math.max(1, Math.round(att.size / 1024))} KB`
                      : att.type}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors ml-1"
                  title="Remover anexo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Live Recording Controls Bar OR Standard Text Input */}
        {isRecording ? (
          <div className="flex items-center justify-between gap-2 p-3 bg-rose-950/20 rounded-b-2xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-mono font-semibold text-rose-200 truncate">
                  Gravando áudio... {formatTimer(recordingSec)}
                </p>
                <p className="text-[10px] font-mono text-rose-300/70 truncate">
                  Fale naturalmente com o NEXUS AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => finishRecording('cancel')}
                className="p-2 rounded-xl border border-rose-500/40 bg-black/40 text-rose-300 hover:text-white hover:bg-rose-950/70 transition-colors"
                title="Cancelar gravação"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => finishRecording('attach')}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/70 text-xs font-mono transition-colors"
                title="Finalizar e anexar áudio"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Anexar</span>
              </button>

              <button
                type="button"
                onClick={() => finishRecording('send')}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${colors.sendBtn}`}
                title="Enviar áudio imediatamente"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex items-end gap-2 p-2.5 sm:p-3">
            {/* Attachment Menu Button */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playClick();
                  setShowAttachMenu(!showAttachMenu);
                }}
                className={`p-2.5 rounded-xl border transition-all ${attachBtnClass}`}
                title="Anexar arquivos, Google Drive, câmera ou imagem"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {showAttachMenu && (
                <div
                  className={`absolute bottom-full left-0 mb-2 w-52 rounded-2xl border p-1.5 shadow-2xl z-40 animate-fadeIn backdrop-blur-md ${colors.panelBg} ${colors.border}`}
                >
                  <div className="text-[10px] font-mono text-slate-400 px-2 py-1 uppercase tracking-wider font-semibold border-b border-white/10 mb-1">
                    Anexar para IA
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playClick();
                      setShowAttachMenu(false);
                      setIsDriveOpen(true);
                    }}
                    className="flex items-center gap-2.5 w-full p-2 rounded-xl text-xs font-mono text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <HardDrive className={`w-4 h-4 ${colors.accent}`} />
                    <span>Google Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2.5 w-full p-2 rounded-xl text-xs font-mono text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <FileText className={`w-4 h-4 ${colors.accent}`} />
                    <span>Arquivos / PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2.5 w-full p-2 rounded-xl text-xs font-mono text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ImageIcon className={`w-4 h-4 ${colors.accent}`} />
                    <span>Galeria / Imagem</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playClick();
                      setIsCameraOpen(true);
                      setShowAttachMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full p-2 rounded-xl text-xs font-mono text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Camera className={`w-4 h-4 ${colors.accent}`} />
                    <span>Abrir Câmera</span>
                  </button>
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={
                attachments.length > 0
                  ? 'Adicione uma pergunta sobre o anexo ou pressione Enviar...'
                  : 'Pergunte qualquer coisa ao NEXUS AI...'
              }
              disabled={isLoading}
              className="w-full min-w-0 bg-transparent text-slate-100 placeholder:text-slate-400/80 text-[14px] sm:text-[15px] resize-none focus:outline-none min-h-[54px] sm:min-h-[52px] max-h-[200px] py-2 px-1 leading-relaxed font-normal"
            />

            {input.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  if (textareaRef.current) textareaRef.current.style.height = '52px';
                }}
                className="p-1.5 text-slate-400 hover:text-white transition-colors shrink-0"
                title="Limpar mensagem"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleMicButtonClick}
              disabled={isLoading}
              className={`relative p-2.5 rounded-xl border transition-all shrink-0 ${micBtnClass}`}
              title={
                micPermState === 'granted'
                  ? 'Microfone disponível — clique para gravar áudio'
                  : 'Clique para permitir e usar o microfone'
              }
            >
              <Mic className="w-4 h-4" />
              {micPermState === 'granted' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              )}
            </button>

            {isLoading && onStopGeneration ? (
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playClick();
                  onStopGeneration();
                }}
                className="p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 bg-rose-500/20 border border-rose-400/70 text-rose-200 hover:bg-rose-500/35"
                title="Parar geração de resposta"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
                  (input.trim() || attachments.length > 0) && !isLoading
                    ? `${colors.sendBtn} hover:scale-105 active:scale-95`
                    : 'bg-white/5 border border-white/10 text-slate-600 cursor-not-allowed'
                }`}
                title="Enviar mensagem"
              >
                {isLoading ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={`flex items-center justify-between mt-1.5 px-2 text-[10px] font-mono ${colors.accentDim}`}
      >
        <span>NEXUS AI • NEXUSBYE</span>
        <span>DRIVE, ÁUDIO, GPS E PESQUISA PROFUNDA</span>
      </div>
    </div>
  );
};
