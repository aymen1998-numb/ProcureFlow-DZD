import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Plus, Search, Package, Trash2, X, Loader2, FileSpreadsheet, Tag, AlertTriangle, Edit3, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';

export default function Products() {
  const { user, tenantId } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', sku: '', category: '', unit: 'pcs', defaultPrice: 0, stockQuantity: 0, minStock: 0 });

  // Stock Adjustment State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustData, setAdjustData] = useState({ quantity: 0, type: 'add', note: '' });

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'products'), where('tenantId', '==', tenantId), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const [error, setError] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);
    setError(null);
    try {
      if (!tenantId) throw new Error("Tenant ID manquant.");
      await addDoc(collection(db, 'products'), { 
        ...formData, 
        tenantId: tenantId,
        createdAt: new Date().toISOString(),
        createdBy: user?.displayName || user?.email || 'Unknown User'
      });
      setIsModalOpen(false);
      setFormData({ name: '', sku: '', category: '', unit: 'pcs', defaultPrice: 0, stockQuantity: 0, minStock: 0 });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoadingForm(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoadingForm(true);
    setError(null);
    
    let newQuantity = selectedProduct.stockQuantity || 0;
    const qty = Number(adjustData.quantity);
    
    if (adjustData.type === 'add') newQuantity += qty;
    else if (adjustData.type === 'remove') newQuantity = Math.max(0, newQuantity - qty);
    else if (adjustData.type === 'set') newQuantity = qty;

    try {
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        stockQuantity: newQuantity,
        lastStockUpdate: new Date().toISOString()
      });
      setIsAdjustModalOpen(false);
      setSelectedProduct(null);
      setAdjustData({ quantity: 0, type: 'add', note: '' });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoadingForm(false);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Catalogue");
    XLSX.writeFile(workbook, "Catalogue_Articles.xlsx");
  };

  const filtered = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const alertProducts = products.filter(p => (p.stockQuantity || 0) <= (p.minStock || 0));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] tracking-tight">Catalogue Produits</h2>
          <p className="text-sm text-gray-500 font-medium">Gestion des articles et nomenclatures</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-[#1E3A5F] rounded-xl hover:bg-slate-50 font-bold text-xs transition-all uppercase tracking-wide">
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#3B82F6] text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-blue-100 transition-all text-xs uppercase tracking-widest">
            <Plus size={18} />
            Ajouter Produit
          </button>
        </div>
      </div>

      {alertProducts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-orange-800 font-black tracking-tight uppercase text-sm mb-1">Alertes de Stock ({alertProducts.length})</h3>
            <p className="text-orange-700 text-xs font-medium mb-3">Certains articles ont atteint ou dépassé leur seuil d'alerte (Point de commande).</p>
            <div className="flex flex-wrap gap-2">
              {alertProducts.slice(0, 5).map(p => (
                <span key={p.id} className="px-3 py-1 bg-white/60 text-orange-800 rounded-lg text-[10px] font-bold border border-orange-200/50">
                  {p.sku} - Reste: {p.stockQuantity} / Min: {p.minStock}
                </span>
              ))}
              {alertProducts.length > 5 && <span className="px-3 py-1 text-orange-800 text-[10px] font-bold">+{alertProducts.length - 5} autres</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200 max-w-md shadow-sm group focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-200 transition-all">
        <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Rechercher par nom ou SKU..." 
          className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none font-medium placeholder-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1E3A5F] text-white text-[10px] uppercase font-black tracking-[0.2em]">
                  <th className="px-5 py-5">SKU / Réf</th>
                  <th className="px-5 py-5">Désignation</th>
                  <th className="px-5 py-5">Catégorie</th>
                  <th className="px-5 py-5 text-center">En Stock</th>
                  <th className="px-5 py-5 text-center">Seuil</th>
                  <th className="px-5 py-5 text-center">Unité</th>
                  <th className="px-5 py-5 text-right">Prix Unit.</th>
                  <th className="px-5 py-5 text-center">Statut</th>
                  <th className="px-5 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-400 tracking-tighter uppercase">{p.sku}</td>
                    <td className="px-5 py-5 font-bold text-[#1E3A5F] uppercase text-sm">{p.name}</td>
                    <td className="px-5 py-5">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                        {p.category || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className={`text-sm font-black font-mono px-3 py-1 rounded-lg ${p.stockQuantity <= (p.minStock || 0) && p.stockQuantity > 0 ? 'bg-orange-50 text-orange-600' : p.stockQuantity <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {p.stockQuantity || 0}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className="text-[11px] font-mono font-bold text-slate-400">{p.minStock || 0}</span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">{p.unit}</span>
                    </td>
                    <td className="px-5 py-5 font-black text-right text-[#1E3A5F] font-mono whitespace-nowrap text-xs">
                      {p.defaultPrice?.toLocaleString()}
                    </td>
                    <td className="px-5 py-5 text-center">
                      {p.stockQuantity <= 0 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[9px] font-bold uppercase tracking-widest">Rupture</span>
                      ) : p.stockQuantity <= (p.minStock || 0) ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-[9px] font-bold uppercase tracking-widest">Stock Alert</span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-widest">En Stock</span>
                      )}
                    </td>
                    <td className="px-5 py-5 text-right flex justify-end gap-2">
                       <button 
                        onClick={() => {
                          setSelectedProduct(p);
                          setAdjustData({ quantity: 0, type: 'add', note: '' });
                          setIsAdjustModalOpen(true);
                        }}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg transition-all hover:bg-blue-100 opacity-0 group-hover:opacity-100"
                        title="Ajuster le Stock"
                      >
                        <ArrowRightLeft size={16} />
                      </button>
                      <button onClick={() => deleteDoc(doc(db, 'products', p.id))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <AnimatePresence>
        {isAdjustModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdjustModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#1E3A5F] text-white">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Ajustement Stock</h3>
                  <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">{selectedProduct.name}</p>
                </div>
                <button onClick={() => setIsAdjustModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleAdjustStock} className="p-8 space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                    {error}
                  </div>
                )}
                <div className="flex bg-slate-50 p-1 rounded-xl">
                  {['add', 'remove', 'set'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjustData({ ...adjustData, type: t as any })}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                        adjustData.type === t 
                          ? t === 'set' ? 'bg-[#1E3A5F] text-white shadow-sm' : t === 'remove' ? 'bg-red-500 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t === 'add' ? 'Ajout' : t === 'remove' ? 'Retrait' : 'Forcer'}
                    </button>
                  ))}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quantité</label>
                  <input type="number" required min="0" value={adjustData.quantity} onChange={e => setAdjustData({ ...adjustData, quantity: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-mono font-black text-center focus:bg-white transition-all outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200" />
                </div>
                
                <button type="submit" disabled={loadingForm} className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl active:scale-95 mt-2 disabled:bg-slate-400 disabled:shadow-none ${
                  adjustData.type === 'remove' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : adjustData.type === 'set' ? 'bg-[#1E3A5F] hover:bg-slate-900 shadow-slate-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                }`}>
                  {loadingForm ? 'Mise à jour en cours...' : 'Valider l\'ajustement'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Modal - Restyled to match other modules */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-[#1E3A5F] text-white">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Nouveau Produit</h3>
                  <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">Nomenclature technique</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SKU / Référence</label>
                    <input required placeholder="REF-000X" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold focus:ring-4 focus:ring-blue-50 focus:bg-white outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Catégorie</label>
                    <input required placeholder="ex. Outillage" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-50 focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Désignation de l'article</label>
                  <input required placeholder="Nom complet de l'article" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#1E3A5F] outline-none focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unité de Mesure</label>
                    <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white transition-all outline-none appearance-none cursor-pointer">
                      <option value="pcs">Pièce (pcs)</option>
                      <option value="kg">Kilogramme (kg)</option>
                      <option value="ton">Tonne</option>
                      <option value="meter">Mètre (m)</option>
                      <option value="m2">Mètre Carré (m2)</option>
                      <option value="m3">Mètre Cube (m3)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prix Unit. (DZD)</label>
                    <input type="number" placeholder="0.00" value={formData.defaultPrice} onChange={e => setFormData({ ...formData, defaultPrice: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold focus:bg-white transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stock Initial</label>
                    <input type="number" placeholder="0" value={formData.stockQuantity} onChange={e => setFormData({ ...formData, stockQuantity: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold focus:bg-white transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stock d'Alerte (Min)</label>
                    <input type="number" placeholder="0" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold focus:bg-white transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={loadingForm} className="w-full py-5 bg-[#1E3A5F] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200/50 active:scale-95 mt-4 disabled:bg-slate-400">
                  {loadingForm ? 'Enregistrement en cours...' : 'Inscrire au Catalogue'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

