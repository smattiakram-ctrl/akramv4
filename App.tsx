import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, ShoppingCart, User as UserIcon, RefreshCw, Home, History 
} from 'lucide-react';
import { Category, Product, ViewState, User, SaleRecord } from './types';
import * as db from './db';

// استيراد المكونات (تأكد من وجودها في مجلد components)
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);

  // 1. تهيئة محرك جوجل عند تشغيل التطبيق
  useEffect(() => {
    db.initTokenClient(async (token) => {
      console.log("تم الحصول على توكن الوصول للدرايف");
      await loadCloudData();
    });
    
    // تحميل البيانات المحلية كبداية سريعة
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    const cats = await db.getAll<Category>('categories');
    const pros = await db.getAll<Product>('products');
    setCategories(cats);
    setProducts(pros);
    setTotalEarnings(db.getEarnings());
  };

  const loadCloudData = async () => {
    setIsSyncing(true);
    const cloudData = await db.fetchFromCloud();
    if (cloudData) {
      setCategories(cloudData.categories || []);
      setProducts(cloudData.products || []);
      setSales(cloudData.sales || []);
      setTotalEarnings(cloudData.earnings || 0);
      await db.overwriteLocalData(cloudData);
      console.log("تم تحديث البيانات من السحاب");
    }
    setIsSyncing(false);
  };

  // 2. معالجة تسجيل الدخول
  const handleLogin = (userData: User) => {
    setUser(userData);
    db.saveUser(userData);
    db.requestToken(); // طلب صلاحية الدرايف فور الدخول
  };

  const handleLogout = () => {
    db.logoutUser();
    setUser(null);
    setCategories([]);
    setProducts([]);
    window.location.reload();
  };

  // 3. المزامنة اليدوية
  const handleManualSync = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setIsSyncing(true);
    const dataToSync = {
      categories,
      products,
      sales,
      earnings: totalEarnings,
      version: Date.now()
    };
    await db.syncToCloud(dataToSync);
    setIsSyncing(false);
    alert("✅ تم حفظ نسخة احتياطية على Google Drive");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-right" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight">NABIL <span className="text-blue-600">PRO</span></h1>
        </div>
        
        <button 
          onClick={() => setShowAuthModal(true)}
          className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 p-2 rounded-2xl transition-all border border-gray-100"
        >
          {user ? (
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border-2 border-blue-500" />
          ) : (
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5" />
            </div>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        {/* واجهة التطبيق حسب الـ view */}
        {view === 'HOME' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* هنا تضع كود عرض التصنيفات والمنتجات */}
             <div className="text-center py-20 text-gray-400">
                <p className="font-bold">أهلاً بك في نظام NABIL</p>
                <p className="text-sm">ابدأ بإضافة تصنيفات ومنتجات لإدارة مخزونك</p>
             </div>
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
          onClick={() => setShowSaleDialog(true)}
          className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-300 flex items-center justify-center -translate-y-8 border-4 border-[#f8fafc] active:scale-90 transition"
        >
          <Plus className="w-8 h-8" />
        </button>

        <button onClick={handleManualSync} className={`flex flex-col items-center ${isSyncing ? 'text-orange-500' : 'text-gray-400'}`}>
          <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="text-[10px] font-bold mt-1">مزامنة</span>
        </button>
      </nav>

      {/* Modals */}
      {showAuthModal && (
        <AuthModal 
          user={user} 
          onLogin={handleLogin} 
          onLogout={handleLogout} 
          onSync={handleManualSync} 
          onClose={() => setShowAuthModal(false)} 
          isSyncing={isSyncing}
        />
      )}

      {showSaleDialog && (
        <SaleDialog 
          products={products} 
          onClose={() => setShowSaleDialog(false)} 
          onSuccess={(sale) => {
            // منطق تسجيل البيع
            setShowSaleDialog(false);
          }} 
        />
      )}
    </div>
  );
};

export default App;
