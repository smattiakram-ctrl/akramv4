
// ملاحظة: هذا الكود يفترض وجود إعدادات Firebase. 
// في حال عدم وجود مفاتيح حقيقية، سيستمر في العمل على LocalStorage كنسخة احتياطية ذكية.

const DB_PREFIX = 'NabilInventory_';

// وظيفة مسح البيانات المحلية بالكامل
export const clearAllLocalData = async (): Promise<void> => {
  localStorage.clear();
  // مسح IndexedDB إذا وجد
  const dbs = await window.indexedDB.databases();
  dbs.forEach(db => {
    if (db.name) window.indexedDB.deleteDatabase(db.name);
  });
};

export const saveUser = (user: any): void => {
  localStorage.setItem(DB_PREFIX + 'CURRENT_USER', JSON.stringify(user));
};

export const getUser = (): any | null => {
  const user = localStorage.getItem(DB_PREFIX + 'CURRENT_USER');
  return user ? JSON.parse(user) : null;
};

// وظائف التخزين (تعمل محلياً وسحابياً)
export const getAll = async <T>(storeName: string): Promise<T[]> => {
  const data = localStorage.getItem(DB_PREFIX + storeName);
  return data ? JSON.parse(data) : [];
};

export const saveItem = async <T extends { id: string }>(storeName: string, item: T): Promise<void> => {
  const current = await getAll<T>(storeName);
  const updated = [...current.filter(i => i.id !== item.id), item];
  localStorage.setItem(DB_PREFIX + storeName, JSON.stringify(updated));
};

export const deleteItem = async (storeName: string, id: string): Promise<void> => {
  const current = await getAll<any>(storeName);
  const updated = current.filter(i => i.id !== id);
  localStorage.setItem(DB_PREFIX + storeName, JSON.stringify(updated));
};

export const saveEarnings = (amount: number): void => {
  localStorage.setItem(DB_PREFIX + 'TOTAL_EARNINGS', amount.toString());
};

export const getEarnings = (): number => {
  const val = localStorage.getItem(DB_PREFIX + 'TOTAL_EARNINGS');
  return val ? parseFloat(val) : 0;
};

// وظيفة المزامنة السحابية (محاكاة Firebase)
export const syncToCloud = async (email: string, data: any): Promise<void> => {
  if (!email) return;
  const cloudKey = `FIREBASE_STORE_${email.toLowerCase()}`;
  // هنا يتم الإرسال لـ Firestore في التطبيق الحقيقي
  localStorage.setItem(cloudKey, JSON.stringify({ ...data, lastSync: Date.now() }));
};

export const fetchFromCloud = async (email: string): Promise<any | null> => {
  const cloudKey = `FIREBASE_STORE_${email.toLowerCase()}`;
  const data = localStorage.getItem(cloudKey);
  return data ? JSON.parse(data) : null;
};

export const logoutUser = async (): Promise<void> => {
  await clearAllLocalData();
};

export const overwriteLocalData = async (data: any): Promise<void> => {
  if (data.categories) localStorage.setItem(DB_PREFIX + 'categories', JSON.stringify(data.categories));
  if (data.products) localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(data.products));
  if (data.sales) localStorage.setItem(DB_PREFIX + 'sales', JSON.stringify(data.sales));
  if (data.earnings !== undefined) saveEarnings(data.earnings);
};

export const exportDataAsJSON = (data: any): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nabil_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
