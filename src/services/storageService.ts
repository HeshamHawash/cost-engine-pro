import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Project, LibraryResource, ActivityTemplate } from '../types';

enum OperationType {
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
  }
}

function sanitizeData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: any = {};
  for (const key in data) {
    if (data[key] !== undefined) {
      sanitized[key] = sanitizeData(data[key]);
    }
  }
  return sanitized;
}

let isQuotaExceeded = false;

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || errMsg.includes('429')) {
    isQuotaExceeded = true;
    console.warn("Firestore Quota Exceeded. Disabling further writes for this session.");
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// ================= OFFLINE QUEUE AND SYNC RETRY SYSTEM =================

const QUEUE_STORAGE_KEY = 'cost_engine_sync_queue';

export interface QueuedOperation {
  id: string;
  userId: string;
  type: 'SAVE_RESOURCE' | 'DELETE_RESOURCE' | 'SAVE_RESOURCES_BULK' | 'SAVE_PROJECT' | 'DELETE_PROJECT' | 'SAVE_TEMPLATE' | 'DELETE_TEMPLATE';
  payload: any;
  timestamp: number;
  attempts: number;
}

function isSyncErrorTransient(error: any): boolean {
  if (!error) return false;
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (typeof error === 'object' && 'code' in error && error.code) ? String(error.code) : '';
  
  return (
    errCode === 'resource-exhausted' || 
    errCode === 'unavailable' || 
    errCode === 'deadline-exceeded' ||
    errCode === '429' ||
    errCode === '503' ||
    errMsg.includes('429') || 
    errMsg.includes('503') || 
    errMsg.includes('resource-exhausted') || 
    errMsg.includes('unavailable') ||
    errMsg.includes('quota') ||
    errMsg.includes('Quota') ||
    errMsg.includes('timeout') ||
    errMsg.includes('offline')
  );
}

function getSyncQueue(): QueuedOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(QUEUE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to read sync queue from localStorage', e);
    return [];
  }
}

function saveSyncQueue(queue: QueuedOperation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifyQueueCount();
  } catch (e) {
    console.error('Failed to save sync queue to localStorage', e);
  }
}

export function getPendingSyncCount(): number {
  return getSyncQueue().length;
}

type QueueCountListener = (count: number) => void;
const listeners = new Set<QueueCountListener>();

export function subscribeToQueueCount(listener: QueueCountListener) {
  listeners.add(listener);
  listener(getPendingSyncCount());
  return () => {
    listeners.delete(listener);
  };
}

function notifyQueueCount() {
  const count = getPendingSyncCount();
  listeners.forEach(l => l(count));
}

function queueOperationBetter(
  userId: string,
  type: QueuedOperation['type'],
  payload: any
) {
  if (typeof window === 'undefined') return;
  let queue = getSyncQueue();

  // Deduplicate saves to avoid redundant writes for the same project, template or resources
  if (type === 'SAVE_PROJECT') {
    queue = queue.filter(item => !(item.userId === userId && item.type === 'SAVE_PROJECT' && item.payload.id === payload.id));
  } else if (type === 'DELETE_PROJECT') {
    queue = queue.filter(item => !(item.userId === userId && (item.type === 'SAVE_PROJECT' || item.type === 'DELETE_PROJECT') && (item.payload.id === payload || item.payload === payload)));
  } else if (type === 'SAVE_RESOURCE') {
    queue = queue.filter(item => !(item.userId === userId && item.type === 'SAVE_RESOURCE' && item.payload.id === payload.id));
  } else if (type === 'DELETE_RESOURCE') {
    queue = queue.filter(item => !(item.userId === userId && (item.type === 'SAVE_RESOURCE' || item.type === 'DELETE_RESOURCE') && (item.payload.id === payload || item.payload === payload)));
  } else if (type === 'SAVE_TEMPLATE') {
    queue = queue.filter(item => !(item.userId === userId && item.type === 'SAVE_TEMPLATE' && item.payload.id === payload.id));
  } else if (type === 'DELETE_TEMPLATE') {
    queue = queue.filter(item => !(item.userId === userId && (item.type === 'SAVE_TEMPLATE' || item.type === 'DELETE_TEMPLATE') && (item.payload.id === payload || item.payload === payload)));
  }

  queue.push({
    id: crypto.randomUUID(),
    userId,
    type,
    payload,
    timestamp: Date.now(),
    attempts: 0
  });
  saveSyncQueue(queue);
  console.log(`[Sync Queue] Queued [${type}] for background retry. Total pending: ${queue.length}`);
}

let isRetrying = false;

export async function processQueue() {
  if (isRetrying || typeof window === 'undefined') return;
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  isRetrying = true;
  console.log(`[Sync Queue] Attempting to process ${queue.length} pending operations...`);
  
  const remaining: QueuedOperation[] = [];
  let succeededAny = false;

  for (const item of queue) {
    try {
      item.attempts++;
      if (item.type === 'SAVE_RESOURCE') {
        await setDoc(doc(db, 'users', item.userId, 'resourceLibrary', item.payload.id), sanitizeData(item.payload));
      } else if (item.type === 'SAVE_RESOURCES_BULK') {
        const CHUNK_SIZE = 400;
        const resources = item.payload;
        for (let i = 0; i < resources.length; i += CHUNK_SIZE) {
          const chunk = resources.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((res: any) => {
            const ref = doc(db, 'users', item.userId, 'resourceLibrary', res.id);
            batch.set(ref, sanitizeData(res));
          });
          await batch.commit();
        }
      } else if (item.type === 'DELETE_RESOURCE') {
        await deleteDoc(doc(db, 'users', item.userId, 'resourceLibrary', item.payload));
      } else if (item.type === 'SAVE_PROJECT') {
        await setDoc(doc(db, 'users', item.userId, 'projects', item.payload.id), sanitizeData(item.payload));
      } else if (item.type === 'DELETE_PROJECT') {
        await deleteDoc(doc(db, 'users', item.userId, 'projects', item.payload));
      } else if (item.type === 'SAVE_TEMPLATE') {
        await setDoc(doc(db, 'users', item.userId, 'activityTemplates', item.payload.id), sanitizeData(item.payload));
      } else if (item.type === 'DELETE_TEMPLATE') {
        await deleteDoc(doc(db, 'users', item.userId, 'activityTemplates', item.payload));
      }
      succeededAny = true;
      console.log(`[Sync Queue] Successfully synced queued [${item.type}] id: ${item.id}`);
    } catch (error) {
      console.warn(`[Sync Queue] Failed queued operation [${item.type}] on attempt ${item.attempts}:`, error);
      if (isSyncErrorTransient(error) && item.attempts < 15) {
        remaining.push(item);
      } else {
        console.error(`[Sync Queue] Permanent discard for [${item.type}] due to non-transient error or maximum attempts exceeded.`);
      }
    }
  }

  if (succeededAny) {
    isQuotaExceeded = false;
  }

  saveSyncQueue(remaining);
  isRetrying = false;
}

// Auto-trigger synchronizations
if (typeof window !== 'undefined') {
  // Let the client boot first, then start retries
  setTimeout(() => {
    processQueue();
  }, 4000);

  // Interval-based sync checks every 15 seconds
  setInterval(() => {
    processQueue();
  }, 15000);

  // Network Restoration Listener
  window.addEventListener('online', () => {
    console.log('[Sync Queue] Internet connection restored. Processing queue...');
    processQueue();
  });
}

// ================= RESOURCE LIBRARY =================

export async function saveResourceToLibrary(userId: string, resource: LibraryResource) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'SAVE_RESOURCE', resource);
    return;
  }
  const path = `users/${userId}/resourceLibrary/${resource.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'resourceLibrary', resource.id), sanitizeData(resource));
  } catch (error) {
    if (isSyncErrorTransient(error)) {
      queueOperationBetter(userId, 'SAVE_RESOURCE', resource);
    } else {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function saveResourcesBulk(userId: string, resources: LibraryResource[]) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'SAVE_RESOURCES_BULK', resources);
    return;
  }
  const CHUNK_SIZE = 400; // Staying under 500 limit
  for (let i = 0; i < resources.length; i += CHUNK_SIZE) {
    const chunk = resources.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(res => {
      const ref = doc(db, 'users', userId, 'resourceLibrary', res.id);
      batch.set(ref, sanitizeData(res));
    });
    try {
      await batch.commit();
    } catch (error) {
      if (isSyncErrorTransient(error)) {
        queueOperationBetter(userId, 'SAVE_RESOURCES_BULK', resources);
        break;
      } else {
        handleFirestoreError(error, OperationType.WRITE, `users/${userId}/resourceLibrary bulk chunk ${i}`);
      }
    }
  }
}

export async function fetchResourceLibrary(userId: string): Promise<LibraryResource[]> {
  const path = `users/${userId}/resourceLibrary`;
  try {
    const q = query(collection(db, 'users', userId, 'resourceLibrary'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as LibraryResource);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteResourceFromLibrary(userId: string, resourceId: string) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'DELETE_RESOURCE', resourceId);
    return;
  }
  const path = `users/${userId}/resourceLibrary/${resourceId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'resourceLibrary', resourceId));
  } catch (error) {
    if (isSyncErrorTransient(error)) {
      queueOperationBetter(userId, 'DELETE_RESOURCE', resourceId);
    } else {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

// ================= PROJECTS =================

export async function saveProject(userId: string, project: Project) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'SAVE_PROJECT', project);
    return;
  }
  const path = `users/${userId}/projects/${project.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'projects', project.id), sanitizeData(project));
  } catch (error) {
    if (isSyncErrorTransient(error)) {
      queueOperationBetter(userId, 'SAVE_PROJECT', project);
    } else {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function fetchProjects(userId: string): Promise<Project[]> {
  const path = `users/${userId}/projects`;
  try {
    const q = query(collection(db, 'users', userId, 'projects'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Project);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteProject(userId: string, projectId: string) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'DELETE_PROJECT', projectId);
    return;
  }
  const path = `users/${userId}/projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'projects', projectId));
  } catch (error) {
    if (isSyncErrorTransient(error)) {
      queueOperationBetter(userId, 'DELETE_PROJECT', projectId);
    } else {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

// ================= ACTIVITY TEMPLATES =================

export async function saveActivityTemplate(userId: string, template: ActivityTemplate) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'SAVE_TEMPLATE', template);
    return;
  }
  const path = `users/${userId}/activityTemplates/${template.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'activityTemplates', template.id), sanitizeData(template));
  } catch (error) {
    if (isSyncErrorTransient(error)) {
      queueOperationBetter(userId, 'SAVE_TEMPLATE', template);
    } else {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function fetchActivityTemplates(userId: string): Promise<ActivityTemplate[]> {
  const path = `users/${userId}/activityTemplates`;
  try {
    const q = query(collection(db, 'users', userId, 'activityTemplates'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ActivityTemplate);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteActivityTemplate(userId: string, templateId: string) {
  if (isQuotaExceeded) {
    queueOperationBetter(userId, 'DELETE_TEMPLATE', templateId);
    return;
  }
  const path = `users/${userId}/activityTemplates/${templateId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'activityTemplates', templateId));
  } catch (error) {
    if (isSyncErrorTransient(error)) {
      queueOperationBetter(userId, 'DELETE_TEMPLATE', templateId);
    } else {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}
