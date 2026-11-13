import React, { useEffect, useState } from 'react';
import {
  X,
  Search,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  File,
  Loader2,
  LogOut,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { Attachment, ThemeMode } from '../types/chat';
import {
  DriveFileItem,
  initDriveAuth,
  googleDriveSignIn,
  listDriveFiles,
  downloadDriveFileAsAttachment,
  driveSignOut,
  getDriveAccessToken,
  getCurrentDriveUser,
} from '../utils/googleDrive';
import { cyberAudio } from '../utils/audio';
import { getThemeColors } from '../utils/themeStyles';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachFile: (attachment: Attachment) => void;
  theme?: ThemeMode;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onAttachFile,
  theme = 'cyber',
}) => {
  const [needsAuth, setNeedsAuth] = useState(!getDriveAccessToken());
  const [userEmail, setUserEmail] = useState<string | null>(
    getCurrentDriveUser()?.email || null
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const colors = getThemeColors(theme);

  useEffect(() => {
    const unsub = initDriveAuth(
      (user) => {
        setUserEmail(user.email || user.displayName || 'Conta Google');
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, []);

  const loadFiles = async (query = searchQuery) => {
    setLoadingFiles(true);
    setError(null);
    try {
      const items = await listDriveFiles(query);
      setFiles(items);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED' || err?.message === 'AUTH_EXPIRED') {
        setNeedsAuth(true);
        setError('Conecte sua conta Google para visualizar seus arquivos do Drive.');
      } else {
        setError(err?.message || 'Erro ao carregar arquivos do Google Drive.');
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen && getDriveAccessToken()) {
      setNeedsAuth(false);
      loadFiles('');
    } else if (isOpen && !getDriveAccessToken()) {
      setNeedsAuth(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await googleDriveSignIn();
      if (result) {
        setUserEmail(result.user.email || result.user.displayName || 'Conta Google');
        setNeedsAuth(false);
        await loadFiles('');
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível conectar com o Google Drive.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePickFile = async (file: DriveFileItem) => {
    cyberAudio.playClick();
    setDownloadingId(file.id);
    setError(null);
    try {
      const att = await downloadDriveFileAsAttachment(file);
      onAttachFile(att);
      onClose();
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED' || err?.message === 'AUTH_EXPIRED') {
        setNeedsAuth(true);
      }
      setError(err?.message || 'Falha ao importar arquivo do Google Drive.');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderFileIcon = (mime: string) => {
    if (mime.includes('image')) return <ImageIcon className="w-4 h-4 text-sky-400" />;
    if (mime.includes('spreadsheet') || mime.includes('csv'))
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (mime.includes('presentation'))
      return <Presentation className="w-4 h-4 text-amber-400" />;
    if (mime.includes('document') || mime.includes('pdf') || mime.includes('text'))
      return <FileText className={`w-4 h-4 ${colors.accent}`} />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  const formatSize = (sizeStr?: string) => {
    if (!sizeStr) return 'Google Workspace';
    const bytes = Number(sizeStr);
    if (Number.isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border p-5 space-y-4 shadow-2xl ${colors.panelBg} ${colors.borderStrong}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${colors.badgeBg}`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-white">
                Google Drive
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Anexe documentos, planilhas, PDFs ou imagens do seu Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-mono">
            {error}
          </div>
        )}

        {needsAuth ? (
          <div className="py-6 px-3 text-center space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Entre com sua conta Google para listar e enviar arquivos do{' '}
              <strong className="text-white">Google Drive</strong> diretamente para o NEXUS AI.
            </p>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium text-sm shadow-lg transition-all disabled:opacity-60"
              >
                <div className="gsi-material-button-icon w-5 h-5 shrink-0">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
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
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Conectando...' : 'Sign in with Google'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Connected Account Bar */}
            <div className="flex items-center justify-between text-xs font-mono px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className="truncate text-slate-300">
                Conectado: <strong className="text-white">{userEmail}</strong>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadFiles(searchQuery)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Atualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await driveSignOut();
                    setNeedsAuth(true);
                    setUserEmail(null);
                    setError(null);
                    setFiles([]);
                  }}
                  className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-500/30"
                  title="Desconectar Google Drive"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* Search bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadFiles(searchQuery);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar arquivo no Drive..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="submit"
                className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold border ${colors.badgeBg}`}
              >
                Buscar
              </button>
            </form>

            {/* Files List */}
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {loadingFiles ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs font-mono text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span>Carregando arquivos do Google Drive...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="py-10 text-center text-xs font-mono text-slate-400 border border-white/10 rounded-xl">
                  Nenhum arquivo encontrado no seu Google Drive.
                </div>
              ) : (
                files.map((file) => {
                  const isDownloading = downloadingId === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      disabled={Boolean(downloadingId)}
                      onClick={() => handlePickFile(file)}
                      className="w-full text-left p-2.5 rounded-xl border border-white/10 bg-black/25 hover:bg-white/10 hover:border-cyan-400/50 transition-all flex items-center justify-between gap-3 disabled:opacity-60"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-white/5 shrink-0">
                          {renderFileIcon(file.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{file.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            {formatSize(file.size)}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-1 rounded-lg border shrink-0 ${colors.badgeBg}`}>
                        {isDownloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Anexar'
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
