import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import type { Quiz, QuizDifficulty } from '../types';

function getDifficultyBadgeClass(difficulty: QuizDifficulty): string {
  switch (difficulty) {
    case 'Easy':
      return 'text-emerald-800 bg-emerald-50 border-emerald-200';
    case 'Hard':
      return 'text-red-800 bg-red-50 border-red-200';
    case 'Medium':
    default:
      return 'text-amber-800 bg-amber-50 border-amber-200';
  }
}

interface QuizCatalogProps {
  quizzes: Quiz[];
  loading: boolean;
  startingQuizId: number | null;
  error: string | null;
  onStartQuiz: (quizId: number) => void;
}

export function QuizCatalog({
  quizzes,
  loading,
  startingQuizId,
  error,
  onStartQuiz,
}: QuizCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of quizzes) {
      counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
    return [{ name: 'All', count: quizzes.length }, ...sorted];
  }, [quizzes]);

  useEffect(() => {
    if (
      selectedCategory !== 'All' &&
      !categories.some((c) => c.name === selectedCategory)
    ) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  const filteredQuizzes = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      const matchesCat = selectedCategory === 'All' || quiz.category === selectedCategory;
      const matchesSearch =
        !qLower ||
        quiz.title.toLowerCase().includes(qLower) ||
        quiz.description.toLowerCase().includes(qLower) ||
        quiz.category.toLowerCase().includes(qLower) ||
        quiz.difficulty.toLowerCase().includes(qLower);
      return matchesCat && matchesSearch;
    });
  }, [quizzes, searchQuery, selectedCategory]);

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Available Quizzes
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Select a published quiz below to begin a timed attempt with automatic server evaluation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or keyword..."
              aria-label="Search quizzes by title or keyword"
              className="w-full sm:w-72 pl-9 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        {!loading && quizzes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
            <span className="text-xs font-medium text-slate-500 mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                aria-pressed={selectedCategory === cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  selectedCategory === cat.name
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        {!loading && quizzes.length > 0 && (
          <span className="text-xs text-slate-500 tabular-nums">
            Showing {filteredQuizzes.length} of {quizzes.length}{' '}
            {quizzes.length === 1 ? 'quiz' : 'quizzes'}
          </span>
        )}
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
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200 rounded-xl p-6 h-56 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-12 bg-slate-100 rounded w-full" />
              </div>
              <div className="h-9 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="mt-10 bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No quizzes match your filter</h2>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing your search query or selecting a different category.
          </p>
          {(searchQuery || selectedCategory !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-5 px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => (
            <article
              key={quiz.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">{quiz.title}</h2>
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold border rounded-md whitespace-nowrap shrink-0 ${getDifficultyBadgeClass(
                      quiz.difficulty
                    )}`}
                  >
                    {quiz.difficulty}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                  <span>{quiz.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quiz.questionCount} Questions</span>
                  <span aria-hidden="true">·</span>
                  <span>{quiz.totalMarks} Marks</span>
                  <span aria-hidden="true">·</span>
                  <span>{quiz.passingPercentage}% Pass</span>
                </div>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {quiz.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-slate-600 tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{quiz.durationMinutes} min limit</span>
                </div>

                <button
                  type="button"
                  disabled={startingQuizId !== null || quiz.questionCount === 0}
                  onClick={() => onStartQuiz(quiz.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {startingQuizId === quiz.id ? 'Starting...' : 'Start Quiz'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
