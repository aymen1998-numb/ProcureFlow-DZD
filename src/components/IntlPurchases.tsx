import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Plus, Search, Trash2, CheckSquare, Square, FileText, ChevronRight, X, Ship, CreditCard, Box, FileCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function IntlPurchases() {
  const { tenantId, role } = useAuth();
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // the snapshot will update the list
      setSelectedPurchase({ id: docRef.id, daNumber: 'Nouveau' }); // optimistically set
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

  const filteredPurchases = purchases.filter(p => 
    (p.daNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          {['admin', 'buyer_intl'].includes(role || '') && (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col min-h-[600px] max-h-[800px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-700">
            Dossiers ({filteredPurchases.length})
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {loading ? (
              <div className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : filteredPurchases.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium text-sm">Aucun achat international trouvé.</div>
            ) : (
              filteredPurchases.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPurchase(p)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedPurchase?.id === p.id ? 'bg-[#EFF6FF] border-[#136AA8] shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">DA: {p.daNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getStatusColor(p.status)}`}>
                      {getStatusLabel(p.status)}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-1">{p.supplierName || 'Fournisseur à définir'}</h3>
                  <div className="flex justify-between items-center mt-3">
                    <div className="text-xs text-slate-500 font-medium font-mono">{p.paymentMethod || '-'}</div>
                    {['admin', 'buyer'].includes(role || '') && (
                      <button onClick={(e) => handleDelete(p.id, e)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedPurchase ? (
            <PurchaseDetails purchase={selectedPurchase} onUpdate={(data) => updatePurchase(selectedPurchase.id, data)} role={role} />
          ) : (
            <div className="h-full min-h-[600px] border border-slate-200 rounded-2xl bg-slate-50/50 border-dashed flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <Globe className="w-16 h-16 mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">Sélectionnez un dossier</h3>
              <p className="text-sm max-w-sm">Cliquez sur un achat international dans la liste pour voir ses détails, gérer les paiements et le dédouanement.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseDetails({ purchase, onUpdate, role }: { purchase: any, onUpdate: (data: any) => void, role: string|null }) {
  const steps = ['proforma', 'payment_processing', 'documents_pending', 'dedouanement', 'completed'];
  const currentStepIdx = steps.indexOf(purchase.status || 'proforma');

  const docs = purchase.documents || { facture: false, bl: false, certOrigin: false, packingList: false, revised: false };
  const allDocsChecked = docs.facture && docs.bl && docs.certOrigin && docs.packingList;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[800px]">
      <div className="p-6 border-b border-slate-100 bg-[#136AA8] text-white">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-blue-200 text-xs font-black uppercase tracking-wider mb-1">DA SOURCE: {purchase.daNumber}</div>
            <h2 className="text-xl font-bold">{purchase.supplierName || 'Nouveau Dossier d\'Importation'}</h2>
          </div>
          <div>
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
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
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
              <input 
                value={purchase.supplierName || ''} 
                onChange={e => onUpdate({ supplierName: e.target.value })}
                placeholder="Nom du fournisseur..."
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Référence Proforma</label>
              <input 
                value={purchase.proformaRef || ''} 
                onChange={e => onUpdate({ proformaRef: e.target.value })}
                placeholder="Ex: PROF-2026-001..."
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Incoterm</label>
                <select 
                  value={purchase.incoterm || ''} 
                  onChange={e => onUpdate({ incoterm: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white"
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Mode de Transport</label>
                <select 
                  value={purchase.transportMethod || ''} 
                  onChange={e => onUpdate({ transportMethod: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white"
                >
                  <option value="">Sélectionner...</option>
                  <option value="maritime">Maritime</option>
                  <option value="aerien">Aérien</option>
                  <option value="routier">Routier</option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Méthode de Paiement</label>
              <select 
                value={purchase.paymentMethod || ''} 
                onChange={e => onUpdate({ paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-white"
              >
                <option value="">Sélectionner...</option>
                <option value="LC">Lettre de Crédit (LC)</option>
                <option value="DP">Remise Documentaire (DP)</option>
                <option value="Free Transfer">Free Transfer (Virement Libre)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Montant Total Devise</label>
              <div className="flex gap-2">
                <input 
                  type="number"
                  value={purchase.totalAmount || ''} 
                  onChange={e => onUpdate({ totalAmount: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-white"
                />
                <select 
                  value={purchase.currency || 'EUR'}
                  onChange={e => onUpdate({ currency: e.target.value })}
                  className="bg-slate-50 border border-slate-200 px-2 rounded-lg text-sm font-bold w-24"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* DOCUMENT CHECKLIST */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black text-sm text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <FileCheck size={18} className="text-[#136AA8]" /> Dossier d'Importation
             </h3>
             {allDocsChecked && docs.revised && (
               <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md">Dossier Complet et Révisé</span>
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
                onClick={() => onUpdate({ documents: { ...docs, [docItem.key]: !docs[docItem.key as keyof typeof docs] } })}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${docs[docItem.key as keyof typeof docs] ? 'bg-white border-[#136AA8] shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'} ${docItem.key === 'revised' && !allDocsChecked ? 'opacity-50 pointer-events-none' : ''}`}
                title={docItem.key === 'revised' && !allDocsChecked ? 'Tous les documents doivent être cochés d\'abord' : ''}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${docs[docItem.key as keyof typeof docs] ? 'bg-[#136AA8] text-white' : 'border-2 border-slate-300'}`}>
                  {docs[docItem.key as keyof typeof docs] && <CheckSquare size={14} />}
                </div>
                <span className={`text-sm font-bold ${docs[docItem.key as keyof typeof docs] ? 'text-slate-800' : 'text-slate-500'}`}>{docItem.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200 flex justify-end">
            <button 
               onClick={() => onUpdate({ status: 'dedouanement' })}
               disabled={!allDocsChecked || !docs.revised || purchase.status === 'dedouanement' || purchase.status === 'completed'}
               className="bg-[#136AA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-800 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <Ship size={18} /> Passer au Dédouanement
            </button>
          </div>
        </div>

        {/* DEDOUANEMENT TRACKING */}
        {currentStepIdx >= 3 && (
          <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100">
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
                  placeholder="Nom du transitaire..."
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">N° Déclaration (D10)</label>
                <input 
                  value={purchase.numeroDeclaration || ''} 
                  onChange={e => onUpdate({ numeroDeclaration: e.target.value })}
                  placeholder="N° de déclaration..."
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-orange-50 focus:border-orange-300 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Date Arrivée Port/Aéroport</label>
                <input 
                  type="date"
                  value={purchase.dateArriveePort || ''} 
                  onChange={e => onUpdate({ dateArriveePort: e.target.value })}
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Date Sortie (Prévue/Réelle)</label>
                <input 
                  type="date"
                  value={purchase.dateSortiePort || ''} 
                  onChange={e => onUpdate({ dateSortiePort: e.target.value })}
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none"
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
                  placeholder="Ex: 10"
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-bold focus:bg-orange-50 focus:border-orange-300 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 mb-1 block">Frais de Douane / Droits et Taxes (DZD)</label>
                <input 
                  type="number"
                  value={purchase.fraisDouane || ''} 
                  onChange={e => onUpdate({ fraisDouane: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0.00"
                  className="w-full bg-white border border-orange-200 px-3 py-2 rounded-lg text-sm font-mono focus:bg-orange-50 focus:border-orange-300 outline-none"
                />
              </div>
            </div>
            
            {purchase.status === 'dedouanement' && (
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
    </div>
  );
}
