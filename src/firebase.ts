import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CloudAccountSettings,
  Conversation,
  Project,
  Reminder,
  UserProfile,
} from './types/chat';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const accountProvider = new GoogleAuthProvider();
accountProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

function formatFirebaseAuthError(err: any, fallback: string): string {
  const code = err?.code || '';
  if (code === 'auth/popup-blocked') {
    return 'O pop-up de login foi bloqueado pelo navegador. Libere pop-ups para este site e tente novamente.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Login cancelado antes da conclusão.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este domínio ainda não está autorizado no Firebase Auth.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de rede ao conectar com sua conta Google. Verifique sua conexão.';
  }
  return err?.message || fallback;
}

export async function signInWithEmailAccount(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, accountProvider);
    return result.user;
  } catch (err: any) {
    throw new Error(formatFirebaseAuthError(err, 'Não foi possível entrar com sua conta Google.'));
  }
}

export async function signOutEmailAccount(): Promise<void> {
  await signOut(auth);
}

export async function saveCloudUserProfile(
  user: User,
  profile: UserProfile,
  settings?: CloudAccountSettings
): Promise<void> {
  if (!user.uid || !user.email) return;
  const profilePath = `users/${user.uid}/private/profile`;

  const allowedDepth = ['high', 'balanced', 'simple'].includes(profile.technicalDepth)
    ? profile.technicalDepth
    : 'high';
  const allowedVibe = ['humorous', 'technical', 'direct', 'balanced'].includes(profile.userVibe)
    ? profile.userVibe
    : 'humorous';

  const payload: Record<string, any> = {
    uid: user.uid,
    email: user.email.slice(0, 254),
    humorPreference: Boolean(profile.humorPreference),
    technicalDepth: allowedDepth,
    autonomyDecisiveness: Boolean(profile.autonomyDecisiveness),
    likedTopics: (profile.likedTopics || []).filter(Boolean).map((s) => s.slice(0, 120)).slice(0, 30),
    dislikedTopics: (profile.dislikedTopics || []).filter(Boolean).map((s) => s.slice(0, 120)).slice(0, 30),
    userVibe: allowedVibe,
    totalLikes: Math.max(0, Number(profile.totalLikes) || 0),
    totalDislikes: Math.max(0, Number(profile.totalDislikes) || 0),
    notes: (profile.notes || []).filter(Boolean).map((s) => s.slice(0, 200)).slice(0, 50),
    slangTerms: (profile.slangTerms || []).filter(Boolean).map((s) => s.slice(0, 40)).slice(0, 25),
    updatedAt: serverTimestamp(),
  };

  const cleanName = (profile.name || user.displayName || '').trim();
  if (cleanName) payload.name = cleanName.slice(0, 100);

  const cleanCity = (profile.city || '').trim();
  if (cleanCity) payload.city = cleanCity.slice(0, 100);

  if (settings) {
    if (settings.theme && ['simple', 'cyber', 'nebula'].includes(settings.theme)) {
      payload.preferredTheme = settings.theme;
    }
    if (settings.persona && ['standard', 'cyber', 'code', 'concise'].includes(settings.persona)) {
      payload.preferredPersona = settings.persona;
    }
    if (typeof settings.useSearch === 'boolean') {
      payload.preferredUseSearch = settings.useSearch;
    }
    const rp = settings.responsePrefs;
    if (rp) {
      if (rp.voiceName && ['Kore', 'Zephyr', 'Charon', 'Fenrir'].includes(rp.voiceName)) {
        payload.voiceName = rp.voiceName;
      }
      if (rp.tone && ['friendly', 'professional', 'creative', 'didactic'].includes(rp.tone)) {
        payload.responseTone = rp.tone;
      }
      if (rp.length && ['short', 'balanced', 'detailed'].includes(rp.length)) {
        payload.responseLength = rp.length;
      }
      if (rp.format && ['rich', 'bullets', 'steps', 'plain'].includes(rp.format)) {
        payload.responseFormat = rp.format;
      }
      if (typeof rp.useEmojis === 'boolean') {
        payload.responseUseEmojis = rp.useEmojis;
      }
      if (rp.fontSize && ['small', 'medium', 'large'].includes(rp.fontSize)) {
        payload.responseFontSize = rp.fontSize;
      }
      if (typeof rp.customInstructions === 'string') {
        payload.customInstructions = rp.customInstructions.slice(0, 240);
      }
    }
  }

  try {
    await setDoc(doc(db, 'users', user.uid, 'private', 'profile'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function loadCloudUserProfile(
  uid: string
): Promise<(Partial<UserProfile> & { accountSettings?: CloudAccountSettings }) | null> {
  const profilePath = `users/${uid}/private/profile`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'profile'));
    if (!snap.exists()) return null;
    const data = snap.data();

    const accountSettings: CloudAccountSettings = {};
    if (data.preferredTheme === 'simple' || data.preferredTheme === 'cyber' || data.preferredTheme === 'nebula') {
      accountSettings.theme = data.preferredTheme;
    }
    if (
      data.preferredPersona === 'standard' ||
      data.preferredPersona === 'cyber' ||
      data.preferredPersona === 'code' ||
      data.preferredPersona === 'concise'
    ) {
      accountSettings.persona = data.preferredPersona;
    }
    if (typeof data.preferredUseSearch === 'boolean') {
      accountSettings.useSearch = data.preferredUseSearch;
    }

    const syncedResponsePrefs: CloudAccountSettings['responsePrefs'] = {};
    if (data.voiceName === 'Kore' || data.voiceName === 'Zephyr' || data.voiceName === 'Charon' || data.voiceName === 'Fenrir') {
      syncedResponsePrefs.voiceName = data.voiceName;
    }
    if (data.responseTone === 'friendly' || data.responseTone === 'professional' || data.responseTone === 'creative' || data.responseTone === 'didactic') {
      syncedResponsePrefs.tone = data.responseTone;
    }
    if (data.responseLength === 'short' || data.responseLength === 'balanced' || data.responseLength === 'detailed') {
      syncedResponsePrefs.length = data.responseLength;
    }
    if (data.responseFormat === 'rich' || data.responseFormat === 'bullets' || data.responseFormat === 'steps' || data.responseFormat === 'plain') {
      syncedResponsePrefs.format = data.responseFormat;
    }
    if (typeof data.responseUseEmojis === 'boolean') {
      syncedResponsePrefs.useEmojis = data.responseUseEmojis;
    }
    if (data.responseFontSize === 'small' || data.responseFontSize === 'medium' || data.responseFontSize === 'large') {
      syncedResponsePrefs.fontSize = data.responseFontSize;
    }
    if (typeof data.customInstructions === 'string') {
      syncedResponsePrefs.customInstructions = data.customInstructions.slice(0, 240);
    }
    if (Object.keys(syncedResponsePrefs).length > 0) {
      accountSettings.responsePrefs = syncedResponsePrefs;
    }

    return {
      email: typeof data.email === 'string' ? data.email : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
      city: typeof data.city === 'string' ? data.city : undefined,
      humorPreference: typeof data.humorPreference === 'boolean' ? data.humorPreference : true,
      technicalDepth: data.technicalDepth || 'high',
      autonomyDecisiveness: typeof data.autonomyDecisiveness === 'boolean' ? data.autonomyDecisiveness : true,
      likedTopics: Array.isArray(data.likedTopics) ? data.likedTopics : [],
      dislikedTopics: Array.isArray(data.dislikedTopics) ? data.dislikedTopics : [],
      userVibe: data.userVibe || 'humorous',
      totalLikes: typeof data.totalLikes === 'number' ? data.totalLikes : 0,
      totalDislikes: typeof data.totalDislikes === 'number' ? data.totalDislikes : 0,
      notes: Array.isArray(data.notes) ? data.notes : [],
      slangTerms: Array.isArray(data.slangTerms) ? data.slangTerms.filter((s: any) => typeof s === 'string') : [],
      accountSettings: Object.keys(accountSettings).length > 0 ? accountSettings : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }
}

function sanitizeMessagesForCloud(messages: Conversation['messages']) {
  return (messages || []).slice(-120).map((m) => {
    const cleanMsg: Record<string, any> = {
      id: m.id,
      role: m.role,
      content: (m.content || '').slice(0, 18000),
      timestamp: Number(m.timestamp) || Date.now(),
    };
    if (m.error) cleanMsg.error = true;
    if (m.feedback) cleanMsg.feedback = m.feedback;
    if (m.durationMs) cleanMsg.durationMs = m.durationMs;
    if (m.groundingSources && m.groundingSources.length > 0) {
      cleanMsg.groundingSources = m.groundingSources.slice(0, 12);
    }
    if (m.attachments && m.attachments.length > 0) {
      cleanMsg.attachments = m.attachments.slice(0, 5).map((a) => ({
        id: a.id,
        name: a.name.slice(0, 120),
        type: a.type,
        mimeType: a.mimeType,
        size: a.size || 0,
        source: a.source || 'local',
        dataUrl: '',
        base64Data: '',
      }));
    }
    return cleanMsg;
  });
}

export async function saveCloudConversation(uid: string, conv: Conversation): Promise<void> {
  const safeId = conv.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `users/${uid}/conversations/${safeId}`;
  const payload: Record<string, any> = {
    id: safeId,
    ownerUid: uid,
    title: (conv.title || 'Conversa').slice(0, 200),
    messages: sanitizeMessagesForCloud(conv.messages),
    createdAt: Number(conv.createdAt) || Date.now(),
    updatedAt: Number(conv.updatedAt) || Date.now(),
  };
  if (typeof conv.isFavorite === 'boolean') payload.isFavorite = conv.isFavorite;
  if (typeof conv.isArchived === 'boolean') payload.isArchived = conv.isArchived;
  if (conv.projectId) payload.projectId = conv.projectId.slice(0, 128);

  try {
    await setDoc(doc(db, 'users', uid, 'conversations', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudConversation(uid: string, convId: string): Promise<void> {
  const safeId = convId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `users/${uid}/conversations/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'conversations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadCloudConversations(uid: string): Promise<Conversation[]> {
  const path = `users/${uid}/conversations`;
  try {
    const q = query(collection(db, 'users', uid, 'conversations'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        title: data.title || 'Conversa',
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: Number(data.createdAt) || Date.now(),
        updatedAt: Number(data.updatedAt) || Date.now(),
        isFavorite: Boolean(data.isFavorite),
        isArchived: Boolean(data.isArchived),
        projectId: data.projectId || undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCloudProject(uid: string, proj: Project): Promise<void> {
  const safeId = proj.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `users/${uid}/projects/${safeId}`;
  const payload = {
    id: safeId,
    ownerUid: uid,
    name: (proj.name || 'Projeto').slice(0, 100),
    color: (proj.color || '#06b6d4').slice(0, 30),
    createdAt: Number(proj.createdAt) || Date.now(),
  };
  try {
    await setDoc(doc(db, 'users', uid, 'projects', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudProject(uid: string, projId: string): Promise<void> {
  const safeId = projId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `users/${uid}/projects/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'projects', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadCloudProjects(uid: string): Promise<Project[]> {
  const path = `users/${uid}/projects`;
  try {
    const q = query(collection(db, 'users', uid, 'projects'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        name: data.name || 'Projeto',
        color: data.color || '#06b6d4',
        createdAt: Number(data.createdAt) || Date.now(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCloudReminder(uid: string, reminder: Reminder): Promise<void> {
  const safeId = reminder.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `users/${uid}/reminders/${safeId}`;
  const payload: Record<string, any> = {
    id: safeId,
    ownerUid: uid,
    title: (reminder.title || 'Lembrete').trim().slice(0, 200),
    completed: Boolean(reminder.completed),
    createdAt: Number(reminder.createdAt) || Date.now(),
    updatedAt: Number(reminder.updatedAt) || Date.now(),
  };
  if (typeof reminder.notes === 'string' && reminder.notes.trim()) {
    payload.notes = reminder.notes.trim().slice(0, 500);
  }
  if (typeof reminder.dueAt === 'number' && reminder.dueAt >= 0) {
    payload.dueAt = reminder.dueAt;
  } else if (reminder.dueAt === null) {
    payload.dueAt = null;
  }
  if (typeof reminder.sourceConvId === 'string' && reminder.sourceConvId.trim()) {
    payload.sourceConvId = reminder.sourceConvId.slice(0, 128);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'reminders', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudReminder(uid: string, reminderId: string): Promise<void> {
  const safeId = reminderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `users/${uid}/reminders/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'reminders', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadCloudReminders(uid: string): Promise<Reminder[]> {
  const path = `users/${uid}/reminders`;
  try {
    const q = query(collection(db, 'users', uid, 'reminders'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        title: data.title || 'Lembrete',
        notes: typeof data.notes === 'string' ? data.notes : undefined,
        dueAt: typeof data.dueAt === 'number' ? data.dueAt : null,
        completed: Boolean(data.completed),
        sourceConvId: typeof data.sourceConvId === 'string' ? data.sourceConvId : undefined,
        createdAt: Number(data.createdAt) || Date.now(),
        updatedAt: Number(data.updatedAt) || Date.now(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
