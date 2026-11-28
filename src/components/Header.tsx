import type { User } from '../types';

export type ActiveTab =
  | 'auth'
  | 'quizzes'
  | 'my-results'
  | 'leaderboard'
  | 'feedback'
  | 'profile'
  | 'admin-reports'
  | 'admin-quizzes';

interface HeaderProps {
  user: User | null;
  activeTab: ActiveTab;
  inActiveAttempt: boolean;
  onNavigate: (tab: ActiveTab) => void;
  onLogout: () => void;
}

export function Header({
  user,
  activeTab,
  inActiveAttempt,
  onNavigate,
  onLogout,
}: HeaderProps) {
  const navItems: Array<{ id: ActiveTab; label: string }> = user
    ? user.role === 'admin'
      ? [
          { id: 'admin-reports', label: 'Reports' },
          { id: 'admin-quizzes', label: 'Manage Quizzes' },
          { id: 'quizzes', label: 'Take Quiz' },
          { id: 'leaderboard', label: 'Leaderboard' },
          { id: 'profile', label: 'Profile' },
        ]
      : [
          { id: 'quizzes', label: 'Quizzes' },
          { id: 'my-results', label: 'My Results' },
          { id: 'leaderboard', label: 'Leaderboard' },
          { id: 'feedback', label: 'Feedback' },
          { id: 'profile', label: 'Profile' },
        ]
    : [{ id: 'auth', label: 'Sign In' }];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          disabled={inActiveAttempt}
          onClick={() =>
            onNavigate(user ? (user.role === 'admin' ? 'admin-reports' : 'quizzes') : 'auth')
          }
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        >
          QuizLab
        </button>

        <nav className="flex items-center gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={inActiveAttempt}
                onClick={() => onNavigate(item.id)}
                className={`py-5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              disabled={inActiveAttempt}
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
