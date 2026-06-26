import React from 'react';

import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

function App() {
    return (
        <div className="min-h-screen flex justify-center bg-gray-900">
            <div className="w-full max-w-[430px] bg-white min-h-screen shadow-lg">
                <Routes>
                    <Route path="/" element={<Home />} />
                </Routes>
            </div>
        </div>
    );
}

export default App;

