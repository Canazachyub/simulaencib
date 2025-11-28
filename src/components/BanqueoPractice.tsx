import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Brain, ArrowLeft, Loader2, CheckCircle, XCircle, ChevronRight,
  RefreshCw, Home, AlertCircle
} from 'lucide-react';
import { getBanqueoQuestions, BanqueoQuestion } from '../services/api';

type AnswerState = 'unanswered' | 'correct' | 'incorrect';

interface QuestionState {
  answered: boolean;
  selectedOption: number | null;
  isCorrect: boolean;
}

export function BanqueoPractice() {
  const navigate = useNavigate();
  const { curso } = useParams<{ curso: string }>();
  const courseName = decodeURIComponent(curso || '');

  const [questions, setQuestions] = useState<BanqueoQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // Check access and load questions
  useEffect(() => {
    const dni = sessionStorage.getItem('banqueo_dni');
    const email = sessionStorage.getItem('banqueo_email');
    if (!dni || !email) {
      navigate('/banqueo/acceso');
      return;
    }

    loadQuestions();
  }, [courseName, navigate]);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getBanqueoQuestions(courseName);
      if (result.error) {
        setError(result.error);
      } else {
        setQuestions(result.questions);
        setQuestionStates(result.questions.map(() => ({
          answered: false,
          selectedOption: null,
          isCorrect: false
        })));
        setCurrentIndex(0);
        setShowSummary(false);
      }
    } catch (err) {
      setError('Error al cargar las preguntas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    if (questionStates[currentIndex]?.answered) return;

    const isCorrect = optionIndex === questions[currentIndex].correctAnswer;

    setQuestionStates(prev => {
      const newStates = [...prev];
      newStates[currentIndex] = {
        answered: true,
        selectedOption: optionIndex,
        isCorrect
      };
      return newStates;
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handlePracticeAgain = () => {
    loadQuestions();
  };

  const getAnswerState = (optionIndex: number): AnswerState => {
    const state = questionStates[currentIndex];
    if (!state?.answered) return 'unanswered';

    const correctAnswer = questions[currentIndex].correctAnswer;

    if (optionIndex === correctAnswer) return 'correct';
    if (optionIndex === state.selectedOption) return 'incorrect';
    return 'unanswered';
  };

  const getOptionClasses = (optionIndex: number): string => {
    const state = getAnswerState(optionIndex);
    const baseClasses = 'w-full p-4 rounded-xl text-left transition-all duration-200 border-2';

    switch (state) {
      case 'correct':
        return `${baseClasses} bg-green-50 border-green-500 text-green-800`;
      case 'incorrect':
        return `${baseClasses} bg-red-50 border-red-500 text-red-800`;
      default:
        if (questionStates[currentIndex]?.answered) {
          return `${baseClasses} bg-slate-50 border-slate-200 text-slate-600`;
        }
        return `${baseClasses} bg-white border-slate-200 hover:border-purple-400 hover:bg-purple-50 cursor-pointer`;
    }
  };

  const correctCount = questionStates.filter(s => s.isCorrect).length;
  const incorrectCount = questionStates.filter(s => s.answered && !s.isCorrect).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando preguntas de {courseName}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/banqueo/cursos')}
              className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Volver a cursos
            </button>
            <button
              onClick={loadQuestions}
              className="btn-primary"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl mb-4">
              <Brain className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              ¡Práctica Completada!
            </h2>
            <p className="text-slate-600 mb-6">{courseName}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold text-green-700">{correctCount}</span>
                </div>
                <p className="text-sm text-green-600">Correctas</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-2xl font-bold text-red-700">{incorrectCount}</span>
                </div>
                <p className="text-sm text-red-600">Incorrectas</p>
              </div>
            </div>

            {/* Score */}
            <div className="bg-purple-50 rounded-xl p-4 mb-8">
              <p className="text-3xl font-bold text-purple-700">
                {Math.round((correctCount / questions.length) * 100)}%
              </p>
              <p className="text-sm text-purple-600">Porcentaje de aciertos</p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handlePracticeAgain}
                className="btn-primary w-full py-3"
              >
                <RefreshCw className="w-5 h-5" />
                Practicar {courseName} otra vez
              </button>
              <button
                onClick={() => navigate('/banqueo/cursos')}
                className="btn w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <Home className="w-5 h-5" />
                Elegir otro curso
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentState = questionStates[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/banqueo/cursos')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>

            <div className="text-center">
              <p className="text-sm text-slate-500">{courseName}</p>
              <p className="font-bold text-slate-800">
                Pregunta {currentIndex + 1} de {questions.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4" />
                {correctCount}
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-sm">
                <XCircle className="w-4 h-4" />
                {incorrectCount}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Question Content */}
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          {/* Question Type Badge */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              {currentQuestion.questionType}
            </span>
            {currentQuestion.metadata?.tema && (
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                {currentQuestion.metadata.tema}
              </span>
            )}
            {currentQuestion.sourceFile && (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
                Tomado en: {currentQuestion.sourceFile}
              </span>
            )}
          </div>

          {/* Question Text */}
          <div
            className="text-slate-800 text-lg leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: currentQuestion.questionText }}
          />

          {/* Image if exists */}
          {currentQuestion.imageLink && (
            <div className="mb-6">
              <img
                src={currentQuestion.imageLink}
                alt="Imagen de la pregunta"
                className="max-w-full h-auto rounded-xl border border-slate-200"
              />
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const answerState = getAnswerState(index);

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(index)}
                  disabled={currentState?.answered}
                  className={getOptionClasses(index)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                      ${answerState === 'correct' ? 'bg-green-500 text-white' :
                        answerState === 'incorrect' ? 'bg-red-500 text-white' :
                        currentState?.answered ? 'bg-slate-200 text-slate-500' :
                        'bg-purple-100 text-purple-700'}`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <div className="flex-1 text-left">
                      <span dangerouslySetInnerHTML={{ __html: option }} />
                      {answerState === 'correct' && (
                        <span className="ml-2 text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4 inline" /> Correcto
                        </span>
                      )}
                      {answerState === 'incorrect' && (
                        <span className="ml-2 text-red-600 font-medium">
                          <XCircle className="w-4 h-4 inline" /> Incorrecto
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback & Next Button */}
        {currentState?.answered && (
          <div className="space-y-4">
            {/* Feedback Box */}
            <div className={`rounded-xl p-4 ${currentState.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-start gap-3">
                {currentState.isCorrect ? (
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-bold ${currentState.isCorrect ? 'text-green-700' : 'text-amber-700'}`}>
                    {currentState.isCorrect ? '¡Correcto!' : 'Incorrecto'}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    La respuesta correcta es la opción <strong>{String.fromCharCode(65 + currentQuestion.correctAnswer)}</strong>
                  </p>
                  {currentQuestion.justification && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-sm font-semibold text-slate-700 mb-1">Justificación:</p>
                      <p className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: currentQuestion.justification }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={handleNext}
              className="btn-primary w-full py-4 text-lg"
            >
              {currentIndex < questions.length - 1 ? (
                <>
                  Siguiente pregunta
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Ver resultados
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Instruction when not answered */}
        {!currentState?.answered && (
          <div className="text-center text-slate-500 text-sm">
            Selecciona una opción para ver la respuesta
          </div>
        )}
      </main>
    </div>
  );
}
