import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Plus, Search, Trash2, CheckSquare, Square, FileText, ChevronRight, X, Ship, CreditCard, Box, FileCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AddSupplierModal from './AddSupplierModal';

export default function IntlPurchases() {
  const { user, tenantId, role } = useAuth();
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'intl_purchases'), where('tenantId', '==', tenantId));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setPurchases(data);
      setLoading(false);
      
      // Update selected purchase if open
      if (selectedPurchase) {
        const updated = data.find(p => p.id === selectedPurchase.id);
        if (updated) setSelectedPurchase(updated);
        else setSelectedPurchase(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'intl_purchases'));

    return () => unsubscribe();
  }, [tenantId, selectedPurchase?.id]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet achat international ?")) return;
    try {
      await deleteDoc(doc(db, 'intl_purchases', id));
      if (selectedPurchase?.id === id) setSelectedPurchase(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `intl_purchases/${id}`);
    }
  };

  const handleCreateDirectIntlPurchase = async () => {
    if (!tenantId) return;
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      const docRef = await addDoc(collection(db, 'intl_purchases'), {
        tenantId,
        daId: 'direct',
        daNumber: `INTL-${new Date().toISOString().split('T')[0].replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`,
        items: [],
        status: 'proforma',
        isConfirmed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setSelectedPurchase({ id: docRef.id, daNumber: 'Nouveau' }); 
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'intl_purchases');
    }
  };

  const updatePurchase = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, 'intl_purchases', id), { ...data, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `intl_purchases/${id}`);
    }
  };

  const confirmPurchase = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir confirmer ce dossier ? Il ne pourra plus être modifié.")) return;
    try {
      await updateDoc(doc(db, 'intl_purchases', id), { 
        isConfirmed: true,
        confirmedBy: user?.displayName || user?.email,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString() 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `intl_purchases/${id}`);
    }
  };

  const unconfirmPurchase = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler la confirmation de ce dossier ?")) return;
    try {
      await updateDoc(doc(db, 'intl_purchases', id), { 
        isConfirmed: false,
        confirmedBy: null,
        confirmedAt: null,
        updatedAt: new Date().toISOString() 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `intl_purchases/${id}`);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'proforma': return 'Proforma (Initiée)';
      case 'payment_processing': return 'Traitement Paiement (LC/DP)';
      case 'documents_pending': return 'Attente Documents';
      case 'dedouanement': return 'Dédouanement';
      case 'completed': return 'Clôturé';
      default: return status;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proforma': return 'bg-gray-100 text-gray-700';
      case 'payment_processing': return 'bg-blue-100 text-blue-800';
      case 'documents_pending': return 'bg-yellow-100 text-yellow-800';
      case 'dedouanement': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPurchases = React.useMemo(() => {
    return purchases.filter(p => 
      (p.daNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.proformaRef || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [purchases, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#136AA8] tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6" /> Achats Internationaux
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gestion des importations, LC/DP et Dédouanement</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-white border border-slate-200 rounded-xl px-3 py-2.5 items-center gap-2 shadow-sm w-full sm:w-80 focus-within:ring-2 focus-within:ring-[#136AA8]/20 transition-all">
            <Search size={18} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher N° DA, fournisseur..." 
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none font-medium placeholder:font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {['admin', 'superadmin', 'buyer_intl'].includes(role || '') && (
            <button
              onClick={handleCreateDirectIntlPurchase}
              className="bg-[#136AA8] text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-sm whitespace-nowrap"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nouveau Dossier</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                <th className="px-5 py-4">N° Dossier / DA</th>
                <th className="px-5 py-4">Fournisseur</th>
                <th className="px-5 py-4">Infos Logistique</th>
                <th className="px-5 py-4">Dédouanement</th>
                <th className="px-5 py-4 text-center">Paiement</th>
                <th className="px-5 py-4 text-center">Statut</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Chargement des dossiers...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium font-mono">Aucun achat international trouvé.</td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} onClick={() => setSelectedPurchase(p)} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      <div>{p.daNumber}</div>
                      {p.isConfirmed && <div className="text-[9px] text-[#136AA8] mt-1 bg-blue-50 inline-block px-1.5 py-0.5 rounded uppercase font-black">Confirmé par {p.confirmedBy}</div>}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">{p.supplierName || '-'}</td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-bold text-slate-700">{p.incoterm || '-'}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.proformaRef ? `Prof: ${p.proformaRef}` : ''}</div>
                    </td>
                    <td className="px-5 py-4">
                      {p.dateArriveePort ? (
                        <>
                          <div className="text-xs font-bold text-slate-700">Arr: {new Date(p.dateArriveePort).toLocaleDateString()}</div>
                          {p.joursFranchise && (
                            <div className="text-[10px] font-mono mt-0.5 text-slate-500">Fran: {p.joursFranchise} j</div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs italic">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        {p.paymentMethod || 'Non défini'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest bg-opacity-20 ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {['admin', 'superadmin', 'buyer'].includes(role || '') && !p.isConfirmed && (
                        <button onClick={(e) => handleDelete(p.id, e)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedPurchase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedPurchase(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <PurchaseDetails 
                purchase={selectedPurchase} 
                onUpdate={(data) => updatePurchase(selectedPurchase.id, data)} 
                onConfirm={() => confirmPurchase(selectedPurchase.id)}
                onUnconfirm={() => unconfirmPurchase(selectedPurchase.id)}
                role={role}
                currentUser={user?.displayName || user?.email}
                onClose={() => setSelectedPurchase(null)}
                onAddNewSupplier={() => setIsSupplierModalOpen(true)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddSupplierModal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} />
    </div>
  );
}

function PurchaseDetails({ purchase, onUpdate, onConfirm, onUnconfirm, role, currentUser, onClose, onAddNewSupplier }: { purchase: any, onUpdate: (data: any) => void, onConfirm: () => void, onUnconfirm: () => void, role: string|null, currentUser: string|null|undefined, onClose: () => void, onAddNewSupplier: () => void }) {
  const steps = ['proforma', 'payment_processing', 'documents_pending', 'dedouanement', 'completed'];
  const currentStepIdx = steps.indexOf(purchase.status || 'proforma');
  const { tenantId } = useAuth();
  const [foreignSuppliers, setForeignSuppliers] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'suppliers'),
      where('tenantId', '==', tenantId),
      where('type', '==', 'foreign')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setForeignSuppliers(data);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const docs = purchase.documents || { facture: false, bl: false, certOrigin: false, packingList: false, revised: false };
  const allDocsChecked = docs.facture && docs.bl && docs.certOrigin && docs.packingList;
  
  const isReadOnly = purchase.isConfirmed;

  return (
    <>
      <div className="p-6 border-b border-slate-100 bg-[#136AA8] text-white shrink-0 relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors">
          <X size={20} />
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start pr-12 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="text-blue-200 text-xs font-black uppercase tracking-wider">DA SOURCE: {purchase.daNumber}</div>
              {purchase.isConfirmed && (
                <span className="bg-emerald-500/20 text-white border border-emerald-400 border-opacity-50 text-[10px] uppercase font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckSquare size={12} /> Confirmé par {purchase.confirmedBy}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold">{purchase.supplierName || 'Nouveau Dossier d\'Importation'}</h2>
          </div>
          <div className="flex items-center gap-3">
             {isReadOnly ? (
                <div className="bg-blue-900 border-none text-white text-sm font-bold uppercase tracking-widest rounded-lg py-2 px-4 select-none opacity-80 cursor-not-allowed">
                  Status: {purchase.status}
                </div>
             ) : (
               <select 
                value={purchase.status} 
                onChange={e => onUpdate({ status: e.target.value })}
                className="bg-blue-800 border-none text-white text-sm rounded-lg py-2 px-4 focus:ring-2 font-bold outline-none cursor-pointer"
               >
                 <option value="proforma">Proforma</option>
                 <option value="payment_processing">Traitement Paiement</option>
                 <option value="documents_pending">Attente Documents</option>
                 <option value="dedouanement">Dédouanement</option>
                 <option value="completed">Clôturé</option>
               </select>
             )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">

        
        {/* PROGRESS BAR */}
        <div className="flex items-center justify-between relative px-2">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 -z-10" />
          {[
            { id: 'proforma', icon: FileText, label: 'Proforma' },
            { id: 'payment_processing', icon: CreditCard, label: 'Paiement' },
            { id: 'documents_pending', icon: FileCheck, label: 'Documents' },
            { id: 'dedouanement', icon: Ship, label: 'Dédouanement' },
            { id: 'completed', icon: Box, label: 'Clôturé' }
          ].map((s, idx) => (
            <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${idx <= currentStepIdx ? 'bg-[#136AA8] border-[#136AA8] text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                <s.icon size={18} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${idx <= currentStepIdx ? 'text-[#136AA8]' : 'text-slate-400'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* DETAILS */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Fournisseur / Bénéficiaire</label>
              <select 
                value={purchase.supplierName || ''} 
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    onAddNewSupplier();
                  } else {
                    onUpdate({ supplierName: e.target.value });
                  }
                }}
                disabled={isReadOnly}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <option value="">Sélectionner un fournisseur...</option>
                {foreignSuppliers.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
                {(!foreignSuppliers.some(s => s.name === purchase.supplierName) && purchase.supplierName) && (
                  <option value={purchase.supplierName}>{purchase.supplierName}</option>
                )}
                <option value="ADD_NEW">+ Ajouter un fournisseur...</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Référence Proforma</label>
                <input 
                  value={purchase.proformaRef || ''} 
                  onChange={e => onUpdate({ proformaRef: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Ex: PROF-2026-001..."
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Date de Proforma</label>
                <input 
                  type="date"
                  value={purchase.proformaDate || ''} 
                  onChange={e => onUpdate({ proformaDate: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Numéro de Facture Finale</label>
                <input 
                  value={purchase.invoiceNumber || ''} 
                  onChange={e => onUpdate({ invoiceNumber: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Ex: FACT-2026-001..."
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Date Facture Finale</label>
                <input 
                  type="date"
                  value={purchase.finalInvoiceDate || ''} 
                  onChange={e => onUpdate({ finalInvoiceDate: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Incoterm</label>
                <select 
                  value={purchase.incoterm || ''} 
                  onChange={e => onUpdate({ incoterm: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="">Sélectionner...</option>
                  <option value="CFR">CFR (Maritime)</option>
                  <option value="CPT">CPT (Aérien)</option>
                  <option value="EXW">EXW</option>
                  <option value="FOB">FOB</option>
                  <option value="CIF">CIF</option>
                  <option value="CIP">CIP</option>
                  <option value="DAP">DAP</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Méthode de Paiement</label>
                <select 
                  value={purchase.paymentMethod || ''} 
                  onChange={e => onUpdate({ paymentMethod: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="">Sélectionner...</option>
                  <option value="LC">Lettre de Crédit (LC)</option>
                  <option value="DP">Remise Documentaire (DP)</option>
                  <option value="Free Transfer">Free Transfer (Virement Libre)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-inner space-y-4">
              <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">Finance & Articles</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Devise</label>
                    <select 
                      value={purchase.currency || 'EUR'}
                      onChange={e => onUpdate({ currency: e.target.value })}
                      disabled={isReadOnly}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-75"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="CNY">CNY</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Coût du Fret / Transport</label>
                    <input 
                      type="number"
                      value={purchase.freightAmount || ''} 
                      onChange={e => onUpdate({ freightAmount: e.target.value ? Number(e.target.value) : null })}
                      disabled={isReadOnly}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono disabled:opacity-75 text-amber-600 font-bold"
                    />
                 </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Liste des Articles</label>
                  {!isReadOnly && (
                    <button 
                      onClick={() => {
                        const currentItems = purchase.items || [];
                        onUpdate({ items: [...currentItems, { id: Date.now().toString(), name: '', quantity: 1, unitPrice: 0 }] });
                      }}
                      className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded font-bold uppercase transition flex items-center gap-1"
                    >
                      <Plus size={12} /> Ajouter Article
                    </button>
                  )}
                </div>
                
                {(!purchase.items || purchase.items.length === 0) ? (
                   <div className="text-center p-4 bg-white border border-slate-200 border-dashed rounded-lg text-xs text-slate-400">
                     Aucun article ajouté.
                   </div>
                ) : (
                  <div className="space-y-2">
                    {(purchase.items || []).map((item: any, idx: number) => {
                      const calculatedTotalFOB = (purchase.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) * Number(it.unitPrice)), 0);
                      const freight = Number(purchase.freightAmount) || 0;
                      // Unit CFR = Unit FOB * (1 + Total Freight / Total FOB)
                      const unitCfr = calculatedTotalFOB > 0 
                        ? Number(item.unitPrice) * (1 + (freight / calculatedTotalFOB)) 
                        : Number(item.unitPrice);
                        
                      return (
                        <div key={item.id || idx} className="bg-white p-3 rounded-lg border border-slate-200 relative">
                          {!isReadOnly && (
                            <button 
                              onClick={() => {
                                const newItems = purchase.items.filter((_: any, i: number) => i !== idx);
                                onUpdate({ items: newItems });
                              }}
                              className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <div className="grid grid-cols-12 gap-3 mb-2">
                            <div className="col-span-12 sm:col-span-6">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nom de l'article</label>
                              <input 
                                type="text"
                                value={item.name || ''} 
                                onChange={e => {
                                  const newItems = [...purchase.items];
                                  newItems[idx].name = e.target.value;
                                  onUpdate({ items: newItems });
                                }}
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded text-xs font-bold disabled:opacity-75 focus:bg-white"
                                placeholder="Description..."
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-3">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Qté</label>
                              <input 
                                type="number"
                                value={item.quantity || ''} 
                                onChange={e => {
                                  const newItems = [...purchase.items];
                                  newItems[idx].quantity = Number(e.target.value);
                                  onUpdate({ items: newItems });
                                }}
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded text-xs font-mono disabled:opacity-75 focus:bg-white"
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-3">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">P.U FOB</label>
                              <input 
                                type="number"
                                value={item.unitPrice || ''} 
                                onChange={e => {
                                  const newItems = [...purchase.items];
                                  newItems[idx].unitPrice = Number(e.target.value);
                                  onUpdate({ items: newItems });
                                }}
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded text-xs font-mono disabled:opacity-75 focus:bg-white"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-2 border-t border-slate-100 px-1">
                             <span className="text-[10px] uppercase font-bold text-slate-400">Prix unitaire CFR:</span>
                             <span className="text-xs font-black text-[#136AA8]">{unitCfr.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {purchase.currency || 'EUR'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {purchase.items && purchase.items.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500 font-bold">Total FOB</span>
                     <span className="font-bold text-slate-700">
                       {(purchase.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) * Number(it.unitPrice)), 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {purchase.currency || 'EUR'}
                     </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500 font-bold">Fret Total</span>
                     <span className="font-bold text-amber-600">
                       {(Number(purchase.freightAmount) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {purchase.currency || 'EUR'}
                     </span>
                  </div>
                  <div className="flex justify-between items-center text-base pt-2">
                     <span className="text-slate-800 font-black">Total CFR</span>
                     <span className="font-black text-[#136AA8]">
                       {(purchase.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) * Number(it.unitPrice)), 0) + (Number(purchase.freightAmount) || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {purchase.currency || 'EUR'}
                     </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DOCUMENT CHECKLIST */}
        <div className="bg-white shadow-sm rounded-2xl p-5 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black text-sm text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <FileCheck size={18} className="text-[#136AA8]" /> Dossier d'Importation
             </h3>
             {allDocsChecked && docs.revised && (
               <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md">
                 Dossier Complet et Révisé{purchase.documentsCheckedBy ? ` par ${purchase.documentsCheckedBy}` : ''}
               </span>
             )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'facture', label: 'Facture Commerciale' },
              { key: 'bl', label: 'Bill of Lading / Airwaybill (BL)' },
              { key: 'certOrigin', label: 'Certificat d\'Origine' },
              { key: 'packingList', label: 'Packing List' },
              { key: 'revised', label: 'Documents Révisés (Conformes)' },
            ].map(docItem => (
              <div 
                key={docItem.key}
                onClick={() => {
                  if (isReadOnly) return;
                  if (docItem.key === 'revised' && !allDocsChecked) return;
                  const newValue = !docs[docItem.key as keyof typeof docs];
                  const newDocs = { ...docs, [docItem.key]: newValue };
                  let updatePayload: any = { documents: newDocs };
                  
                  if (docItem.key === 'revised') {
                    updatePayload.documentsCheckedBy = newValue ? currentUser : null;
                  }
                  
                  onUpdate(updatePayload);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isReadOnly ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300'} ${docs[docItem.key as keyof typeof docs] ? 'bg-blue-50 border-[#136AA8] shadow-sm' : 'bg-slate-50 border-slate-200'} ${docItem.key === 'revised' && !allDocsChecked && !isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}
                title={docItem.key === 'revised' && !allDocsChecked ? 'Tous les documents doivent être cochés d\'abord' : ''}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${docs[docItem.key as keyof typeof docs] ? 'bg-[#136AA8] text-white' : 'border-2 border-slate-300'}`}>
                  {docs[docItem.key as keyof typeof docs] && <CheckSquare size={14} />}
                </div>
                <span className={`text-sm font-bold ${docs[docItem.key as keyof typeof docs] ? 'text-slate-800' : 'text-slate-500'}`}>{docItem.label}</span>
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <div className="mt-6 pt-5 border-t border-slate-200 flex justify-end">
              <button 
                 onClick={() => onUpdate({ status: 'dedouanement' })}
                 disabled={!allDocsChecked || !docs.revised || purchase.status === 'dedouanement' || purchase.status === 'completed'}
                 className="bg-[#136AA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-800 transition-colors uppercase tracking-widest flex items-center gap-2"
              >
                <Ship size={18} /> Passer au Dédouanement
              </button>
            </div>
          )}
        </div>

        {/* DEDOUANEMENT TRACKING */}
        {currentStepIdx >= 3 && (
          <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100 shadow-sm relative overflow-hidden">
            {isReadOnly && <div className="absolute inset-0 bg-white/20 z-10 pointer-events-none"></div>}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-sm text-orange-800 uppercase tracking-widest flex items-center gap-2">
                 <Ship size={18} /> Suivi de Dédouanement
              </h3>
            </div>
            
            {purchase.dateArriveePort && purchase.joursFranchise > 0 && !purchase.dateSortiePort && (() => {
              const arrivee = new Date(purchase.dateArriveePort);
              const endFranchise = new Date(arrivee.getTime() + purchase.joursFranchise * 24 * 60 * 60 * 1000);
              const today = new Date();
              const diff = Math.ceil((endFranchise.getTime() - today.getTime()) / (1000 * 3600 * 24));
              
              if (diff < 0) {
                return (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-black text-red-800 uppercase tracking-wide">Alerte : Franchise dépassée</h3>
                        <div className="mt-1 text-sm text-red-700 font-medium">
                          La date de fin de franchise est dépassée depuis {-diff} jour(s). Cela peut entraîner des frais de surestaries supplémentaires !
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Transitaire</label>
                <input 
                  value={purchase.transitaire || ''} 
                  onChange={e => onUpdate({ transitaire: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="Nom du transitaire..."
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none disabled:opacity-75 disabled:bg-orange-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">N° Déclaration (D10)</label>
                <input 
                  value={purchase.numeroDeclaration || ''} 
                  onChange={e => onUpdate({ numeroDeclaration: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="N° de déclaration..."
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-orange-50 focus:border-orange-300 outline-none disabled:opacity-75 disabled:bg-orange-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Date Arrivée Port/Aéroport</label>
                <input 
                  type="date"
                  value={purchase.dateArriveePort || ''} 
                  onChange={e => onUpdate({ dateArriveePort: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none disabled:opacity-75 disabled:bg-orange-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Date Sortie (Prévue/Réelle)</label>
                <input 
                  type="date"
                  value={purchase.dateSortiePort || ''} 
                  onChange={e => onUpdate({ dateSortiePort: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none disabled:opacity-75 disabled:bg-orange-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 block">Jours de Franchise</label>
                  {purchase.dateArriveePort && purchase.joursFranchise > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      (() => {
                        const arrivee = new Date(purchase.dateArriveePort);
                        const endFranchise = new Date(arrivee.getTime() + purchase.joursFranchise * 24 * 60 * 60 * 1000);
                        const today = new Date();
                        const diff = Math.ceil((endFranchise.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        if (purchase.dateSortiePort) return 'bg-slate-100 text-slate-500'; // Déjà sorti
                        if (diff < 0) return 'bg-red-100 text-red-700';
                        if (diff <= 3) return 'bg-orange-200 text-orange-800';
                        return 'bg-emerald-100 text-emerald-700';
                      })()
                    }`}>
                      {(() => {
                        const arrivee = new Date(purchase.dateArriveePort);
                        const endFranchise = new Date(arrivee.getTime() + purchase.joursFranchise * 24 * 60 * 60 * 1000);
                        const today = new Date();
                        const diff = Math.ceil((endFranchise.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        if (purchase.dateSortiePort) return 'Sorti';
                        if (diff < 0) return `Dépassement (${Math.abs(diff)} j)`;
                        return `${diff} j restants`;
                      })()}
                    </span>
                  )}
                </div>
                <input 
                  type="number"
                  value={purchase.joursFranchise || ''} 
                  onChange={e => onUpdate({ joursFranchise: e.target.value ? Number(e.target.value) : null })}
                  disabled={isReadOnly}
                  placeholder="Ex: 10"
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none disabled:opacity-75 disabled:bg-orange-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Frais de Douane / Droits et Taxes (DZD)</label>
                <input 
                  type="number"
                  value={purchase.fraisDouane || ''} 
                  onChange={e => onUpdate({ fraisDouane: e.target.value ? Number(e.target.value) : null })}
                  disabled={isReadOnly}
                  placeholder="0.00"
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-orange-50 focus:border-orange-300 outline-none disabled:opacity-75 disabled:bg-orange-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            
            {purchase.status === 'dedouanement' && !isReadOnly && (
              <div className="mt-6 pt-5 border-t border-orange-200/50 flex justify-end">
                <button 
                  onClick={() => onUpdate({ status: 'completed' })}
                  className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-700 transition-colors uppercase tracking-widest flex items-center gap-2"
                >
                  <Box size={18} /> Clôturer et Archiver le dossier
                </button>
              </div>
            )}
          </div>
        )}

        {/* ITEMS VIEW ONLY */}
        {purchase.items && purchase.items.length > 0 && (
          <div>
            <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-3">Articles de la DA</h3>
            <div className="space-y-3">
              {purchase.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-white p-3 border border-slate-100 rounded-xl">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">{item.category || 'N/A'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-[#136AA8]">{item.quantity} {item.unit || 'pcs'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        {!isReadOnly ? (
          <div className="flex justify-end">
            <button
               onClick={onConfirm}
               className="bg-[#136AA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors flex items-center gap-2 uppercase tracking-widest shadow-sm"
            >
              <CheckSquare size={18} /> Confirmer le Dossier
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div className="text-slate-500 text-sm font-medium">
               Dossier confirmé et verrouillé.
             </div>
             {['admin', 'superadmin'].includes(role || '') && (
               <button
                 onClick={onUnconfirm}
                 className="text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 uppercase tracking-widest"
               >
                 <X size={16} /> Annuler Confirmation (Admin)
               </button>
             )}
          </div>
        )}
      </div>
    </>
  );
}
