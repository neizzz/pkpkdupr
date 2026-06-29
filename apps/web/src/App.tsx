import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import BottomNav from './components/BottomNav';

function App() {
    return (
             <div className="min-h-screen flex justify-center bg-gray-900">
                 <div className="w-full max-w-[430px] bg-white min-h-screen shadow-lg">
                     <AuthProvider>
                         <Routes>
                             <Route path="/" element={<BottomNav />} />
                             <Route path="/login" element={<Login />} />
                         </Routes>
                     </AuthProvider>
                 </div>
             </div>
         );
};

export default App;
