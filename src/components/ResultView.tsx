import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Star, XCircle } from 'lucide-react';
import { api } from '../api';
import type { FeedbackTopic, QuizResultDetail } from '../types';

interface ResultViewProps {
  result: QuizResultDetail;
  onBack: () => void;
  backLabel?: string;
  allowFeedback?: boolean;
}

export function ResultView({
  result,
  onBack,
  backLabel = 'Back to Quizzes',
  allowFeedback = true,
}: ResultViewProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [topic, setTopic] = useState<FeedbackTopic>('Quiz Content');
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const formattedDate = result.submittedAt
    ? new Date(result.submittedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Recently';

  const handleFeedbackSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await api.submitFeedback({
        quizId: result.quizId,
        attemptId: result.attemptId,
        rating,
        topic,
        comment: comment.trim(),
      });
      setFeedbackSubmitted(true);
      setComment('');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <main className="max-w-[1040px] mx-auto px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </button>

      {/* Evaluation Summary Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{result.category}</span>
              <span aria-hidden="true">·</span>
              <span>Submitted {formattedDate}</span>
              {result.autoSubmitted && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Auto-submitted at timer expiry
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
              {result.quizTitle}
            </h1>
          </div>

          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold shrink-0 ${
              result.passed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {result.passed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Passed ({result.passingPercentage}% required)</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-700" />
                <span>Not Passed ({result.passingPercentage}% required)</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">Score Obtained</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {result.score} / {result.totalMarks}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Percentage</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {result.percentage}%
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Correct Answers</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
              {result.correctCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Incorrect / Skipped</div>
            <div className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
              {result.incorrectCount}
            </div>
          </div>
        </div>
      </section>

      {/* Question-by-Question Evaluation Review */}
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Question Evaluation Breakdown</h2>

        {result.breakdown.map((item, idx) => (
          <article
            key={item.questionId}
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                Question {idx + 1}
              </span>
              <div className="flex items-center gap-3 text-xs font-medium tabular-nums">
                <span className="font-mono text-slate-600">
                  Earned: {item.earnedMarks} / {item.marks}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  |
                </span>
                {item.isCorrect ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Correct
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                    <XCircle className="w-3.5 h-3.5" />
                    {item.selectedOption === null ? 'Unanswered' : 'Incorrect'}
                  </span>
                )}
              </div>
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-900 leading-relaxed">
              {item.questionText}
            </h3>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {item.options.map((optText, optIdx) => {
                const isCorrectKey = optIdx === item.correctOption;
                const isUserChoice = optIdx === item.selectedOption;
                const letter = String.fromCharCode(65 + optIdx);

                let styleClass = 'border-slate-200 bg-white text-slate-700';
                let tagText: string | null = null;

                if (isCorrectKey && isUserChoice) {
                  styleClass = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                  tagText = 'Your Answer · Correct';
                } else if (isCorrectKey) {
                  styleClass = 'border-emerald-400 bg-emerald-50/70 text-emerald-950';
                  tagText = 'Correct Answer';
                } else if (isUserChoice) {
                  styleClass = 'border-red-400 bg-red-50 text-red-950';
                  tagText = 'Your Answer';
                }

                return (
                  <div
                    key={optIdx}
                    className={`p-3 rounded-lg border text-sm flex items-start justify-between gap-3 ${styleClass}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-xs font-semibold pt-0.5">{letter}.</span>
                      <span>{optText}</span>
                    </div>
                    {tagText && (
                      <span className="text-xs font-semibold whitespace-nowrap shrink-0">
                        {tagText}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      {/* Post-Quiz Student Feedback */}
      {allowFeedback && (
        <section className="mt-10 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">Quiz Feedback</h2>
          <p className="mt-1 text-xs text-slate-500">
            Let your instructor know how you found the questions, clarity, and time limit for this
            quiz.
          </p>

          {feedbackSubmitted ? (
            <div
              role="status"
              className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Thank you! Your feedback for this attempt has been recorded.</span>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="mt-5 space-y-4">
              {feedbackError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{feedbackError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">Rating</span>
                  <div className="flex items-center gap-1.5" role="group" aria-label="Quiz rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        aria-label={`Rate ${star} out of 5 stars`}
                        aria-pressed={rating === star}
                        className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= (hoverRating ?? rating)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-mono font-semibold text-slate-600 tabular-nums">
                      {rating} / 5
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="result-feedback-topic"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Topic
                  </label>
                  <select
                    id="result-feedback-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as FeedbackTopic)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="Quiz Content">Quiz Content</option>
                    <option value="Difficulty & Timing">Difficulty &amp; Timing</option>
                    <option value="Platform & UI">Platform &amp; UI</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Suggestion">Suggestion</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="result-feedback-comment"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Comments
                </label>
                <textarea
                  id="result-feedback-comment"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share thoughts on question quality, difficulty, or timing..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
