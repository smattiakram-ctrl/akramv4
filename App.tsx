import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Edit, Camera, LayoutGrid, 
  ShoppingCart, Tag, User as UserIcon, RefreshCw, Menu, History, Home, X, Percent, Clock, CloudOff, LogIn, TrendingUp, Package, Layers, ChevronLeft,
  SortAsc
} from 'lucide-react';
import { Category, Product, ViewState, User, SaleRecord } from './types';
import { supabase } from './supabaseClient'; // الربط الجديد
import CategoryForm from './components/CategoryForm';
import ProductForm from './components/ProductForm';
import BarcodeScanner from './components/BarcodeScanner';
import SaleDialog from './components/SaleDialog';
// تم إخفاء AuthModal لأنه لم يعد متوافقاً مع نظام Supabase المباشر حالياً

const App: React.FC = () => {
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [isLoading, setIsLoading] = useState(true);

  // تحميل البيانات من Supabase
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: cats } = await supabase.from('categories').select('*');
      const { data: prods } = await supabase.from('products').select('*');
      const { data: salesLog } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });

      if (cats) setCategories(cats);
      if (prods) setProducts(prods);
      if (salesLog) {
        setSales(salesLog);
        const total = salesLog.reduce((sum, s) => sum + (s.sold_at_price * s.quantity), 0);
        setTotalEarnings(total);
      }
    } catch (error) {
      console.error("Error loading cloud data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleAddCategory = async (category: Category) => {
    const { error } = await supabase.from('categories').upsert(category);
    if (!error) {
      setCategories(prev => [...prev.filter(c => c.id !== category.id), category]);
      setShowCategoryForm(false);
    }
  };

  const handleAddProduct = async (product: Product) => {
    const { error } = await supabase.from('products').upsert(product);
    if (!error) {
      setProducts(prev => [...prev.filter(p => p.id !== product.id), product]);
      setShowProductForm(false);
      setEditingProduct(null);
    }
  };

  const handleDeleteProduct = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من حذف هذه السلعة نهائياً من السحاب؟')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('حذف الصنف سيؤدي لحذف جميع السلع التابعة له سحابياً. هل أنت متأكد؟')) {
      await supabase.from('categories').delete().eq('id', id);
      setCategories(prev => prev.filter(c => c.id !== id));
      setProducts(prev => prev.filter(p => p.categoryId !== id));
      if (selectedCategoryId === id) setView('HOME');
    }
  };

  const handleSale = async (productId: string, quantity: number, price: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const sale: SaleRecord = {
      id: Date.now().toString(),
      productId,
      productName: product.name,
      productImage: product.image,
      quantity,
      soldAtPrice: price,
      timestamp: Date.now()
    };

    const newQuantity = product.quantity - quantity;

    // تحديث السحاب
    await supabase.from('sales').insert(sale);
    if (newQuantity <= 0) {
      await supabase.from('products').delete().eq('id', productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } else {
      await supabase.from('products').update({ quantity: newQuantity }).eq('id', productId);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: newQuantity } : p));
    }

    setSales(prev => [sale, ...prev]);
    setTotalEarnings(prev => prev + (price * quantity));
    setShowSaleDialog(false);
  };

  const filteredProducts = useMemo(() => {
    let result = products;
    if (view === 'CATEGORY_DETAIL' && selectedCategoryId) {
      result = result.filter(p => p.categoryId === selectedCategoryId);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.includes(query))
      );
    }
    return [...result].sort((a, b) => {
      return sortOrder === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }, [products, view, selectedCategoryId, searchQuery, sortOrder]);

  const inventoryValue = useMemo(() => {
    return products.reduce((total, p) => {
      const price = parseFloat(p.price.split('/')[0]);
      return total + (price * p.quantity);
    }, 0);
  }, [products]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="font-black text-blue-900 animate-pulse">جاري الاتصال بالسحاب...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 font-['Cairo'] selection:bg-blue-100">
      {/* Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white z-[70] shadow-2xl transition-all duration-500 transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-2xl font-black text-blue-900 leading-none">القائمة</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Nabil Cloud POS</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <nav className="flex-1 space-y-4">
            <button 
              onClick={() => { setView('HOME'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-5 rounded-3xl font-bold transition-all ${view === 'HOME' ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Home className="w-6 h-6" /> الرئيسية
            </button>
            <button 
              onClick={() => { setView('SALES_LOG'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-5 rounded-3xl font-bold transition-all ${view === 'SALES_LOG' ? 'bg-orange-50 text-orange-700 shadow-sm shadow-orange-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <History className="w-6 h-6" /> سجل المبيعات
            </button>
          </nav>

          <div className="pt-8 border-t border-gray-100">
             <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white flex items-center gap-4 shadow-xl shadow-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-xl shadow-lg">N</div>
                <div className="flex-1 min-w-0">
                   <p className="font-black truncate text-sm">Nabil Cloud</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">نسخة المزامنة السحابية</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-gray-100 gap-4">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-slate-900 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all active:scale-90"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex-1 max-w-xl relative group">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="ابحث سحابياً بالاسم أو الباركود..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value && view === 'HOME') setView('SEARCH');
              if (!e.target.value && view === 'SEARCH') setView('HOME');
            }}
            className="w-full pr-10 pl-4 py-3 bg-gray-100/50 border-0 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">N</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {(view === 'HOME' || view === 'SEARCH') && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {/* Stats */}
            {view === 'HOME' && !searchQuery && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                  <TrendingUp className="absolute top-[-20px] left-[-20px] w-40 h-40 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                  <p className="text-blue-100 text-[10px] font-black uppercase mb-1 tracking-widest italic">إجمالي الفائدة (سحابي)</p>
                  <div className="text-3xl font-black flex items-baseline gap-2">
                    {totalEarnings.toLocaleString('fr-DZ')} <span className="text-sm opacity-70">د.ج</span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-blue-500/10"></div>
                  <p className="text-slate-400 text-[10px] font-black uppercase mb-1 tracking-widest italic">قيمة المخزن</p>
                  <p className="text-2xl font-black text-slate-900 leading-none">
                    {inventoryValue.toLocaleString('fr-DZ')} <span className="text-xs text-slate-400">د.ج</span>
                  </p>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500/10"></div>
                  <p className="text-slate-400 text-[10px] font-black uppercase mb-1 tracking-widest italic">السلع المسجلة</p>
                  <p className="text-2xl font-black text-slate-900 leading-none">
                    {products.length} <span className="text-xs text-slate-400">سلعة</span>
                  </p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {view === 'HOME' && !searchQuery && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => setShowProductForm(true)}
                  className="p-6 bg-green-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg shadow-green-200 active:scale-95 transition-all hover:bg-green-600"
                >
                  <Plus className="w-8 h-8" />
                  <span className="text-xs uppercase tracking-tighter">إضافة سلعة</span>
                </button>
                <button 
                  onClick={() => setIsScanning(true)}
                  className="p-6 bg-blue-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-600"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-xs uppercase tracking-tighter">مسح باركود</span>
                </button>
                <button 
                  onClick={() => setShowSaleDialog(true)}
                  className="p-6 bg-orange-500 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg shadow-orange-200 active:scale-95 transition-all hover:bg-orange-600"
                >
                  <ShoppingCart className="w-8 h-8" />
                  <span className="text-xs uppercase tracking-tighter">عملية بيع</span>
                </button>
                <button 
                  onClick={() => setShowCategoryForm(true)}
                  className="p-6 bg-slate-800 text-white rounded-[2.5rem] font-black flex flex-col items-center gap-3 shadow-lg shadow-slate-300 active:scale-95 transition-all hover:bg-slate-900"
                >
                  <LayoutGrid className="w-8 h-8" />
                  <span className="text-xs uppercase tracking-tighter">صنف جديد</span>
                </button>
              </div>
            )}

            {/* Content List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 italic">
                  {searchQuery ? <Layers className="w-5 h-5 text-blue-600" /> : <Package className="w-5 h-5 text-blue-600" />}
                  {searchQuery ? 'نتائج البحث السحابي' : 'أصناف المخزن'}
                </h3>
              </div>

              {searchQuery ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                      <div className="aspect-square relative overflow-hidden bg-slate-50">
                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} />
                        <div className="absolute bottom-3 right-3 bg-blue-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black shadow-lg shadow-blue-900/20 backdrop-blur-md">
                          {p.quantity} قطعة
                        </div>
                      </div>
                      <div className="p-6 flex-1 text-center">
                        <h4 className="font-black text-slate-900 mb-2 truncate text-sm">{p.name}</h4>
                        <div className="text-xl font-black text-blue-700 mb-6 flex items-baseline justify-center gap-1">
                          {p.price.split('/')[0]} <span className="text-[10px] opacity-50">د.ج</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setEditingProduct(p); setShowProductForm(true); }}
                            className="p-3 bg-blue-50 text-blue-500 rounded-2xl flex-1 flex justify-center hover:bg-blue-500 hover:text-white transition-all active:scale-90"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteProduct(e, p.id)}
                            className="p-3 bg-red-50 text-red-500 rounded-2xl flex-1 flex justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {categories.map(category => (
                    <div 
                      key={category.id} 
                      className="group bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer text-center relative"
                      onClick={() => { setSelectedCategoryId(category.id); setView('CATEGORY_DETAIL'); }}
                    >
                      <div className="aspect-square relative overflow-hidden p-4">
                        <button 
                          onClick={(e) => handleDeleteCategory(e, category.id)}
                          className="absolute top-4 left-4 z-10 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <img 
                          src={category.image} 
                          className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-700 border-4 border-slate-50" 
                          alt={category.name} 
                        />
                      </div>
                      <div className="p-5">
                        <p className="font-black text-slate-800 text-sm truncate">{category.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider italic">
                          {products.filter(p => p.categoryId === category.id).length} سلع سحابية
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'SALES_LOG' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-left duration-500">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setView('HOME')}
                className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow active:scale-90"
              >
                <ChevronLeft className="w-6 h-6 rotate-180 text-slate-600" />
              </button>
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-none italic">سجل المبيعات السحابي</h2>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">تاريخ العمليات المزامنة</p>
              </div>
            </div>

            <div className="space-y-4">
              {sales.length === 0 ? (
                <div className="bg-white p-20 rounded-[3rem] border border-dashed text-center space-y-4">
                   <History className="w-12 h-12 text-slate-200 mx-auto" />
                   <p className="font-bold text-slate-400">لا يوجد سجل عمليات حتى الآن</p>
                </div>
              ) : (
                sales.map(sale => (
                  <div key={sale.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between hover:border-orange-200 transition-colors group">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                         <img src={sale.productImage} className="w-16 h-16 rounded-2xl object-cover border border-slate-100 group-hover:rotate-3 transition-transform" alt={sale.productName} />
                         <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[8px] font-black w-6 h-6 rounded-lg flex items-center justify-center border-2 border-white">x{sale.quantity}</div>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{sale.productName}</h4>
                        <div className="flex items-center gap-3 mt-1">
                           <span className="text-[10px] text-slate-400 font-black flex items-center gap-1 italic">
                              <Clock className="w-3 h-3" /> {new Date(sale.timestamp).toLocaleString('ar-DZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                           </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                       <div className="font-black text-xl text-green-600">+{sale.soldAtPrice.toLocaleString('fr-DZ')} <span className="text-[10px]">د.ج</span></div>
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">سعر القطعة: { (sale.soldAtPrice / sale.quantity).toLocaleString('fr-DZ') }</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'CATEGORY_DETAIL' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setView('HOME'); setSelectedCategoryId(null); }}
                  className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow active:scale-90"
                >
                  <ChevronLeft className="w-6 h-6 rotate-180 text-slate-600" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-none uppercase italic">
                    {categories.find(c => c.id === selectedCategoryId)?.name}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest italic">عرض جميع السلع التابعة لهذا الصنف</p>
                </div>
              </div>
              
              <button 
                onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                className="p-4 bg-white rounded-2xl border border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <SortAsc className={`w-6 h-6 transition-transform duration-500 ${sortOrder === 'DESC' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  <div className="aspect-square relative overflow-hidden bg-slate-50">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} />
                    <div className="absolute bottom-3 right-3 bg-blue-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black shadow-lg shadow-blue-900/20 backdrop-blur-md">
                      {p.quantity} قطعة
                    </div>
                  </div>
                  <div className="p-6 flex-1 text-center">
                    <h4 className="font-black text-slate-900 mb-2 truncate text-sm">{p.name}</h4>
                    <div className="text-xl font-black text-blue-700 mb-6 flex items-baseline justify-center gap-1">
                      {p.price.split('/')[0]} <span className="text-[10px] opacity-50">د.ج</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditingProduct(p); setShowProductForm(true); }}
                        className="p-3 bg-blue-50 text-blue-500 rounded-2xl flex-1 flex justify-center hover:bg-blue-500 hover:text-white transition-all active:scale-90"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteProduct(e, p.id)}
                        className="p-3 bg-red-50 text-red-500 rounded-2xl flex-1 flex justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Forms & Modals */}
      {showCategoryForm && (
        <CategoryForm 
          onSave={handleAddCategory} 
          onClose={() => setShowCategoryForm(false)} 
        />
      )}
      
      {showProductForm && (
        <ProductForm 
          categories={categories} 
          onSave={handleAddProduct} 
          onClose={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
          initialData={editingProduct || undefined}
          defaultCategoryId={selectedCategoryId || undefined}
        />
      )}

      {isScanning && (
        <BarcodeScanner 
          onScan={(code) => {
            setView('SEARCH');
            setSearchQuery(code);
            setIsScanning(false);
          }}
          onClose={() => setIsScanning(false)}
        />
      )}

      {showSaleDialog && (
        <SaleDialog 
          products={products} 
          onSale={handleSale} 
          onClose={() => setShowSaleDialog(false)} 
        />
      )}
      
      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 inset-x-0 h-20 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center justify-around md:hidden z-50 px-4">
         <button 
            onClick={() => {setView('HOME'); setSelectedCategoryId(null); setSearchQuery('');}} 
            className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${view === 'HOME' ? 'text-blue-600' : 'text-gray-400'}`}
         >
            <Home className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase italic">الرئيسية</span>
         </button>
         
         <button 
            onClick={() => setShowSaleDialog(true)} 
            className="w-14 h-14 bg-orange-500 text-white rounded-3xl shadow-xl shadow-orange-200 flex items-center justify-center -translate-y-6 border-4 border-[#f8fafc] active:scale-90 transition transform"
         >
            <ShoppingCart className="w-7 h-7" />
         </button>
         
         <button 
            onClick={() => setView('SALES_LOG')} 
            className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${view === 'SALES_LOG' ? 'text-orange-600' : 'text-gray-400'}`}
         >
            <History className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase italic">السجل</span>
         </button>
      </div>
    </div>
  );
};

export default App;
