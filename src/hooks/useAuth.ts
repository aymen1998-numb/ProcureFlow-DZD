import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'buyer' | 'finance' | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Fetch or create user Profile
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            let currentRole = userDoc.data().role;
            let currentTenantId = userDoc.data().tenantId;
            
            if (!currentTenantId) {
              currentTenantId = firebaseUser.uid;
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), { tenantId: currentTenantId }, { merge: true });
              } catch (e) {
                console.error("Failed to migrate tenantId:", e);
              }
            }
            
            // Removed the old hardcoded admin@procuraflow.dz override to allow proper tenant assignment
            setRole(currentRole);
            setTenantId(currentTenantId);
            // We expose user document data in hook State? Actually let's just make it accessible 
            // We'll update the user object or return tenantId from useAuth
          } else {
            // New Uninvited User -> Creates their own Tenant
            const newTenantId = firebaseUser.uid;
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'Acheteur Anonyme',
              role: 'admin',
              tenantId: newTenantId,
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
            setRole('admin');
            setTenantId(newTenantId);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setRole(null);
        setTenantId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, role, tenantId, loading };
}
