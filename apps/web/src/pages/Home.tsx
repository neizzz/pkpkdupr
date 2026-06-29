import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
    const { player, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
      };

    return (
           <div className="min-h-screen flex items-center justify-center bg-gray-100">
               <div className="text-center px-6">
                   <h1 className="text-4xl font-bold text-blue-600 mb-4">🏓 PkpkDupr</h1>
                   <p className="text-lg text-gray-700 mb-8">Pickleball DUPR System에 오신 것을 환영합니다!</p>

                   {player ? (
                       <div className="mb-6 p-4 bg-white rounded-xl shadow-sm w-full max-w-[320px] mx-auto">
                           <div className="text-left space-y-2">
                               <div className="flex items-center justify-between">
                                   <span className="text-gray-500 text-sm">이름</span>
                                   <span className="font-semibold">{player.username || player.id}</span>
                               </div>
                               {player.duprRating != null && (
                                   <>
                                       <div className="flex items-center justify-between">
                                             <span className="text-gray-500 text-sm">DUPR Total</span>
                                           <span className="font-semibold text-blue-600">{player.duprRating.total}</span>
                                       </div>
                                       <div className="flex items-center justify-between text-sm text-gray-500">
                                           <span>Singles</span>
                                           <span>{player.duprRating.singles}</span>
                                       </div>
                                       <div className="flex items-center justify-between text-sm text-gray-500">
                                           <span>Doubles</span>
                                           <span>
                                             Mx {player.duprRating.doubles.mixed} · Men {player.duprRating.doubles.men} · Women {player.duprRating.doubles.women}
                                           </span>
                                       </div>
                                   </>
                               )}
                               {player.gender && (
                                   <div className="flex items-center justify-between">
                                        <span className="text-gray-500 text-sm">성별</span>
                                       <span>{player.gender === 'M' ? '🙋‍♂️ Male' : '🙋‍♀️ Female'}</span>
                                   </div>
                               )}
                           </div>

                     <Button
                         onPress={handleLogout}
                         className="mt-4 w-full bg-default-200 text-default-700"
                         fullWidth
                     >
                         로그아웃
                     </Button>
                       </div>
                    ) : (
                       <div className="space-y-3">
                           <Link
                              to="/login"
                              className="block w-full max-w-[320px] mx-auto py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                              로그인
                           </Link>
                       </div>
                   )}
               </div>
           </div>
       );
};

export default Home;
