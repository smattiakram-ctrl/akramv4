import React, { useEffect, useRef } from 'react';
import { User } from '../types';
import { X, Cloud, LogOut, LogIn, RefreshCw, CheckCircle2, Download, ShieldCheck } from 'lucide-react';

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
    // إعداد مكتبة Google Identity Services (GSI)
    if (!user && window.google) {
      window.google.accounts.id.initialize({
        client_id: '193989877512-vekucvd5hbb801cgnsb4nsju1u8gbo4a.apps.googleusercontent.com',
        callback: (response: any) => {
          // فك تشفير بيانات المستخدم من جوجل (JWT)
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          const userData: User = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          };
          onLogin(userData);
        },
        auto_select: false
      });

      // رسم زر جوجل الحقيقي
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInBtn"),
        { theme: "outline", size: "large", width: "100%", text: "signin_with" }
      );
    }
  }, [user, onLogin]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
        
        {/* Header */}
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
            /* واجهة المستخدم بعد تسجيل الدخول */
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-blue-100">
                <img 
                  src={user.picture} 
                  alt={user.name} 
                  className="w-16 h-16 rounded-full border-2 border-blue-500 shadow-md" 
                />
                <div>
                  <h3 className="font-bold text-gray-800 text-lg leading-tight">{user.name}</h3>
                  <p className="text-gray-500 text-sm">{user.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onSync}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-3 w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Cloud className="w-6 h-6" />
                  )}
                  {isSyncing ? 'جاري الحفظ سحابياً...' : 'مزامنة مع Google Drive'}
                </button>

                <button
                  onClick={onLogout}
                  className="flex items-center justify-center gap-3 w-full border-2 border-red-50 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-50 transition active:scale-95"
                >
                  <LogOut className="w-5 h-5" />
                  تسجيل الخروج
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 py-2 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                متصل وجاهز للمزامنة
              </div>
            </div>
          ) : (
            /* واجهة تسجيل الدخول */
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto rotate-3 shadow-inner">
                <LogIn className="w-10 h-10" />
              </div>
              
              <div>
                <h3 className="text-2xl font-black text-gray-800">تفعيل السحاب</h3>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed px-4">
                  قم بربط حسابك لحفظ المنتجات والمبيعات في مساحتك الخاصة على جوجل درايف والوصول إليها من هاتفك.
                </p>
              </div>
              
              <div id="googleSignInBtn" className="min-h-[50px] flex justify-center"></div>

              <p className="text-[10px] text-gray-400 px-6">
                * لن يتمكن التطبيق من الوصول لملفاتك الخاصة، سيتم إنشاء مجلد مخفي خاص ببيانات NABIL فقط.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
