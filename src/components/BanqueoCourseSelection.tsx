import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, ArrowLeft, Activity, Heart, Microscope, Zap, Target, FileText, BookOpen
} from 'lucide-react';
import { BANQUEO_COURSES } from '../services/api';

export function BanqueoCourseSelection() {
  const navigate = useNavigate();

  // Check if user has access
  useEffect(() => {
    const dni = sessionStorage.getItem('banqueo_dni');
    const email = sessionStorage.getItem('banqueo_email');
    if (!dni || !email) {
      navigate('/banqueo/acceso');
    }
  }, [navigate]);

  const handleSelectCourse = (courseName: string) => {
    navigate(`/banqueo/practica/${encodeURIComponent(courseName)}`);
  };

  const getCourseIcon = (courseName: string) => {
    const icons: Record<string, typeof Heart> = {
      'Anatomía': Activity,
      'Embriología': Heart,
      'Histología': Microscope,
      'Bioquímica': Zap,
      'Fisiología': Activity,
      'Patología': Target,
      'Farmacología': FileText,
      'Microbiología-Parasitología': Microscope
    };
    return icons[courseName] || BookOpen;
  };

  const getCourseColor = (index: number) => {
    const colors = [
      'from-red-500 to-rose-600',
      'from-pink-500 to-fuchsia-600',
      'from-purple-500 to-violet-600',
      'from-blue-500 to-indigo-600',
      'from-cyan-500 to-teal-600',
      'from-green-500 to-emerald-600',
      'from-amber-500 to-orange-600',
      'from-slate-500 to-slate-700'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/banqueo')}
            className="flex items-center gap-2 text-purple-200 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Salir del Banqueo
          </button>

          <div className="max-w-4xl mx-auto text-center py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl mb-3">
              <Brain className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Selecciona un Curso
            </h1>
            <p className="text-purple-100">
              Elige el curso que deseas practicar (10 preguntas aleatorias)
            </p>
          </div>
        </div>
      </header>

      {/* Course Grid */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {BANQUEO_COURSES.map((course, index) => {
            const Icon = getCourseIcon(course.name);
            const gradientColor = getCourseColor(index);

            return (
              <button
                key={course.code}
                onClick={() => handleSelectCourse(course.name)}
                className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                {/* Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor}`} />

                {/* Decorative circles */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-lg" />
                <div className="absolute right-8 bottom-8 w-16 h-16 bg-white/5 rounded-full" />

                {/* Content */}
                <div className="relative z-10 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{course.name}</h3>
                  <p className="text-sm text-white/80">10 preguntas</p>
                </div>

                {/* Hover effect */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Método Active Recall
            </h3>
            <p className="text-sm text-purple-700">
              Después de responder cada pregunta, verás inmediatamente si tu respuesta fue correcta
              y cuál era la respuesta correcta. Este método de retroalimentación inmediata
              mejora significativamente la retención de información.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              <span className="font-semibold text-white">Banqueo Histórico</span>
            </p>
            <p className="text-sm">SimulaENCIB - Active Recall</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
