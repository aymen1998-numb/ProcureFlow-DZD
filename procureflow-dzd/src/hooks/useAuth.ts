import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, safeGetDoc } from '../lib/firebase';
import { enableGmailDemoMode, disableGmailDemoMode } from '../lib/gmail';

export type UserRole = 'admin' | 'superadmin' | 'buyer' | 'buyer_intl' | 'finance' | 'magasinier' | 'magasinier_central';

export interface LocalAuthSession {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string;
  unitId?: string | null;
  isDemo?: boolean;
}

const LOCAL_STORAGE_KEY = 'procuraflow_auth_session';

export function getLocalSession(): LocalAuthSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLocalSession(session: LocalAuthSession): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
    if (session.isDemo) {
      enableGmailDemoMode();
    }
    window.dispatchEvent(new CustomEvent('procuraflow-auth-changed', { detail: session }));
  } catch (e) {
    console.error('Failed to save local session:', e);
  }
}

export function clearLocalSession(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    disableGmailDemoMode();
    window.dispatchEvent(new CustomEvent('procuraflow-auth-changed', { detail: null }));
  } catch (e) {
    console.error('Failed to clear local session:', e);
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | any | null>(() => {
    const local = getLocalSession();
    if (local) {
      return {
        uid: local.uid,
        email: local.email,
        displayName: local.displayName,
        isAnonymous: false,
      };
    }
    return auth.currentUser || null;
  });

  const [role, setRole] = useState<UserRole | null>(() => {
    const local = getLocalSession();
    return local ? local.role : null;
  });

  const [tenantId, setTenantId] = useState<string | null>(() => {
    const local = getLocalSession();
    return local ? local.tenantId : null;
  });

  const [unitId, setUnitId] = useState<string | null>(() => {
    const local = getLocalSession();
    return local ? local.unitId || null : null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    return !getLocalSession() && !auth.currentUser;
  });

  useEffect(() => {
    const handleLocalAuthChange = (e: any) => {
      const session: LocalAuthSession | null = e.detail || getLocalSession();
      if (session) {
        setUser({
          uid: session.uid,
          email: session.email,
          displayName: session.displayName,
          isAnonymous: false,
        });
        setRole(session.role);
        setTenantId(session.tenantId || 'demo-tenant-procuraflow');
        setUnitId(session.unitId || null);
        setLoading(false);
      } else if (!auth.currentUser) {
        setUser(null);
        setRole(null);
        setTenantId(null);
        setUnitId(null);
        setLoading(false);
      }
    };

    window.addEventListener('procuraflow-auth-changed', handleLocalAuthChange);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let userDoc = null;
          let retries = 2;
          while (retries > 0) {
            try {
              userDoc = await safeGetDoc(doc(db, 'users', firebaseUser.uid));
              break;
            } catch (err: any) {
              retries--;
              if (retries > 0) await new Promise(r => setTimeout(r, 600));
            }
          }

          if (userDoc && userDoc.exists()) {
            const data = userDoc.data();
            const currentRole = data.role || 'superadmin';
            let currentTenantId = data.tenantId || firebaseUser.uid;
            const currentUnitId = data.unitId || null;

            setRole(currentRole);
            setTenantId(currentTenantId);
            setUnitId(currentUnitId);
          } else {
            const newTenantId = firebaseUser.uid;
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || `${firebaseUser.uid}@procuraflow.local`,
              displayName: firebaseUser.displayName || 'Utilisateur ProcuraFlow',
              role: 'superadmin',
              tenantId: newTenantId,
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });
            } catch (err) {
              console.warn("Notice saving user profile to Firestore:", err);
            }
            setRole('superadmin');
            setTenantId(newTenantId);
            setUnitId(null);
          }
        } catch (error) {
          console.warn("Auth profile resolution notice:", error);
          setRole('superadmin');
          setTenantId(firebaseUser.uid);
        }
        setLoading(false);
      } else {
        const local = getLocalSession();
        if (local) {
          setUser({
            uid: local.uid,
            email: local.email,
            displayName: local.displayName,
            isAnonymous: false,
          });
          setRole(local.role);
          setTenantId(local.tenantId);
          setUnitId(local.unitId || null);
        } else {
          setUser(null);
          setRole(null);
          setTenantId(null);
          setUnitId(null);
        }
        setLoading(false);
      }
    });

    return () => {
      window.removeEventListener('procuraflow-auth-changed', handleLocalAuthChange);
      unsubscribe();
    };
  }, []);

  return { user, role, tenantId, unitId, loading };
}
