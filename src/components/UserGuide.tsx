import React, { useState } from 'react';
import { BookOpen, Factory, ClipboardList, Target, AlertTriangle, Users, BarChart3, ChevronRight, CheckCircle2, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export default function UserGuide() {
  const [activeSection, setActiveSection] = useState<'intro' | 'bom' | 'production' | 'variance' | 'roles' | 'kpi'>('intro');
  const [lang, setLang] = useState<'fr' | 'ar'>('fr');

  const content = {
    fr: {
      title: 'Guide Utilisateur & Documentation',
      subtitle: 'Apprenez à utiliser la plateforme et maîtriser la gestion de production.',
      nav: {
        intro: 'Introduction & Workflow',
        bom: 'Nomenclatures (BOM)',
        production: 'Ordres de Fabrication',
        variance: 'Écarts & Observations',
        roles: 'Rôles & Accès',
        kpi: 'Indicateurs & Tableaux',
      },
      intro: {
        title: 'Le Workflow de Production',
        desc: 'Comprendre le cycle de vie d\'un produit, de la matière première à l\'expédition.',
        p1: 'La plateforme centralise toutes vos opérations de production pour vous offrir une traçabilité totale sur vos consommations et vos coûts. Le cycle de production suit un schéma simple en 3 étapes :',
        step1: 'Nomenclature',
        step1Desc: 'Création des recettes (BOM). Vous définissez quelles matières premières sont nécessaires pour concevoir le produit fini.',
        step2: 'Lancement O.F.',
        step2Desc: 'Planification de la production. Affectation d\'une machine, d\'une équipe et calcul de la demande théorique.',
        step3: 'Clôture & Bilan',
        step3Desc: 'Déclaration des quantités réelles produites et consommées. Identification des pertes et ajustements.',
      },
      bom: {
        title: 'Nomenclatures (BOM - Bill of Materials)',
        p1: 'Une nomenclature est la recette d\'un produit fini. Elle liste les composants et matières premières nécessaires (Polyol, Additifs, Tissu, etc.) ainsi que les quantités exactes pour fabriquer une seule unité.',
        exampleTitle: 'Exemple concret :',
        example1: 'Produit Fini : Matelas Confort 140x190',
        example2: 'Composants : 7kg de mousse, 1 Housse Tissu, 20m de fil, 0.5kg de Colle.',
        footer: 'L\'outil utilise cette recette pour prédire vos besoins lors des commandes de fabrication.',
      },
      production: {
        title: 'Ordres de Fabrication (O.F.)',
        p1: 'Le module de production suit trois statuts principaux :',
        s1Title: 'Brouillon',
        s1Sub: 'Planification (Théorique)',
        s1Desc: 'L\'ordre est créé. Vous décidez quel produit fabriquer et en quelle quantité. Le système calcule la demande théorique en fonction de la nomenclature (BOM).',
        s2Title: 'En Cours',
        s2Sub: 'Exécution',
        s2Desc: 'La production a démarré sur la machine. Les équipes travaillent sur le lot. Rien n\'est encore déduit des stocks finaux.',
        s3Title: 'Terminé',
        s3Sub: 'Clôture & Déclaration',
        s3Desc: 'L\'opérateur déclare la production terminée. C\'est à ce moment qu\'il inscrit ce qui a REELLEMENT été produit et consommé.',
      },
      variance: {
        title: 'Gestion des Écarts (Théorique vs Réel)',
        t1: 'Consommation Théorique',
        d1: 'Ce que la machine aurait dû consommer selon la formule idéale (BOM x Quantité commandée).',
        t2: 'Consommation Réelle',
        d2: 'Ce qui a été physiquement sorti du stock pour réaliser cette commande précise.',
        obsTitle: 'Le champ "Observations / Notes"',
        obsDesc: 'Il y a très souvent des écarts en usine à cause des aléas. Lorsque l\'opérateur clôture un ordre et modifie une consommation pour la rendre réelle (ex: +3kg de colle consommée en plus), il DOIT justifier l\'écart dans les notes libres.',
        casesTitle: 'Cas d\'usage fréquents pour les notes :',
        c1: 'Défaut qualité : Rebut de mousse, lot de tissu abîmé taché.',
        c2: 'Ajustement machine : Premier réglage machine défectueux (perte).',
        c3: 'Conditions : Variation de la densité en raison de l\'humidité.',
      },
      roles: {
        title: 'Accès & Rôles',
        desc: 'Le système protège les données en fonction du poste de l\'utilisateur. Chaque rôle a des permissions ciblées.',
        r1Title: 'Administrateur / Manager',
        r1Desc: 'Accès total à tous les modules, configurations et tableaux de bord analytiques.',
        r2Title: 'Chef de Production',
        r2Desc: 'Création des BOM, génération des O.F., modification des statuts en cours et clôture. N\'a généralement pas accès aux prix d\'achat fournisseurs vitaux.',
        r3Title: 'Magasinier (Stock)',
        r3Desc: 'Vue restreinte aux articles, inventaires, réceptions de marchandises et transferts inter-sites. Assure les sorties de matières pour la production.',
      },
      kpi: {
        title: 'Indicateurs & Utilisation des Tableaux',
        t1: 'Tableau Dynamique (O.F.)',
        p1: 'La liste des ordres de fabrication possède la particularité d\'être un tableau dynamique. Cliquez sur le bouton "Colonnes" en haut à droite pour afficher ou masquer des informations (Opérateur, Machine, Progression...). Vous pouvez configurer l\'affichage pour réduire la surcharge visuelle et ensuite cliquer sur "Exporter" pour récupérer uniquement ces données en format Excel.',
        t2: 'KPI à surveiller (Analytique à venir)',
        k1: 'Taux de Rebut (Waste Rate) : S\'observe facilement via l\'écart positif des consommations. Permet de cibler la santé d\'une machine.',
        k2: 'Fiabilité des BOM : Si les écarts de consommation sont systématiques pour une recette précise, le BOM théorique est mal paramétré et doit être ajusté.',
        k3: 'Évaluation des coûts de revient : À chaque clôture d\'OF, la matière gâchée devrait idéalement être redistribuée sur le coût final des matelas. (Fonctionnalité financière étendue).',
      }
    },
    ar: {
      title: 'دليل المستخدم والتوثيق',
      subtitle: 'تعلم كيفية استخدام المنصة وإتقان إدارة الإنتاج.',
      nav: {
        intro: 'مقدمة وسير العمل',
        bom: 'فواتير المواد (BOM)',
        production: 'أوامر التصنيع (O.F.)',
        variance: 'الفروقات والملاحظات',
        roles: 'الأدوار والصلاحيات',
        kpi: 'المؤشرات والجداول',
      },
      intro: {
        title: 'سير عمل الإنتاج',
        desc: 'فهم دورة حياة المنتج، من المواد الخام إلى الشحن.',
        p1: 'تقوم المنصة بمركزة جميع عمليات الإنتاج الخاصة بك لتمنحك تتبعاً كاملاً لاستهلاكاتك وتكاليفك. تتبع دورة الإنتاج نمطاً بسيطاً من 3 خطوات :',
        step1: 'فاتورة المواد (BOM)',
        step1Desc: 'إنشاء الوصفات (BOM). تحدد المواد الخام اللازمة لتصميم المنتج النهائي.',
        step2: 'إطلاق طلب التصنيع (O.F.)',
        step2Desc: 'تخطيط الإنتاج. تخصيص آلة وفريق وحساب الطلب النظري.',
        step3: 'الإغلاق والتقييم',
        step3Desc: 'الإعلان عن الكميات الفعلية المنتجة والمستهلكة. تحديد الخسائر والتعديلات.',
      },
      bom: {
        title: 'فواتير المواد (BOM - Bill of Materials)',
        p1: 'فاتورة المواد هي وصفة المنتج النهائي. تدرج المكونات والمواد الخام اللازمة (بوليول، إضافات، قماش، إلخ) بالإضافة إلى الكميات الدقيقة لإنتاج وحدة واحدة.',
        exampleTitle: 'مثال ملموس :',
        example1: 'المنتج النهائي : مرتبة كمفورت 140x190',
        example2: 'المكونات : 7 كجم إسفنج، 1 غطاء قماش، 20 متر خيط، 0.5 كجم غراء.',
        footer: 'تستخدم الأداة هذه الوصفة للتنبؤ باحتياجاتك عند طلبات التصنيع.',
      },
      production: {
        title: 'أوامر التصنيع (O.F.)',
        p1: 'تتبع وحدة الإنتاج ثلاث حالات رئيسية :',
        s1Title: 'مسودة',
        s1Sub: 'التخطيط (النظري)',
        s1Desc: 'تم إنشاء الطلب. تقرر المنتج الذي تريد تصنيعه والكمية. يحسب النظام الطلب النظري بناءً على فاتورة المواد (BOM).',
        s2Title: 'قيد التنفيذ',
        s2Sub: 'التنفيذ',
        s2Desc: 'بدأ الإنتاج على الآلة. تعمل الفرق على الدفعة. لم يتم خصم أي شيء من المخازن النهائية بعد.',
        s3Title: 'مكتمل',
        s3Sub: 'الإغلاق والإعلان',
        s3Desc: 'يعلن المشغل انتهاء الإنتاج. في هذه اللحظة يسجل ما تم إنتاجه واستهلاكه فعلياً.',
      },
      variance: {
        title: 'إدارة الفروقات (النظري مقابل الفعلي)',
        t1: 'الاستهلاك النظري',
        d1: 'ما كان يجب أن تستهلكه الآلة وفقاً للصيغة المثالية (BOM x الكمية المطلوبة).',
        t2: 'الاستهلاك الفعلي',
        d2: 'ما تم إخراجه فعلياً من المخزون لإنجاز هذا الطلب المحدد.',
        obsTitle: 'حقل "الملاحظات"',
        obsDesc: 'غالباً ما تكون هناك فروقات في المصنع بسبب الطوارئ. عندما يغلق المشغل طلباً ويعدل استهلاكاً لجعله فعلياً (مثال: استهلاك +3 كجم من الغراء زيادة)، يجب عليه تبرير الفرق في الملاحظات الحرة.',
        casesTitle: 'حالات الاستخدام الشائعة للملاحظات :',
        c1: 'عيب الجودة : نفايات إسفنج، دفعة قماش تالفة أو ملطخة.',
        c2: 'تعديل الآلة : الإعداد الأول للآلة معيب (خسارة).',
        c3: 'الظروف : تغير الكثافة بسبب الرطوبة.',
      },
      roles: {
        title: 'الأدوار والصلاحيات',
        desc: 'يحمي النظام البيانات بناءً على منصب المستخدم. لكل دور صلاحيات محددة.',
        r1Title: 'المسؤول / المدير',
        r1Desc: 'الوصول الكامل إلى جميع الوحدات والتكوينات ولوحات البيانات التحليلية.',
        r2Title: 'مدير الإنتاج',
        r2Desc: 'إنشاء BOM، توليد أوامر التصنيع، تعديل الحالات قيد التنفيذ والإغلاق. عادة ليس لديه وصول إلى أسعار شراء الموردين الحيوية.',
        r3Title: 'أمين المخزن',
        r3Desc: 'رؤية مقيدة للمقالات والمخزونات واستلام البضائع والتحويلات بين المواقع. يضمن خروج المواد للإنتاج.',
      },
      kpi: {
        title: 'المؤشرات واستخدام الجداول',
        t1: 'الجدول الديناميكي (أوامر التصنيع)',
        p1: 'يتميز قائمة أوامر التصنيع بكونها جدولاً ديناميكياً. انقر على زر "الأعمدة" في أعلى اليمين لإظهار أو إخفاء المعلومات (المشغل، الآلة، التقدم...). يمكنك تكوين العرض لتقليل الكثافة البصرية ثم النقر على "تصدير" لاسترجاع هذه البيانات فقط بصيغة Excel.',
        t2: 'مؤشرات الأداء الرئيسية للمراقبة',
        k1: 'معدل النفايات (Waste Rate) : يُلاحظ بسهولة من خلال الفارق الإيجابي للاستهلاكات. يسمح باستهداف صحة الآلة.',
        k2: 'موثوقية BOM : إذا كانت فروقات الاستهلاك منهجية لوصفة محددة، فإن BOM النظري مهيأ بشكل سيئ ويجب تعديله.',
        k3: 'تقييم تكاليف الإنتاج : عند كل إغلاق لطلب تصنيع، يجب من الناحية المثالية إعادة توزيع المواد المهدورة على التكلفة النهائية للمراتب. (ميزة مالية متقدمة).',
      }
    }
  };

  const navItems = [
    { id: 'intro', label: content[lang].nav.intro, icon: BookOpen },
    { id: 'bom', label: content[lang].nav.bom, icon: ClipboardList },
    { id: 'production', label: content[lang].nav.production, icon: Factory },
    { id: 'variance', label: content[lang].nav.variance, icon: AlertTriangle },
    { id: 'roles', label: content[lang].nav.roles, icon: Users },
    { id: 'kpi', label: content[lang].nav.kpi, icon: BarChart3 },
  ] as const;

  const t = content[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="space-y-8 max-w-6xl mx-auto" dir={dir}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <BookOpen className="text-indigo-600" /> {t.title}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm shrink-0">
          <button 
            onClick={() => setLang('fr')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${lang === 'fr' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            FR
          </button>
          <button 
            onClick={() => setLang('ar')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${lang === 'ar' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            العربية
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Navigation / Sommaire */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm sticky top-4">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${lang === 'ar' ? 'text-right' : 'text-left'} ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-l-4 border-transparent'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                  {isActive && <ChevronRight size={16} className={`${lang === 'ar' ? 'mr-auto rotate-180' : 'ml-auto'}`} />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 min-h-[600px]">
          {activeSection === 'intro' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl"><Target size={32} /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{t.intro.title}</h3>
                  <p className="text-slate-500 text-sm mt-1">{t.intro.desc}</p>
                </div>
              </div>
              
              <p className="text-slate-600 leading-relaxed font-medium">
                {t.intro.p1}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group">
                  <div className={`absolute top-0 ${lang === 'ar' ? 'left-0 p-4 -translate-x-2' : 'right-0 p-4 translate-x-2'} opacity-10 transform -translate-y-2 group-hover:scale-110 transition-transform`}><ClipboardList size={64} /></div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span> {t.intro.step1}</h4>
                  <p className="text-xs text-slate-500 font-medium">{t.intro.step1Desc}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group">
                  <div className={`absolute top-0 ${lang === 'ar' ? 'left-0 p-4 -translate-x-2' : 'right-0 p-4 translate-x-2'} opacity-10 transform -translate-y-2 group-hover:scale-110 transition-transform`}><Factory size={64} /></div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span> {t.intro.step2}</h4>
                  <p className="text-xs text-slate-500 font-medium">{t.intro.step2Desc}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group">
                  <div className={`absolute top-0 ${lang === 'ar' ? 'left-0 p-4 -translate-x-2' : 'right-0 p-4 translate-x-2'} opacity-10 transform -translate-y-2 group-hover:scale-110 transition-transform`}><CheckCircle2 size={64} /></div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span> {t.intro.step3}</h4>
                  <p className="text-xs text-slate-500 font-medium">{t.intro.step3Desc}</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'bom' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4">{t.bom.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {t.bom.p1}
              </p>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mt-4">
                <h5 className="font-bold text-indigo-900 text-sm mb-2">{t.bom.exampleTitle}</h5>
                <ul className="list-disc px-5 text-sm text-indigo-800 space-y-1">
                  <li>{t.bom.example1}</li>
                  <li>{t.bom.example2}</li>
                </ul>
                <p className="text-xs text-indigo-700 mt-3 font-medium">{t.bom.footer}</p>
              </div>
            </motion.div>
          )}

          {activeSection === 'production' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4">{t.production.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {t.production.p1}
              </p>
              <div className="space-y-4 mt-4">
                <div className="flex items-start gap-4">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mt-1 whitespace-nowrap">{t.production.s1Title}</span>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{t.production.s1Sub}</h5>
                    <p className="text-xs text-slate-500">{t.production.s1Desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase mt-1 whitespace-nowrap">{t.production.s2Title}</span>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{t.production.s2Sub}</h5>
                    <p className="text-xs text-slate-500">{t.production.s2Desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase mt-1 whitespace-nowrap">{t.production.s3Title}</span>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{t.production.s3Sub}</h5>
                    <p className="text-xs text-slate-500">{t.production.s3Desc}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'variance' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4">{t.variance.title}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-sm mb-2">{t.variance.t1}</h4>
                  <p className="text-xs text-slate-500">{t.variance.d1}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 text-sm mb-2">{t.variance.t2}</h4>
                  <p className="text-xs text-emerald-700">{t.variance.d2}</p>
                </div>
              </div>

              <h4 className="font-bold text-slate-800 mt-6 mb-3">{t.variance.obsTitle}</h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                {t.variance.obsDesc}
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h5 className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={14} /> {t.variance.casesTitle}</h5>
                <ul className="list-disc px-5 text-sm text-orange-700/80 space-y-1">
                  <li>{t.variance.c1}</li>
                  <li>{t.variance.c2}</li>
                  <li>{t.variance.c3}</li>
                </ul>
              </div>
            </motion.div>
          )}

          {activeSection === 'roles' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4">{t.roles.title}</h3>
              <p className="text-slate-600 text-sm mb-6">
                {t.roles.desc}
              </p>

              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 shrink-0 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">{t.roles.r1Title}</h5>
                    <p className="text-xs text-slate-500">{t.roles.r1Desc}</p>
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <Factory size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">{t.roles.r2Title}</h5>
                    <p className="text-xs text-slate-500">{t.roles.r2Desc}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 shrink-0 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">{t.roles.r3Title}</h5>
                    <p className="text-xs text-slate-500">{t.roles.r3Desc}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'kpi' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4">{t.kpi.title}</h3>
              
              <h4 className="font-bold text-slate-800 mt-2">{t.kpi.t1}</h4>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                {t.kpi.p1}
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h4 className="font-bold text-blue-900 text-sm mb-3">{t.kpi.t2}</h4>
                <ul className="list-disc px-5 text-sm text-blue-800/80 space-y-2">
                  <li>{t.kpi.k1}</li>
                  <li>{t.kpi.k2}</li>
                  <li>{t.kpi.k3}</li>
                </ul>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}

