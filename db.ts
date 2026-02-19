// db.ts

// دالة عامة لحفظ العناصر (الأصناف أو المنتجات)
export const saveItem = async (storeName: string, item: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    // محاكاة أو استخدام IndexedDB
    const request = indexedDB.open("NabilCloudDB", 1);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      
      // استخدام put للتحديث أو الإضافة
      const putRequest = store.put(item);
      
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject("خطأ في حفظ العنصر");
    };

    request.onerror = () => reject("تعذر فتح قاعدة البيانات");
  });
};

// دالة جلب كل العناصر
export const getAll = async <T>(storeName: string): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("NabilCloudDB", 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result as T[]);
      getAllRequest.onerror = () => reject("خطأ في جلب البيانات");
    };
  });
};

// وظائف المستخدم والإيرادات (المخزنة في LocalStorage للسرعة)
export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const saveUser = (user: any) => localStorage.setItem('user', JSON.stringify(user));

export const getEarnings = () => Number(localStorage.getItem('earnings') || 0);

export const saveEarnings = (amount: number) => localStorage.setItem('earnings', amount.toString());

// --- دوال Google Drive (تأكد من وجودها لكي لا يعلق App.tsx) ---
export let initTokenClient: any = null;
export let requestToken: any = null;

export const fetchFromCloud = async () => {
  // هنا يوضع كود جلب البيانات من Google Drive
  return null; 
};

export const syncToCloud = async (data: any) => {
  // هنا يوضع كود الرفع إلى Google Drive
  console.log("Syncing to cloud...", data);
};

export const overwriteLocalData = async (data: any) => {
  // منطق استبدال البيانات المحلية ببيانات السحاب
};

export const logoutUser = async () => {
  localStorage.clear();
  // إضافة مسح IndexedDB إذا لزم الأمر
};
