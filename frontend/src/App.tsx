import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { RisingPage } from './pages/RisingPage';
import { NewPage } from './pages/NewPage';
import { FilmDetailPage } from './pages/FilmDetailPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rising" element={<RisingPage />} />
          <Route path="/new" element={<NewPage />} />
          <Route path="/film/:id" element={<FilmDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
