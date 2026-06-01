import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Plus, Trash2, Box, Calendar, FileText, CheckCircle2, X, AlertTriangle, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PPIItem {
  id: string;
  category: 'equipment' | 'aapi' | 'fonctionnement';
  period: string; // e.g., "S1 2026"
  tariffCode: string; // البند التعريفي
  subTariffCode: string; // البند التعريفي الفرعي
  productName: string; // تسمية المنتج
  stockStatus: number; // حالة المخزونات
  customsClearance: number; // المادة الخام قيد التخليص الجمركي
  requestedQuantity: number; // الكمية المطلوب استرادها
  consumedQuantity: number; // الكمية المستهلكة (المستوردة)
  unit: string; // الوحدة
  remarks: string; // ملاحظات
}

export default function PPI() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<PPIItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'equipment' | 'aapi' | 'fonctionnement'>('equipment');
  const [currentPeriod, setCurrentPeriod] = useState<string>('S1 2026');
  const [isJsonImportOpen, setIsJsonImportOpen] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');
  const [jsonImportError, setJsonImportError] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'ppi_items'),
      where('tenantId', '==', tenantId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as PPIItem)));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  const handleAddItem = async () => {
    if (!tenantId) return;
    const newItem = {
      tenantId,
      category: activeCategory,
      period: currentPeriod,
      tariffCode: '',
      subTariffCode: '',
      productName: '',
      stockStatus: 0,
      customsClearance: 0,
      requestedQuantity: 0,
      consumedQuantity: 0,
      unit: '',
      remarks: '',
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'ppi_items'), newItem);
  };

  const handleJsonImport = async () => {
    try {
      setJsonImportError('');
      const parsed = JSON.parse(jsonImportText);
      const itemsToAdd = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const item of itemsToAdd) {
        if (!tenantId) continue;
        const newItem = {
          tenantId,
          category: activeCategory,
          period: currentPeriod,
          tariffCode: String(item.tariffCode || item.code || item['البند التعريفي'] || ''),
          subTariffCode: String(item.subTariffCode || item.subCode || item['البند التعريفي الفرعي'] || ''),
          productName: String(item.productName || item.name || item.nom || item['تسمية المنتج'] || item.description || ''),
          stockStatus: Number(item.stockStatus || item.stock || item['حالة المخزونات'] || 0),
          customsClearance: Number(item.customsClearance || item.clearance || item['المادة الخام قيد التخليص الجمركي'] || 0),
          requestedQuantity: Number(item.requestedQuantity || item.quantity || item.qte || item['الكمية المطلوب استرادها'] || 0),
          consumedQuantity: Number(item.consumedQuantity || item.consumed || 0),
          unit: String(item.unit || item.unite || item['الوحدة'] || 'U'),
          remarks: String(item.remarks || item.remarques || item['ملاحظات'] || ''),
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'ppi_items'), newItem);
      }
      setIsJsonImportOpen(false);
      setJsonImportText('');
    } catch (err) {
      setJsonImportError('Le format JSON est invalide. Veuillez vérifier la syntaxe.');
    }
  };

  const handleUpdateItem = async (id: string, field: keyof PPIItem, value: any) => {
    await updateDoc(doc(db, 'ppi_items', id), {
      [field]: value
    });
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer cette ligne?')) {
      await deleteDoc(doc(db, 'ppi_items', id));
    }
  };

  const filteredItems = items.filter(i => i.category === activeCategory && i.period === currentPeriod);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#136AA8] tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6" /> Programme Prévisionnel d'Importation (PPI)
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gestion des quotas et prévisions d'importation semestrielles</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-[12px] shadow-sm">
          <Calendar size={18} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Période:</span>
          <select 
            value={currentPeriod} 
            onChange={(e) => setCurrentPeriod(e.target.value)}
            className="bg-transparent text-sm font-black text-[#136AA8] outline-none border-none py-1 lg:pl-1 pr-8"
          >
            <option value="S1 2025">S1 2025</option>
            <option value="S2 2025">S2 2025</option>
            <option value="S1 2026">S1 2026</option>
            <option value="S2 2026">S2 2026</option>
          </select>
        </div>
      </div>

      <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 w-fit">
        <button 
          onClick={() => setActiveCategory('equipment')}
          className={`flex-1 flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
            activeCategory === 'equipment' ? 'bg-[#136AA8] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Box size={16} /> التجهيز (Équipement)
        </button>
        <button 
          onClick={() => setActiveCategory('aapi')}
          className={`flex-1 flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
            activeCategory === 'aapi' ? 'bg-[#136AA8] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 size={16} /> ترقية الاستثمار (AAPI/ANDI)
        </button>
        <button 
          onClick={() => setActiveCategory('fonctionnement')}
          className={`flex-1 flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
            activeCategory === 'fonctionnement' ? 'bg-[#136AA8] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <FileText size={16} /> التسيير (Fonctionnement)
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">البند التعريفي<br/><span className="text-[10px] uppercase font-normal">Tariff Code</span></th>
                <th className="px-4 py-3 whitespace-nowrap">البند التعريفي الفرعي<br/><span className="text-[10px] uppercase font-normal">Sub-tariff Code</span></th>
                <th className="px-4 py-3 min-w-[200px]">تسمية المنتج<br/><span className="text-[10px] uppercase font-normal">Product Name</span></th>
                <th className="px-4 py-3 whitespace-nowrap text-center">الوحدة<br/><span className="text-[10px] uppercase font-normal">Unit</span></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">حالة المخزونات<br/><span className="text-[10px] uppercase font-normal">Stock</span></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">قيد التخليص<br/><span className="text-[10px] uppercase font-normal">In Clearance</span></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">المطلوب استرادها<br/><span className="text-[10px] uppercase font-normal">Requested (Max)</span></th>
                <th className="px-4 py-3 whitespace-nowrap text-right text-blue-700">المستهلكة<br/><span className="text-[10px] uppercase font-normal">Consumed</span></th>
                <th className="px-4 py-3 whitespace-nowrap text-right text-emerald-700">المتبقية<br/><span className="text-[10px] uppercase font-normal">Remaining</span></th>
                <th className="px-4 py-3">ملاحظات<br/><span className="text-[10px] uppercase font-normal">Remarks</span></th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400 font-medium">
                    Aucun article défini pour cette période et catégorie.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const remaining = Number(item.requestedQuantity || 0) - Number(item.consumedQuantity || 0);
                  const remainingClass = remaining < 0 ? 'text-red-500' : remaining === 0 ? 'text-slate-400' : 'text-emerald-600';
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.tariffCode} 
                          onChange={(e) => handleUpdateItem(item.id, 'tariffCode', e.target.value)}
                          className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs outline-none" 
                          placeholder="Ex: 8504"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.subTariffCode} 
                          onChange={(e) => handleUpdateItem(item.id, 'subTariffCode', e.target.value)}
                          className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs outline-none" 
                          placeholder="Ex: 8504.40.90"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.productName} 
                          onChange={(e) => handleUpdateItem(item.id, 'productName', e.target.value)}
                          className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-bold text-xs outline-none" 
                          placeholder="Nom du produit..."
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.unit} 
                          onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                          className="w-full text-center bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs text-slate-500 outline-none" 
                          placeholder="U/KG/T..."
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          value={item.stockStatus} 
                          onChange={(e) => handleUpdateItem(item.id, 'stockStatus', Number(e.target.value))}
                          className="w-full text-right bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs outline-none" 
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          value={item.customsClearance} 
                          onChange={(e) => handleUpdateItem(item.id, 'customsClearance', Number(e.target.value))}
                          className="w-full text-right bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs outline-none" 
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          value={item.requestedQuantity} 
                          onChange={(e) => handleUpdateItem(item.id, 'requestedQuantity', Number(e.target.value))}
                          className="w-full text-right bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs font-black text-[#136AA8] outline-none" 
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          value={item.consumedQuantity} 
                          onChange={(e) => handleUpdateItem(item.id, 'consumedQuantity', Number(e.target.value))}
                          className="w-full text-right bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded font-mono text-xs font-bold text-blue-700 bg-blue-50/50 outline-none" 
                          title="Quantité déjà importée"
                        />
                      </td>
                      <td className={`px-4 py-2 text-right font-mono text-sm font-black ${remainingClass}`}>
                        {remaining}
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.remarks} 
                          onChange={(e) => handleUpdateItem(item.id, 'remarks', e.target.value)}
                          className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded text-[11px] text-slate-500 outline-none" 
                          placeholder="Remarques..."
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={() => setIsJsonImportOpen(true)}
            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-widest shadow-sm"
          >
            <FileText size={14} /> Importer JSON
          </button>
          <button
            onClick={handleAddItem}
            className="bg-[#136AA8] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-800 transition-colors uppercase tracking-widest shadow-sm"
          >
            <Plus size={14} /> Ajouter une ligne
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isJsonImportOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setIsJsonImportOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" 
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-[#136AA8] flex items-center gap-2">
                   <FileText size={18} /> Importer depuis JSON
                 </h3>
                 <button onClick={() => setIsJsonImportOpen(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent">
                   <X size={20} />
                 </button>
              </div>
              <div className="p-4 space-y-3">
                 <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                   Collez votre tableau JSON ci-dessous. Exemple : <br />
                   <code className="block mt-1 font-mono text-[10px] text-slate-600">
                     [<br/>
                       &nbsp;&nbsp;&#123; "tariffCode": "8401", "name": "Produit 1", "quantity": 10 &#125;,<br/>
                       &nbsp;&nbsp;&#123; "tariffCode": "8402", "name": "Produit 2", "quantity": 5 &#125;<br/>
                     ]
                   </code>
                 </div>
                 
                 <textarea 
                   className="w-full h-48 bg-white border border-slate-300 rounded-lg p-3 text-sm font-mono focus:border-[#136AA8] focus:ring-1 focus:ring-[#136AA8] outline-none"
                   placeholder="Collez le JSON ici..."
                   value={jsonImportText}
                   onChange={e => setJsonImportText(e.target.value)}
                 />
                 
                 {jsonImportError && (
                   <div className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded flex items-center gap-2">
                     <AlertTriangle size={14} /> {jsonImportError}
                   </div>
                 )}
              </div>
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                 <button 
                   onClick={() => setIsJsonImportOpen(false)}
                   className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm border-none bg-transparent"
                 >
                   Annuler
                 </button>
                 <button 
                   onClick={handleJsonImport}
                   disabled={!jsonImportText.trim()}
                   className="bg-[#136AA8] text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-blue-800 transition-colors flex items-center gap-2 border-none"
                 >
                   <CheckSquare size={16} /> Importer
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
