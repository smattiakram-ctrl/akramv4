import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Edit, Camera, LayoutGrid, 
  ShoppingCart, Tag, User as UserIcon, RefreshCw, History, Home, X, TrendingUp, Package, Layers
} from 'lucide-react';
import { Category, Product, ViewState, User, SaleRecord } from './types';
import * as db from './db';

// استيراد المكونات
import CategoryForm from './components/CategoryForm';
import ProductForm from './components/ProductForm';
import BarcodeScanner from './components/BarcodeScanner';
import SaleDialog from './components/SaleDialog';
import AuthModal from './components/AuthModal';

const App: React.FC = () => {
  // الحالات الأساسية (States)
  const [user, setUser] = useState<User | null>(db.getUser());
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  
  const [view, setView] = useState<ViewState>('HOME');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);

  // 1. تهيئة المزامنة السحابية عند بدء التطبيق
  useEffect(() => {
    // إعداد محرك التوكن من ملف db.ts
    db.initTokenClient(async (token) => {
      console.log("تم تفعيل صلاحية الوصول للدرايف");
      handleManualSync(); // محاولة جلب البيانات فور الحصول على التوكن
    });
    
    // تحميل البيانات المحلية فوراً ليعمل التطبيق بدون انتظار الإنترنت
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const cats = await db.getAll<Category>('categories');
    const pros = await db.getAll<Product>('products');
    const savedSales = await db.getAll<SaleRecord>('sales');
    setCategories(cats);
    setProducts(pros);
    setSales(savedSales);
    setTotalEarnings(db.getEarnings());
  };

  // 2. وظائف المزامنة
  const handleManualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // أولاً: جلب أحدث البيانات من السحاب
      const cloudData = await db.fetchFromCloud();
      if (cloudData) {
        setCategories(cloudData.categories || []);
        setProducts(cloudData.products || []);
        setSales(cloudData.sales || []);
        setTotalEarnings(cloudData.earnings || 0);
        await db.overwriteLocalData(cloudData);
      }

      // ثانياً: رفع البيانات الحالية للسحاب (لضمان التطابق)
      const dataToUpload = {
        categories,
        products,
        sales,
        earnings: totalEarnings,
        lastSync: new Date().toISOString()
      };
      await db.syncToCloud(dataToUpload);
    } catch (error) {
      console.error("خطأ أثناء المزامنة:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. معالجة تسجيل الدخول
  const handleLogin = (userData: User) => {
    setUser(userData);
    db.saveUser(userData);
    db.requestToken(); // طلب الصلاحية فوراً
  };

  const handleLogout = () => {
    db.logoutUser();
    setUser(null);
    window.location.reload();
  };

  // 4. تصفية المنتجات (Search & Filter)
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
      const matchesCategory = !selectedCategoryId || p.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategoryId]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-right" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight">NABIL <span className="text-blue-600">PRO</span></h1>
        </div>
        
        <div className="flex items-center gap-2">
           {isSyncing && <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />}
           <button 
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100"
           >
            {user ? (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border-2 border-blue-500" />
            ) : (
              <UserIcon className="w-8 h-8 p-1.5 bg-blue-100 text-blue-600 rounded-full" />
            )}
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        {view === 'HOME' ? (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="بحث عن منتج أو باركود..." 
                className="w-full pr-12 pl-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Categories Horizontal Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => setSelectedCategoryId(null)}
                className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${!selectedCategoryId ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500'}`}
              >
                الكل
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500'}`}
                >
                  {cat.name}
                </button>
              ))}
              <button onClick={() => setShowCategoryForm(true)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Plus className="w-6 h-6" />
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white p-4 rounded-3xl shadow-sm border border-transparent hover:border-blue-200 transition-all">
                  <div className="aspect-square bg-gray-50 rounded-2xl mb-3 flex items-center justify-center text-3xl">
                    {product.image || '📦'}
                  </div>
                  <h3 className="font-black text-gray-800 mb-1">{product.name}</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-600 font-black">{product.price} د.ج</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-lg text-gray-500">مخزون: {product.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-gray-500 font-bold">
             سجل المبيعات (قيد التطوير)
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 h-20 bg-white/95 backdrop-blur-md border-t flex items-center justify-around px-4 z-50">
        <button onClick={() => setView('HOME')} className={`flex flex-col items-center ${view === 'HOME' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold mt-1">الرئيسية</span>
        </button>

        <button 
          onClick={() => setShowProductForm(true)}
          className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center -translate-y-8 border-4 border-[#f8fafc] active:scale-90 transition"
        >
          <Plus className="w-8 h-8" />
        </button>

        <button onClick={() => setView('SALES_LOG')} className={`flex flex-col items-center ${view === 'SALES_LOG' ? 'text-blue-600' : 'text-gray-400'}`}>
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold mt-1">السجل</span>
        </button>
      </nav>

      {/* Modals & Forms */}
      {showAuthModal && (
        <AuthModal 
          user={user} onLogin={handleLogin} onLogout={handleLogout} 
          onSync={handleManualSync} onClose={() => setShowAuthModal(false)} 
          isSyncing={isSyncing} categories={categories} products={products} onImport={handleManualSync}
        />
      )}
      
      {showCategoryForm && (
        <CategoryForm 
          onClose={() => setShowCategoryForm(false)} 
          onSave={async (cat) => {
            const newCats = [...categories, cat];
            setCategories(newCats);
            await db.saveItem('categories', cat);
            setShowCategoryForm(false);
          }}
        />
      )}

      {showProductForm && (
        <ProductForm 
          categories={categories}
          onClose={() => setShowProductForm(false)}
          onSave={async (pro) => {
            const newPros = [...products, pro];
            setProducts(newPros);
            await db.saveItem('products', pro);
            setShowProductForm(false);
          }}
        />
      )}
    </div>
  );
};

export default App;
