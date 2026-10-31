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
    type: 'local',
    contact: '',
    family: '',
    subFamily: '',
    nif: '', 
    nis: '',
    rc: '', 
    ai: '',
    address: '', 
    phone: '', 
    email: '',
    bankInfo: ''
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
      setFormData({ name: '', type: 'local', contact: '', family: '', subFamily: '', nif: '', nis: '', rc: '', ai: '', address: '', phone: '', email: '', bankInfo: '' });
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
            className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
          >
            <div className="px-6 py-6 sm:px-10 sm:py-8 border-b border-slate-100 flex justify-between items-center bg-[#136AA8] text-white flex-shrink-0">
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
            <div className="overflow-y-auto p-6 sm:p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Fournisseur</label>
                  <select 
                    value={formData.type} 
                    onChange={e => setFormData({ ...formData, type: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#136AA8] outline-none focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all"
                  >
                    <option value="local">Local</option>
                    <option value="foreign">Étranger</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de l'établissement</label>
                  <input 
                    required 
                    placeholder="ex. SARL ALGER LOG" 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#136AA8] outline-none focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact (Nom du Gérant / Référent)</label>
                  <input placeholder="ex. M. Amir" value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white transition-all outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Famille</label>
                  <input placeholder="ex. Matière Première" value={formData.family} onChange={e => setFormData({ ...formData, family: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white transition-all outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sous Famille</label>
                  <input placeholder="ex. Emballage" value={formData.subFamily} onChange={e => setFormData({ ...formData, subFamily: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white transition-all outline-none" />
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NIS</label>
                  <input placeholder="000... (Statistique)" value={formData.nis} onChange={e => setFormData({ ...formData, nis: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">AI</label>
                  <input placeholder="000... (Article Imposition)" value={formData.ai} onChange={e => setFormData({ ...formData, ai: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
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
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Informations Bancaires</label>
                <input 
                  placeholder="RIB, Banque..." 
                  value={formData.bankInfo} 
                  onChange={e => setFormData({ ...formData, bankInfo: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" 
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
                className="w-full py-5 bg-[#136AA8] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200/50 active:scale-95 mt-4 disabled:bg-slate-400"
              >
                {loading ? 'Enregistrement...' : 'Inscrire le Fournisseur'}
              </button>
            </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
