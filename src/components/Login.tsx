import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn, Loader2, ShieldCheck, Globe, Package } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const email = username.includes('@') ? username : `${username}@pms.local`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Firebase : L'authentification par email/mot-de-passe n'est pas activée. Veuillez l'activer dans la console Firebase (Authentication > Sign-in method).");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        if (username === 'admin') {
           try {
             const email = username.includes('@') ? username : `${username}@pms.local`;
             const { createUserWithEmailAndPassword } = await import('firebase/auth');
             const { setDoc, doc } = await import('firebase/firestore');
             const { db } = await import('../lib/firebase');
             const { user } = await createUserWithEmailAndPassword(auth, email, password);
             await setDoc(doc(db, 'users', user.uid), {
               uid: user.uid,
               email: email,
               displayName: 'Administrateur',
               role: 'admin',
               createdAt: new Date().toISOString()
             });
             return; // Success
           } catch (createErr: any) {
             console.error(createErr);
             if (createErr.code === 'auth/email-already-in-use') {
               setError("Mot de passe incorrect pour le compte administrateur.");
             } else if (createErr.code === 'auth/weak-password') {
               setError("Le mot de passe doit contenir au moins 6 caractères.");
             } else {
               setError("Identifiants invalides. Création automatique de l'admin impossible.");
             }
           }
        } else {
          setError("Mot de passe ou identifiant incorrect.");
        }
      } else {
        setError("Échec de la connexion. Vérifiez vos identifiants ou assurez-vous d'avoir créé le compte (Firebase).");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-[#1E3A5F] text-white shadow-xl mb-6 ring-8 ring-slate-50">
            <Package size={40} />
          </div>
          <h1 className="text-4xl font-bold text-[#1E3A5F] tracking-tight mb-2">ProcuraFlow</h1>
          <p className="text-slate-500 font-medium">Système de Gestion d'Entrepôt et des Achats</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
               <label className="text-xs font-black uppercase tracking-widest text-[#1E3A5F] ml-1 mb-1 block">Identifiant</label>
               <input
                 type="text"
                 required
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all"
                 placeholder="admin"
               />
            </div>
            <div>
               <label className="text-xs font-black uppercase tracking-widest text-[#1E3A5F] ml-1 mb-1 block">Mot de Passe</label>
               <input
                 type="password"
                 required
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all"
                 placeholder="••••••••"
               />
            </div>
          </div>

          {error && (
            <div className="p-4 text-sm bg-red-50 text-red-600 rounded-xl border border-red-100 text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#1E3A5F] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#152945] transition-all hover:shadow-lg hover:shadow-slate-200 active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                Se connecter
              </>
            )}
          </button>
        </form>

      <div className="mt-12 pt-8 border-t border-slate-100 text-center space-y-4">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          Mode Hors-Ligne & Multi-Acheteurs
        </p>
        <a 
          href="https://www.linkedin.com/in/benouasser-aymen-chamssedine-93a806197?utm_source=share_via&utm_content=profile&utm_medium=member_android" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
          Benouasser Aymen Chamssedine
        </a>
      </div>
      </motion.div>
    </div>
  );
}
