import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'superadmin' | 'buyer' | 'buyer_intl' | 'finance' | 'magasinier' | 'magasinier_central' | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Fetch or create user Profile with retry
          let userDoc = null;
          let retries = 3;
          while (retries > 0) {
            try {
              userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              break;
            } catch (err: any) {
              if (err.message && err.message.includes('offline') && retries > 1) {
                retries--;
                await new Promise(r => setTimeout(r, 1000));
              } else {
                throw err;
              }
            }
          }
          
          if (userDoc && userDoc.exists()) {
            let currentRole = userDoc.data().role;
            let currentTenantId = userDoc.data().tenantId;
            let currentUnitId = userDoc.data().unitId || null;
            
            if (!currentTenantId) {
              currentTenantId = firebaseUser.uid;
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), { tenantId: currentTenantId }, { merge: true });
              } catch (e) {
                console.error("Failed to migrate tenantId:", e);
              }
            }
            
            setRole(currentRole);
            setTenantId(currentTenantId);
            setUnitId(currentUnitId);
          } else {
            // New Uninvited User -> Creates their own Tenant
            const newTenantId = firebaseUser.uid;
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'Acheteur Anonyme',
              role: 'superadmin',
              tenantId: newTenantId,
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
            setRole('superadmin');
            setTenantId(newTenantId);
            setUnitId(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setRole(null);
        setTenantId(null);
        setUnitId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, role, tenantId, unitId, loading };
}
