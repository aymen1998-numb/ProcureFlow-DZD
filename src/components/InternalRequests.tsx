import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, updateDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { FileText, Plus, Search, Trash2, Link as LinkIcon, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InternalRequests({ onConvertToPO }: { onConvertToPO?: (da: any) => void }) {
  const { tenantId, role, unitId, user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [units, setUnits] = useState<any[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([{ name: '', qtyInStock: 0, monthlyConsumption: 0, quantity: 1, category: '', unit: 'pcs' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const fetchUnits = async () => {
      const docRef = doc(db, 'tenant_settings', tenantId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().units) {
        setUnits(docSnap.data().units);
      }
    };
    fetchUnits();

    // Do not use complex compound queries here natively to avoid needing immediate indexes
    // Fetch all relevant active requests and filter locally if 'magasinier'
    const q = query(
        collection(db, 'purchase_requests'), 
        where('tenantId', '==', tenantId),
        where('status', 'in', ['confirmed', 'partial', 'pending'])
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter for unitId if role is magasinier
      if (role === 'magasinier' && unitId) {
          data = data.filter((d: any) => d.unitId === unitId);
      }
      
      // Sort locally by createdAt desc
      data.sort((a: any, b: any) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return b.createdAt.localeCompare(a.createdAt);
      });
      
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'purchase_requests');
    });

    return () => unsubscribe();
  }, [tenantId, role, unitId]);

  const handleCreateDA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setIsSubmitting(true);
    
    // Auto-generate DA number
    const prefix = "DA";
    const yearMonth = new Date().toISOString().slice(2, 7).replace('-', '');
    const count = requests.length + 1;
    const daNumber = `${prefix}${yearMonth}-${String(count).padStart(3, '0')}`;

    try {
      await addDoc(collection(db, 'purchase_requests'), {
        daNumber,
        tenantId,
        unitId: unitId || 'HQ',
        items: items.filter(i => i.name && i.quantity > 0),
        status: 'confirmed', // confirmed directly by magasinier
        createdBy: user?.displayName || user?.email,
        createdAt: new Date().toISOString(),
      });
      setIsModalOpen(false);
      setItems([{ name: '', qtyInStock: 0, monthlyConsumption: 0, quantity: 1, category: '', unit: 'pcs' }]);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création de la DA.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDA = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment annuler/supprimer cette demande ? Elle sera archivée.")) {
      try {
        await updateDoc(doc(db, 'purchase_requests', id), {
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          cancelledBy: user?.displayName
        });
      } catch (err) {
        console.error("Error cancelling DA", err);
      }
    }
  };

  const filteredRequests = requests.filter(r => 
    r.daNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.items?.some((i: any) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getUnitName = (uId: string) => {
    if (uId === 'HQ') return 'Siège Principal';
    const found = units.find(u => u.id === uId);
    return found ? found.name : uId;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#136AA8] tracking-tight uppercase flex items-center gap-3">
            <FileText className="text-[#009CDA]" />
            Demandes d'Achat Internes
          </h2>
          <p className="text-slate-500 font-medium mt-1">Gérez les besoins en matériel des différentes unités.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une DA..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#009CDA] focus:border-transparent outline-none shadow-sm"
            />
          </div>
          {(role === 'magasinier' || role === 'admin') && (
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#136AA8] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#152945] transition-all shadow-md active:scale-95 text-sm uppercase tracking-wide">
              <Plus size={18} /> Nouvelle DA
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#136AA8]" /></div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Aucune Demande d'Achat</h3>
          <p className="text-slate-500">Aucune demande temporaire active.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRequests.map(req => (
            <motion.div key={req.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#136AA8] font-black text-lg">{req.daNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700">Confirmée</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Unité: <span className="text-slate-800 font-bold">{getUnitName(req.unitId)}</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">Par {req.createdBy} le {new Date(req.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                {(role === 'magasinier' || role === 'admin') && (
                  <button onClick={() => handleCancelDA(req.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Annuler/Supprimer">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Articles demandés ({req.items?.length || 0})</h4>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[150px] pr-2">
                  {req.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Stock: {item.qtyInStock || 0} | Conso/mois: {item.monthlyConsumption || 0}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Qté Dem.</span>
                        <span className="text-sm font-black text-[#136AA8] leading-none">{item.quantity} {item.unit || 'pcs'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Buyer Actions */}
              {(role === 'buyer' || role === 'admin') && (
                <div className="bg-slate-50 p-4 border-t border-slate-100 mt-auto">
                  <button onClick={() => onConvertToPO && onConvertToPO(req)} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#136AA8] text-[#136AA8] py-2.5 rounded-xl font-bold hover:bg-[#136AA8] hover:text-white transition-all text-xs uppercase tracking-widest">
                    <LinkIcon size={16} /> Générer Bon de Commande
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Create DA Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-3xl bg-white rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#136AA8] text-white shrink-0">
                  <h3 className="text-lg font-black uppercase tracking-tight">Nouvelle Demande d'Achat</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Trash2 className="hidden" /><X size={18} /></button>
                </div>
                <form onSubmit={handleCreateDA} className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-4 sm:p-8 overflow-y-auto flex-1 space-y-6">
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#136AA8]">Articles à demander</h4>
                        <button type="button" onClick={() => setItems([...items, { name: '', qtyInStock: 0, monthlyConsumption: 0, quantity: 1, category: '', unit: 'pcs' }])} className="text-xs font-bold text-[#009CDA] hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                          <Plus size={14} /> Ajouter un article
                        </button>
                      </div>
                      
                      {items.map((item, index) => (
                        <div key={index} className="flex gap-3 items-start bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="grid grid-cols-12 gap-3 flex-1">
                            <div className="col-span-12 sm:col-span-4">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Désignation *</label>
                              <input required value={item.name} onChange={e => { const newItems = [...items]; newItems[index].name = e.target.value; setItems(newItems); }} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-[#009CDA] focus:ring-1 focus:ring-[#009CDA] outline-none" placeholder="Nom de l'article" />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stock</label>
                              <input type="number" min="0" step="1" required value={item.qtyInStock} onChange={e => { const newItems = [...items]; newItems[index].qtyInStock = Number(e.target.value); setItems(newItems); }} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:border-[#009CDA] focus:ring-1 focus:ring-[#009CDA] outline-none" />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conso/Mois</label>
                              <input type="number" min="0" step="1" required value={item.monthlyConsumption} onChange={e => { const newItems = [...items]; newItems[index].monthlyConsumption = Number(e.target.value); setItems(newItems); }} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:border-[#009CDA] focus:ring-1 focus:ring-[#009CDA] outline-none" />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unité</label>
                              <select value={item.unit || 'pcs'} onChange={e => { const newItems = [...items]; newItems[index].unit = e.target.value; setItems(newItems); }} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:border-[#009CDA] focus:ring-1 focus:ring-[#009CDA] outline-none">
                                <option value="pcs">Pièces</option>
                                <option value="kg">Kg</option>
                                <option value="g">G</option>
                                <option value="l">Litres</option>
                                <option value="ml">mL</option>
                                <option value="m">Mètres</option>
                                <option value="m2">m²</option>
                                <option value="m3">m³</option>
                                <option value="boxes">Boîtes</option>
                                <option value="packs">Packs</option>
                                <option value="pallets">Palettes</option>
                                <option value="rolls">Rouleaux</option>
                              </select>
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Qté Dem.</label>
                              <input type="number" min="1" step="1" required value={item.quantity} onChange={e => { const newItems = [...items]; newItems[index].quantity = Number(e.target.value); setItems(newItems); }} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:border-[#009CDA] focus:ring-1 focus:ring-[#009CDA] outline-none" />
                            </div>
                          </div>
                          {items.length > 1 && (
                            <button type="button" onClick={() => { const newItems = [...items]; newItems.splice(index, 1); setItems(newItems); }} className="mt-6 p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                  <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-[#136AA8] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-[#152945] transition-all shadow-xl active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirmer la Demande
                    </button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
