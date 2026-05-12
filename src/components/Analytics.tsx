import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Loader2, TrendingUp, DollarSign, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8B5CF6', '#F43F5E', '#10B981', '#3B82F6'];

export default function Analytics() {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPos(snap.docs.map(d => d.data()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-[#009CDA]" /></div>;
  }

  // 1. Total Spending Per Month
  const spendingPerMonth = pos.reduce((acc, po) => {
    const date = new Date(po.createdAt);
    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    acc[month] = (acc[month] || 0) + (po.totalAmount || 0);
    return acc;
  }, {} as Record<string, number>);

  const monthlyData = Object.keys(spendingPerMonth).map(month => ({
    name: month,
    Total: spendingPerMonth[month]
  }));

  // 2. Spending Distribution by Supplier
  const spendingBySupplier = pos.reduce((acc, po) => {
    const supplier = po.supplierName || 'Unknown';
    acc[supplier] = (acc[supplier] || 0) + (po.totalAmount || 0);
    return acc;
  }, {} as Record<string, number>);

  const supplierData = Object.keys(spendingBySupplier).map(supplier => ({
    name: supplier,
    value: spendingBySupplier[supplier]
  })).sort((a, b) => b.value - a.value).slice(0, 10); // Top 10

  // 3. Number of Pending vs Completed Orders
  const ordersByStatus = pos.reduce((acc, po) => {
    const status = po.status || 'draft';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.keys(ordersByStatus).map(status => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: ordersByStatus[status]
  }));

  // 4. Most Frequently Bought Products (By Quantity)
  const productQuantities = pos.reduce((acc, po) => {
    if (po.status !== 'cancelled' && po.items) {
      po.items.forEach((item: any) => {
        const prodName = item.name || 'Unknown';
        acc[prodName] = (acc[prodName] || 0) + (Number(item.quantity) || 0);
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const topProductsData = Object.keys(productQuantities).map(prod => ({
    name: prod,
    Quantité: productQuantities[prod]
  })).sort((a, b) => b.Quantité - a.Quantité).slice(0, 10);

  // 5. Spending by Unit / Department
  const spendingByUnit = pos.reduce((acc, po) => {
    if (po.status !== 'cancelled') {
        const unitName = po.unit?.name || 'Siège HQ';
        acc[unitName] = (acc[unitName] || 0) + (Number(po.totalAmount) || 0);
    }
    return acc;
  }, {} as Record<string, number>);

  const unitData = Object.keys(spendingByUnit).map(unit => ({
    name: unit,
    value: spendingByUnit[unit]
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#136AA8]">Analyses avancées</h2>
        <p className="text-sm text-gray-500">Aperçu visuel de vos dépenses et statuts de commandes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spending Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            Dépenses Totales par Mois
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Status */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <Package size={16} className="text-emerald-500" />
            Statut des Commandes
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 Products by Quantity */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <Package size={16} className="text-orange-500" />
            Top 10 Produits les plus demandés (Qté)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="Quantité" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by Unit (Pie / Donut) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <DollarSign size={16} className="text-rose-500" />
            Dépenses par Unité / Département
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={unitData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {unitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val: number) => `${val.toLocaleString()} DZD`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by Supplier */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <DollarSign size={16} className="text-amber-500" />
            Répartition des Dépenses par Fournisseur
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierData} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
