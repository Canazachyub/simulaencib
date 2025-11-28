import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './components/Landing';
import { StudentForm } from './components/StudentForm';
import { ExamConfirmation } from './components/ExamConfirmation';
import { Quiz } from './components/Quiz';
import { Results } from './components/Results';
import { BanqueoLanding } from './components/BanqueoLanding';
import { BanqueoAccess } from './components/BanqueoAccess';
import { BanqueoCourseSelection } from './components/BanqueoCourseSelection';
import { BanqueoPractice } from './components/BanqueoPractice';

function App() {
  return (
    <BrowserRouter basename="/simulaencib">
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
