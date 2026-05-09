import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, where } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Shield, Plus, Users as UsersIcon, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../hooks/useAuth';

export default function Users() {
  const { tenantId } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'buyer'
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'users'), where('tenantId', '==', tenantId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => unsubscribe();
  }, [tenantId]);

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setSelectedUser(null);
    setFormData({ username: '', password: '', role: 'buyer' });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setSelectedUser(user);
    setFormData({ username: user.displayName, password: '', role: user.role });
    setError(null);
    setIsModalOpen(true);
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
      try {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', userId), { role: newRole });
      } catch (err: any) {
        console.error("Error updating role:", err);
      }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (isEditMode && editingUserId) {
         const { updateDoc } = await import('firebase/firestore');
         const updateData: any = { role: formData.role };
         await updateDoc(doc(db, 'users', editingUserId), updateData);
      } else {
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        
        const email = formData.username.includes('@') ? formData.username : `${formData.username}@pms.local`;
        
        const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, formData.password);
        await updateProfile(user, { displayName: formData.username });
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: email,
          displayName: formData.username,
          role: formData.role,
          tenantId: tenantId,
          createdAt: new Date().toISOString(),
          createdBy: "Admin" // You can pass currentUser.displayName if passed, but it's fine
        });
        
        await secondaryAuth.signOut();
      }
      
      setIsModalOpen(false);
      setFormData({ username: '', password: '', role: 'buyer' });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Cet identifiant est déjà utilisé.');
      } else if (err.code === 'auth/weak-password') {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Identifiants invalides fournis pour la création.');
      } else {
        setError(err.message || 'Erreur lors de la création ou de la mise à jour de l\'utilisateur.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center p-10 text-[#1E3A5F]">
      <Loader2 className="animate-spin w-8 h-8" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#1E3A5F] tracking-tight uppercase flex items-center gap-3">
            <UsersIcon className="text-blue-600" />
            Équipe & Utilisateurs
          </h2>
          <p className="text-slate-500 font-medium mt-1">Gérez les accès administrateurs et modérateurs (acheteurs).</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-3 rounded-2xl font-bold hover:bg-[#152945] transition-all hover:shadow-lg active:scale-95"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nouvel Utilisateur</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <motion.div key={user.id} layout className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4 relative group">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white ${user.role === 'admin' ? 'bg-indigo-500' : user.role === 'finance' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                {user.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#1E3A5F] text-lg">{user.displayName}</h3>
                <p className="text-xs text-slate-400 mb-1 truncate">{user.email}</p>
                <p className="text-[10px] text-slate-400 font-medium">Créé le : {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={user.role || 'buyer'}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none border cursor-pointer hover:shadow-sm transition-all ${user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : user.role === 'finance' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}
                  >
                    <option value="admin">Administrateur</option>
                    <option value="finance">Finance</option>
                    <option value="buyer">Modérateur / Acheteur</option>
                  </select>
                </div>
              </div>
            </div>
            <button
               onClick={() => openEditModal(user)}
               className="hidden group-hover:flex absolute top-4 right-4 bg-slate-100 text-slate-400 p-2 rounded-lg hover:bg-[#1E3A5F] hover:text-white transition-colors"
               title="Modifier l'utilisateur"
            >
               <UsersIcon size={16} /> {/* Can use an Edit icon here ideally, but using UsersIcon as fallback */}
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white rounded-[2rem] overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#1E3A5F] text-white">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{isEditMode ? 'Modifier Utilisateur' : 'Ajouter un Utilisateur'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="p-8 space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identifiant</label>
                    <input type="text" required={!isEditMode} disabled={isEditMode} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white transition-all outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="mod1" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{isEditMode ? 'Nouveau Mot De Passe (optionnel)' : 'Mot De Passe'}</label>
                    <input type="password" required={!isEditMode} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white transition-all outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200" placeholder="••••••••" minLength={6} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rôle</label>
                    <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white transition-all outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200">
                      <option value="admin">Administrateur</option>
                      <option value="finance">Finance</option>
                      <option value="buyer">Modérateur / Acheteur</option>
                    </select>
                  </div>
                  {isEditMode && selectedUser?.createdAt && (
                    <div className="pt-2">
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Créé le : {new Date(selectedUser.createdAt).toLocaleDateString('fr-FR')} à {new Date(selectedUser.createdAt).toLocaleTimeString('fr-FR')}</p>
                    </div>
                  )}
                </div>
                
                {error && <div className="text-red-500 text-xs font-bold text-center mt-2">{error}</div>}
                
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-[#1E3A5F] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-[#152945] transition-all shadow-xl active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 mt-4">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditMode ? 'Mettre à jour' : "Créer l'utilisateur"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
