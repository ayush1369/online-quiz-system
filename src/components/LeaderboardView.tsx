import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Clock, Trophy, XCircle } from 'lucide-react';
import type { QuizLeaderboard } from '../types';

interface LeaderboardViewProps {
  leaderboards: QuizLeaderboard[];
  loading: boolean;
  error: string | null;
  onBrowseQuizzes: () => void;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function LeaderboardView({
  leaderboards,
  loading,
  error,
  onBrowseQuizzes,
}: LeaderboardViewProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);

  useEffect(() => {
    if (leaderboards.length === 0) {
      setSelectedQuizId(null);
      return;
    }
    if (selectedQuizId === null || !leaderboards.some((lb) => lb.quizId === selectedQuizId)) {
      const withEntries = leaderboards.find((lb) => lb.entries.length > 0);
      setSelectedQuizId((withEntries ?? leaderboards[0]).quizId);
    }
  }, [leaderboards, selectedQuizId]);

  const activeBoard = leaderboards.find((lb) => lb.quizId === selectedQuizId) ?? null;

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Global Leaderboard
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Top performers for each quiz ranked by highest score and fastest completion time.
          </p>
        </div>

        <button
          type="button"
          onClick={onBrowseQuizzes}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          Attempt a Quiz
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
        <div className="mt-8 space-y-4">
          <div className="h-10 bg-slate-200 rounded-lg w-80 animate-pulse" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : leaderboards.length === 0 ? (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No published quizzes available</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rankings will appear once quizzes are published and completed.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Quiz Selector */}
          <div
            role="tablist"
            aria-label="Select quiz leaderboard"
            className="flex flex-wrap items-center gap-2"
          >
            {leaderboards.map((lb) => {
              const isSelected = lb.quizId === activeBoard?.quizId;
              return (
                <button
                  key={lb.quizId}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedQuizId(lb.quizId)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lb.quizTitle} ({lb.totalParticipants})
                </button>
              );
            })}
          </div>

          {activeBoard && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{activeBoard.quizTitle}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <span>{activeBoard.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeBoard.durationMinutes} min limit</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeBoard.passingPercentage}% pass threshold</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeBoard.totalParticipants}{' '}
                      {activeBoard.totalParticipants === 1 ? 'participant' : 'participants'}
                    </span>
                  </div>
                </div>

                {activeBoard.currentUserEntry && (
                  <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900 tabular-nums shrink-0">
                    Your best rank:{' '}
                    <span className="font-mono font-bold">
                      #{activeBoard.currentUserEntry.rank}
                    </span>{' '}
                    · {activeBoard.currentUserEntry.percentage}% in{' '}
                    {formatDuration(activeBoard.currentUserEntry.durationSeconds)}
                  </div>
                )}
              </div>

              {activeBoard.entries.length === 0 ? (
                <div className="p-12 text-center">
                  <Trophy className="w-8 h-8 text-slate-300 mx-auto" />
                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    No submissions yet for this quiz
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Be the first student to complete this quiz and set the benchmark time.
                  </p>
                  <button
                    type="button"
                    onClick={onBrowseQuizzes}
                    className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Go to Quizzes
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3.5 px-6 w-20">Rank</th>
                        <th className="py-3.5 px-4">Student</th>
                        <th className="py-3.5 px-4 text-right">Score</th>
                        <th className="py-3.5 px-4 text-right">Percentage</th>
                        <th className="py-3.5 px-4 text-right">Completion Time</th>
                        <th className="py-3.5 px-4">Outcome</th>
                        <th className="py-3.5 px-6 text-right">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {activeBoard.entries.map((entry) => (
                        <tr
                          key={entry.attemptId}
                          className={
                            entry.isCurrentUser
                              ? 'bg-blue-50/60 hover:bg-blue-50'
                              : 'hover:bg-slate-50/70'
                          }
                        >
                          <td className="py-3.5 px-6 font-mono font-bold tabular-nums text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              {entry.rank === 1 && (
                                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                              )}
                              <span>#{entry.rank}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {entry.userName}
                              {entry.isCurrentUser && (
                                <span className="ml-2 text-xs font-semibold text-blue-700">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              @{entry.username}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                            {entry.score} / {entry.totalMarks}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {entry.percentage}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {formatDuration(entry.durationSeconds)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {entry.passed ? (
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
                          <td className="py-3.5 px-6 text-right text-slate-500 tabular-nums whitespace-nowrap">
                            {new Date(entry.submittedAt).toLocaleDateString(undefined, {
                              dateStyle: 'medium',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
