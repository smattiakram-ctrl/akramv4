import { Category, Product, SaleRecord, User } from './types';

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

const DB_NAME = 'NabilCloudDB';
const STORE_NAMES = ['categories', 'products', 'sales'];
const FILE_NAME = 'nabil_cloud_data.json';
const CLIENT_ID = '193989877512-vekucvd5hbb801cgnsb4nsju1u8gbo4a.apps.googleusercontent.com';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach(store => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveItem = async (storeName: string, item: any) => {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(item);
};

export const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteItem = async (storeName: string, id: string) => {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(id);
};

export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};
export const saveUser = (user: User) => localStorage.setItem('user', JSON.stringify(user));
export const getEarnings = () => Number(localStorage.getItem('earnings') || 0);
export const saveEarnings = (amount: number) => localStorage.setItem('earnings', amount.toString());

// --- المزامنة الفعلية ---

export const fetchFromCloud = async () => {
  try {
    const gapi = window.gapi;
    if (!gapi?.client?.drive) return null;
    
    const response = await gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
    });

    const fileId = response.result.files?.[0]?.id;
    if (fileId) {
      const res = await gapi.client.drive.files.get({ fileId, alt: 'media' });
      return res.result;
    }
  } catch (err) {
    console.error("خطأ جلب بيانات السحاب:", err);
  }
  return null;
};

export const syncToCloud = async (data: any) => {
  try {
    const gapi = window.gapi;
    // التأكد من وجود توكن صالح
    const token = gapi?.auth?.getToken()?.access_token;
    if (!token) {
      console.log("لا يوجد توكن، محاولة طلب توكن جديد...");
      if (window.tokenClient) window.tokenClient.requestAccessToken();
      return;
    }

    const listResponse = await gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
    });

    const fileId = listResponse.result.files?.[0]?.id;
    const metadata = { name: FILE_NAME, mimeType: 'application/json' };
    const boundary = '-------314159265358979323846';
    const multipartRequestBody =
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;

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
    console.log("✅ تمت المزامنة بنجاح");
  } catch (err) {
    console.error("❌ فشلت المزامنة:", err);
  }
};

export const overwriteLocalData = async (data: any) => {
  const db = await openDB();
  for (const store of STORE_NAMES) {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    if (data[store]) data[store].forEach((item: any) => tx.objectStore(store).put(item));
  }
  if (data.earnings !== undefined) saveEarnings(data.earnings);
};

export const logoutUser = async () => {
  localStorage.clear();
  const db = await openDB();
  STORE_NAMES.forEach(s => db.transaction(s, 'readwrite').objectStore(s).clear());
};
