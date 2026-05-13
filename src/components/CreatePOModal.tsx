import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, where, doc, updateDoc } from 'firebase/firestore';
import { X, Loader2, Save, ShoppingBag, Search, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function CreatePOModal({ isOpen, onClose, initialData }: { isOpen: boolean, onClose: () => void, initialData?: any }) {
  const { user, tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [poNumber, setPoNumber] = useState('');
  const [poError, setPoError] = useState<string | null>(null);
  const [tvaRate, setTvaRate] = useState(19);
  const [paymentModality, setPaymentModality] = useState('Chèque');

  useEffect(() => {
    if (isOpen && tenantId) {
      if (initialData && initialData.items) {
        setItems(initialData.items);
      } else {
        setItems([]);
      }
      getDocs(query(collection(db, 'suppliers'), where('tenantId', '==', tenantId))).then(s => setSuppliers(s.docs.map(d => ({id: d.id, ...d.data()}))));
      getDocs(query(collection(db, 'products'), where('tenantId', '==', tenantId))).then(p => setCatalog(p.docs.map(d => ({id: d.id, ...d.data()}))));
      getDocs(query(collection(db, 'tenant_settings'), where('__name__', '==', tenantId))).then(snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.units && data.units.length > 0) {
            setUnits(data.units);
            if (initialData && initialData.unitId) {
                const found = data.units.find((u: any) => u.id === initialData.unitId);
                setSelectedUnit(found || data.units[0]);
            } else {
                setSelectedUnit(data.units[0]);
            }
          }
        }
      });
      generatePONumber().then(setPoNumber);
    } else {
      setPoNumber('');
    }
  }, [isOpen, tenantId, initialData]);

  useEffect(() => {
    if (poNumber) {
      if (!validatePONumber(poNumber)) {
        setPoError("Format requis : PO-YYYY-NNNN (ex: PO-2024-0001)");
      } else {
        setPoError(null);
      }
    }
  }, [poNumber]);

  const generatePONumber = async () => {
    if (!tenantId) return '';
    const year = new Date().getFullYear();
    const q = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    let seq = 1;
    if (!snap.empty) {
      const last = snap.docs[0].data().poNumber;
      if (last && typeof last === 'string' && last.startsWith(`PO-${year}`)) {
        const parts = last.split('-');
        if (parts.length === 3) seq = parseInt(parts[2]) + 1;
      }
    }
    return `PO-${year}-${seq.toString().padStart(4, '0')}`;
  };

  const validatePONumber = (num: string) => {
    const regex = /^PO-\d{4}-\d{4}$/;
    return regex.test(num);
  };

  const totalHT = items.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
  const tvaAmount = totalHT * (tvaRate / 100);
  const total = totalHT + tvaAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSupplier || items.length === 0) return;
    
    if (!validatePONumber(poNumber)) {
      setPoError("Veuillez corriger le format du numéro BC avant de continuer.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'purchase_orders'), {
        poNumber, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
        unit: selectedUnit || null,
        date: new Date().toISOString().split('T')[0], status: 'draft', items, totalAmount: total, totalHT, tvaAmount, tvaRate,
        paymentModality,
        linkedDA: initialData?.linkedDA || null,
        daNumber: initialData?.daNumber || null,
        currency: 'DZD', buyerId: user.uid, buyerName: user.displayName || 'Buyer',
        tenantId: tenantId,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      
      if (initialData?.linkedDA) {
        try {
          await updateDoc(doc(db, 'purchase_requests', initialData.linkedDA), {
             status: 'done',
             linkedPONumber: poNumber,
             updatedAt: new Date().toISOString()
          });
        } catch(e) { console.error("Error updating linked DA", e); }
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchase_orders');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-[#136AA8] text-white">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Préparation du Bon de Commande</h3>
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">Nouveau flux d'approvisionnement</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <div className="w-full lg:w-1/2 p-6 lg:p-10 overflow-y-auto border-r border-slate-100 space-y-8">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Numéro du BC</label>
                  <div className="flex gap-2">
                    <input 
                      className={`flex-1 p-4 bg-slate-50 border ${poError ? 'border-red-400 ring-4 ring-red-50' : 'border-slate-200'} rounded-xl font-bold font-mono text-[#136AA8] focus:ring-4 focus:ring-blue-50 outline-none transition-all w-full`} 
                      value={poNumber} 
                      onChange={e => setPoNumber(e.target.value)}
                      placeholder="PO-YYYY-NNNN"
                    />
                    <button 
                      type="button"
                      onClick={async () => {
                        const newNum = await generatePONumber();
                        setPoNumber(newNum);
                      }}
                      className="w-14 h-14 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-white hover:text-[#009CDA] hover:shadow-lg border border-transparent hover:border-blue-100 transition-all active:scale-95 group"
                      title="Régénérer le numéro automatiquement"
                    >
                      <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                  </div>
                  {poError && <p className="text-[10px] text-red-500 font-bold mt-2 ml-1 animate-bounce">{poError}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Unité Émettrice</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[#136AA8] focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer" 
                    value={selectedUnit?.id || ''} 
                    onChange={e => setSelectedUnit(units.find(u => u.id === e.target.value))}
                  >
                    {units.length === 0 && <option value="">Global / Siège</option>}
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Fournisseur</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[#136AA8] focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer" 
                    value={selectedSupplier?.id || ''} 
                    onChange={e => setSelectedSupplier(suppliers.find(s => s.id === e.target.value))}
                  >
                    <option value="">Sélectionner un Fournisseur</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Modalité de paiement</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[#136AA8] focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer" 
                    value={paymentModality} 
                    onChange={e => setPaymentModality(e.target.value)}
                  >
                    <option value="Chèque">Chèque</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Catalogue Produits</label>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  placeholder="Rechercher des produits (SKU, Nom)..." 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2 no-scrollbar">
                {catalog.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                  <div key={p.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center hover:bg-slate-50 hover:border-slate-200 cursor-pointer transition-all group" onClick={() => setItems([...items, {...p, quantity: 1, price: p.defaultPrice || 0, unit: p.unit || 'pcs'}])}>
                    <div>
                      <p className="font-bold text-[#136AA8] text-sm group-hover:text-[#009CDA] transition-colors uppercase">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tighter mt-0.5">{p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-[#136AA8]">{p.defaultPrice?.toLocaleString()} DZD</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">{p.unit || 'Unité'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 p-6 lg:p-10 bg-slate-50/50 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Articles de la commande</label>
              <span className="text-[10px] font-black bg-blue-100 text-[#009CDA] px-2 py-0.5 rounded uppercase">{items.length} Lignes</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-8 no-scrollbar">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                  <ShoppingBag size={48} strokeWidth={1} />
                  <p className="text-sm font-medium italic">Votre panier est vide</p>
                </div>
              ) : items.map((item, i) => (
                <div key={i} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between group">
                  <div className="flex-1 mr-4">
                    <p className="font-bold text-sm text-[#136AA8] truncate">{item.name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Qté:</span>
                        <input type="number" className="w-16 p-1 bg-slate-50 border border-slate-100 rounded text-xs font-black text-center focus:ring-2 focus:ring-blue-100 outline-none" value={item.quantity} onChange={e => {
                          const ni = [...items]; ni[i].quantity = Number(e.target.value); setItems(ni);
                        }} />
                        <span className="text-[10px] uppercase font-bold text-slate-500">{item.unit || 'pcs'}</span>
                      </div>
                      <div className="h-4 w-px bg-slate-100" />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Prix:</span>
                        <input type="number" min="0" step="any" className="w-24 p-1 bg-slate-50 border border-slate-100 rounded text-xs font-black text-center focus:ring-2 focus:ring-blue-100 outline-none" value={item.price} onChange={e => {
                          const ni = [...items]; ni[i].price = Number(e.target.value); setItems(ni);
                        }} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">DZD</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-xs text-slate-500 uppercase">Total HT</span>
                <span className="font-bold text-base text-[#136AA8] font-mono">{totalHT.toLocaleString()} DZD</span>
              </div>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-500 uppercase">TVA</span>
                  <input type="number" className="w-16 p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center outline-none focus:ring-2 focus:ring-blue-100" value={tvaRate} onChange={e => setTvaRate(Number(e.target.value))} />
                  <span className="font-bold text-xs text-slate-500">%</span>
                </div>
                <span className="font-bold text-base text-[#136AA8] font-mono">{tvaAmount.toLocaleString()} DZD</span>
              </div>
              <div className="flex justify-between items-center mb-8 pt-4 border-t border-slate-100">
                <div>
                  <span className="font-black uppercase text-[10px] text-slate-400 tracking-[0.2em] block mb-1">Montant Total TTC</span>
                  <span className="text-3xl font-black text-[#136AA8] font-mono tracking-tighter">{total.toLocaleString()} <span className="text-sm font-sans text-slate-400">DZD</span></span>
                </div>
              </div>
              <button 
                onClick={handleSubmit} 
                disabled={loading || !selectedSupplier || items.length === 0} 
                className="w-full py-5 bg-[#3B82F6] hover:bg-[#009CDA] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-blue-200/50 transition-all hover:-translate-y-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Confirmer la Commande
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
