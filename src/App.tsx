import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './components/Landing';
import { StudentForm } from './components/StudentForm';
import { ExamConfirmation } from './components/ExamConfirmation';
import { Quiz } from './components/Quiz';
import { Results } from './components/Results';

function App() {
  return (
    <BrowserRouter basename="/simulaencib">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/registro" element={<StudentForm />} />
        <Route path="/confirmar" element={<ExamConfirmation />} />
        <Route path="/examen" element={<Quiz />} />
        <Route path="/resultados" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
