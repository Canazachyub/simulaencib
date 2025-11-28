import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  initialTime: number;
  onTimeout?: () => void;
  autoStart?: boolean;
}

interface UseTimerReturn {
  timeRemaining: number;
  isRunning: boolean;
  isWarning: boolean;
  start: () => void;
  pause: () => void;
  reset: (newTime?: number) => void;
  getElapsedTime: () => number;
}

/**
 * Hook para manejar un temporizador con countdown
 */
export function useTimer({
  initialTime,
  onTimeout,
  autoStart = false
}: UseTimerOptions): UseTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);

  // Determinar si está en estado de advertencia (menos de 10 segundos)
  const isWarning = timeRemaining <= 10 && timeRemaining > 0;

  // Efecto para el countdown
  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return;

    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning, timeRemaining, onTimeout]);

  const start = useCallback(() => {
    if (!isRunning) {
      startTimeRef.current = Date.now();
      setIsRunning(true);
    }
  }, [isRunning]);

  const pause = useCallback(() => {
    if (isRunning) {
      elapsedBeforePauseRef.current += Math.round((Date.now() - startTimeRef.current) / 1000);
      setIsRunning(false);
    }
  }, [isRunning]);

  const reset = useCallback((newTime?: number) => {
    setTimeRemaining(newTime ?? initialTime);
    setIsRunning(false);
    elapsedBeforePauseRef.current = 0;
    startTimeRef.current = Date.now();
  }, [initialTime]);

  const getElapsedTime = useCallback(() => {
    if (isRunning) {
      return elapsedBeforePauseRef.current + Math.round((Date.now() - startTimeRef.current) / 1000);
    }
    return elapsedBeforePauseRef.current;
  }, [isRunning]);

  return {
    timeRemaining,
    isRunning,
    isWarning,
    start,
    pause,
    reset,
    getElapsedTime
  };
}

/**
 * Formatea segundos a formato HH:MM:SS o MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook para manejar un cronómetro que cuenta hacia arriba
 */
export function useStopwatch(autoStart: boolean = false) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);
  const startTimeRef = useRef<number>(Date.now());

  // Actualizar isRunning cuando cambia autoStart
  useEffect(() => {
    if (autoStart && !isRunning) {
      startTimeRef.current = Date.now();
      setIsRunning(true);
    }
  }, [autoStart]);

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = setInterval(() => {
      setElapsedTime(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning]);

  const start = useCallback(() => {
    if (!isRunning) {
      startTimeRef.current = Date.now() - elapsedTime * 1000;
      setIsRunning(true);
    }
  }, [isRunning, elapsedTime]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setElapsedTime(0);
    setIsRunning(false);
    startTimeRef.current = Date.now();
  }, []);

  // Tiempo formateado
  const formattedTime = formatTime(elapsedTime);

  return {
    elapsedTime,
    formattedTime,
    isRunning,
    start,
    pause,
    reset
  };
}
