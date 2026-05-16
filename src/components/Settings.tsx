import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Loader2, Save, Building2 } from 'lucide-react';

export default function Settings() {
  const { tenantId, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    address: '',
    currency: 'DZD',
    logoUrl: '',
    units: [
      { id: '1', name: 'Siège Principal', nif: '', rc: '', ai: '', address: '' }
    ]
  });

  const handleAddUnit = () => {
    setFormData({
      ...formData,
      units: [...(formData.units || []), { id: Date.now().toString(), name: '', nif: '', rc: '', ai: '', address: '' }]
    });
  };

  const handleUpdateUnit = (index: number, field: string, value: string) => {
    const newUnits = [...(formData.units || [])];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setFormData({ ...formData, units: newUnits });
  };

  const handleRemoveUnit = (index: number) => {
    const newUnits = [...(formData.units || [])];
    newUnits.splice(index, 1);
    setFormData({ ...formData, units: newUnits });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 500) {
        alert("L'image est trop grande. Veuillez choisir une image de moins de 500 Ko.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'tenant_settings', tenantId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.units && (data.nif || data.rc || data.locations)) {
            // Migration for legacy data
            const locs = (data.locations || 'Siège Principal').split(',').map((l: string) => l.trim()).filter(Boolean);
            data.units = locs.map((name: string, i: number) => ({
              id: Date.now().toString() + i,
              name,
              nif: data.nif || '',
              rc: data.rc || '',
              ai: data.ai || '',
              address: data.address || ''
            }));
          }
          setFormData({ ...formData, ...data });
        }
      } catch (err) {
        console.error("Error fetching settings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !['admin', 'superadmin'].includes(role || '')) return;
    
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'tenant_settings', tenantId), {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setMessage({ text: 'Paramètres enregistrés avec succès.', type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tenant_settings/${tenantId}`);
      setMessage({ text: 'Erreur lors de l\'enregistrement des paramètres.', type: 'error' });
    } finally {
      setSaving(false);
      // Auto-hide message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!['admin', 'superadmin'].includes(role || '')) {
    return (
      <div className="p-8 text-center text-slate-500">
        Vous n'avez pas l'autorisation d'accéder à cette page.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#136AA8] flex items-center gap-2">
          <Building2 className="text-[#009CDA]" /> Paramètres de l'entreprise
        </h1>
        <p className="text-slate-500 mt-1">Gérez le profil de votre entreprise (utilisé pour les factures et bons de commande).</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'entreprise</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#009CDA] focus:border-transparent outline-none transition-all"
                placeholder="Ex: SARL Ma Société"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresse complète</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#009CDA] focus:border-transparent outline-none transition-all resize-none h-24"
                placeholder="Ex: 123 Rue de la République..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Devise par défaut</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#009CDA] focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="DZD">Dinar Algérien (DZD)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar américain ($)</option>
                <option value="GBP">Livre sterling (£)</option>
              </select>
            </div>

            <div className="md:col-span-2 pt-4">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-slate-700">Unités / Filiales (avec NIF & RC)</label>
                <button type="button" onClick={handleAddUnit} className="text-sm text-[#009CDA] hover:text-blue-800 font-medium">
                  + Ajouter une unité
                </button>
              </div>
              <div className="space-y-4">
                {(formData.units || []).map((unit, idx) => (
                  <div key={unit.id || idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                    <button type="button" onClick={() => handleRemoveUnit(idx)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500">
                      ×
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nom de l'unité (ex: Usine 1)</label>
                        <input type="text" value={unit.name} onChange={(e) => handleUpdateUnit(idx, 'name', e.target.value)} required className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Adresse de l'unité (Optionnel)</label>
                        <input type="text" value={unit.address || ''} onChange={(e) => handleUpdateUnit(idx, 'address', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">NIF</label>
                        <input type="text" value={unit.nif} onChange={(e) => handleUpdateUnit(idx, 'nif', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">RC</label>
                        <input type="text" value={unit.rc} onChange={(e) => handleUpdateUnit(idx, 'rc', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">AI</label>
                        <input type="text" value={unit.ai} onChange={(e) => handleUpdateUnit(idx, 'ai', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
                {(!formData.units || formData.units.length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-slate-200">Aucune unité configurée.</p>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo de l'entreprise</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#009CDA] focus:border-transparent outline-none transition-all bg-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-slate-500 mt-2">Format recommandé: PNG ou JPG, max 500 Ko. Ce logo sera affiché sur les bons de commande et les factures générés en PDF.</p>
              {formData.logoUrl && (
                <div className="mt-4 p-4 border border-slate-100 bg-slate-50 rounded-xl inline-block relative">
                  <span className="text-xs text-slate-500 block mb-2 font-medium">Aperçu :</span>
                  <img src={formData.logoUrl} alt="Logo Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <button type="button" onClick={() => setFormData({...formData, logoUrl: ''})} className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700">Supprimer</button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#009CDA] hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
