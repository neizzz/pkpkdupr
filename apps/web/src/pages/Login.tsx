import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await login(username, password);
            navigate('/');
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류입니다.');
          }
      };

    return (
          <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
              <h1 className="text-2xl font-bold mb-8">PkpkDupr</h1>
              <p className="text-gray-500 mb-6 text-sm">로그인</p>

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

                  <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                      로그인
                  </button>
              </form>
          </div>
      );
};

export default Login;
