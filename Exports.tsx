import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Ship, Search, Plus, Eye, Edit2, Trash2, CheckCircle, FileText, Download, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import ExportPrintout from './ExportPrintout';

export default function Exports() {
  const { tenantId, user } = useAuth();
  const { success, error } = useToast();
  const [exportsList, setExportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<any>(null); // the doc to print
  const [printDocType, setPrintDocType] = useState<'proforma' | 'final' | 'packing'>('proforma');
  
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    status: 'proforma',
    clientName: '',
    clientAddress: '',
    clientMobile: '',
    clientEmail: '',
    portOfLoading: 'ALGER PORT',
    portOfDischarge: '',
    currency: '€',
    freightAmount: 0,
    paymentMode: '40% Advanced, 60% LC',
    remark: 'allocation de quantité et de valeur: ± 10%',
    numberOfPackages: 0,
    clientBankName: 'Société Générale',
    clientBankAddress: 'PARIS MIRABEAU 1A7 rue de Remusat 75016 Paris',
    clientBankAccount: '00027000581',
    clientBankSwift: 'SOGEFRPP',
    clientBankIban: 'FR76 3000 3030 4100 0270 0058 168',
    items: [] as any[]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'exports'), where('tenantId', '==', tenantId), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setExportsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  const calculateTotals = (items: any[], freight: number) => {
    let fob = 0;
    items.forEach(item => { fob += (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0); });
    return {
      totalFob: fob,
      totalCfr: fob + (parseFloat(freight as any) || 0)
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    if (formData.items.length === 0) {
      error("Veuillez rajouter au moins un article");
      return;
    }
    const { totalFob, totalCfr } = calculateTotals(formData.items, formData.freightAmount);
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'exports'), {
        ...formData,
        tenantId,
        totalFob,
        totalCfr,
        createdAt: serverTimestamp(),
        createdBy: user?.displayName
      });
      success("Document créé avec succès");
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      error("Erreur de création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Êtes-vous sûr de supprimer ce document ?")) return;
    try {
      await deleteDoc(doc(db, 'exports', id));
      success("Document supprimé");
    } catch(err) { console.error(err); error("Erreur suppression"); }
  };

  const markAsFinal = async (id: string) => {
    if(!window.confirm("Convertir cette Proforma en Facture Finale ?")) return;
    try {
      await updateDoc(doc(db, 'exports', id), { status: 'final', updatedAt: serverTimestamp() });
      success("Facture finalisée !");
    } catch(err) { console.error(err); error("Erreur lors de la finalisation"); }
  };

  const resetForm = () => {
    setFormData({
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      status: 'proforma',
      clientName: '',
      clientAddress: '',
      clientMobile: '',
      clientEmail: '',
      portOfLoading: 'ALGER PORT',
      portOfDischarge: '',
      currency: '€',
      freightAmount: 0,
      paymentMode: '40% Advanced, 60% LC',
      remark: 'allocation de quantité et de valeur: ± 10%',
      numberOfPackages: 0,
      clientBankName: 'Société Générale',
      clientBankAddress: 'PARIS MIRABEAU 1A7 rue de Remusat 75016 Paris',
      clientBankAccount: '00027000581',
      clientBankSwift: 'SOGEFRPP',
      clientBankIban: 'FR76 3000 3030 4100 0270 0058 168',
      items: []
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', unit: 'Kg', quantity: 1, unitPrice: 0 }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const filtered = React.useMemo(() => {
    return exportsList.filter(e => 
      e.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, exportsList]);

  if(printDoc) {
    return <ExportPrintout data={printDoc} type={printDocType} onClose={() => setPrintDoc(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Ship className="text-[#136AA8]" size={28} />
          Exports (Proforma & Factures)
        </h1>
        <p className="text-slate-500 mt-2 font-medium">Gérez vos expéditions, factures proforma et listes de colisage.</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" placeholder="Rechercher (N° Facture, Client)..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="outline-none text-sm w-full font-medium"
          />
        </div>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="px-5 py-3 bg-[#136AA8] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition">
          <Plus size={20} /> Nouvelle Proforma
        </button>
      </div>

      <div className="grid gap-4">
        {filtered.map(exp => (
          <motion.div key={exp.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg">{exp.invoiceNumber}</h3>
                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg ${exp.status === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                  {exp.status === 'final' ? 'Facture Finale' : 'Proforma'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Client : <span className="font-bold text-slate-700">{exp.clientName}</span> | Date: {exp.date}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
               <button onClick={() => { setPrintDoc(exp); setPrintDocType('proforma'); }} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg flex items-center gap-2 text-xs font-bold border border-slate-200 transition">
                 <FileText size={16} /> Print Proforma
               </button>
               {exp.status === 'final' && (
                 <>
                  <button onClick={() => { setPrintDoc(exp); setPrintDocType('final'); }} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg flex items-center gap-2 text-xs font-bold border border-blue-200 transition">
                    <FileText size={16} /> Print Finale
                  </button>
                  <button onClick={() => { setPrintDoc(exp); setPrintDocType('packing'); }} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2 text-xs font-bold border border-emerald-200 transition">
                    <Ship size={16} /> Packing List
                  </button>
                 </>
               )}
               {exp.status === 'proforma' && (
                 <button onClick={() => markAsFinal(exp.id)} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2 text-xs font-bold border border-emerald-200 transition">
                   <CheckCircle size={16} /> Valider (Facture Finale)
                 </button>
               )}
               <button onClick={() => handleDelete(exp.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">
                 <Trash2 size={16} />
               </button>
            </div>
          </motion.div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800">Créer Facture Proforma</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-6">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Numéro Facture</label>
                   <input required value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1 font-bold" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Date</label>
                   <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1 font-bold" />
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Client Name</label>
                   <input required value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Client Address</label>
                   <input value={formData.clientAddress} onChange={e => setFormData({...formData, clientAddress: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Client Mobile</label>
                   <input value={formData.clientMobile} onChange={e => setFormData({...formData, clientMobile: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Client Email</label>
                   <input type="email" value={formData.clientEmail} onChange={e => setFormData({...formData, clientEmail: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Port de Chargement</label>
                   <input value={formData.portOfLoading} onChange={e => setFormData({...formData, portOfLoading: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Port de Déchargement</label>
                   <input value={formData.portOfDischarge} onChange={e => setFormData({...formData, portOfDischarge: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
               </div>

               <div>
                 <div className="flex justify-between items-center mb-2">
                   <h3 className="font-bold">Articles</h3>
                   <button type="button" onClick={addItem} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={16}/> Ajouter</button>
                 </div>
                 <div className="space-y-3">
                   {formData.items.map((item, idx) => (
                     <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 border rounded-xl">
                       <input placeholder="Description" required value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="flex-1 p-2 border rounded-lg text-sm" />
                       <input placeholder="Unité" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-20 p-2 border rounded-lg text-sm" />
                       <input type="number" placeholder="Quantité" required value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-24 p-2 border rounded-lg text-sm" />
                       <input type="number" step="0.01" placeholder="Prix U" required value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} className="w-24 p-2 border rounded-lg text-sm" />
                       <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-4">
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Devise</label>
                   <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1 font-bold">
                     <option value="€">EUR (€)</option>
                     <option value="$">USD ($)</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Fret Maritime</label>
                   <input type="number" step="0.01" required value={formData.freightAmount} onChange={e => setFormData({...formData, freightAmount: parseFloat(e.target.value) || 0})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1 font-bold" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Nb de Colis</label>
                   <input type="number" value={formData.numberOfPackages} onChange={e => setFormData({...formData, numberOfPackages: parseInt(e.target.value) || 0})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1 font-bold" />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Mode de Paiement</label>
                   <input value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-slate-500 uppercase">Remarque</label>
                   <input value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl mt-1" />
                 </div>
               </div>

               <div className="bg-slate-50 p-4 border rounded-xl space-y-4">
                 <h3 className="font-bold text-slate-700 text-sm">Coordonnées Bancaires (Client / Importateur)</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-[11px] font-bold text-slate-500 uppercase">Banque</label>
                     <input value={formData.clientBankName} onChange={e => setFormData({...formData, clientBankName: e.target.value})} className="w-full p-2 bg-white border rounded mt-1" />
                   </div>
                   <div>
                     <label className="text-[11px] font-bold text-slate-500 uppercase">Adresse</label>
                     <input value={formData.clientBankAddress} onChange={e => setFormData({...formData, clientBankAddress: e.target.value})} className="w-full p-2 bg-white border rounded mt-1" />
                   </div>
                   <div>
                     <label className="text-[11px] font-bold text-slate-500 uppercase">Compte N°</label>
                     <input value={formData.clientBankAccount} onChange={e => setFormData({...formData, clientBankAccount: e.target.value})} className="w-full p-2 bg-white border rounded mt-1" />
                   </div>
                   <div>
                     <label className="text-[11px] font-bold text-slate-500 uppercase">SWIFT</label>
                     <input value={formData.clientBankSwift} onChange={e => setFormData({...formData, clientBankSwift: e.target.value})} className="w-full p-2 bg-white border rounded mt-1" />
                   </div>
                   <div className="col-span-2">
                     <label className="text-[11px] font-bold text-slate-500 uppercase">IBAN</label>
                     <input value={formData.clientBankIban} onChange={e => setFormData({...formData, clientBankIban: e.target.value})} className="w-full p-2 bg-white border rounded mt-1" />
                   </div>
                 </div>
               </div>

               <div className="pt-4 flex justify-end gap-3">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">Annuler</button>
                 <button type="submit" disabled={isSubmitting} className="px-5 py-3 font-bold text-white bg-[#136AA8] hover:bg-blue-700 rounded-xl transition flex items-center gap-2">
                   {isSubmitting ? 'Création...' : 'Créer et Enregistrer'}
                 </button>
               </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
