import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc, where, getDoc } from 'firebase/firestore';
import { Plus, Search, Trash2, X, Loader2, Factory, Play, CheckCircle2, ChevronDown, Check, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

export default function ProductionOrders() {
  const { user, tenantId } = useAuth();
  const { success, error } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [visibleColumns, setVisibleColumns] = useState({
    orderNumber: true,
    status: true,
    product: true,
    machine: true,
    operator: true,
    progress: true,
  });
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);

  const [formData, setFormData] = useState({
    bomId: '',
    expectedQuantity: 1,
    machine: '',
    operator: '',
    shift: '',
    site: 'HQ',
  });

  const [completionModal, setCompletionModal] = useState<{isOpen: boolean, order: any}>({isOpen: false, order: null});
  const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, order: any}>({isOpen: false, order: null});
  
  const [completionData, setCompletionData] = useState({
    actualQuantity: 0,
    materials: [] as any[], // array of actual usage
    notes: ''
  });

  useEffect(() => {
    if (!tenantId) return;

    // Fetch Production Orders
    const q = query(collection(db, 'production_orders'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Fetch BOMs
    const bomsSub = onSnapshot(query(collection(db, 'boms'), where('tenantId', '==', tenantId)), (snap) => {
      setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      bomsSub();
    };
  }, [tenantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !formData.bomId) return;

    setLoadingForm(true);
    setFormError(null);

    const bom = boms.find(b => b.id === formData.bomId);
    if (!bom) {
      setLoadingForm(false);
      return;
    }

    try {
      const materials = bom.materials.map((m: any) => ({
        rawMaterialId: m.rawMaterialId,
        rawMaterialName: m.rawMaterialName,
        sku: m.sku,
        unit: m.unit,
        expectedQty: m.quantity_per_unit * formData.expectedQuantity,
        actualQty: 0,
        variance: 0
      }));

      await addDoc(collection(db, 'production_orders'), {
        tenantId,
        orderNumber: `PO-${new Date().getTime().toString().slice(-6)}`,
        bomId: bom.id,
        bomName: bom.name,
        productId: bom.productId,
        productName: bom.productName,
        productSku: bom.productSku,
        ...formData,
        actualQuantity: 0,
        status: 'draft',
        materials,
        createdBy: user?.displayName || user?.email,
        createdAt: new Date().toISOString()
      });

      setIsModalOpen(false);
      setFormData({ bomId: '', expectedQuantity: 1, machine: '', operator: '', shift: '', site: 'HQ' });
      success('Ordre de fabrication créé avec succès');
    } catch (err: any) {
      console.error(err);
      setFormError("Erreur lors de la création de l'ordre de fabrication.");
      error("Erreur lors de la création");
    } finally {
      setLoadingForm(false);
    }
  };

  const startOrder = async (id: string) => {
    try {
      await updateDoc(doc(db, 'production_orders', id), {
        status: 'in_progress',
        startDate: new Date().toISOString()
      });
      success('Ordre de fabrication démarré');
    } catch (e) {
      console.error(e);
      error('Erreur lors du démarrage');
    }
  };

  const openCompletion = (order: any) => {
    setCompletionData({
      actualQuantity: order.expectedQuantity,
      materials: order.materials.map((m: any) => ({ ...m, actualQty: m.expectedQty })),
      notes: ''
    });
    setCompletionModal({ isOpen: true, order });
  };

  const completeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const order = completionModal.order;
    if (!order) return;

    setLoadingForm(true);
    try {
      // Calculate variance
      const materialsWithVariance = completionData.materials.map(m => ({
        ...m,
        variance: Number(m.actualQty) - Number(m.expectedQty)
      }));

      await updateDoc(doc(db, 'production_orders', order.id), {
        status: 'completed',
        endDate: new Date().toISOString(),
        actualQuantity: completionData.actualQuantity,
        materials: materialsWithVariance,
        notes: completionData.notes,
        updatedAt: new Date().toISOString()
      });
      setCompletionModal({ isOpen: false, order: null });

      // Ideal scenario: reduce stock for consumed raw materials and increase stock for finished product here
      success('Ordre clôturé et bilan matière enregistré');
    } catch (err: any) {
      console.error(err);
      error("Erreur lors de la clôture de l'ordre");
    } finally {
      setLoadingForm(false);
    }
  };

  const exportData = () => {
    const wsData = orders.map(o => ({
      'N° OF': o.orderNumber,
      'Date Création': new Date(o.createdAt).toLocaleDateString(),
      'Produit': o.productName,
      'SKU': o.productSku,
      'Machine': o.machine,
      'Opérateur': o.operator,
      'Qté Théorique': o.expectedQuantity,
      'Qté Produite': o.actualQuantity,
      'Statut': o.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OrdresDeFabrication");
    XLSX.writeFile(workbook, "Rapport_Production.xlsx");
    success('Export démarré');
  };

  const { filteredOrders, paginatedOrders, totalPages } = React.useMemo(() => {
    const filtered = orders.filter(o => {
      const s1 = searchTerm.toLowerCase();
      const matchesSearch = (o.orderNumber||'').toLowerCase().includes(s1) || (o.productName||'').toLowerCase().includes(s1);
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    // ensure current page is within boundaries
    const safePage = Math.min(currentPage, totalPages);
    
    const paginated = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

    return { filteredOrders: filtered, paginatedOrders: paginated, totalPages };
  }, [orders, searchTerm, statusFilter, currentPage, itemsPerPage]);

  // reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-900 tracking-tight flex items-center gap-2">
            <Factory className="text-indigo-600" /> Ordres de Fabrication
          </h2>
          <p className="text-sm text-gray-500 font-medium">Suivi de production, machine, et consommation matières</p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button onClick={() => setIsColumnPanelOpen(!isColumnPanelOpen)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs uppercase tracking-wide">
            <ChevronDown size={16} /> Colonnes
          </button>
          
          <AnimatePresence>
            {isColumnPanelOpen && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4">
                <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">Affichage (Tableau Dynamique)</h4>
                <div className="space-y-2">
                  {Object.entries({
                    orderNumber: 'Nº OF',
                    status: 'Statut',
                    product: 'Gamme / Produit',
                    machine: 'Machine',
                    operator: 'Opérateur',
                    progress: 'Progression'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-2 focus:ring-indigo-100 checked:bg-indigo-600 checked:border-indigo-600 outline-none transition-all cursor-pointer"
                          checked={visibleColumns[key as keyof typeof visibleColumns]}
                          onChange={() => setVisibleColumns(prev => ({...prev, [key]: !prev[key as keyof typeof visibleColumns]}))}
                        />
                        <Check size={14} className="absolute left-0.5 top-0.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 select-none">{label}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={exportData} className="flex items-center gap-2 bg-white border border-slate-200 text-indigo-600 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs uppercase tracking-wide">
            <Download size={16} /> Exporter
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-sm transition-all text-sm uppercase tracking-wide">
            <Plus size={18} /> Nouvel O.F.
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher Nº OF, Produit..." 
            className="bg-transparent border-none outline-none w-full text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white rounded-2xl border border-slate-200 p-2 shadow-sm overflow-x-auto min-w-max">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'draft', label: 'Brouillon' },
            { id: 'in_progress', label: 'En Cours' },
            { id: 'completed', label: 'Terminé' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                statusFilter === f.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-20 text-center border border-gray-200 shadow-sm">
          <Factory size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-indigo-900 mb-1">Aucun Ordre de Fabrication</h3>
          <p className="text-slate-500 text-sm">Créez le premier O.F. pour démarrer la production.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">
                  {visibleColumns.orderNumber && <th className="px-6 py-4">Nº OF</th>}
                  {visibleColumns.status && <th className="px-6 py-4">Status</th>}
                  {visibleColumns.product && <th className="px-6 py-4">Gamme / Produit</th>}
                  {(visibleColumns.machine || visibleColumns.operator) && <th className="px-6 py-4">Ordonnancement</th>}
                  {visibleColumns.progress && <th className="px-6 py-4 text-center">Progression (Qté)</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    {visibleColumns.orderNumber && (
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-indigo-900">{o.orderNumber}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{new Date(o.createdAt).toLocaleDateString()}</div>
                    </td>
                    )}
                    {visibleColumns.status && (
                    <td className="px-6 py-4">
                      {o.status === 'draft' ? <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Brouillon</span> :
                       o.status === 'in_progress' ? <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> En cours</span> :
                       <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-max"><Check size={12}/> Terminé</span>}
                    </td>
                    )}
                    {visibleColumns.product && (
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 text-sm leading-tight uppercase">{o.productName}</div>
                      <div className="text-[11px] font-mono font-medium text-slate-500 mt-0.5">{o.productSku}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">BOM: {o.bomName}</div>
                    </td>
                    )}
                    {(visibleColumns.machine || visibleColumns.operator) && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {visibleColumns.machine && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Machine</p>
                          <p className="text-xs font-semibold text-slate-700">{o.machine || 'N/A'}</p>
                        </div>
                        )}
                        {visibleColumns.operator && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Opérateur</p>
                          <p className="text-xs font-semibold text-slate-700">{o.operator || 'N/A'}</p>
                        </div>
                        )}
                      </div>
                    </td>
                    )}
                    {visibleColumns.progress && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-black font-mono text-indigo-700">{o.actualQuantity}</span>
                        <span className="text-xs font-black text-slate-400">/</span>
                        <span className="text-sm font-bold font-mono text-slate-500">{o.expectedQuantity}</span>
                      </div>
                    </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setDetailsModal({isOpen: true, order: o})} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Détails (Consommations)">
                          <FileText size={18} />
                        </button>
                        {o.status === 'draft' && (
                          <button onClick={() => startOrder(o.id)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Démarrer O.F.">
                            <Play size={18} />
                          </button>
                        )}
                        {o.status === 'in_progress' && (
                          <button onClick={() => openCompletion(o)} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Clôturer & Mettre à jour">
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-500">
                Affichage {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} sur {filteredOrders.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-black text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              <div className="px-8 py-6 bg-indigo-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Nouvel Ordre de Fabrication</h3>
                  <p className="text-[10px] text-indigo-200 font-bold tracking-widest mt-1 uppercase">Planification de Production</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-indigo-500 p-2 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleCreate} className="p-8 space-y-6">
                {formError && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200">{formError}</div>}
                
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Nomenclature (BOM) <span className="text-red-500">*</span></label>
                  <select required value={formData.bomId} onChange={e => setFormData({ ...formData, bomId: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium">
                    <option value="">Sélectionner une nomenclature...</option>
                    {boms.map(b => <option key={b.id} value={b.id}>{b.name} ({b.productName})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Qté. Théorique à Produire</label>
                    <input type="number" required min="1" value={formData.expectedQuantity} onChange={e => setFormData({ ...formData, expectedQuantity: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono font-bold text-2xl text-center" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Machine / Ligne</label>
                    <input type="text" placeholder="Ex: Machine M1" value={formData.machine} onChange={e => setFormData({ ...formData, machine: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Opérateur Responsable</label>
                    <input type="text" placeholder="Ex: Ahmed" value={formData.operator} onChange={e => setFormData({ ...formData, operator: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Shift / Équipe</label>
                    <select value={formData.shift} onChange={e => setFormData({ ...formData, shift: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium">
                      <option value="">Sélectionner...</option>
                      <option value="Matin">Matin</option>
                      <option value="Soir">Soir</option>
                      <option value="Nuit">Nuit</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Annuler</button>
                  <button type="submit" disabled={loadingForm} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
                    {loadingForm && <Loader2 size={18} className="animate-spin" />} Lancer l'O.F.
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion Modal - Declare Consumptions */}
      <AnimatePresence>
        {completionModal.isOpen && completionModal.order && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCompletionModal({isOpen: false, order: null})} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="px-8 py-6 bg-emerald-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Déclaration de Fin de Production</h3>
                  <p className="text-[10px] text-emerald-100 font-bold tracking-widest mt-1 uppercase">O.F. {completionModal.order?.orderNumber} - {completionModal.order?.productName}</p>
                </div>
                <button onClick={() => setCompletionModal({isOpen: false, order: null})} className="hover:bg-emerald-500 p-2 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <form onSubmit={completeOrder} className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                  <label className="block text-[11px] font-black uppercase text-emerald-800 mb-3 tracking-widest text-center">Quantité Réelle Produite (Bons / Pièces Finies)</label>
                  <input type="number" required min="0" value={completionData.actualQuantity} onChange={e => setCompletionData({ ...completionData, actualQuantity: Number(e.target.value) })} className="w-full sm:w-1/2 mx-auto block px-4 py-4 bg-white border border-emerald-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-mono font-black text-4xl text-emerald-900 text-center shadow-inner" />
                </div>

                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 border-b border-slate-200 pb-2 mb-4">Matières Consommées (Théorique vs Réel)</h4>
                  <div className="space-y-4">
                    {completionData.materials.map((m, idx) => {
                      const diff = Number(m.actualQty) - Number(m.expectedQty);
                      const isOver = diff > 0;
                      const isUnder = diff < 0;
                      return (
                      <div key={idx} className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate uppercase">{m.rawMaterialName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{m.sku}</p>
                        </div>
                        <div className="w-full sm:w-auto flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estimé</p>
                            <p className="font-mono font-bold text-slate-600">{m.expectedQty} {m.unit}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Consommé Réel</p>
                            <div className="flex items-center gap-2">
                              <input type="number" step="0.01" required min="0" value={m.actualQty === 0 && m.expectedQty > 0 ? '' : m.actualQty} onChange={e => {
                                const newM = [...completionData.materials];
                                newM[idx].actualQty = Number(e.target.value);
                                setCompletionData({ ...completionData, materials: newM });
                              }} className="w-28 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none text-right" />
                              <span className="text-xs font-bold text-slate-400">{m.unit}</span>
                            </div>
                          </div>
                          <div className="w-24 text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Écart</p>
                            <span className={`text-sm font-mono font-bold ${isOver ? 'text-red-500' : isUnder ? 'text-blue-500' : 'text-slate-400'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Observations / Notes sur les écarts</label>
                  <textarea rows={3} value={completionData.notes} onChange={e => setCompletionData({...completionData, notes: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-medium text-sm" placeholder="Ex: Perte de matière suite défaut machine..."></textarea>
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 shrink-0">
                  <button type="button" onClick={() => setCompletionModal({isOpen: false, order: null})} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Annuler</button>
                  <button type="submit" disabled={loadingForm} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 uppercase tracking-wide">
                    {loadingForm ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={20} />} Enregistrer & Clôturer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {detailsModal.isOpen && detailsModal.order && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailsModal({isOpen: false, order: null})} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="px-8 py-6 bg-slate-800 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Détails de l'Ordre</h3>
                  <p className="text-[10px] text-slate-300 font-bold tracking-widest mt-1 uppercase">O.F. {detailsModal.order.orderNumber} - {detailsModal.order.productName}</p>
                </div>
                <button onClick={() => setDetailsModal({isOpen: false, order: null})} className="hover:bg-slate-700 p-2 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Status</p>
                    <p className="font-bold text-slate-800">{detailsModal.order.status === 'completed' ? 'Clôturé' : detailsModal.order.status === 'in_progress' ? 'En Cours' : 'Brouillon'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Progression</p>
                    <p className="font-bold text-slate-800">{detailsModal.order.actualQuantity} / {detailsModal.order.expectedQuantity}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Machine</p>
                    <p className="font-bold text-slate-800">{detailsModal.order.machine || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Opérateur</p>
                    <p className="font-bold text-slate-800">{detailsModal.order.operator || '-'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 border-b border-slate-200 pb-2 mb-4">Bilan Matières ({detailsModal.order.status === 'completed' ? 'Réel vs Estimé' : 'Estimatif'})</h4>
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                          <th className="px-4 py-3">Matière</th>
                          <th className="px-4 py-3 text-right">Théorique</th>
                          <th className="px-4 py-3 text-right">Consommé</th>
                          <th className="px-4 py-3 text-right">Écart</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailsModal.order.materials.map((m: any, idx: number) => {
                          const isOver = m.variance > 0;
                          const isUnder = m.variance < 0;
                          return (
                          <tr key={idx}>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800 text-xs">{m.rawMaterialName}</p>
                              <p className="font-mono text-[10px] text-slate-400">{m.sku}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-600 text-xs">
                              {m.expectedQty} {m.unit}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 text-xs">
                              {detailsModal.order.status === 'completed' ? m.actualQty + ' ' + m.unit : '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {detailsModal.order.status === 'completed' ? (
                                <span className={`font-mono font-black text-xs ${isOver ? 'text-red-500' : isUnder ? 'text-blue-500' : 'text-slate-400'}`}>
                                  {m.variance > 0 ? '+' : ''}{m.variance} {m.unit}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {detailsModal.order.notes && (
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 border-b border-slate-200 pb-2 mb-4">Observations</h4>
                    <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">{detailsModal.order.notes}</p>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
