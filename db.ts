// db.ts
const DB_PREFIX = 'NabilInventory_';
const CLIENT_ID = '193989877512-vekucvd5hbb801cgnsb4nsju1u8gbo4a.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient: any = null;

// وظيفة لتهيئة طلب التوكن
export const initTokenClient = (onToken: (token: string) => void) => {
  if (window.google) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          localStorage.setItem('drive_access_token', response.access_token);
          onToken(response.access_token);
        }
      },
    });
  }
};

export const requestToken = () => {
  if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
};

// وظيفة جلب البيانات من السحاب
export const fetchFromCloud = async (): Promise<any | null> => {
  const token = localStorage.getItem('drive_access_token');
  if (!token) return null;

  try {
    // 1. البحث عن ملف النسخة الاحتياطية في المجلد الخاص بالتطبيق
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='nabil_inventory_backup.json'&spaces=appDataFolder`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const list = await listRes.json();
    const file = list.files?.[0];

    if (!file) return null;

    // 2. تحميل محتوى الملف
    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return await contentRes.json();
  } catch (error) {
    console.error("خطأ في التحميل من السحاب:", error);
    return null;
  }
};

// وظيفة المزامنة (الرفع للسحاب)
export const syncToCloud = async (data: any): Promise<void> => {
  const token = localStorage.getItem('drive_access_token');
  if (!token) {
    requestToken();
    return;
  }

  try {
    const fileName = 'nabil_inventory_backup.json';
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'&spaces=appDataFolder`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const list = await listRes.json();
    const fileId = list.files?.[0]?.id;

    const metadata = { name: fileName, parents: ['appDataFolder'] };
    const fileData = JSON.stringify(data);

    if (fileId) {
      // تحديث ملف موجود
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: fileData
      });
    } else {
      // إنشاء ملف جديد (Multipart)
      const boundary = 'foo_bar_baz';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;
      const body = 
        delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
        delimiter + 'Content-Type: application/json\r\n\r\n' + fileData +
        close_delim;

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': `multipart/related; boundary=${boundary}` 
        },
        body
      });
    }
    console.log("✅ تمت المزامنة بنجاح");
  } catch (error) {
    console.error("❌ فشلت المزامنة:", error);
  }
};

// الوظائف المحلية البسيطة
export const saveUser = (user: any) => localStorage.setItem(DB_PREFIX + 'USER', JSON.stringify(user));
export const getUser = () => JSON.parse(localStorage.getItem(DB_PREFIX + 'USER') || 'null');
export const saveEarnings = (val: number) => localStorage.setItem(DB_PREFIX + 'EARNINGS', val.toString());
export const getEarnings = () => Number(localStorage.getItem(DB_PREFIX + 'EARNINGS') || 0);

export const overwriteLocalData = async (data: any) => {
  if (data.categories) localStorage.setItem(DB_PREFIX + 'categories', JSON.stringify(data.categories));
  if (data.products) localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(data.products));
  if (data.sales) localStorage.setItem(DB_PREFIX + 'sales', JSON.stringify(data.sales));
};

export const logoutUser = () => {
  localStorage.clear();
};
