import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';
import { ThemeMode } from '../types/chat';
import { getThemeColors } from '../utils/themeStyles';
import { cyberAudio } from '../utils/audio';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, base64: string) => void;
  theme?: ThemeMode;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  theme = 'cyber',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const colors = getThemeColors(theme);

  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      stopCamera();
      setErrorMsg(null);
      setIsCameraReady(false);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Navegador não suporta acesso direto à câmera.');
        }

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false,
          });
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('Camera access error:', err);
          setErrorMsg('Não foi possível acessar a câmera. Você também pode anexar uma foto existente.');
        }
      }
    };

    if (isOpen) {
      initCamera();
    } else {
      stopCamera();
      setCapturedPreview(null);
      setErrorMsg(null);
      setIsCameraReady(false);
    }

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  const switchCamera = () => {
    cyberAudio.playClick();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    cyberAudio.playClick();
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedPreview(dataUrl);
    }
  };

  const confirmCapture = () => {
    if (!capturedPreview) return;
    cyberAudio.playClick();
    const base64 = capturedPreview.replace(/^data:[^;]+;base64,/, '');
    onCapture(capturedPreview, base64);
    onClose();
  };

  const retake = () => {
    cyberAudio.playClick();
    setCapturedPreview(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg rounded-2xl border p-4 shadow-2xl flex flex-col ${colors.panelBg} ${colors.border}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <Camera className={`w-5 h-5 ${colors.accent}`} />
            <h3 className="font-['Space_Grotesk'] font-bold text-sm tracking-wide text-white">
              CÂMERA // ANÁLISE VISUAL NEXUS
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport container */}
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-white/10">
          {errorMsg ? (
            <div className="p-4 text-center text-xs text-amber-300 font-mono">
              <p>{errorMsg}</p>
              <label className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white cursor-pointer hover:bg-white/20 transition-colors">
                Tirar foto pelo sistema
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
                        onCapture(dataUrl, base64);
                        onClose();
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          ) : capturedPreview ? (
            <img src={capturedPreview} alt="Captura" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setIsCameraReady(true)}
                onCanPlay={() => setIsCameraReady(true)}
                className="w-full h-full object-cover"
              />
              {/* Sci-fi Crosshairs Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={`w-32 h-32 border border-dashed rounded-lg opacity-40 ${colors.borderStrong}`} />
                <div className="absolute top-3 left-3 text-[10px] font-mono text-white/60">
                  LENS OPTICAL 1.0x
                </div>
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Action controls */}
        <div className="flex items-center justify-between pt-4 mt-2">
          {capturedPreview ? (
            <>
              <button
                type="button"
                onClick={retake}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-mono transition-colors"
              >
                Tirar outra
              </button>
              <button
                type="button"
                onClick={confirmCapture}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${colors.sendBtn}`}
              >
                <Check className="w-4 h-4" />
                Usar Foto
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={switchCamera}
                disabled={Boolean(errorMsg)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors disabled:opacity-40"
                title="Trocar câmera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCapture}
                disabled={!isCameraReady || Boolean(errorMsg)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${colors.sendBtn}`}
              >
                <Camera className="w-4 h-4" />
                Capturar Foto
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-mono text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
