import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, CheckCircle2, MessageSquare, Star } from 'lucide-react';
import { api } from '../api';
import type { FeedbackRecord, FeedbackTopic, Quiz } from '../types';

const FEEDBACK_TOPICS: FeedbackTopic[] = [
  'Quiz Content',
  'Difficulty & Timing',
  'Platform & UI',
  'Bug Report',
  'Suggestion',
];

interface FeedbackViewProps {
  quizzes: Quiz[];
  feedbackList: FeedbackRecord[];
  loading: boolean;
  error: string | null;
  onFeedbackCreated: (created: FeedbackRecord) => void;
  onBrowseQuizzes: () => void;
}

export function FeedbackView({
  quizzes,
  feedbackList,
  loading,
  error,
  onFeedbackCreated,
  onBrowseQuizzes,
}: FeedbackViewProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [topic, setTopic] = useState<FeedbackTopic>('Quiz Content');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const activeStars = hoverRating ?? rating;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await api.submitFeedback({
        quizId: selectedQuizId ? Number(selectedQuizId) : null,
        rating,
        topic,
        comment: comment.trim(),
      });
      onFeedbackCreated(res.feedback);
      setComment('');
      setRating(5);
      setSubmitSuccess('Thank you! Your feedback has been submitted.');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Student Feedback
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Rate quizzes, report question issues, or share suggestions to improve the assessment
            experience.
          </p>
        </div>

        <button
          type="button"
          onClick={onBrowseQuizzes}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          Browse Quizzes
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Feedback Submission Form */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-900">Share Your Feedback</h2>
          <p className="mt-1 text-xs text-slate-500">
            Feedback is reviewed by administrators alongside quiz performance reports.
          </p>

          {submitError && (
            <div
              role="alert"
              className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div
              role="status"
              className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Rating</span>
              <div className="flex items-center gap-1.5" role="group" aria-label="Star rating">
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
                      className={`w-6 h-6 transition-colors ${
                        star <= activeStars
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
                htmlFor="feedback-quiz"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Related Quiz
              </label>
              <select
                id="feedback-quiz"
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option value="">General Platform Feedback</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={String(q.id)}>
                    {q.title} ({q.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="feedback-topic"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Topic
              </label>
              <select
                id="feedback-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value as FeedbackTopic)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                {FEEDBACK_TOPICS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="feedback-comment"
                  className="block text-sm font-medium text-slate-700"
                >
                  Comments
                </label>
                <span className="text-xs text-slate-400 tabular-nums">
                  {comment.trim().length} / 1000
                </span>
              </div>
              <textarea
                id="feedback-comment"
                required
                minLength={5}
                maxLength={1000}
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share what worked well, unclear questions, or suggestions..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </section>

        {/* Submitted Feedback History */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Your Submitted Feedback ({feedbackList.length})
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-slate-200 rounded-xl p-5 h-28 animate-pulse"
                />
              ))}
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                No feedback submitted yet
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Use the form on the left to share feedback on a quiz or the platform.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {item.quizTitle ?? 'General Platform Feedback'}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {item.topic} ·{' '}
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      aria-label={`Rated ${item.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= item.rating
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {item.comment}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
