import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** 간단한 로그인/회원가입 폼 */
const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState<'M' | 'F'>('M');
    const [error, setError] = useState<string | null>(null);

    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (isLogin) {
                await login(username, password);
             } else {
                await register(username, password, gender);
             }
            navigate('/');
         } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
         }
     };

    return (
         <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
             <h1 className="text-2xl font-bold mb-8">PkpkDupr</h1>
             <p className="text-gray-500 mb-6 text-sm">{isLogin ? '로그인' : '회원가입'}</p>

             {error && (
                <div className="w-full max-w-[430px] bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded mb-4 text-sm">
                    {error}
                </div>
             )}

             <form onSubmit={handleSubmit} className="w-full max-w-[430px] space-y-4">
                 <input
                     type="text"
                     placeholder="Username"
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     required
                     className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />

                 <input
                     type="password"
                     placeholder="Password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     required
                     className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />

                 {!isLogin && (
                     <div className="flex gap-4">
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input
                                 type="radio"
                                 name="gender"
                                 value="M"
                                 checked={gender === 'M'}
                                 onChange={() => setGender('M')}
                                 className="accent-blue-500"
                                 />
                             🙋‍♂️ Male
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input
                                 type="radio"
                                 name="gender"
                                 value="F"
                                 checked={gender === 'F'}
                                 onChange={() => setGender('F')}
                                 className="accent-blue-500"
                                 />
                             🙋‍♀️ Female
                         </label>
                     </div>
                 )}

                 <button
                     type="submit"
                     className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                     >
                     {isLogin ? '로그인' : '회원가입'}
                 </button>
             </form>

             <p className="mt-4 text-sm text-gray-500">
                 {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
                 <button
                     type="button"
                     onClick={() => setIsLogin(!isLogin)}
                     className="text-blue-600 hover:underline font-medium"
                     >
                     {isLogin ? '회원가입' : '로그인'}
                 </button>
             </p>

             <Link to="/" className="mt-4 text-sm text-gray-400 hover:text-gray-600">
                 ← 홈으로 돌아가기
             </Link>
         </div>
     );
};

export default Login;
