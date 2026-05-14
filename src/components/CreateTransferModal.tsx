import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { X, Loader2, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CreateTransferModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { tenantId, user, role, unitId } = useAuth();
  const [locations, setLocations] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    sourceLocation: '',
    destLocation: '',
    items: [] as { productId: string, expectedQty: number }[]
  });

  useEffect(() => {
    if (isOpen && tenantId) {
      // Fetch settings for locations/units
      getDocs(query(collection(db, 'tenant_settings'), where('__name__', '==', tenantId))).then(snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          let currentUnitName = '';
          if (data.units && data.units.length > 0) {
             setLocations(data.units.map((u: any) => u.name));
             const f = data.units.find((u: any) => u.id === unitId);
             if (f) currentUnitName = f.name;
          } else {
             const locs = data.locations || '';
             const locArray = locs.split(',').map((l: string) => l.trim()).filter(Boolean);
             setLocations(locArray);
          }
          if (unitId === 'HQ') currentUnitName = 'Siège Principal';
          
          if (role === 'magasinier' && unitId && currentUnitName) {
             setFormData(prev => ({...prev, sourceLocation: currentUnitName}));
          }
        }
      });
      // Fetch products
      getDocs(query(collection(db, 'products'), where('tenantId', '==', tenantId))).then(snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }
  }, [isOpen, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !user || formData.items.length === 0) return;
    if (formData.sourceLocation === formData.destLocation) {
      alert("L'origine et la destination doivent être différentes.");
      return;
    }
    
    setLoading(true);
    try {
      // Create transfer
      let tnCount = 1;
      const tSnap = await getDocs(query(collection(db, 'transfers'), where('tenantId', '==', tenantId)));
      tnCount = tSnap.size + 1;
      const transferNumber = `BT-${new Date().getFullYear()}-${String(tnCount).padStart(4, '0')}`;

      const itemsWithDetails = formData.items.map(item => {
        const p = products.find(prod => prod.id === item.productId);
        return {
          productId: item.productId,
          sku: p?.sku || '',
          name: p?.name || '',
          expectedQty: item.expectedQty,
          receivedQty: 0
        };
      });

      const docRef = await addDoc(collection(db, 'transfers'), {
        tenantId,
        transferNumber,
        sourceLocation: formData.sourceLocation,
        destLocation: formData.destLocation,
        status: 'in_transit',
        createdBy: user.displayName || 'Inconnu',
        createdAt: new Date().toISOString(),
        items: itemsWithDetails
      });

      setFormData({ sourceLocation: '', destLocation: '', items: [] });
      onClose();
      navigate(`/transfers/${docRef.id}`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => setFormData({ ...formData, items: [...formData.items, { productId: '', expectedQty: 1 }] });
  const removeItem = (index: number) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#136AA8]">Nouveau Bon de Transfert</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usine/Dépôt d'Origine</label>
              <select disabled={role === 'magasinier'} required value={formData.sourceLocation} onChange={(e) => setFormData({...formData, sourceLocation: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50">
                <option value="">Sélectionner l'origine...</option>
                {locations.map(l => <option key={`src-${l}`} value={l}>{l}</option>)}
              </select>
            </div>
            
            <div className="hidden md:flex justify-center mt-6 text-slate-400">
              <ArrowRight size={24} />
            </div>

            <div className="md:col-start-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Usine/Dépôt de Destination</label>
              <select required value={formData.destLocation} onChange={(e) => setFormData({...formData, destLocation: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <option value="">Sélectionner la destination...</option>
                {locations.map(l => <option key={`dst-${l}`} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Articles à transférer</h3>
              <button type="button" onClick={addItem} className="text-xs font-bold text-[#009CDA] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <Plus size={14} /> Ajouter
              </button>
            </div>
            
            {formData.items.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-sm">
                Aucun article ajouté.
              </div>
            ) : (
              <div className="space-y-3">
                {formData.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex-1">
                      <select required value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none mb-2 text-sm text-slate-700">
                        <option value="">Sélectionner un produit...</option>
                        {products.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name} (Stock: {p.stockQuantity})</option>)}
                      </select>
                      <input type="number" required min="1" placeholder="Quantité à transférer" value={item.expectedQty} onChange={(e) => updateItem(idx, 'expectedQty', parseInt(e.target.value))} className="w-32 px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || formData.items.length === 0} className="w-full py-3 bg-[#136AA8] hover:bg-[#152e4d] text-white rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Générer le Bon de Transfert"}
          </button>
        </form>
      </div>
    </div>
  );
}
