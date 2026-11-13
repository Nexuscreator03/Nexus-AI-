import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado na interface.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[NEXUS AI ErrorBoundary]:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full bg-[#030a18] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-cyan-500/40 bg-[#051126] p-6 text-center space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-['Space_Grotesk'] font-bold text-lg text-white">
              Ops! Algo saiu do esperado
            </h2>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              O NEXUS AI detectou uma instabilidade visual e protegeu seus dados. Clique abaixo para restaurar a tela normalmente.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-mono text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recarregar NEXUS AI</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
