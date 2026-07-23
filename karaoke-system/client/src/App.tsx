import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { HomeTV } from './pages/HomeTV';
import { Admin } from './pages/Admin';
import { SingFlow } from './pages/sing/SingFlow';

function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 text-center px-6">
      <p className="text-lg font-semibold">Página não encontrada</p>
      <Link to="/" className="text-fuchsia-300 underline text-sm">
        Voltar para a tela principal
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeTV />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/sing" element={<SingFlow />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
