import { useCallback, useEffect, useState } from 'react';
import { api, setAuthToken } from './api';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthView } from './components/AuthView';
import { FeedbackView } from './components/FeedbackView';
import { Header } from './components/Header';
import type { ActiveTab } from './components/Header';
import { LeaderboardView } from './components/LeaderboardView';
import { MyResultsView } from './components/MyResultsView';
import { ProfileView } from './components/ProfileView';
import { QuizCatalog } from './components/QuizCatalog';
import { QuizRunner } from './components/QuizRunner';
import { ResultView } from './components/ResultView';
import type {
  AttemptStart,
  FeedbackRecord,
  Quiz,
  QuizLeaderboard,
  QuizResultDetail,
  QuizResultSummary,
  User,
  UserProfileStats,
} from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('auth');

  // Quiz catalog state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Active attempt & result state
  const [activeAttempt, setActiveAttempt] = useState<AttemptStart | null>(null);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [inspectedResult, setInspectedResult] = useState<QuizResultDetail | null>(null);
  const [resultReturnTab, setResultReturnTab] = useState<ActiveTab>('quizzes');

  // Student past results
  const [myResults, setMyResults] = useState<QuizResultSummary[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  // Global leaderboard
  const [leaderboards, setLeaderboards] = useState<QuizLeaderboard[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  // User profile & points overview
  const [profileStats, setProfileStats] = useState<UserProfileStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Student feedback
  const [myFeedback, setMyFeedback] = useState<FeedbackRecord[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const loadQuizzes = useCallback(async () => {
    setLoadingQuizzes(true);
    setCatalogError(null);
    try {
      const res = await api.getQuizzes();
      setQuizzes(res.quizzes);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Failed to load quizzes.');
    } finally {
      setLoadingQuizzes(false);
    }
  }, []);

  const loadMyResults = useCallback(async () => {
    setLoadingResults(true);
    setResultsError(null);
    try {
      const res = await api.getMyResults();
      setMyResults(res.results);
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : 'Failed to load quiz results.');
    } finally {
      setLoadingResults(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    setLeaderboardError(null);
    try {
      const res = await api.getLeaderboard();
      setLeaderboards(res.leaderboards);
    } catch (err) {
      setLeaderboardError(err instanceof Error ? err.message : 'Failed to load leaderboard.');
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await api.getProfile();
      setProfileStats(res.stats);
      setUser(res.user);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const [fbRes, quizRes] = await Promise.all([api.getMyFeedback(), api.getQuizzes()]);
      setMyFeedback(fbRes.feedback);
      setQuizzes(quizRes.quizzes);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to load feedback.');
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'quizzes') {
      loadQuizzes();
    } else if (activeTab === 'my-results') {
      loadMyResults();
    } else if (activeTab === 'leaderboard') {
      loadLeaderboard();
    } else if (activeTab === 'feedback') {
      loadFeedback();
    } else if (activeTab === 'profile') {
      loadProfile();
    }
  }, [user, activeTab, loadQuizzes, loadMyResults, loadLeaderboard, loadFeedback, loadProfile]);

  const handleAuthenticated = (token: string, loggedInUser: User) => {
    setAuthToken(token);
    setUser(loggedInUser);
    setInspectedResult(null);
    setActiveAttempt(null);
    setActiveTab(loggedInUser.role === 'admin' ? 'admin-reports' : 'quizzes');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on token revocation and still clear client session
    }
    setAuthToken(null);
    setUser(null);
    setActiveAttempt(null);
    setInspectedResult(null);
    setQuizzes([]);
    setMyResults([]);
    setLeaderboards([]);
    setMyFeedback([]);
    setFeedbackError(null);
    setProfileStats(null);
    setProfileError(null);
    setActiveTab('auth');
  };

  const handleNavigate = (tab: ActiveTab) => {
    if (activeAttempt) return;
    setInspectedResult(null);
    setActiveTab(tab);
  };

  const handleStartQuiz = async (quizId: number) => {
    setStartingQuizId(quizId);
    setCatalogError(null);
    setAttemptError(null);
    try {
      const started = await api.startQuizAttempt(quizId);
      setInspectedResult(null);
      setActiveAttempt(started);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Unable to start quiz.');
    } finally {
      setStartingQuizId(null);
    }
  };

  const handleSubmitAttempt = useCallback(
    async (answers: Record<string, number>, autoSubmitted: boolean) => {
      if (!activeAttempt) return;
      setSubmittingAttempt(true);
      setAttemptError(null);
      try {
        const res = await api.submitAttempt(activeAttempt.attemptId, {
          answers,
          autoSubmitted,
        });
        setActiveAttempt(null);
        setResultReturnTab('quizzes');
        setInspectedResult(res.result);
      } catch (err) {
        setAttemptError(err instanceof Error ? err.message : 'Failed to submit quiz.');
      } finally {
        setSubmittingAttempt(false);
      }
    },
    [activeAttempt]
  );

  const handleInspectResult = async (attemptId: number, returnTo: ActiveTab) => {
    try {
      const res = await api.getResultDetail(attemptId);
      setResultReturnTab(returnTo);
      setInspectedResult(res.result);
    } catch (err) {
      if (returnTo === 'my-results') {
        setResultsError(err instanceof Error ? err.message : 'Unable to load result.');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        user={user}
        activeTab={activeTab}
        inActiveAttempt={Boolean(activeAttempt)}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <div className="flex-1">
        {activeAttempt ? (
          <QuizRunner
            attempt={activeAttempt}
            submitting={submittingAttempt}
            error={attemptError}
            onSubmit={handleSubmitAttempt}
          />
        ) : inspectedResult ? (
          <ResultView
            result={inspectedResult}
            allowFeedback={resultReturnTab !== 'admin-reports'}
            backLabel={
              resultReturnTab === 'admin-reports'
                ? 'Back to Performance Reports'
                : resultReturnTab === 'my-results'
                ? 'Back to My Results'
                : 'Back to Quizzes'
            }
            onBack={() => {
              setInspectedResult(null);
              setActiveTab(resultReturnTab);
            }}
          />
        ) : !user ? (
          <AuthView onAuthenticated={handleAuthenticated} />
        ) : activeTab === 'quizzes' ? (
          <QuizCatalog
            quizzes={quizzes}
            loading={loadingQuizzes}
            startingQuizId={startingQuizId}
            error={catalogError}
            onStartQuiz={handleStartQuiz}
          />
        ) : activeTab === 'my-results' ? (
          <MyResultsView
            results={myResults}
            loading={loadingResults}
            error={resultsError}
            onInspectResult={(attemptId) => handleInspectResult(attemptId, 'my-results')}
            onBrowseQuizzes={() => setActiveTab('quizzes')}
          />
        ) : activeTab === 'leaderboard' ? (
          <LeaderboardView
            leaderboards={leaderboards}
            loading={loadingLeaderboard}
            error={leaderboardError}
            onBrowseQuizzes={() => setActiveTab('quizzes')}
          />
        ) : activeTab === 'feedback' ? (
          <FeedbackView
            quizzes={quizzes}
            feedbackList={myFeedback}
            loading={loadingFeedback}
            error={feedbackError}
            onFeedbackCreated={(created) => setMyFeedback((prev) => [created, ...prev])}
            onBrowseQuizzes={() => setActiveTab('quizzes')}
          />
        ) : activeTab === 'profile' ? (
          <ProfileView
            user={user}
            stats={profileStats}
            loading={loadingProfile}
            error={profileError}
            onUserUpdated={(updated) => setUser(updated)}
            onBrowseQuizzes={() => setActiveTab('quizzes')}
          />
        ) : user.role === 'admin' &&
          (activeTab === 'admin-reports' || activeTab === 'admin-quizzes') ? (
          <AdminDashboard
            initialSection={activeTab === 'admin-quizzes' ? 'quizzes' : 'reports'}
            onInspectAttempt={(attemptId) => handleInspectResult(attemptId, 'admin-reports')}
            onQuizzesChanged={loadQuizzes}
          />
        ) : (
          <QuizCatalog
            quizzes={quizzes}
            loading={loadingQuizzes}
            startingQuizId={startingQuizId}
            error={catalogError}
            onStartQuiz={handleStartQuiz}
          />
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-[1280px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>QuizLab Online Quiz System</span>
          <span>Timed Assessments &amp; Automated Evaluation</span>
        </div>
      </footer>
    </div>
  );
}
