import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getDoc,
  getDocs,
  DocumentReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  try {
    firestoreInstance = getFirestore(app);
  } catch {
    firestoreInstance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);

/**
 * Offline-resilient getDoc wrapper that returns an empty snapshot instead of
 * throwing 'FirebaseError: Failed to get document because the client is offline.'
 */
export async function safeGetDoc(docRef: DocumentReference): Promise<DocumentSnapshot | { exists: () => boolean; data: () => any; id: string }> {
  try {
    return await getDoc(docRef);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes('offline') || 
      msg.includes('unavailable') || 
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition'
    ) {
      console.warn(`Firestore safeGetDoc notice (offline reading ${docRef.path}):`, msg);
      return {
        id: docRef.id,
        exists: () => false,
        data: () => undefined,
      };
    }
    throw err;
  }
}

/**
 * Offline-resilient getDocs wrapper that returns an empty snapshot when offline
 */
export async function safeGetDocs(queryRef: Query): Promise<QuerySnapshot | { empty: boolean; docs: any[]; size: number; forEach: (cb: any) => void }> {
  try {
    return await getDocs(queryRef);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes('offline') || 
      msg.includes('unavailable') || 
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition'
    ) {
      console.warn('Firestore safeGetDocs notice (offline reading query):', msg);
      return {
        empty: true,
        docs: [],
        size: 0,
        forEach: () => {},
      };
    }
    throw err;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo, null, 2));
  
  // Do not crash the app for transient errors, permission notices, or offline state
  if (
    errInfo.error.includes('offline') || 
    errInfo.error.includes('unavailable') ||
    errInfo.error.includes('permission-denied') ||
    errInfo.error.includes('Missing or insufficient permissions')
  ) {
    return;
  }
}
