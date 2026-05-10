import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddSupplierModal({ isOpen, onClose }: AddSupplierModalProps) {
  const { user, tenantId } = useAuth();
  const [formData, setFormData] = useState({ 
    name: '', 
    nif: '', 
    rc: '', 
    address: '', 
    phone: '', 
    email: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is missing. Please refresh the page.');
      }
      await addDoc(collection(db, 'suppliers'), { 
        ...formData, 
        tenantId: tenantId,
        createdAt: new Date().toISOString() 
      });
      setFormData({ name: '', nif: '', rc: '', address: '', phone: '', email: '' });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-[#1E3A5F] text-white">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Nouveau Fournisseur</h3>
                <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">Enregistrement partenaire</p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                disabled={loading}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de l'établissement</label>
                <input 
                  required 
                  placeholder="ex. SARL ALGER LOG" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#1E3A5F] outline-none focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NIF</label>
                  <input 
                    placeholder="000... (Fiscal)" 
                    value={formData.nif} 
                    onChange={e => setFormData({ ...formData, nif: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">RC</label>
                  <input 
                    placeholder="00B... (Registre)" 
                    value={formData.rc} 
                    onChange={e => setFormData({ ...formData, rc: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Adresse Complète</label>
                <input 
                  placeholder="Z.I de Rouiba, Alger" 
                  value={formData.address} 
                  onChange={e => setFormData({ ...formData, address: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white transition-all outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Téléphone</label>
                  <input 
                    placeholder="+213..." 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Contact</label>
                  <input 
                    type="email" 
                    placeholder="contact@fournisseur.dz" 
                    value={formData.email} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white transition-all outline-none" 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-[#1E3A5F] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200/50 active:scale-95 mt-4 disabled:bg-slate-400"
              >
                {loading ? 'Enregistrement...' : 'Inscrire le Fournisseur'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
