import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Edit, Camera, LayoutGrid, 
  ShoppingCart, Tag, User as UserIcon, RefreshCw, Menu, History, Home, X, Percent, Clock, CloudOff, LogIn, TrendingUp, Package, Layers, ChevronLeft,
  SortAsc
} from 'lucide-react';
import { Category, Product, ViewState, User, SaleRecord } from './types';
import { supabase } from './supabaseClient';
import CategoryForm from './components/CategoryForm';
import ProductForm from './components/ProductForm';
import BarcodeScanner from './components/BarcodeScanner';
import SaleDialog from './components/SaleDialog';
import AuthModal from './components/AuthModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(db.getUser());
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

  const loadData = useCallback(async () => {
    try {
      const [cats, prods, sLog] = await Promise.all([
        db.getAll<Category>('categories'),
        db.getAll<Product>('products'),
        db.getAll<SaleRecord>('sales')
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
      setSales((sLog || []).sort((a, b) => b.timestamp - a.timestamp));
      setTotalEarnings(db.getEarnings());
    } catch (e) {
      console.error("خطأ في تحميل البيانات:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // دالة المزامنة المطورة لطلب التصريح عند الحاجة
  const handleManualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // إرسال البيانات
      const dataToSync = { categories, products, sales, earnings: totalEarnings };
      await db.syncToCloud(dataToSync);
      
      // جلب التحديثات
      const cloudData = await db.fetchFromCloud();
      if (cloudData) {
        await db.overwriteLocalData(cloudData);
        await loadData();
      }
    } catch (e: any) {
      console.error("Sync Error:", e);
      // إذا كان الخطأ بسبب صلاحيات قوقل درايف، نطلبها من المستخدم
      if (e.status === 401 || e.message?.includes('auth')) {
        alert("يرجى إعادة تسجيل الدخول لتفعيل صلاحيات الوصول لملفات Drive.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async (newUser: User) => {
    db.saveUser(newUser);
    setUser(newUser);
    setShowAuthModal(false);
    // محاولة جلب البيانات فور تسجيل الدخول
    setTimeout(async () => {
        const cloudData = await db.fetchFromCloud();
        if (cloudData) {
          await db.overwriteLocalData(cloudData);
          await loadData();
        }
    }, 1000);
  };

  const handleLogout = async () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      await db.logoutUser();
      setUser(null);
      window.location.reload();
    }
  };

  const handleAddCategory = async (cat: Category) => {
    await db.saveItem('categories', cat);
    setCategories(prev => [...prev.filter(c => c.id !== cat.id), cat]);
    setShowCategoryForm(false);
    handleManualSync(); 
  };

  const handleAddProduct = async (prod: Product) => {
    await db.saveItem('products', prod);
    setProducts(prev => [...prev.filter(p => p.id !== prod.id), prod]);
    setShowProductForm(false);
    handleManualSync();
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
    await db.saveItem('sales', sale);
    const newEarnings = totalEarnings + (price * qty);
    db.saveEarnings(newEarnings);
    setTotalEarnings(newEarnings);
    setSales(prev => [sale, ...prev]);

    const updatedQty = product.quantity - qty;
    if (updatedQty <= 0) {
      await db.deleteItem('products', productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } else {
      const updatedProd = { ...product, quantity: updatedQty };
      await db.saveItem('products', updatedProd);
      setProducts(prev => prev.map(p => p.id === productId ? updatedProd : p));
    }
    setShowSaleDialog(false);
    handleManualSync();
  };

  const handleDeleteProduct = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('حذف السلعة؟')) {
      await db.deleteItem('products', id);
      setProducts(prev => prev.filter(p => p.id !== id));
      handleManualSync();
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('حذف هذا الصنف وجميع سلعه؟')) {
      const related = products.filter(p => p.categoryId === id);
      for (const p of related) await db.deleteItem('products', p.id);
      await db.deleteItem('categories', id);
      setCategories(prev => prev.filter(c => c.id !== id));
      setProducts(prev => prev.filter(p => p.categoryId !== id));
      if (selectedCategoryId === id) setView('HOME');
      handleManualSync();
    }
  };

  const filteredProducts = useMemo(() => {
    let list = products;
    if (view === 'CATEGORY_DETAIL' && selectedCategoryId) {
      list = list.filter(p => p.categoryId === selectedCategoryId);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
    }
    return [...list].sort((a, b) => sortOrder === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }, [products, view, selectedCategoryId, searchQuery, sortOrder]);

  const inventoryValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (parseFloat(p.price.split('/')[0]) * p.quantity), 0);
  }, [products]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><RefreshCw className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden font-['Cairo']">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[100px] rounded-full"></div>
        <div className="relative z-10 max-w-sm">
          <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[4rem] border border-white/10 mb-10 shadow-2xl">
            <Package className="w-16 h-16 text-white mx-auto mb-6" />
            <h1 className="text-4xl font-black text-white mb-3 tracking-tighter italic uppercase">NABIL Cloud</h1>
            <p className="text-gray-400 font-medium">مخزنك سحابي بالكامل مع Google Drive. آمن، سريع، ومتاح من أي جهاز.</p>
          </div>
          <button onClick={() => setShowAuthModal(true)} className="w-full bg-white text-blue-900 py-6 rounded-3xl font-black text-xl shadow-2xl active:scale-95 transition-all">
            تسجيل الدخول للبدء
          </button>
        </div>
        {showAuthModal && <AuthModal user={null} onLogin={handleLogin} onLogout={() => {}} onSync={() => {}} onClose={() => setShowAuthModal(false)} isSyncing={false} categories={[]} products={[]} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-['Cairo']">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setIsSidebarOpen(false)}></div>}
      
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
             <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white flex items-center gap-3">
                <img src={user.picture} className="w-10 h-10 rounded-full border-2 border-white/20" alt="" />
                <span className="font-bold truncate text-sm">{user.name}</span>
             </div>
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 p-5 text-red-500 font-black bg-red-50 rounded-3xl hover:bg-red-100 transition">
              <CloudOff className="w-5 h-5" /> تسجيل الخروج
             </button>
          </div>
        </div>
      </div>

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
        <button onClick={() => setShowAuthModal(true)} className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-blue-50">
          <img src={user.picture} className="w-full h-full object-cover" alt="" />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {(view === 'HOME' || view === 'SEARCH') && (
          <div className="space-y-10 animate-in fade-in duration-500">
             {view === 'HOME' && !searchQuery && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                     <TrendingUp className="absolute top-[-20px] left-[-20px] w-40 h-40 opacity-10" />
                     <p className="text-blue-100 text-[10px] font-black uppercase mb-1">إجمالي الفائدة المحققة</p>
                     <div className="text-3xl font-black">{totalEarnings.toLocaleString('fr-DZ')} <span className="text-sm">د.ج</span></div>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] border shadow-xl flex flex-col justify-center">
                     <p className="text-slate-400 text-[10px] font-black uppercase mb-1">قيمة المخزن الإجمالية</p>
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
                  <button onClick={() => setShowProductForm(true)} className="p-6 bg-green-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-all"><Plus className="w-8 h-8" /> إضافة سلعة</button>
                  <button onClick={() => setIsScanning(true)} className="p-6 bg-blue-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-all"><Camera className="w-8 h-8" /> مسح باركود</button>
                  <button onClick={() => setShowSaleDialog(true)} className="p-6 bg-orange-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-all"><ShoppingCart className="w-8 h-8" /> عملية بيع</button>
                  <button onClick={() => setShowCategoryForm(true)} className="p-6 bg-slate-800 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-all"><LayoutGrid className="w-8 h-8" /> صنف جديد</button>
               </div>
             )}

             <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">{searchQuery ? 'نتائج البحث' : 'أصناف المخزن'}</h3>
                    {isSyncing && <div className="text-blue-500 text-xs font-bold animate-pulse">جاري المزامنة...</div>}
                </div>
                {searchQuery ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all">
                        <div className="aspect-square relative overflow-hidden bg-slate-50">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                          <div className="absolute bottom-3 right-3 bg-blue-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black">{p.quantity} قطعة</div>
                        </div>
                        <div className="p-6 flex-1">
                          <h4 className="font-black text-slate-900 mb-2 truncate text-sm">{p.name}</h4>
                          <div className="text-xl font-black text-blue-700 mb-6">{p.price.split('/')[0]} <span className="text-[10px]">د.ج</span></div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingProduct(p); setShowProductForm(true); }} className="p-3 bg-blue-50 text-blue-500 rounded-2xl flex-1 flex justify-center"><Edit className="w-5 h-5" /></button>
                            <button onClick={(e) => handleDeleteProduct(e, p.id)} className="p-3 bg-red-50 text-red-500 rounded-2xl flex-1 flex justify-center"><Trash2 className="w-5 h-5" /></button>
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
                          <button onClick={(e) => handleDeleteCategory(e, c.id)} className="absolute top-3 left-3 z-10 p-2 bg-red-50/80 backdrop-blur-sm text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                          <img src={c.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                        </div>
                        <div className="p-5 text-center">
                          <p className="font-black text-slate-800 text-sm truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-400 font-black mt-1 uppercase">{products.filter(p => p.categoryId === c.id).length} سلع مسجلة</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}

        {view === 'SALES_LOG' && (
          <div className="space-y-6 animate-in slide-in-from-left duration-500">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setView('HOME')} className="p-3 bg-white rounded-2xl shadow-sm"><ChevronLeft className="w-6 h-6 rotate-180" /></button>
              <h2 className="text-2xl font-black text-slate-900">سجل المبيعات</h2>
            </div>
            {sales.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center justify-between hover:border-orange-200 transition-colors">
                <div className="flex items-center gap-6">
                  <img src={s.productImage} className="w-16 h-16 rounded-2xl object-cover border" alt="" />
                  <div>
                    <h4 className="font-black text-slate-900">{s.productName}</h4>
                    <span className="text-[10px] text-slate-400 font-black"><Clock className="w-3 h-3 inline" /> {new Date(s.timestamp).toLocaleTimeString('ar-DZ')}</span>
                  </div>
                </div>
                <div className="text-left font-black text-xl text-green-600">+{s.soldAtPrice.toLocaleString('fr-DZ')} <span className="text-[10px]">د.ج</span></div>
              </div>
            ))}
          </div>
        )}

        {view === 'CATEGORY_DETAIL' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => { setView('HOME'); setSelectedCategoryId(null); }} className="p-3 bg-white rounded-2xl shadow-sm"><ChevronLeft className="w-6 h-6 rotate-180" /></button>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{categories.find(c => c.id === selectedCategoryId)?.name}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowProductForm(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition">
                  <Plus className="w-5 h-5" /> إضافة سلعة هنا
                </button>
                <button onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')} className="p-4 bg-white rounded-2xl border text-slate-600 active:scale-90 transition-transform"><SortAsc className={`w-6 h-6 ${sortOrder === 'DESC' ? 'rotate-180' : ''}`} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all">
                  <div className="aspect-square relative overflow-hidden bg-slate-50">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                    <div className="absolute bottom-3 right-3 bg-blue-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black shadow-lg shadow-blue-900/20">{p.quantity} قطعة</div>
                  </div>
                  <div className="p-6 flex-1">
                    <h4 className="font-black text-slate-900 mb-2 truncate text-sm">{p.name}</h4>
                    <div className="text-xl font-black text-blue-700 mb-6">{p.price.split('/')[0]} <span className="text-[10px] font-bold opacity-50 uppercase">د.ج</span></div>
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

      {showCategoryForm && <CategoryForm onSave={handleAddCategory} onClose={() => {setShowCategoryForm(false); setEditingCategory(null);}} initialData={editingCategory || undefined} />}
      {showProductForm && <ProductForm categories={categories} onSave={handleAddProduct} onClose={() => {setShowProductForm(false); setEditingProduct(null);}} initialData={editingProduct || undefined} defaultCategoryId={selectedCategoryId || undefined} />}
      {isScanning && <BarcodeScanner onScan={(code) => { setView('SEARCH'); setSearchQuery(code); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
      {showSaleDialog && <SaleDialog products={products} onSale={handleSale} onClose={() => setShowSaleDialog(false)} />}
      {showAuthModal && <AuthModal user={user} onLogin={handleLogin} onLogout={handleLogout} onSync={handleManualSync} onClose={() => setShowAuthModal(false)} isSyncing={isSyncing} categories={categories} products={products} />}
      
      <div className="fixed bottom-0 inset-x-0 h-20 bg-white/95 backdrop-blur-md border-t flex items-center justify-around md:hidden z-50 px-4">
         <button onClick={() => {setView('HOME'); setSelectedCategoryId(null); setSearchQuery('');}} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-colors ${view === 'HOME' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Home className="w-6 h-6" /> <span className="text-[8px] font-black uppercase">الرئيسية</span>
         </button>
         <button onClick={() => setShowSaleDialog(true)} className="w-14 h-14 bg-orange-500 text-white rounded-3xl shadow-xl shadow-orange-200 flex items-center justify-center -translate-y-6 border-4 border-[#f8fafc] active:scale-90 transition transform">
            <ShoppingCart className="w-7 h-7" />
         </button>
         <button onClick={() => setView('SALES_LOG')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-colors ${view === 'SALES_LOG' ? 'text-orange-600' : 'text-gray-400'}`}>
            <History className="w-6 h-6" /> <span className="text-[8px] font-black uppercase tracking-tighter">سجل المبيعات</span>
         </button>
      </div>
    </div>
  );
};

export default App;
