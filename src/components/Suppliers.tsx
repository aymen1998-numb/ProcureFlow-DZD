import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { Plus, Search, Building2, MapPin, Phone, Mail, Trash2, Edit2, X, Loader2, FileSpreadsheet, UploadCloud } from 'lucide-react';
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
  const [formData, setFormData] = useState({ name: '', contact: '', family: '', subFamily: '', nif: '', nis: '', rc: '', ai: '', address: '', phone: '', email: '', bankInfo: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setFormData({ name: '', contact: '', family: '', subFamily: '', nif: '', nis: '', rc: '', ai: '', address: '', phone: '', email: '', bankInfo: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditMode(true);
    setEditingSupplierId(supplier.id);
    setFormData({
      name: supplier.name || '',
      contact: supplier.contact || '',
      family: supplier.family || '',
      subFamily: supplier.subFamily || '',
      nif: supplier.nif || '',
      nis: supplier.nis || '',
      rc: supplier.rc || '',
      ai: supplier.ai || '',
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
    // ... rest of it is fine ...
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
      setFormData({ name: '', contact: '', family: '', subFamily: '', nif: '', nis: '', rc: '', ai: '', address: '', phone: '', email: '', bankInfo: '' });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoadingForm(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Etes-vous sûr de vouloir supprimer ce fournisseur ?')) {
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

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingForm(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        for (const row of data as any[]) {
          // Helper to find a value by evaluating multiple possible keys (case-insensitive & trimmed)
          const getVal = (possibleKeys: string[]) => {
            const foundKey = Object.keys(row).find(k => {
              const cleanK = k.trim().toLowerCase();
              return possibleKeys.some(pk => cleanK === pk.toLowerCase() || cleanK.includes(pk.toLowerCase()));
            });
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const name = getVal(['FOURNISSEUR', 'Fournisseur', 'Nom', 'name', 'Supplier']);
          if (!name) continue; // Ignore empty rows

          await addDoc(collection(db, 'suppliers'), {
            name: name,
            contact: getVal(['CONTACT', 'Contact']),
            family: getVal(['FAMILLE', 'Famille', 'family']),
            subFamily: getVal(['SOUS FAMILLE', 'Sous Famille', 'subFamily']),
            nif: getVal(['NIF', 'N° NIF', 'N°NIF']),
            nis: getVal(['NIS', 'N°NIS', 'N° NIS']),
            rc: getVal(['RC', 'N°RC', 'N° RC']),
            ai: getVal(['ARTICLE', 'AI', 'Article d\'Imposition']),
            address: getVal(['ADRESSE', 'Adresse', 'address']),
            phone: getVal(['MOBILE', 'Mobile', 'Téléphone', 'Tel', 'phone']),
            email: getVal(['Email', 'email', 'E-mail']),
            bankInfo: getVal(['Banque', 'bankInfo']),
            tenantId: tenantId,
            createdAt: new Date().toISOString(),
            createdBy: user?.displayName || user?.email || 'Importer'
          });
        }
        alert('Import terminé avec succès!');
      } catch (err: any) {
        console.error(err);
        alert('Erreur lors de l\'importation: ' + err.message);
      } finally {
        setLoadingForm(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSuppliers.length === 0) return;
    if (window.confirm(`Voulez-vous vraiment supprimer ${selectedSuppliers.length} fournisseur(s) ?`)) {
      try {
        setLoadingForm(true);
        for (const id of selectedSuppliers) {
          await deleteDoc(doc(db, 'suppliers', id));
        }
        setSelectedSuppliers([]);
      } catch (err) {
        console.error("Error bulk deleting suppliers: ", err);
      } finally {
        setLoadingForm(false);
      }
    }
  };

  const filtered = React.useMemo(() => {
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#136AA8] tracking-tight">Fournisseurs</h2>
          <p className="text-sm text-gray-500 font-medium">Répertoire des partenaires commerciaux</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={importFromExcel} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          {suppliers.length === 0 && !loading && (
            <button onClick={seedFakeSuppliers} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-bold text-xs transition-all uppercase tracking-wide border border-emerald-100">
              Initialiser Démo
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-[#136AA8] rounded-xl hover:bg-slate-50 font-bold text-xs transition-all uppercase tracking-wide">
            <UploadCloud size={16} />
            Importer Excel
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-[#136AA8] rounded-xl hover:bg-slate-50 font-bold text-xs transition-all uppercase tracking-wide">
            <FileSpreadsheet size={16} />
            Exporter Excel
          </button>
          {['admin', 'superadmin'].includes(role || '') && (
            <button onClick={openCreateModal} className="flex items-center gap-2 bg-[#3B82F6] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#009CDA] shadow-lg shadow-blue-100 transition-all text-xs uppercase tracking-widest">
              <Plus size={18} />
              Ajouter Fournisseur
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200 max-w-md shadow-sm group focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-200 transition-all flex-1">
          <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Rechercher par nom..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none font-medium placeholder-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {['admin', 'superadmin'].includes(role || '') && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedSuppliers.length === filtered.length && filtered.length > 0) {
                  setSelectedSuppliers([]);
                } else {
                  setSelectedSuppliers(filtered.map(s => s.id));
                }
              }}
              className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              {selectedSuppliers.length === filtered.length && filtered.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            {selectedSuppliers.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-bold text-xs transition-all uppercase tracking-wide border border-red-100"
              >
                <Trash2 size={16} />
                Supprimer ({selectedSuppliers.length})
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#009CDA]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(s => (
            <motion.div layout key={s.id} className={`bg-white p-7 rounded-[2rem] border ${selectedSuppliers.includes(s.id) ? 'border-blue-400 shadow-md ring-4 ring-blue-50' : 'border-slate-100 shadow-sm'} hover:shadow-xl transition-all group relative overflow-hidden`}>
              {['admin', 'superadmin'].includes(role || '') && (
                <div className="absolute top-0 right-0 p-6 flex gap-2 items-center z-10 bg-white/80 backdrop-blur-sm rounded-bl-3xl">
                  <input 
                    type="checkbox"
                    checked={selectedSuppliers.includes(s.id)}
                    onChange={() => toggleSelection(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-2 cursor-pointer"
                  />
                  <button onClick={(e) => openEditModal(s, e)} className="text-slate-400 hover:text-blue-500 transition-colors p-2 hover:bg-blue-50 rounded-lg shadow-sm bg-white border border-slate-100"><Edit2 size={16} /></button>
                  <button onClick={(e) => handleDelete(s.id, e)} className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg shadow-sm bg-white border border-slate-100"><Trash2 size={16} /></button>
                </div>
              )}
              <div className="flex items-center gap-4 mb-6 cursor-pointer" onClick={() => ['admin', 'superadmin'].includes(role || '') && toggleSelection(s.id)}>
                <div className="w-14 h-14 bg-slate-50 text-[#136AA8] rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-[#136AA8] group-hover:text-white transition-all duration-500"><Building2 size={24} /></div>
                <div className="min-w-0 pr-10">
                  <h3 className="text-lg font-black text-[#136AA8] leading-tight truncate uppercase">{s.name || <span className="text-red-400 italic">SANS NOM</span>}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Fournisseur Local</p>
                </div>
              </div>
              
              <div className="space-y-3 text-[12px] text-slate-500 font-medium">
                {(s.family || s.subFamily) && (
                  <div className="flex gap-2">
                    {s.family && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">{s.family}</span>}
                    {s.subFamily && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">{s.subFamily}</span>}
                  </div>
                )}
                {s.contact && (
                  <div className="flex items-start gap-2.5 p-2 bg-slate-50/50 rounded-xl group-hover:bg-slate-50 transition-colors">
                    <span className="font-bold text-slate-700">Contact:</span>
                    <span className="truncate">{s.contact}</span>
                  </div>
                )}
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
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">NIF</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 truncate">{s.nif || 'N/A'}</div>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">RC</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 truncate">{s.rc || 'N/A'}</div>
                </div>
              </div>
              <div className="mt-3 flex justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">NIS</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 truncate">{s.nis || 'N/A'}</div>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">AI</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 truncate">{s.ai || 'N/A'}</div>
                </div>
              </div>
              {s.bankInfo && (
                <div className="mt-3 py-2 px-3 bg-blue-50/50 rounded-xl border border-blue-50">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">Banque / RIB</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 truncate">{s.bankInfo}</div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal - Restyled to match CreatePOModal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-[#136AA8] text-white flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{isEditMode ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h3>
                  <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">Enregistrement partenaire</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto p-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de l'établissement</label>
                  <input required placeholder="ex. SARL ALGER LOG" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#136AA8] outline-none focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all" />
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
                    <input placeholder="000... (Fiscal)" value={formData.nif} onChange={e => setFormData({ ...formData, nif: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">RC</label>
                    <input placeholder="00B... (Registre)" value={formData.rc} onChange={e => setFormData({ ...formData, rc: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
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
                  <input placeholder="Z.I de Rouiba, Alger" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white transition-all outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Informations Bancaires</label>
                  <input placeholder="RIB, Banque..." value={formData.bankInfo} onChange={e => setFormData({ ...formData, bankInfo: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:bg-white transition-all outline-none" />
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
                <button type="submit" disabled={loadingForm} className="w-full py-5 bg-[#136AA8] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200/50 active:scale-95 mt-4 disabled:bg-slate-400">
                  {loadingForm ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Inscrire le Fournisseur'}
                </button>
              </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
