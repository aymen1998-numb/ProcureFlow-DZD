import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { Plus, Search, Building2, MapPin, Phone, Mail, Trash2, Edit2, X, Loader2, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';

export default function Suppliers() {
  const { role, user, tenantId } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', nif: '', rc: '', address: '', phone: '', email: '', bankInfo: '' });

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'suppliers'), where('tenantId', '==', tenantId), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const seedFakeSuppliers = async () => {
    const fakes = [
      { name: "SARL METAL LOGISTICS", address: "Z.I. Rouiba, Alger", nif: "000116090012345", rc: "16/00-0123456B15", phone: "+213 21 85 44 22", email: "contact@metalog.dz", tenantId: tenantId, createdAt: new Date().toISOString() },
      { name: "SPA ALGERIE DISTRIBUTION", address: "Dar El Beida, Alger", nif: "000316010054321", rc: "16/00-0654321B20", phone: "+213 23 45 67 89", email: "sales@alger-dist.dz", tenantId: tenantId, createdAt: new Date().toISOString() },
      { name: "EURL TECH SOLUTIONS", address: "Hamma, Alger", nif: "000516070098765", rc: "16/00-0987654B10", phone: "+213 21 66 11 00", email: "info@tech-sol.com", tenantId: tenantId, createdAt: new Date().toISOString() }
    ];
    for (const s of fakes) {
      await addDoc(collection(db, 'suppliers'), s);
    }
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingSupplierId(null);
    setFormData({ name: '', nif: '', rc: '', address: '', phone: '', email: '', bankInfo: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: any) => {
    setIsEditMode(true);
    setEditingSupplierId(supplier.id);
    setFormData({
      name: supplier.name || '',
      nif: supplier.nif || '',
      rc: supplier.rc || '',
      address: supplier.address || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      bankInfo: supplier.bankInfo || ''
    });
    setIsModalOpen(true);
  };

  const [error, setError] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);
    setError(null);
    try {
      if (!tenantId) throw new Error("Tenant ID manquant. Rechargez la page.");

      if (isEditMode && editingSupplierId) {
        await updateDoc(doc(db, 'suppliers', editingSupplierId), { ...formData, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, 'suppliers'), { 
           ...formData, 
           tenantId: tenantId,
           createdAt: new Date().toISOString(),
           createdBy: user?.displayName || user?.email || 'Unknown User'
        });
      }
      setIsModalOpen(false);
      setFormData({ name: '', nif: '', rc: '', address: '', phone: '', email: '', bankInfo: '' });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoadingForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
      } catch (err) {
        console.error("Error deleting supplier: ", err);
      }
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(suppliers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fournisseurs");
    XLSX.writeFile(workbook, "Liste_Fournisseurs.xlsx");
  };

  const filtered = suppliers.filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] tracking-tight">Fournisseurs</h2>
          <p className="text-sm text-gray-500 font-medium">Répertoire des partenaires commerciaux</p>
        </div>
        <div className="flex gap-3">
          {suppliers.length === 0 && !loading && (
            <button onClick={seedFakeSuppliers} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-bold text-xs transition-all uppercase tracking-wide border border-emerald-100">
              Initialiser Démo
            </button>
          )}
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-[#1E3A5F] rounded-xl hover:bg-slate-50 font-bold text-xs transition-all uppercase tracking-wide">
            <FileSpreadsheet size={16} />
            Excel
          </button>
          {role === 'admin' && (
            <button onClick={openCreateModal} className="flex items-center gap-2 bg-[#3B82F6] text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-blue-100 transition-all text-xs uppercase tracking-widest">
              <Plus size={18} />
              Ajouter Fournisseur
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200 max-w-md shadow-sm group focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-200 transition-all">
        <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Rechercher par nom..." 
          className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none font-medium placeholder-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(s => (
            <motion.div layout key={s.id} className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              {role === 'admin' && (
                <div className="absolute top-0 right-0 p-6 flex gap-2">
                   <button onClick={() => openEditModal(s)} className="text-slate-200 hover:text-blue-500 transition-colors p-2 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                   <button onClick={() => handleDelete(s.id)} className="text-slate-200 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              )}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-slate-50 text-[#1E3A5F] rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-[#1E3A5F] group-hover:text-white transition-all duration-500"><Building2 size={24} /></div>
                <div className="min-w-0 pr-10">
                  <h3 className="text-lg font-black text-[#1E3A5F] leading-tight truncate uppercase">{s.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Fournisseur Local</p>
                </div>
              </div>
              
              <div className="space-y-3 text-[12px] text-slate-500 font-medium">
                <div className="flex items-start gap-2.5 p-3 bg-slate-50/50 rounded-xl group-hover:bg-slate-50 transition-colors">
                  <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="truncate">{s.address || 'Adresse non renseignée'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2.5 border border-slate-100 rounded-xl">
                    <Phone size={14} className="text-emerald-500 flex-shrink-0" />
                    <span className="truncate font-mono">{s.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 border border-slate-100 rounded-xl">
                    <Mail size={14} className="text-orange-500 flex-shrink-0" />
                    <span className="truncate">{s.email || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-50 flex justify-between gap-4">
                <div className="flex-1">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Identifiant Fiscal</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{s.nif || 'N/A'}</div>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Registre Com.</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{s.rc || 'N/A'}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal - Restyled to match CreatePOModal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-[#1E3A5F] text-white">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{isEditMode ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h3>
                  <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">Enregistrement partenaire</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de l'établissement</label>
                  <input required placeholder="ex. SARL ALGER LOG" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#1E3A5F] outline-none focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NIF</label>
                    <input placeholder="000... (Fiscal)" value={formData.nif} onChange={e => setFormData({ ...formData, nif: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">RC</label>
                    <input placeholder="00B... (Registre)" value={formData.rc} onChange={e => setFormData({ ...formData, rc: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Adresse Complète</label>
                  <input placeholder="Z.I de Rouiba, Alger" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white transition-all outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Téléphone</label>
                    <input placeholder="+213..." value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Contact</label>
                    <input type="email" placeholder="contact@fournisseur.dz" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white transition-all outline-none" />
                  </div>
                </div>
                <button type="submit" disabled={loadingForm} className="w-full py-5 bg-[#1E3A5F] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200/50 active:scale-95 mt-4 disabled:bg-slate-400">
                  {loadingForm ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Inscrire le Fournisseur'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
