// db.ts - النسخة الكاملة والمفعلة للمزامنة السحابية
import { Category, Product, SaleRecord, User } from './types';

// --- إعدادات Google API (يجب أن تكون معرفة في index.html أو بشكل عام) ---
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const DB_NAME = 'NabilCloudDB';
const STORE_NAMES = ['categories', 'products', 'sales'];
const FILE_NAME = 'nabil_cloud_data.json';

// --- وظائف قاعدة البيانات المحلية (IndexedDB) ---
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach(store => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveItem = async (storeName: string, item: any) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteItem = async (storeName: string, id: string) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- وظائف المستخدم والإيرادات ---
export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};
export const saveUser = (user: User) => localStorage.setItem('user', JSON.stringify(user));
export const getEarnings = () => Number(localStorage.getItem('earnings') || 0);
export const saveEarnings = (amount: number) => localStorage.setItem('earnings', amount.toString());

// --- المحرك الفعلي للمزامنة مع Google Drive ---

export let initTokenClient: any = null;
export let requestToken: any = null;

// تحميل مكتبة جوجل وتجهيز التوكن
export const setupGoogleAuth = (callback: () => void) => {
  if (window.google) {
    initTokenClient = (onSuccess: () => void) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // سيتم استخدامه من ملفك الأصلي
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.access_token) onSuccess();
        },
      });
      requestToken = () => client.requestAccessToken();
    };
    callback();
  }
};

// الدالة السحرية: جلب البيانات من السحاب
export const fetchFromCloud = async () => {
  try {
    const gapi = window.gapi;
    const response = await gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
    });

    const fileId = response.result.files?.[0]?.id;
    if (fileId) {
      const res = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });
      return res.result; // يعيد الكائنات (أصناف، منتجات، مبيعات)
    }
  } catch (err) {
    console.error("خطأ في جلب بيانات السحاب:", err);
  }
  return null;
};

// الدالة السحرية: رفع كل شيء للسحاب
export const syncToCloud = async (data: any) => {
  try {
    const gapi = window.gapi;
    const token = gapi.auth.getToken()?.access_token;
    if (!token) return;

    // البحث عن الملف أولاً
    const listResponse = await gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
    });

    const fileId = listResponse.result.files?.[0]?.id;
    const metadata = {
      name: FILE_NAME,
      mimeType: 'application/json',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(data) +
      close_delim;

    const path = fileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    await fetch(path, {
      method: fileId ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    console.log("✅ تمت المزامنة مع قوقل درايف بنجاح");
  } catch (err) {
    console.error("❌ فشلت المزامنة السحابية:", err);
  }
};

export const overwriteLocalData = async (data: any) => {
  const db = await openDB();
  for (const storeName of STORE_NAMES) {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    if (data[storeName]) {
      data[storeName].forEach((item: any) => store.put(item));
    }
  }
  if (data.earnings !== undefined) saveEarnings(data.earnings);
};

export const logoutUser = async () => {
  localStorage.clear();
  const db = await openDB();
  STORE_NAMES.forEach(store => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
  });
};
