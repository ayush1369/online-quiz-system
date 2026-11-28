import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { AttemptStart } from '../types';
import { QuizProgressBar } from './QuizProgressBar';

interface QuizRunnerProps {
  attempt: AttemptStart;
  submitting: boolean;
  error: string | null;
  onSubmit: (answers: Record<string, number>, autoSubmitted: boolean) => void;
}

function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playLowTimeChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.06, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(659.25, 0, 0.16);
    playTone(880, 0.14, 0.24);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 650);
  } catch {
    // Ignore audio playback errors when blocked by browser autoplay rules
  }
}

export function QuizRunner({ attempt, submitting, error, onSubmit }: QuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(() => new Set());
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  const answersRef = useRef<Record<string, number>>({});
  const autoSubmittedRef = useRef(false);
  const lowTimeAlertedRef = useRef(false);
  const soundMutedRef = useRef(false);

  const computeRemainingSeconds = useCallback(() => {
    const diffMs = Date.parse(attempt.expiresAt) - Date.now();
    return Math.max(0, Math.ceil(diffMs / 1000));
  }, [attempt.expiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => computeRemainingSeconds());

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  // FR8: Quiz Timer with final-60s alert chime and automatic submission when time expires
  useEffect(() => {
    const checkTimer = () => {
      const next = computeRemainingSeconds();
      setRemainingSeconds(next);

      if (next <= 60 && next > 0 && !lowTimeAlertedRef.current) {
        lowTimeAlertedRef.current = true;
        if (!soundMutedRef.current) {
          playLowTimeChime();
        }
      }

      if (next <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        onSubmit(answersRef.current, true);
        return true;
      }
      return false;
    };

    if (checkTimer()) {
      return;
    }

    const interval = window.setInterval(() => {
      if (checkTimer()) {
        window.clearInterval(interval);
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [computeRemainingSeconds, onSubmit]);

  const questions = attempt.questions;
  const activeQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isTimeLow = remainingSeconds <= 60;

  const flaggedIndices = useMemo(() => {
    const indices: number[] = [];
    questions.forEach((q, idx) => {
      if (flaggedIds.has(q.id)) {
        indices.push(idx);
      }
    });
    return indices;
  }, [questions, flaggedIds]);

  const toggleFlagQuestion = useCallback((questionId: number) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const jumpToNextMarked = useCallback(() => {
    if (flaggedIndices.length === 0) return;
    const nextAfter = flaggedIndices.find((idx) => idx > currentIndex);
    setCurrentIndex(nextAfter !== undefined ? nextAfter : flaggedIndices[0]);
  }, [currentIndex, flaggedIndices]);

  const handleSelectOption = useCallback((questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [String(questionId)]: optionIndex,
    }));
  }, []);

  const handleManualSubmit = () => {
    if (submitting || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    onSubmit(answersRef.current, false);
  };

  // Global keyboard navigation: 1–4 selects option, Enter submits/advances current question
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (confirmingSubmit) {
        if (e.key === 'Escape' && !submitting) {
          e.preventDefault();
          setConfirmingSubmit(false);
        }
        return;
      }

      if (submitting || !activeQuestion) return;

      if (e.key >= '1' && e.key <= '4') {
        const optIdx = Number(e.key) - 1;
        if (optIdx < activeQuestion.options.length) {
          e.preventDefault();
          handleSelectOption(activeQuestion.id, optIdx);
        }
        return;
      }

      if (e.key === 'Enter') {
        const isButtonTarget = target?.tagName === 'BUTTON';
        const isRadioOption = target?.getAttribute('role') === 'radio';
        if (isButtonTarget && !isRadioOption) {
          return;
        }
        e.preventDefault();
        if (currentIndex < questions.length - 1) {
          setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
        } else {
          setConfirmingSubmit(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeQuestion,
    confirmingSubmit,
    currentIndex,
    handleSelectOption,
    questions.length,
    submitting,
  ]);

  if (!activeQuestion) {
    return null;
  }

  const selectedForCurrent = answers[String(activeQuestion.id)];
  const isCurrentFlagged = flaggedIds.has(activeQuestion.id);

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-8">
      {/* Top Assessment Header */}
      <div
        className={`bg-white border rounded-xl p-5 space-y-4 transition-colors ${
          isTimeLow ? 'border-red-300' : 'border-slate-200'
        }`}
      >
        <QuizProgressBar
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          flaggedIndices={flaggedIndices}
          onSelectQuestion={setCurrentIndex}
        />

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{attempt.quiz.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span>{attempt.quiz.category}</span>
              <span aria-hidden="true">·</span>
              <span>
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {answeredCount} of {questions.length} answered
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {flaggedIndices.length > 0 && (
              <button
                type="button"
                onClick={jumpToNextMarked}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                Jump to Marked ({flaggedIndices.length})
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <div
                aria-live="polite"
                className={`px-4 py-2 rounded-lg border flex items-center gap-2 font-mono text-base font-semibold tabular-nums ${
                  isTimeLow
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                {isTimeLow ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 shrink-0" />
                )}
                <span>{formatRemaining(remainingSeconds)}</span>
                <span className="text-xs font-sans font-semibold">
                  {isTimeLow ? 'final minute' : 'remaining'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSoundMuted((m) => !m)}
                aria-label={soundMuted ? 'Unmute timer alert sound' : 'Mute timer alert sound'}
                title={soundMuted ? 'Alert sound muted' : 'Alert sound enabled'}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmingSubmit(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Submit Quiz
            </button>
          </div>
        </div>
      </div>

      {isTimeLow && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">
              Final 60 seconds remaining — your quiz will submit automatically when the timer
              reaches 00:00.
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-red-700 tabular-nums">
            {formatRemaining(remainingSeconds)} left
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
        >
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question Stage */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                Question {currentIndex + 1} / {questions.length}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {activeQuestion.marks} {activeQuestion.marks === 1 ? 'mark' : 'marks'}
              </span>
            </div>

            <button
              type="button"
              aria-pressed={isCurrentFlagged}
              onClick={() => toggleFlagQuestion(activeQuestion.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCurrentFlagged
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Flag
                className={`w-3.5 h-3.5 ${
                  isCurrentFlagged ? 'fill-amber-500 text-amber-600' : 'text-slate-400'
                }`}
              />
              {isCurrentFlagged ? 'Marked for Review' : 'Mark for Review'}
            </button>
          </div>

          <h2 className="mt-5 text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed">
            {activeQuestion.questionText}
          </h2>

          <div className="mt-6 space-y-3" role="radiogroup" aria-label="Answer options">
            {activeQuestion.options.map((optionText, optIdx) => {
              const isSelected = selectedForCurrent === optIdx;
              const letter = String.fromCharCode(65 + optIdx);

              return (
                <button
                  key={optIdx}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectOption(activeQuestion.id, optIdx)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-600 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-md font-mono text-xs font-semibold flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="flex-1 text-sm sm:text-base leading-relaxed pt-0.5">
                    {optionText}
                  </span>
                  <span className="font-mono text-xs text-slate-400 pt-1 shrink-0 tabular-nums">
                    {optIdx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-xs text-slate-500 hidden sm:inline">
              Shortcuts: 1–4 select · Enter {currentIndex < questions.length - 1 ? 'next question' : 'submit quiz'}
            </span>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Next Question
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingSubmit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Finish &amp; Submit
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* Question Palette Sidebar */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Question Navigator</h3>
            {flaggedIndices.length > 0 && (
              <button
                type="button"
                onClick={jumpToNextMarked}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                Next Marked
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Jump to any question directly. Blue indicates answered; amber indicates marked for
            review.
          </p>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = answers[String(q.id)] !== undefined;
              const isFlagged = flaggedIds.has(q.id);

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Question ${idx + 1}${isAnswered ? ', answered' : ', unanswered'}${
                    isFlagged ? ', marked for review' : ''
                  }`}
                  className={`relative h-10 rounded-lg font-mono text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                    isCurrent
                      ? 'border-slate-900 ring-2 ring-slate-900/15 bg-slate-900 text-white'
                      : isFlagged
                      ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : isAnswered
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <Flag
                      aria-hidden="true"
                      className={`w-2.5 h-2.5 absolute top-1 right-1 ${
                        isCurrent
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-amber-500 text-amber-600'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs text-slate-600 tabular-nums">
            <div className="flex items-center justify-between">
              <span>Answered</span>
              <span className="font-mono font-semibold text-slate-900">{answeredCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unanswered</span>
              <span className="font-mono font-semibold text-slate-900">
                {questions.length - answeredCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Marked for Review</span>
              <span className="font-mono font-semibold text-amber-700">
                {flaggedIndices.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Passing Requirement</span>
              <span className="font-mono font-semibold text-slate-900">
                {attempt.quiz.passingPercentage}%
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirm Submit Modal */}
      {confirmingSubmit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-dialog-title"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h2 id="submit-dialog-title" className="text-lg font-bold text-slate-900">
              Submit Quiz Answers?
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              You have answered{' '}
              <strong className="text-slate-900 tabular-nums">
                {answeredCount} of {questions.length}
              </strong>{' '}
              questions.{' '}
              {answeredCount < questions.length
                ? 'Unanswered questions will be marked as incorrect.'
                : 'All questions have a selected option.'}
            </p>
            {flaggedIndices.length > 0 && (
              <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Flag className="w-4 h-4 fill-amber-500 text-amber-600 shrink-0" />
                <span className="tabular-nums">
                  {flaggedIndices.length}{' '}
                  {flaggedIndices.length === 1 ? 'question is' : 'questions are'} still marked for
                  review.
                </span>
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {flaggedIndices.length > 0 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setConfirmingSubmit(false);
                    jumpToNextMarked();
                  }}
                  className="px-4 py-2 text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  Review Marked
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingSubmit(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Continue Quiz
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleManualSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Evaluating...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
