import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Landing } from './components/Landing';
import { StudentForm } from './components/StudentForm';
import { ExamConfirmation } from './components/ExamConfirmation';
import { Quiz } from './components/Quiz';
import { Results } from './components/Results';
import { BanqueoLanding } from './components/BanqueoLanding';
import { BanqueoAccess } from './components/BanqueoAccess';
import { BanqueoCourseSelection } from './components/BanqueoCourseSelection';
import { BanqueoPractice } from './components/BanqueoPractice';

const MARCA = 'Simulacros SINAPSIS';

/** Título de la pestaña por ruta (SEO y pestañas reconocibles). */
const TITULOS: Array<[RegExp, string]> = [
  [/^\/$/, 'Simulacro gratis de medicina'],
  [/^\/registro/, 'Inscripción al simulacro'],
  [/^\/confirmar/, 'Confirma tu simulacro'],
  [/^\/examen/, 'Simulacro en curso'],
  [/^\/resultados/, 'Tus resultados'],
  [/^\/banqueo\/acceso/, 'Acceso al banqueo'],
  [/^\/banqueo\/cursos/, 'Elige tu curso · Banqueo'],
  [/^\/banqueo\/practica/, 'Práctica · Banqueo'],
  [/^\/banqueo/, 'Banqueo histórico'],
];

function TituloPorRuta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITULOS.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · ${MARCA}` : MARCA;
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <TituloPorRuta />
      <Routes>
        {/* Simulacro Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/registro" element={<StudentForm />} />
        <Route path="/confirmar" element={<ExamConfirmation />} />
        <Route path="/examen" element={<Quiz />} />
        <Route path="/resultados" element={<Results />} />

        {/* Banqueo Histórico Routes */}
        <Route path="/banqueo" element={<BanqueoLanding />} />
        <Route path="/banqueo/acceso" element={<BanqueoAccess />} />
        <Route path="/banqueo/cursos" element={<BanqueoCourseSelection />} />
        <Route path="/banqueo/practica/:curso" element={<BanqueoPractice />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
