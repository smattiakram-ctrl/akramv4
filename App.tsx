import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Edit, Camera, LayoutGrid, 
  ShoppingCart, Tag, User as UserIcon, RefreshCw, Menu, History, Home, X, Percent, Clock, CloudOff, LogIn, TrendingUp, Package, Layers, ChevronLeft,
  SortAsc
} from 'lucide-react';
import { Category, Product, ViewState, User, SaleRecord } from './types';
import { supabase } from './supabaseClient'; // الربط مع سوبابيس
import CategoryForm from './components/CategoryForm';
import ProductForm from './components/ProductForm';
import BarcodeScanner from './components/BarcodeScanner';
import SaleDialog from './components/SaleDialog';
import AuthModal from './components/AuthModal';

const App: React.FC = () => {
  // الحفاظ على جميع الحالات (States) الأصلية
  const [user, setUser] = useState<User | null>(null); 
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  
  const [view, setView] = useState<ViewState>('HOME');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [isLoading, setIsLoading] = useState(true);

  // تحميل البيانات من Supabase
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: cats } = await supabase.from('categories').select('*');
      const { data: prods } = await supabase.from('products').select('*');
      const { data: salesLog } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });

      if (cats) setCategories(cats);
      if (prods) setProducts(prods);
      if (salesLog) {
        setSales(salesLog);
        const total = salesLog.reduce((sum, s) => sum + (Number(s.soldAtPrice) * s.quantity), 0);
        setTotalEarnings(total);
      }
    } catch (error) {
      console.error("خطأ في جلب البيانات سحابياً:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await loadData();
    setIsSyncing(false);
    alert('تم التحديث من السحاب بنجاح ✅');
  };

  const handleLogout = async () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      setUser(null);
      window.location.reload();
    }
  };

  const handleLogin = async (newUser: User) => {
    setUser(newUser);
    setShowAuthModal(false);
  };

  const handleAddCategory = async (cat: Category) => {
    const { error } = await supabase.from('categories').upsert(cat);
    if (!error) {
      setCategories(prev => [...prev.filter(c => c.id !== cat.id), cat]);
      setShowCategoryForm(false);
    }
  };

  const handleAddProduct = async (prod: Product) => {
    const { error } = await supabase.from('products').upsert(prod);
    if (!error) {
      setProducts(prev => [...prev.filter(p => p.id !== prod.id), prod]);
      setShowProductForm(false);
      setEditingProduct(null);
    }
  };

  const handleSale = async (productId: string, qty: number, price: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const sale: SaleRecord = {
      id: Date.now().toString(),
      productId,
      productName: product.name,
      productImage: product.image,
      quantity: qty,
      soldAtPrice: price,
      timestamp: Date.now()
    };

    // 1. تسجيل البيع سحابياً
    await supabase.from('sales').insert(sale);
    
    // 2. تحديث الكمية سحابياً
    const updatedQty = product.quantity - qty;
    if (updatedQty <= 0) {
      await supabase.from('products').delete().eq('id', productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } else {
      await supabase.from('products').update({ quantity: updatedQty }).eq('id', productId);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: updatedQty } : p));
    }

    setSales(prev => [sale, ...prev]);
    setTotalEarnings(prev => prev + (price * qty));
    setShowSaleDialog(false);
  };

  const handleDeleteProduct = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('حذف السلعة نهائياً من السحاب؟')) {
      await supabase.from('products').delete().eq('id', id);
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('حذف هذا الصنف وجميع سلعه من السحاب؟')) {
      await supabase.from('products').delete().eq('categoryId', id);
      await supabase.from('categories').delete().eq('id', id);
      setCategories(prev => prev.filter(c => c.id !== id));
      setProducts(prev => prev.filter(p => p.categoryId !== id));
      if (selectedCategoryId === id) setView('HOME');
    }
  };

  // منطق الفرز والبحث الأصلي (كما هو)
  const filteredProducts = useMemo(() => {
    let list = products;
    if (view === 'CATEGORY_DETAIL' && selectedCategoryId) {
      list = list.filter(p => p.categoryId === selectedCategoryId);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
    }
    return list.sort((a, b) => sortOrder === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }, [products, view, selectedCategoryId, searchQuery, sortOrder]);

  const inventoryValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (parseFloat(p.price.split('/')[0]) * p.quantity), 0);
  }, [products]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><RefreshCw className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-['Cairo']">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* Sidebar - كما هو في الكود الأصلي */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white z-[70] shadow-2xl transition-all duration-500 transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl font-black text-blue-900 leading-none">القائمة</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-gray-50 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <nav className="flex-1 space-y-4">
            <button onClick={() => { setView('HOME'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-5 rounded-3xl font-bold ${view === 'HOME' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}><Home className="w-6 h-6" /> الرئيسية</button>
            <button onClick={() => { setView('SALES_LOG'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-5 rounded-3xl font-bold ${view === 'SALES_LOG' ? 'bg-orange-50 text-orange-700' : 'text-gray-500'}`}><History className="w-6 h-6" /> سجل المبيعات</button>
          </nav>
          <div className="pt-8 border-t space-y-4">
             <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">N</div>
                  <span className="font-bold truncate text-sm">Nabil Cloud</span>
                </div>
             </div>
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 p-5 text-red-500 font-black bg-red-50 rounded-3xl hover:bg-red-100 transition">
              <CloudOff className="w-5 h-5" /> تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b gap-4">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-900 bg-slate-50 rounded-xl"><Menu className="w-6 h-6" /></button>
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="ابحث بالاسم أو الباركود..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value && view === 'HOME') setView('SEARCH');
              if (!e.target.value && view === 'SEARCH') setView('HOME');
            }}
            className="w-full pr-10 pl-4 py-3 bg-gray-100/50 border-0 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg">N</div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {(view === 'HOME' || view === 'SEARCH') && (
          <div className="space-y-10">
             {view === 'HOME' && !searchQuery && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                     <TrendingUp className="absolute top-[-20px] left-[-20px] w-40 h-40 opacity-10" />
                     <p className="text-blue-100 text-[10px] font-black uppercase mb-1">إجمالي الفائدة (سحابي)</p>
                     <div className="text-3xl font-black">{totalEarnings.toLocaleString('fr-DZ')} <span className="text-sm">د.ج</span></div>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] border shadow-xl flex flex-col justify-center">
                     <p className="text-slate-400 text-[10px] font-black uppercase mb-1">قيمة المخزن</p>
                     <p className="text-2xl font-black text-slate-900">{inventoryValue.toLocaleString('fr-DZ')} <span className="text-xs">د.ج</span></p>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] border shadow-xl flex flex-col justify-center">
                     <p className="text-slate-400 text-[10px] font-black uppercase mb-1">السلع المسجلة</p>
                     <p className="text-2xl font-black text-slate-900">{products.length} <span className="text-xs">سلعة</span></p>
                  </div>
               </div>
             )}

             {view === 'HOME' && !searchQuery && (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button onClick={() => setShowProductForm(true)} className="p-6 bg-green-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition"><Plus className="w-8 h-8" /> إضافة سلعة</button>
                  <button onClick={() => setIsScanning(true)} className="p-6 bg-blue-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition"><Camera className="w-8 h-8" /> مسح باركود</button>
                  <button onClick={() => setShowSaleDialog(true)} className="p-6 bg-orange-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition"><ShoppingCart className="w-8 h-8" /> عملية بيع</button>
                  <button onClick={() => setShowCategoryForm(true)} className="p-6 bg-slate-800 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition"><LayoutGrid className="w-8 h-8" /> صنف جديد</button>
               </div>
             )}

             <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900">{searchQuery ? 'نتائج البحث السحابي' : 'أصناف المخزن'}</h3>
                {searchQuery ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all">
                        <div className="aspect-square relative overflow-hidden bg-slate-50">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute bottom-3 right-3 bg-blue-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black">{p.quantity} قطعة</div>
                        </div>
                        <div className="p-6 flex-1 text-center">
                          <h4 className="font-black text-slate-900 mb-2 truncate text-sm">{p.name}</h4>
                          <div className="text-xl font-black text-blue-700 mb-6">{p.price.split('/')[0]} <span className="text-[10px]">د.ج</span></div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingProduct(p); setShowProductForm(true); }} className="p-3 bg-blue-50 text-blue-500 rounded-2xl flex-1 flex justify-center hover:bg-blue-500 transition-colors"><Edit className="w-5 h-5" /></button>
                            <button onClick={(e) => handleDeleteProduct(e, p.id)} className="p-3 bg-red-50 text-red-500 rounded-2xl flex-1 flex justify-center hover:bg-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {categories.map(c => (
                      <div key={c.id} className="group bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer" onClick={() => { setSelectedCategoryId(c.id); setView('CATEGORY_DETAIL'); }}>
                        <div className="aspect-square relative overflow-hidden">
                          <button onClick={(e) => handleDeleteCategory(e, c.id)} className="absolute top-3 left-3 z-10 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                          <img src={c.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="p-5 text-center">
                          <p className="font-black text-slate-800 text-sm truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase italic">{products.filter(p => p.categoryId === c.id).length} سلع سحابية</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}

        {view === 'SALES_LOG' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setView('HOME')} className="p-3 bg-white rounded-2xl shadow-sm"><ChevronLeft className="w-6 h-6 rotate-180" /></button>
              <h2 className="text-2xl font-black text-slate-900 leading-none italic">سجل المبيعات السحابي</h2>
            </div>
            {sales.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center justify-between hover:border-orange-200 transition-colors">
                <div className="flex items-center gap-6">
                  <img src={s.productImage} className="w-16 h-16 rounded-2xl object-cover border" />
                  <div>
                    <h4 className="font-black text-slate-900">{s.productName}</h4>
                    <span className="text-[10px] text-slate-400 font-black"><Clock className="w-3 h-3 inline" /> {new Date(s.timestamp).toLocaleString('ar-DZ')}</span>
                  </div>
                </div>
                <div className="text-left font-black text-xl text-green-600">+{s.soldAtPrice.toLocaleString('fr-DZ')} <span className="text-sm">د.ج</span></div>
              </div>
            ))}
          </div>
        )}

        {view === 'CATEGORY_DETAIL' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => { setView('HOME'); setSelectedCategoryId(null); }} className="p-3 bg-white rounded-2xl shadow-sm"><ChevronLeft className="w-6 h-6 rotate-180" /></button>
                <h2 className="text-2xl font-black text-slate-900 leading-none">{categories.find(c => c.id === selectedCategoryId)?.name}</h2>
              </div>
              <button onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')} className="p-4 bg-white rounded-2xl border text-slate-600"><SortAsc className={`w-6 h-6 ${sortOrder === 'DESC' ? 'rotate-180' : ''}`} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all">
                  <div className="aspect-square relative overflow-hidden bg-slate-50">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute bottom-3 right-3 bg-blue-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black shadow-lg shadow-blue-900/20">{p.quantity} قطعة</div>
                  </div>
                  <div className="p-6 flex-1 text-center">
                    <h4 className="font-black text-slate-900 mb-2 truncate text-sm">{p.name}</h4>
                    <div className="text-xl font-black text-blue-700 mb-6">{p.price.split('/')[0]} <span className="text-[10px]">د.ج</span></div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProduct(p); setShowProductForm(true); }} className="p-3 bg-blue-50 text-blue-500 rounded-2xl flex-1 flex justify-center hover:bg-blue-500 hover:text-white transition-all"><Edit className="w-5 h-5" /></button>
                      <button onClick={(e) => handleDeleteProduct(e, p.id)} className="p-3 bg-red-50 text-red-500 rounded-2xl flex-1 flex justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* القوائم والنوافذ المنبثقة */}
      {showCategoryForm && <CategoryForm onSave={handleAddCategory} onClose={() => setShowCategoryForm(false)} />}
      {showProductForm && <ProductForm categories={categories} onSave={handleAddProduct} onClose={() => {setShowProductForm(false); setEditingProduct(null);}} initialData={editingProduct || undefined} defaultCategoryId={selectedCategoryId || undefined} />}
      {isScanning && <BarcodeScanner onScan={(code) => { setView('SEARCH'); setSearchQuery(code); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
      {showSaleDialog && <SaleDialog products={products} onSale={handleSale} onClose={() => setShowSaleDialog(false)} />}
      {showAuthModal && <AuthModal user={user} onLogin={handleLogin} onLogout={handleLogout} onSync={handleManualSync} onClose={() => setShowAuthModal(false)} isSyncing={isSyncing} categories={categories} products={products} onImport={handleManualSync} />}
      
      {/* Mobile Footer */}
      <div className="fixed bottom-0 inset-x-0 h-20 bg-white/95 backdrop-blur-md border-t flex items-center justify-around md:hidden z-50 px-4">
         <button onClick={() => {setView('HOME'); setSelectedCategoryId(null); setSearchQuery('');}} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-colors ${view === 'HOME' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Home className="w-6 h-6" /> <span className="text-[8px] font-black uppercase">الرئيسية</span>
         </button>
         <button onClick={() => setShowSaleDialog(true)} className="w-14 h-14 bg-orange-500 text-white rounded-3xl shadow-xl shadow-orange-200 flex items-center justify-center -translate-y-6 border-4 border-[#f8fafc] active:scale-90 transition transform">
            <ShoppingCart className="w-7 h-7" />
         </button>
         <button onClick={() => setView('SALES_LOG')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-colors ${view === 'SALES_LOG' ? 'text-orange-600' : 'text-gray-400'}`}>
            <History className="w-6 h-6" /> <span className="text-[8px] font-black uppercase">السجل</span>
         </button>
      </div>
    </div>
  );
};

export default App;
