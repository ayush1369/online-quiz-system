import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  Plus,
  Star,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import type {
  AdminFeedbackResponse,
  AdminReports,
  AdminUserRecord,
  Question,
  Quiz,
  QuizDifficulty,
} from '../types';

export type AdminSubTab = 'reports' | 'quizzes' | 'users' | 'feedback' | 'backup';

const PRESET_CATEGORIES = [
  'Programming',
  'Mathematics',
  'Science',
  'Computer Science',
  'Software Engineering',
  'Systems & Web',
  'General',
] as const;

const CUSTOM_CATEGORY_VALUE = '__custom__';

interface AdminDashboardProps {
  initialSection: 'reports' | 'quizzes';
  onInspectAttempt: (attemptId: number) => void;
  onQuizzesChanged: () => void;
}

export function AdminDashboard({
  initialSection,
  onInspectAttempt,
  onQuizzesChanged,
}: AdminDashboardProps) {
  const [subTab, setSubTab] = useState<AdminSubTab>(initialSection);

  useEffect(() => {
    setSubTab(initialSection);
  }, [initialSection]);

  // Reports & Users state
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingReports, setLoadingReports] = useState(false);

  // Quizzes & Questions management state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  // Quiz form modal/panel state
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizCategoryPreset, setQuizCategoryPreset] = useState<string>('Programming');
  const [quizCustomCategory, setQuizCustomCategory] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>('Medium');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizDuration, setQuizDuration] = useState(10);
  const [quizPassing, setQuizPassing] = useState(60);
  const [quizPublished, setQuizPublished] = useState(true);

  // Question form state
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [qMarks, setQMarks] = useState(2);

  // Delete confirmation state (no window.confirm)
  const [confirmDeleteQuizId, setConfirmDeleteQuizId] = useState<number | null>(null);
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<number | null>(null);

  // Feedback & Backup state
  const [adminFeedback, setAdminFeedback] = useState<AdminFeedbackResponse | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadReportsAndUsers = useCallback(async () => {
    setLoadingReports(true);
    setError(null);
    try {
      const [repRes, usrRes] = await Promise.all([api.getAdminReports(), api.getAdminUsers()]);
      setReports(repRes);
      setUsers(usrRes.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const loadQuizzes = useCallback(async () => {
    setLoadingQuizzes(true);
    setError(null);
    try {
      const res = await api.getQuizzes();
      setQuizzes(res.quizzes);
      if (res.quizzes.length > 0 && selectedQuizId === null) {
        setSelectedQuizId(res.quizzes[0].id);
      } else if (
        selectedQuizId !== null &&
        !res.quizzes.some((q) => q.id === selectedQuizId)
      ) {
        setSelectedQuizId(res.quizzes[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quizzes.');
    } finally {
      setLoadingQuizzes(false);
    }
  }, [selectedQuizId]);

  const loadQuizQuestions = useCallback(async (quizId: number) => {
    try {
      const res = await api.getQuizDetail(quizId);
      setQuestions(res.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions.');
    }
  }, []);

  const loadAdminFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    setError(null);
    try {
      const res = await api.getAdminFeedback();
      setAdminFeedback(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student feedback.');
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'reports' || subTab === 'users') {
      loadReportsAndUsers();
    } else if (subTab === 'quizzes') {
      loadQuizzes();
    } else if (subTab === 'feedback') {
      loadAdminFeedback();
    }
  }, [subTab, loadReportsAndUsers, loadQuizzes, loadAdminFeedback]);

  useEffect(() => {
    if (subTab === 'quizzes' && selectedQuizId !== null) {
      loadQuizQuestions(selectedQuizId);
    } else {
      setQuestions([]);
    }
  }, [subTab, selectedQuizId, loadQuizQuestions]);

  const openCreateQuiz = () => {
    setEditingQuizId(null);
    setQuizTitle('');
    setQuizCategoryPreset('Programming');
    setQuizCustomCategory('');
    setQuizDifficulty('Medium');
    setQuizDescription('');
    setQuizDuration(10);
    setQuizPassing(60);
    setQuizPublished(true);
    setShowQuizForm(true);
    setError(null);
  };

  const openEditQuiz = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setQuizTitle(quiz.title);
    const isPreset = (PRESET_CATEGORIES as readonly string[]).includes(quiz.category);
    if (isPreset) {
      setQuizCategoryPreset(quiz.category);
      setQuizCustomCategory('');
    } else {
      setQuizCategoryPreset(CUSTOM_CATEGORY_VALUE);
      setQuizCustomCategory(quiz.category);
    }
    setQuizDifficulty(quiz.difficulty ?? 'Medium');
    setQuizDescription(quiz.description);
    setQuizDuration(quiz.durationMinutes);
    setQuizPassing(quiz.passingPercentage);
    setQuizPublished(quiz.isPublished);
    setShowQuizForm(true);
    setError(null);
  };

  const handleSaveQuiz = async (e: FormEvent) => {
    e.preventDefault();
    const resolvedCategory =
      quizCategoryPreset === CUSTOM_CATEGORY_VALUE
        ? quizCustomCategory.trim()
        : quizCategoryPreset;

    if (resolvedCategory.length < 2 || resolvedCategory.length > 60) {
      setError('Category must be between 2 and 60 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      if (editingQuizId === null) {
        const res = await api.createQuiz({
          title: quizTitle,
          description: quizDescription,
          category: resolvedCategory,
          difficulty: quizDifficulty,
          durationMinutes: Number(quizDuration),
          passingPercentage: Number(quizPassing),
          isPublished: quizPublished,
        });
        setSelectedQuizId(res.quiz.id);
        setStatusMessage(`Created quiz "${res.quiz.title}".`);
      } else {
        const res = await api.updateQuiz(editingQuizId, {
          title: quizTitle,
          description: quizDescription,
          category: resolvedCategory,
          difficulty: quizDifficulty,
          durationMinutes: Number(quizDuration),
          passingPercentage: Number(quizPassing),
          isPublished: quizPublished,
        });
        setStatusMessage(`Updated quiz "${res.quiz.title}".`);
      }
      setShowQuizForm(false);
      await loadQuizzes();
      onQuizzesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save quiz.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    setSaving(true);
    setError(null);
    try {
      await api.deleteQuiz(quizId);
      setConfirmDeleteQuizId(null);
      if (selectedQuizId === quizId) {
        setSelectedQuizId(null);
      }
      setStatusMessage('Quiz deleted.');
      await loadQuizzes();
      onQuizzesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete quiz.');
    } finally {
      setSaving(false);
    }
  };

  const openCreateQuestion = () => {
    setEditingQuestionId(null);
    setQText('');
    setQOptions(['', '', '', '']);
    setQCorrect(0);
    setQMarks(2);
    setShowQuestionForm(true);
    setError(null);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQText(q.questionText);
    setQOptions([
      q.options[0] ?? '',
      q.options[1] ?? '',
      q.options[2] ?? '',
      q.options[3] ?? '',
    ]);
    setQCorrect(q.correctOption ?? 0);
    setQMarks(q.marks);
    setShowQuestionForm(true);
    setError(null);
  };

  const handleSaveQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedQuizId === null) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      if (editingQuestionId === null) {
        await api.addQuestion(selectedQuizId, {
          questionText: qText,
          options: qOptions,
          correctOption: qCorrect,
          marks: Number(qMarks),
        });
        setStatusMessage('Question added to quiz.');
      } else {
        await api.updateQuestion(editingQuestionId, {
          questionText: qText,
          options: qOptions,
          correctOption: qCorrect,
          marks: Number(qMarks),
        });
        setStatusMessage('Question updated.');
      }
      setShowQuestionForm(false);
      await Promise.all([loadQuizQuestions(selectedQuizId), loadQuizzes()]);
      onQuizzesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (selectedQuizId === null) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteQuestion(questionId);
      setConfirmDeleteQuestionId(null);
      setStatusMessage('Question deleted.');
      await Promise.all([loadQuizQuestions(selectedQuizId), loadQuizzes()]);
      onQuizzesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    setError(null);
    setStatusMessage(null);
    try {
      const snapshot = await api.exportBackup();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `quizlab-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusMessage('Backup JSON exported successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup export failed.');
    }
  };

  const handleDownloadCsv = async () => {
    setExportingCsv(true);
    setError(null);
    setStatusMessage(null);
    try {
      const csvText = await api.downloadReportsCsv();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `quizlab-performance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusMessage('Student performance report CSV downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.restoreBackup(parsed);
      setStatusMessage(
        `Restored ${res.restoredQuizzes} quizzes and ${res.restoredQuestions} questions from backup.`
      );
      await loadQuizzes();
      onQuizzesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid backup file.');
    } finally {
      setSaving(false);
    }
  };

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) ?? null;
  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Administrator Console
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Manage quizzes, questions, registered users, performance analytics, and system backups.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Administrator sections"
          className="inline-flex flex-wrap p-1 bg-slate-100 rounded-lg gap-1"
        >
          {(
            [
              { id: 'reports', label: 'Performance Reports' },
              { id: 'quizzes', label: 'Quizzes & Questions' },
              { id: 'users', label: 'Registered Users' },
              { id: 'feedback', label: 'Student Feedback' },
              { id: 'backup', label: 'Backup & Recovery' },
            ] as Array<{ id: AdminSubTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              onClick={() => {
                setSubTab(tab.id);
                setError(null);
                setStatusMessage(null);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="mt-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* TAB 1: PERFORMANCE REPORTS (FR13) */}
      {subTab === 'reports' && (
        <div className="mt-8 space-y-8">
          {loadingReports || !reports ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-slate-200 rounded-xl p-6 h-28 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Student Performance Overview
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Summary metrics and attempt records across all published and draft quizzes.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={exportingCsv}
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                >
                  <Download className="w-4 h-4" />
                  {exportingCsv ? 'Exporting CSV...' : 'Download CSV'}
                </button>
              </div>

              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-slate-500">Registered Students</div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {reports.summary.totalStudents}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-slate-500">Total Quizzes</div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {reports.summary.totalQuizzes}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-slate-500">Submitted Attempts</div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {reports.summary.totalAttempts}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-slate-500">
                    Avg Score / Pass Rate
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {reports.summary.averagePercentage}%{' '}
                    <span className="text-sm font-normal text-slate-500">
                      ({reports.summary.passRate}% pass)
                    </span>
                  </div>
                </div>
              </section>

              {/* Per-Quiz Performance Breakdown */}
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-bold text-slate-900">Quiz Performance Summary</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-6">Quiz Title</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Attempts</th>
                        <th className="py-3 px-4 text-right">Avg Score</th>
                        <th className="py-3 px-4 text-right">Highest</th>
                        <th className="py-3 px-6 text-right">Passed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {reports.quizStats.map((qs) => (
                        <tr key={qs.quizId} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-6 font-semibold text-slate-900">{qs.title}</td>
                          <td className="py-3.5 px-4 text-slate-600">{qs.category}</td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {qs.attemptCount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {qs.averagePercentage}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {qs.highestPercentage}%
                          </td>
                          <td className="py-3.5 px-6 text-right font-mono tabular-nums">
                            {qs.passCount} / {qs.attemptCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Recent Student Submissions */}
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-bold text-slate-900">Recent Quiz Submissions</h2>
                </div>
                {reports.recentAttempts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No student quiz attempts have been submitted yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-6">Student</th>
                          <th className="py-3 px-4">Quiz</th>
                          <th className="py-3 px-4">Submitted</th>
                          <th className="py-3 px-4 text-right">Score</th>
                          <th className="py-3 px-4">Outcome</th>
                          <th className="py-3 px-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {reports.recentAttempts.map((ra) => (
                          <tr key={ra.attemptId} className="hover:bg-slate-50/70">
                            <td className="py-3 px-6">
                              <div className="font-semibold text-slate-900">{ra.userName}</div>
                              <div className="text-xs font-mono text-slate-500">@{ra.username}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">{ra.quizTitle}</td>
                            <td className="py-3 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                              {new Date(ra.submittedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {ra.score}/{ra.totalMarks} ({ra.percentage}%)
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {ra.passed ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Not Passed
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-6 text-right">
                              <button
                                type="button"
                                onClick={() => onInspectAttempt(ra.attemptId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* TAB 2: MANAGE QUIZZES & QUESTIONS (FR4, FR5) */}
      {subTab === 'quizzes' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Quiz List Sidebar */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-slate-900">Quizzes ({quizzes.length})</h2>
              <button
                type="button"
                onClick={openCreateQuiz}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                New Quiz
              </button>
            </div>

            {loadingQuizzes ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : quizzes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No quizzes created yet. Click &ldquo;New Quiz&rdquo; to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {quizzes.map((quiz) => {
                  const isSelected = quiz.id === selectedQuizId;
                  return (
                    <div
                      key={quiz.id}
                      className={`p-4 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuizId(quiz.id);
                            setShowQuestionForm(false);
                          }}
                          className="text-left flex-1 cursor-pointer"
                        >
                          <div className="font-semibold text-sm text-slate-900">{quiz.title}</div>
                          <div className="mt-1 text-xs text-slate-500 tabular-nums">
                            {quiz.category} · {quiz.difficulty} · {quiz.questionCount} questions ·{' '}
                            {quiz.durationMinutes} min · {quiz.isPublished ? 'Published' : 'Draft'}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditQuiz(quiz)}
                            aria-label={`Edit ${quiz.title}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteQuizId(quiz.id)}
                            aria-label={`Delete ${quiz.title}`}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {confirmDeleteQuizId === quiz.id && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                          <span className="text-red-900 font-medium">
                            Delete this quiz and all its questions?
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteQuizId(null)}
                              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleDeleteQuiz(quiz.id)}
                              className="px-2.5 py-1 bg-red-700 text-white rounded font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Question Bank Editor */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {selectedQuiz ? (
              <>
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{selectedQuiz.title}</h2>
                    <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {selectedQuiz.category} · {selectedQuiz.difficulty} · {questions.length}{' '}
                      questions · {selectedQuiz.totalMarks} total marks ·{' '}
                      {selectedQuiz.passingPercentage}% passing
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateQuestion}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Question
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No questions in this quiz yet. Add at least one question before publishing to
                    students.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-xs font-mono text-slate-500 tabular-nums">
                              Q{idx + 1} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {q.questionText}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditQuestion(q)}
                              aria-label={`Edit question ${idx + 1}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteQuestionId(q.id)}
                              aria-label={`Delete question ${idx + 1}`}
                              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {q.options.map((opt, optIdx) => {
                            const isKey = q.correctOption === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 ${
                                  isKey
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span>
                                  <strong className="font-mono mr-1.5">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </strong>
                                  {opt}
                                </span>
                                {isKey && (
                                  <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {confirmDeleteQuestionId === q.id && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                            <span className="text-red-900 font-medium">
                              Delete this question permanently?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteQuestionId(null)}
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="px-2.5 py-1 bg-red-700 text-white rounded font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-10 text-center text-sm text-slate-500">
                Select a quiz from the left panel to add or edit its questions.
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: REGISTERED USERS (FR1, FR13) */}
      {subTab === 'users' && (
        <section className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900">
              Registered Users ({filteredUsers.length})
            </h2>
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search name, username, or email..."
              aria-label="Search registered users"
              className="w-full sm:w-64 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Attempts</th>
                  <th className="py-3 px-4 text-right">Avg Score</th>
                  <th className="py-3 px-6 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">@{u.username}</td>
                    <td className="py-3.5 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3.5 px-4 capitalize text-slate-700">{u.role}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {u.attemptCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {u.averagePercentage}%
                    </td>
                    <td className="py-3.5 px-6 text-right text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: STUDENT FEEDBACK */}
      {subTab === 'feedback' && (
        <div className="mt-8 space-y-6">
          {loadingFeedback || !adminFeedback ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="bg-white border border-slate-200 rounded-xl p-5 h-24 animate-pulse"
                  />
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 h-48 animate-pulse" />
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-slate-500">Total Feedback Entries</div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {adminFeedback.summary.totalCount}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-slate-500">Average Rating</div>
                  <div className="mt-2 flex items-center gap-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    <span>{adminFeedback.summary.averageRating} / 5</span>
                    <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                  </div>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-base font-bold text-slate-900">Submitted Feedback</h2>
                  <select
                    aria-label="Filter feedback by rating"
                    value={feedbackRatingFilter}
                    onChange={(e) => setFeedbackRatingFilter(e.target.value)}
                    className="w-full sm:w-44 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="all">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>

                {(() => {
                  const filtered = adminFeedback.feedback.filter((item) =>
                    feedbackRatingFilter === 'all'
                      ? true
                      : item.rating === Number(feedbackRatingFilter)
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="p-10 text-center text-sm text-slate-500">
                        No student feedback entries match the current filter.
                      </div>
                    );
                  }
                  return (
                    <div className="divide-y divide-slate-200">
                      {filtered.map((item) => (
                        <article key={item.id} className="p-6">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">
                                  {item.userName}
                                </span>
                                <span className="text-xs font-mono text-slate-500">
                                  @{item.username}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="text-xs font-medium text-slate-700">
                                  {item.quizTitle ?? 'General Platform Feedback'}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="text-xs text-slate-500">{item.topic}</span>
                              </div>
                              <p className="mt-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                {item.comment}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div
                                className="flex items-center gap-0.5"
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
                              <span className="text-xs text-slate-400 tabular-nums">
                                {new Date(item.createdAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  );
                })()}
              </section>
            </>
          )}
        </div>
      )}

      {/* TAB 5: BACKUP & RECOVERY (NFR10) */}
      {subTab === 'backup' && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Export Quiz Bank Backup</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Download a complete JSON snapshot of all quizzes, answer options, marks, and correct
                keys stored in the SQLite database for archival or migration.
              </p>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Backup JSON
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Restore From Backup File</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Import a previously exported QuizLab JSON backup file. All quizzes and questions in
                the file are validated inside an atomic database transaction before insertion.
              </p>
            </div>
            <div className="mt-6">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{saving ? 'Restoring...' : 'Select Backup JSON File'}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={saving}
                  onChange={handleRestoreFile}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {/* QUIZ CREATE/EDIT MODAL */}
      {showQuizForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quiz-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6">
            <h2 id="quiz-modal-title" className="text-lg font-bold text-slate-900">
              {editingQuizId === null ? 'Create New Quiz' : 'Edit Quiz'}
            </h2>
            <form onSubmit={handleSaveQuiz} className="mt-5 space-y-4">
              <div>
                <label htmlFor="quiz-title" className="block text-sm font-medium text-slate-700 mb-1">
                  Quiz Title
                </label>
                <input
                  id="quiz-title"
                  type="text"
                  required
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="quiz-category"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="quiz-category"
                    value={quizCategoryPreset}
                    onChange={(e) => setQuizCategoryPreset(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>Custom category...</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="quiz-difficulty"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Difficulty Level
                  </label>
                  <select
                    id="quiz-difficulty"
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value as QuizDifficulty)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>
              {quizCategoryPreset === CUSTOM_CATEGORY_VALUE && (
                <div>
                  <label
                    htmlFor="quiz-custom-category"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Custom Category Name
                  </label>
                  <input
                    id="quiz-custom-category"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    placeholder="e.g., History, Economics, Literature"
                    value={quizCustomCategory}
                    onChange={(e) => setQuizCustomCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="quiz-desc"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="quiz-desc"
                  required
                  rows={3}
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="quiz-duration"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Duration (minutes)
                  </label>
                  <input
                    id="quiz-duration"
                    type="number"
                    min={1}
                    max={180}
                    required
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="quiz-passing"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Passing (%)
                  </label>
                  <input
                    id="quiz-passing"
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={quizPassing}
                    onChange={(e) => setQuizPassing(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quizPublished}
                  onChange={(e) => setQuizPublished(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Publish quiz to students immediately</span>
              </label>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuizForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingQuizId === null ? 'Create Quiz' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUESTION CREATE/EDIT MODAL */}
      {showQuestionForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 id="question-modal-title" className="text-lg font-bold text-slate-900">
              {editingQuestionId === null ? 'Add Multiple-Choice Question' : 'Edit Question'}
            </h2>
            <form onSubmit={handleSaveQuestion} className="mt-5 space-y-4">
              <div>
                <label htmlFor="q-text" className="block text-sm font-medium text-slate-700 mb-1">
                  Question Prompt
                </label>
                <textarea
                  id="q-text"
                  required
                  rows={2}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-2.5">
                <div className="text-sm font-medium text-slate-700">
                  Answer Options (select the radio button for the correct answer)
                </div>
                {qOptions.map((optVal, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={qCorrect === idx}
                      onChange={() => setQCorrect(idx)}
                      aria-label={`Mark Option ${String.fromCharCode(65 + idx)} as correct`}
                      className="w-4 h-4 text-blue-700 focus:ring-blue-600 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-semibold text-slate-500 w-5">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <input
                      type="text"
                      required
                      value={optVal}
                      onChange={(e) => {
                        const next = [...qOptions] as [string, string, string, string];
                        next[idx] = e.target.value;
                        setQOptions(next);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                ))}
              </div>

              <div className="w-36">
                <label htmlFor="q-marks" className="block text-sm font-medium text-slate-700 mb-1">
                  Marks
                </label>
                <input
                  id="q-marks"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={qMarks}
                  onChange={(e) => setQMarks(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuestionForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : editingQuestionId === null
                    ? 'Add Question'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
