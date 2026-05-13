import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Facturas from './pages/Facturas';
import Alertas from './pages/Alertas';
import Proyeccion from './pages/Proyeccion';
import Movimientos from './pages/Movimientos';
import CuentasCobrar from './pages/CuentasCobrar';
import XmlSat from './pages/XmlSat';
import EstatusSat from './pages/EstatusSat';
import Reportes from './pages/Reportes';
import Perfil from './pages/Perfil';

function PrivateRoute({ children }) {
  return localStorage.getItem('zenta_token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index        element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="facturas"    element={<Facturas />} />
          <Route path="alertas"     element={<Alertas />} />
          <Route path="proyeccion"  element={<Proyeccion />} />
          <Route path="movimientos" element={<Movimientos />} />
          <Route path="cxc"         element={<CuentasCobrar />} />
          <Route path="xml-sat"     element={<XmlSat />} />
          <Route path="estatus-sat" element={<EstatusSat />} />
          <Route path="reportes"    element={<Reportes />} />
          <Route path="perfil"      element={<Perfil />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
