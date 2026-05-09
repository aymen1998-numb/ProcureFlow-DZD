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
    taxId: '',
    currency: 'DZD',
    logoUrl: ''
  });

  useEffect(() => {
    if (!tenantId) return;
    
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'tenant_settings', tenantId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData({ ...formData, ...docSnap.data() });
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
    if (!tenantId || role !== 'admin') return;
    
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

  if (role !== 'admin') {
    return (
      <div className="p-8 text-center text-slate-500">
        Vous n'avez pas l'autorisation d'accéder à cette page.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F] flex items-center gap-2">
          <Building2 className="text-blue-600" /> Paramètres de l'entreprise
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
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                placeholder="Ex: SARL Ma Société"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresse complète</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all resize-none h-24"
                placeholder="Ex: 123 Rue de la République..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIF / RC / Identifiant Fiscal</label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                placeholder="Ex: 000123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Devise par défaut</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="DZD">Dinar Algérien (DZD)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar américain ($)</option>
                <option value="GBP">Livre sterling (£)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">URL du Logo (optionnel)</label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-slate-500 mt-2">Ce logo sera affiché sur les bons de commande et les factures générés en PDF.</p>
              {formData.logoUrl && (
                <div className="mt-4 p-4 border border-slate-100 bg-slate-50 rounded-xl inline-block">
                  <span className="text-xs text-slate-500 block mb-2 font-medium">Aperçu :</span>
                  <img src={formData.logoUrl} alt="Logo Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
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
