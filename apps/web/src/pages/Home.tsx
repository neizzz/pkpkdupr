import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
                                  <div className="flex items-center justify-between">
                                        <span className="text-gray-500 text-sm">DUPR</span>
                                      <span className="font-semibold text-blue-600">{player.duprRating}</span>
                                  </div>
                              )}
                              {player.gender && (
                                  <div className="flex items-center justify-between">
                                       <span className="text-gray-500 text-sm">성별</span>
                                      <span>{player.gender === 'M' ? '🙋‍♂️ Male' : '🙋‍♀️ Female'}</span>
                                  </div>
                              )}
                          </div>

                          <button
                              onClick={handleLogout}
                              className="mt-4 w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                               >
                              로그아웃
                          </button>
                      </div>
                   ) : (
                      <div className="space-y-3">
                          <Link
                              to="/login"
                              className="block w-full max-w-[320px] mx-auto py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                               >
                              로그인 / 회원가입
                          </Link>
                      </div>
                  )}
              </div>
          </div>
      );
};

export default Home;
