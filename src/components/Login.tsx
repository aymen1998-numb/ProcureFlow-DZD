import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn, UserPlus, Loader2, Box } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const email = username.includes('@') ? username : `${username}@pms.local`;
      
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Firebase : L'authentification par email/mot-de-passe n'est pas activée.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError("Mot de passe ou identifiant incorrect.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Un compte existe déjà pour cet email.");
      } else if (err.code === 'auth/weak-password') {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else {
        setError("L'opération a échoué. Vérifiez vos informations ou votre connexion.");
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-[#136AA8] text-white shadow-xl mb-6 ring-8 ring-slate-50">
            <Box size={40} />
          </div>
          <h1 className="text-4xl font-bold text-[#136AA8] tracking-tight mb-2">ProcuraFlow</h1>
          <p className="text-slate-500 font-medium">Système de Gestion d'Entrepôt et des Achats</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                isLogin ? 'bg-white text-[#136AA8] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                !isLogin ? 'bg-white text-[#136AA8] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Créer une équipe
            </button>
          </div>

          <div className="space-y-4">
            <div>
               <label className="text-xs font-black uppercase tracking-widest text-[#136AA8] ml-1 mb-1 block">
                 {isLogin ? 'Identifiant / Email' : 'Email de l\'admin'}
               </label>
               <input
                 type={isLogin ? "text" : "email"}
                 required
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all"
                 placeholder={isLogin ? "admin" : "contact@entreprise.com"}
               />
            </div>
            <div>
               <label className="text-xs font-black uppercase tracking-widest text-[#136AA8] ml-1 mb-1 block">Mot de Passe</label>
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
            className="w-full flex items-center justify-center gap-3 bg-[#136AA8] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#152945] transition-all hover:shadow-lg hover:shadow-slate-200 active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                {isLogin ? 'Se connecter' : 'Créer l\'équipe'}
              </>
            )}
          </button>
        </form>

      <div className="mt-12 pt-8 border-t border-slate-100 text-center space-y-4">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          Mode Multi-Équipes
        </p>
        <a 
          href="https://www.linkedin.com/in/benouasser-aymen-chamssedine-93a806197?utm_source=share_via&utm_content=profile&utm_medium=member_android" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-[#136AA8] hover:text-[#009CDA] font-bold transition-colors"
        >
          Benouasser Aymen Chamssedine
        </a>
      </div>
      </motion.div>
    </div>
  );
}
