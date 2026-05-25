import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc, where, getDoc } from 'firebase/firestore';
import { Plus, Search, Trash2, X, Loader2, FileSpreadsheet, AlertTriangle, ArrowRightLeft, UploadCloud, ChevronLeft, ChevronRight, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';

export default function RawMaterials() {
  const { user, tenantId, unitId, role } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', sku: '', category: 'Matière Première', unit: 'kg', defaultPrice: 0, stockQuantity: 0, minStock: 0, type: 'raw_material' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unit / Magasin State
  const [units, setUnits] = useState<any[]>([]);
  // raw materials force Unit 1 (Magasin 1)?? Wait, the user said "comes only from magasin 1"
  // "this stock comes only from magasin 1"
  // Let's set the selected unit to be Magasin 1 by default, or force it.
  const [selectedUnitId, setSelectedUnitId] = useState<string>('HQ');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Stock Adjustment State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustData, setAdjustData] = useState({ quantity: 0, type: 'add', note: '' });

  useEffect(() => {
    if (!tenantId) return;

    const fetchUnits = async () => {
      const docRef = doc(db, 'tenant_settings', tenantId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().units) {
        setUnits(docSnap.data().units);
        // Find Magasin 1 if possible
        const u = docSnap.data().units;
        const mag1 = u.find((x: any) => x.name.toLowerCase().includes('magasin 1')) || u[0];
        if (mag1) {
            setSelectedUnitId(mag1.id);
        } else {
            setSelectedUnitId('HQ'); // fallback
        }
      }
    };
    fetchUnits();

    const q = query(collection(db, 'products'), where('tenantId', '==', tenantId), where('type', '==', 'raw_material'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  // Helper Functions for Stock View
  const getStockForUnit = (product: any, uId: string) => {
    if (product.unitStocks && product.unitStocks[uId] !== undefined) {
      return product.unitStocks[uId].qty;
    }
    // Backward compatibility if no units setup yet
    if (uId === 'HQ' && !product.unitStocks) return product.stockQuantity || 0;
    return 0;
  };

  const getMinStockForUnit = (product: any, uId: string) => {
    if (product.unitStocks && product.unitStocks[uId] !== undefined) {
      return product.unitStocks[uId].min || product.minStock || 0;
    }
    return product.minStock || 0;
  };

  // Rest of state management...
  const [error, setError] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);
    setError(null);
    try {
      if (!tenantId) throw new Error("Tenant ID manquant.");
      
      const skuValue = formData.sku.trim();
      const isSkuDuplicate = skuValue !== '' && products.some(p => p.sku?.trim().toUpperCase() === skuValue.toUpperCase());
      if (isSkuDuplicate) {
        throw new Error("Le SKU / Référence existe déjà.");
      }
      if (skuValue.length < 3) {
        throw new Error("Le SKU doit contenir au moins 3 caractères.");
      }

      await addDoc(collection(db, 'products'), { 
        ...formData, 
        tenantId: tenantId,
        createdAt: new Date().toISOString(),
        createdBy: user?.displayName || user?.email || 'Unknown User'
      });
      setIsModalOpen(false);
      setFormData({ name: '', sku: '', category: 'Matière Première', unit: 'kg', defaultPrice: 0, stockQuantity: 0, minStock: 0, type: 'raw_material' });
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
    
    let currentQty = selectedProduct.unitStocks?.[selectedUnitId]?.qty;
    if (currentQty === undefined) {
      currentQty = selectedUnitId === 'HQ' ? (selectedProduct.stockQuantity || 0) : 0;
    }
    
    let newQuantity = currentQty;
    const qty = Number(adjustData.quantity);
    
    if (adjustData.type === 'add') newQuantity += qty;
    else if (adjustData.type === 'remove') newQuantity = Math.max(0, newQuantity - qty);
    else if (adjustData.type === 'set') newQuantity = qty;

    try {
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        [`unitStocks.${selectedUnitId}.qty`]: newQuantity,
        lastStockUpdate: new Date().toISOString()
      });

      await addDoc(collection(db, 'stock_movements'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        unitId: selectedUnitId,
        tenantId: tenantId,
        type: adjustData.type,
        quantity: qty,
        previousQuantity: currentQty,
        newQuantity: newQuantity,
        note: adjustData.note,
        createdBy: user?.displayName || user?.email,
        createdAt: new Date().toISOString(),
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
    const worksheet = XLSX.utils.json_to_sheet(products.map(p => ({
      ...p,
      stockQuantity: getStockForUnit(p, selectedUnitId),
      minStock: getMinStockForUnit(p, selectedUnitId)
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MatieresPremieres");
    XLSX.writeFile(workbook, "Stock_Matieres_Premieres.xlsx");
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
          await addDoc(collection(db, 'products'), {
            sku: String(row.sku || row.SKU || row['Référence'] || ''),
            name: String(row.name || row.Désignation || row.Nom || ''),
            category: String(row.category || row.Catégorie || 'Matière Première'),
            unit: String(row.unit || row['Unité'] || 'kg'),
            type: 'raw_material',
            defaultPrice: Number(row.defaultPrice || row['Prix Unit.'] || row.Prix || 0),
            stockQuantity: Number(row.stockQuantity || row.Stock || row['En Stock'] || 0),
            minStock: Number(row.minStock || row.Seuil || 0),
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

  const { filtered, alertProducts, totalPages, paginatedProducts } = React.useMemo(() => {
    const f = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return {
      filtered: f,
      alertProducts: f.filter(p => getStockForUnit(p, selectedUnitId) <= getMinStockForUnit(p, selectedUnitId)),
      totalPages: Math.ceil(f.length / itemsPerPage),
      paginatedProducts: f.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    };
  }, [products, searchTerm, selectedUnitId, currentPage, itemsPerPage]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-amber-700 tracking-tight">Stock Matière Première</h2>
          <p className="text-sm text-gray-500 font-medium">Gestion du stock magasin 1</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={importFromExcel} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-amber-700 rounded-xl hover:bg-slate-50 font-bold text-xs transition-all uppercase tracking-wide">
            <UploadCloud size={16} />
            Importer Excel
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-amber-700 rounded-xl hover:bg-slate-50 font-bold text-xs transition-all uppercase tracking-wide">
            <FileSpreadsheet size={16} />
            Exporter Excel
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 shadow-lg shadow-amber-100 transition-all text-xs uppercase tracking-widest">
            <Plus size={18} />
            Nouvelle Matière
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
            <p className="text-orange-700 text-xs font-medium mb-3">Certains articles ont atteint ou dépassé leur seuil d'alerte.</p>
            <div className="flex flex-wrap gap-2">
              {alertProducts.slice(0, 5).map(p => (
                <span key={p.id} className="px-3 py-1 bg-white/60 text-orange-800 rounded-lg text-[10px] font-bold border border-orange-200/50">
                  {p.sku} - Reste: {getStockForUnit(p, selectedUnitId)} / Min: {getMinStockForUnit(p, selectedUnitId)}
                </span>
              ))}
              {alertProducts.length > 5 && <span className="px-3 py-1 text-orange-800 text-[10px] font-bold">+{alertProducts.length - 5} autres</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex-1 flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl group focus-within:ring-2 focus-within:ring-amber-100 transition-all w-full">
          <Search size={18} className="text-slate-400 group-focus-within:text-amber-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Rechercher par nom ou SKU..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none font-medium placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-slate-400 ml-1" />
          <span className="text-sm font-bold text-slate-700">Magasin 1</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-600" /></div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-amber-700 text-white text-[10px] uppercase font-black tracking-[0.2em]">
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
                {paginatedProducts.map(p => {
                  const stock = getStockForUnit(p, selectedUnitId);
                  const min = getMinStockForUnit(p, selectedUnitId);
                  return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-400 tracking-tighter uppercase">{p.sku}</td>
                    <td className="px-5 py-5 font-bold text-amber-800 uppercase text-sm">{p.name}</td>
                    <td className="px-5 py-5">
                      <span className="px-3 py-1 bg-amber-50 rounded-lg text-[9px] font-black text-amber-700 uppercase tracking-widest border border-amber-200">
                        {p.category || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className={`text-sm font-black font-mono px-3 py-1 rounded-lg ${stock <= min && stock > 0 ? 'bg-orange-50 text-orange-600' : stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {stock}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className="text-[11px] font-mono font-bold text-slate-400">{min}</span>
                    </td>
                    <td className="px-5 py-5 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">{p.unit}</span>
                    </td>
                    <td className="px-5 py-5 font-black text-right text-amber-800 font-mono whitespace-nowrap text-xs">
                      {p.defaultPrice?.toLocaleString()}
                    </td>
                    <td className="px-5 py-5 text-center">
                      {stock <= 0 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[9px] font-bold uppercase tracking-widest">Rupture</span>
                      ) : stock <= min ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-[9px] font-bold uppercase tracking-widest">Stock Alert</span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-widest">En Stock</span>
                      )}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                         onClick={() => {
                           setSelectedProduct(p);
                           setAdjustData({ quantity: 0, type: 'add', note: '' });
                           setIsAdjustModalOpen(true);
                         }}
                         className="p-2 bg-amber-50 text-amber-600 rounded-lg transition-all hover:bg-amber-100"
                         title="Ajuster le Stock"
                       >
                         <ArrowRightLeft size={16} />
                       </button>
                       <button onClick={() => deleteDoc(doc(db, 'products', p.id))} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Supprimer">
                         <Trash2 size={16} />
                       </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 mt-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Page {currentPage} sur {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      <AnimatePresence>
        {isAdjustModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdjustModalOpen(false)} className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-amber-700 text-white">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Ajustement Stock</h3>
                  <p className="text-[10px] text-amber-200 font-bold uppercase tracking-widest mt-1">{selectedProduct.name}</p>
                </div>
                <button onClick={() => setIsAdjustModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleAdjustStock} className="p-4 sm:p-8 space-y-5">
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
                          ? t === 'set' ? 'bg-amber-600 text-white shadow-sm' : t === 'remove' ? 'bg-red-500 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t === 'add' ? 'Ajout' : t === 'remove' ? 'Retrait' : 'Forcer'}
                    </button>
                  ))}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quantité</label>
                  <input type="number" required min="0" value={adjustData.quantity} onChange={e => setAdjustData({ ...adjustData, quantity: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-mono font-black text-center focus:bg-white transition-all outline-none focus:ring-4 focus:ring-amber-50 focus:border-amber-200" />
                </div>
                
                <button type="submit" disabled={loadingForm} className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl active:scale-95 mt-2 disabled:bg-slate-400 disabled:shadow-none ${
                  adjustData.type === 'remove' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : adjustData.type === 'set' ? 'bg-amber-600 hover:bg-slate-900 shadow-slate-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
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
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-amber-700 text-white">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Nouvelle Matière</h3>
                  <p className="text-[10px] text-amber-200 font-bold uppercase tracking-widest mt-1">Nomenclature technique</p>
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
                    {(() => {
                      const skuValue = formData.sku.trim();
                      const isSkuDuplicate = skuValue !== '' && products.some(p => p.sku?.trim().toUpperCase() === skuValue.toUpperCase());
                      const isSkuLengthValid = skuValue.length >= 3;
                      const isSkuValidStatus = skuValue !== '' && isSkuLengthValid && !isSkuDuplicate;

                      let inputBorderClasses = "border-slate-200 focus:ring-amber-50";
                      if (skuValue !== '') {
                        inputBorderClasses = isSkuValidStatus 
                          ? "border-emerald-300 bg-emerald-50/10 focus:ring-emerald-100/50" 
                          : "border-red-300 bg-red-50/10 focus:ring-red-100/50";
                      }

                      return (
                        <>
                          <div className="relative">
                            <input 
                              required 
                              placeholder="REF-000X" 
                              value={formData.sku} 
                              onChange={e => setFormData({ ...formData, sku: e.target.value })} 
                              className={`w-full p-4 pr-12 bg-slate-50 border rounded-2xl text-sm font-mono font-bold focus:ring-4 focus:bg-white outline-none transition-all ${inputBorderClasses}`} 
                            />
                            {skuValue !== '' && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                {!isSkuValidStatus ? (
                                  <XCircle size={18} className="text-red-500" />
                                ) : (
                                  <CheckCircle2 size={18} className="text-emerald-500" />
                                )}
                              </div>
                            )}
                          </div>
                          {skuValue !== '' && isSkuDuplicate && (
                            <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">
                              Ce SKU existe déjà !
                            </p>
                          )}
                          {skuValue !== '' && !isSkuLengthValid && (
                            <p className="text-[10px] text-red-400 font-bold mt-1 ml-1">
                              Requis: au moins 3 caractères.
                            </p>
                          )}
                          {skuValue !== '' && isSkuValidStatus && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1 ml-1">
                              SKU disponible.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Catégorie</label>
                    <input required placeholder="ex. Poudre" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-amber-50 focus:bg-white outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Désignation de l'article</label>
                  <input required placeholder="Nom complet de l'article" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-amber-800 outline-none focus:ring-4 focus:ring-amber-50 focus:bg-white transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unité de Mesure</label>
                    <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white transition-all outline-none appearance-none cursor-pointer">
                      <option value="pcs">Pièce (pcs)</option>
                      <option value="kg">Kilogramme (kg)</option>
                      <option value="ton">Tonne</option>
                      <option value="liter">Litre (L)</option>
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
                <button type="submit" disabled={loadingForm} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-slate-200/50 active:scale-95 mt-4 disabled:bg-slate-400">
                  {loadingForm ? 'Enregistrement en cours...' : 'Inscrire au Stock'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

