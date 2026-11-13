import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { Attachment } from '../types/chat';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token cache ONLY (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleDriveSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Drive.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => cachedAccessToken;

export const getCurrentDriveUser = (): User | null => auth.currentUser;

export const driveSignOut = async (): Promise<void> => {
  cachedAccessToken = null;
  await auth.signOut();
};

export async function listDriveFiles(searchQuery = ''): Promise<DriveFileItem[]> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  let q = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
  if (searchQuery.trim()) {
    const escaped = searchQuery.trim().replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '30',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_EXPIRED');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Erro ao listar arquivos do Google Drive.');
  }

  const data = await res.json();
  return data.files || [];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo do Google Drive.'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadDriveFileAsAttachment(file: DriveFileItem): Promise<Attachment> {
  const token = cachedAccessToken;
  if (!token) throw new Error('AUTH_REQUIRED');

  const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
  const isGoogleSheet = file.mimeType === 'application/vnd.google-apps.spreadsheet';
  const isGoogleSlides = file.mimeType === 'application/vnd.google-apps.presentation';

  // Export Google Workspace native files as readable text/CSV
  if (isGoogleDoc || isGoogleSheet || isGoogleSlides) {
    const exportMime = isGoogleSheet ? 'text/csv' : 'text/plain';
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) {
      throw new Error(`Não foi possível exportar "${file.name}" do Google Drive.`);
    }

    const textContent = (await res.text()).slice(0, 60000);
    return {
      id: 'att-drv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: file.name,
      type: 'document',
      mimeType: exportMime,
      size: textContent.length,
      dataUrl: '',
      base64Data: '',
      textContent,
      source: 'drive',
    };
  }

  // Standard binary or text files
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(`Não foi possível baixar "${file.name}" do Google Drive.`);
  }

  const blob = await res.blob();
  const isText =
    file.mimeType.startsWith('text/') ||
    /\.(txt|md|json|csv|xml|js|ts|tsx|py|html|css)$/i.test(file.name);

  if (isText) {
    const textContent = (await blob.text()).slice(0, 60000);
    return {
      id: 'att-drv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: file.name,
      type: 'document',
      mimeType: file.mimeType || 'text/plain',
      size: blob.size,
      dataUrl: '',
      base64Data: '',
      textContent,
      source: 'drive',
    };
  }

  if (blob.size > 12 * 1024 * 1024) {
    throw new Error('Arquivo muito grande para envio direto (máximo 12 MB).');
  }

  const dataUrl = await blobToDataUrl(blob);
  const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');

  return {
    id: 'att-drv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name: file.name,
    type: isImage ? 'image' : isAudio ? 'audio' : 'document',
    mimeType: file.mimeType || 'application/octet-stream',
    size: blob.size,
    dataUrl,
    base64Data: cleanBase64,
    source: 'drive',
  };
}
