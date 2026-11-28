import { useMemo } from 'react';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { QuizResultSummary } from '../types';

interface MyResultsViewProps {
  results: QuizResultSummary[];
  loading: boolean;
  error: string | null;
  onInspectResult: (attemptId: number) => void;
  onBrowseQuizzes: () => void;
}

interface ChartPoint {
  attemptId: number;
  label: string;
  quizTitle: string;
  percentage: number;
  scoreLabel: string;
  submittedLabel: string;
  passed: boolean;
}

export function MyResultsView({
  results,
  loading,
  error,
  onInspectResult,
  onBrowseQuizzes,
}: MyResultsViewProps) {
  const progressionData = useMemo<ChartPoint[]>(() => {
    const recentTen = results.slice(0, 10).reverse();
    return recentTen.map((r, idx) => {
      const dateStr = r.submittedAt
        ? new Date(r.submittedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
        : `#${idx + 1}`;
      return {
        attemptId: r.attemptId,
        label: `${dateStr} (#${idx + 1})`,
        quizTitle: r.quizTitle,
        percentage: r.percentage,
        scoreLabel: `${r.score} / ${r.totalMarks}`,
        submittedLabel: r.submittedAt
          ? new Date(r.submittedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '—',
        passed: r.passed,
      };
    });
  }, [results]);

  const recentAverage = useMemo(() => {
    if (progressionData.length === 0) return 0;
    const sum = progressionData.reduce((acc, item) => acc + item.percentage, 0);
    return Math.round((sum / progressionData.length) * 10) / 10;
  }, [progressionData]);

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            My Quiz Results
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Stored attempt records with scores, submission dates, and full answer breakdowns.
          </p>
        </div>

        <button
          type="button"
          onClick={onBrowseQuizzes}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          Attempt Another Quiz
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

      {loading ? (
        <div className="mt-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 h-72 animate-pulse" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No quiz results recorded yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Complete a quiz from the catalog to store and review your evaluation score here.
          </p>
          <button
            type="button"
            onClick={onBrowseQuizzes}
            className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
          >
            Browse Available Quizzes
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Score Progression Line Chart (Last 10 Attempts) */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Score Progression (Last {progressionData.length}{' '}
                  {progressionData.length === 1 ? 'Attempt' : 'Attempts'})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Percentage score trajectory ordered chronologically from oldest to most recent.
                </p>
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                Recent Average:{' '}
                <span className="font-mono font-bold text-slate-900">{recentAverage}%</span>
              </div>
            </div>

            <div className="mt-5 w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={progressionData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0].payload as ChartPoint;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm text-xs space-y-1 max-w-xs">
                          <div className="font-bold text-slate-900">{point.quizTitle}</div>
                          <div className="text-slate-500">{point.submittedLabel}</div>
                          <div className="pt-1 font-mono font-semibold text-blue-700 tabular-nums">
                            {point.percentage}% ({point.scoreLabel}) ·{' '}
                            {point.passed ? 'Passed' : 'Not Passed'}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#1D4ED8"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#1D4ED8', stroke: '#FFFFFF', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#1D4ED8', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Attempt History Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-5">Quiz Title</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Submitted</th>
                    <th className="py-3.5 px-4 text-right">Score</th>
                    <th className="py-3.5 px-4 text-right">Percentage</th>
                    <th className="py-3.5 px-4">Outcome</th>
                    <th className="py-3.5 px-5 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {results.map((r) => (
                    <tr key={r.attemptId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{r.quizTitle}</td>
                      <td className="py-3.5 px-4 text-slate-600">{r.category}</td>
                      <td className="py-3.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {r.submittedAt
                          ? new Date(r.submittedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                        {r.score} / {r.totalMarks}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {r.percentage}%
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {r.passed ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                            <XCircle className="w-3.5 h-3.5" />
                            Not Passed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onInspectResult(r.attemptId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
