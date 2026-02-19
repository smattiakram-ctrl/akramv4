import React, { useEffect } from 'react';
import { User } from '../types';
import { X, Cloud, LogOut, LogIn, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  user: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onSync: () => void;
  onClose: () => void;
  isSyncing: boolean;
  categories: any[];
  products: any[];
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  user, onLogin, onLogout, onSync, onClose, isSyncing 
}) => {

  useEffect(() => {
    const CLIENT_ID = '193989877512-vekucvd5hbb801cgnsb4nsju1u8gbo4a.apps.googleusercontent.com';

    if (!user && window.google) {
      // 1. تهيئة تسجيل الدخول العادي
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response: any) => {
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          const userData: User = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          };
          onLogin(userData);
          
          // 2. طلب إذن الوصول للملفات فور نجاح الدخول
          // @ts-ignore
          if (window.tokenClient) {
            // @ts-ignore
            window.tokenClient.requestAccessToken();
          }
        },
        auto_select: false
      });

      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInBtn"),
        { theme: "outline", size: "large", width: "100%", text: "signin_with" }
      );

      // 3. تجهيز محرك الأذونات الخاص بجوجل درايف
      // @ts-ignore
      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            console.log("تم الحصول على إذن الوصول للملفات");
            onSync(); // ابدأ أول مزامنة تلقائياً
          }
        },
      });
    }
  }, [user, onLogin, onSync]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b flex items-center justify-between bg-blue-600 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-xl font-bold">الحساب والمزامنة</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {user ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-blue-100">
                <img src={user.picture} alt="" className="w-16 h-16 rounded-full border-2 border-blue-500" />
                <div>
                  <h3 className="font-bold text-gray-800 text-lg leading-tight">{user.name}</h3>
                  <p className="text-gray-500 text-sm">{user.email}</p>
                </div>
              </div>

              <button
                onClick={onSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-3 w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {isSyncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Cloud className="w-6 h-6" />}
                {isSyncing ? 'جاري الحفظ سحابياً...' : 'مزامنة مع Google Drive'}
              </button>

              <button onClick={onLogout} className="w-full text-red-600 py-4 rounded-2xl font-bold hover:bg-red-50 transition">
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <LogIn className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-800">تفعيل السحاب</h3>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed px-4">قم بربط حسابك لحفظ المنتجات والمبيعات في مساحتك الخاصة على جوجل درايف.</p>
              </div>
              <div id="googleSignInBtn" className="min-h-[50px] flex justify-center"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
