import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { Plus, Search, Trash2, X, Loader2, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function BOMs() {
  const { user, tenantId } = useAuth();
  const [boms, setBoms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]); // Finished goods
  const [rawMaterials, setRawMaterials] = useState<any[]>([]); // Raw materials
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    productId: '',
    materials: [] as { rawMaterialId: string, quantity: number }[]
  });

  useEffect(() => {
    if (!tenantId) return;

    // Fetch BOMs
    const q = query(collection(db, 'boms'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Fetch Products
    const productsSub = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', tenantId)), (snap) => {
      const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      setProducts(allProducts.filter(p => !p.type || p.type === 'product'));
      setRawMaterials(allProducts.filter(p => p.type === 'raw_material'));
    });

    return () => {
      unsubscribe();
      productsSub();
    };
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    if (!formData.productId || formData.materials.length === 0) {
      setError("Veuillez sélectionner un produit et au moins une matière première.");
      return;
    }
    
    setLoadingForm(true);
    setError(null);
    try {
      const product = products.find(p => p.id === formData.productId);
      const materialsWithDetails = formData.materials.map(m => {
        const rm = rawMaterials.find(r => r.id === m.rawMaterialId);
        return {
          rawMaterialId: m.rawMaterialId,
          rawMaterialName: rm?.name || 'Inconnu',
          sku: rm?.sku || '',
          unit: rm?.unit || 'kg',
          quantity_per_unit: m.quantity
        };
      });

      await addDoc(collection(db, 'boms'), {
        tenantId,
        name: formData.name || `BOM - ${product?.name}`,
        productId: formData.productId,
        productName: product?.name || 'Inconnu',
        productSku: product?.sku || '',
        materials: materialsWithDetails,
        createdBy: user?.displayName || user?.email,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ name: '', productId: '', materials: [] });
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la création de la nomenclature.");
    } finally {
      setLoadingForm(false);
    }
  };

  const addMaterial = () => {
    setFormData({ ...formData, materials: [...formData.materials, { rawMaterialId: '', quantity: 0 }] });
  };

  const removeMaterial = (index: number) => {
    const newMats = [...formData.materials];
    newMats.splice(index, 1);
    setFormData({ ...formData, materials: newMats });
  };

  const filteredBoms = React.useMemo(() => {
    return boms.filter(b => 
      (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (b.productName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boms, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="text-indigo-600" /> Nomenclatures (BOM)
          </h2>
          <p className="text-sm text-gray-500 font-medium">Gérer les formules et recettes des produits finis</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-sm transition-all text-sm uppercase tracking-wide">
          <Plus size={18} /> Nouvelle Nomenclature
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400" />
        <input 
          type="text" 
          placeholder="Rechercher une nomenclature..." 
          className="bg-transparent border-none outline-none w-full text-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : filteredBoms.length === 0 ? (
        <div className="bg-white rounded-2xl p-20 text-center border border-gray-200 shadow-sm">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-indigo-900 mb-1">Aucune nomenclature</h3>
          <p className="text-slate-500 text-sm">Créez votre première nomenclature pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBoms.map(bom => (
            <div key={bom.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative">
              <button 
                onClick={() => deleteDoc(doc(db, 'boms', bom.id))}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Supprimer la nomenclature"
              >
                <Trash2 size={18} />
              </button>
              <h3 className="text-lg font-bold text-indigo-900 mb-1">{bom.name}</h3>
              <p className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded inline-block mb-4">Pour: {bom.productName} ({bom.productSku})</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wider">
                      <th className="px-4 py-2">Composant / Matière</th>
                      <th className="px-4 py-2 text-right">Qté Requise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bom.materials?.map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-100/50">
                        <td className="px-4 py-3 font-medium text-slate-700">{m.rawMaterialName} <span className="text-xs text-slate-400">({m.sku})</span></td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-700 font-mono">{m.quantity_per_unit} <span className="text-xs text-slate-500 font-sans">{m.unit}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="px-8 py-6 bg-indigo-600 text-white flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold uppercase tracking-tight">Créer une Nomenclature</h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-indigo-500 p-2 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200">{error}</div>}
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Nom de la Nomenclature</label>
                    <input type="text" placeholder="Ex: BOM Matelas Standard" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Produit Fini <span className="text-red-500">*</span></label>
                    <select required value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium">
                      <option value="">Sélectionner un produit...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[11px] font-black uppercase text-slate-500">Matières Premières Requises</label>
                    <button type="button" onClick={addMaterial} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Plus size={14} /> Ajouter Composant
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.materials.map((m, idx) => (
                      <div key={idx} className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Matière</label>
                          <select required value={m.rawMaterialId} onChange={e => {
                            const newM = [...formData.materials];
                            newM[idx].rawMaterialId = e.target.value;
                            setFormData({ ...formData, materials: newM });
                          }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white">
                            <option value="">Sélectionner...</option>
                            {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.sku} - {rm.name}</option>)}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Qté (par unité)</label>
                          <input type="number" required min="0" step="0.01" value={m.quantity || ''} onChange={e => {
                            const newM = [...formData.materials];
                            newM[idx].quantity = Number(e.target.value);
                            setFormData({ ...formData, materials: newM });
                          }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:bg-white" placeholder="0.00" />
                        </div>
                        <button type="button" onClick={() => removeMaterial(idx)} className="p-2 mb-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {formData.materials.length === 0 && (
                      <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <p className="text-slate-400 text-sm">Aucun composant ajouté. Cliquez sur "Ajouter Composant".</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Annuler</button>
                  <button type="submit" disabled={loadingForm} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
                    {loadingForm && <Loader2 size={18} className="animate-spin" />} Confirmer
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
