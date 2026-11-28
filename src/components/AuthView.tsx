import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { AdminStatus, User } from '../types';

interface AuthViewProps {
  onAuthenticated: (token: string, user: User) => void;
}

type AuthMode = 'login' | 'register' | 'admin';

export function AuthView({ onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(false);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register / Claim Admin fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'admin') return;
    let cancelled = false;
    setLoadingAdminStatus(true);
    api
      .getAdminStatus()
      .then((status) => {
        if (!cancelled) {
          setAdminStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminStatus({ configured: true, viaEnv: false, claimed: true });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAdminStatus(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleModeSwitch = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        const res = await api.register({
          name,
          email,
          username,
          password: regPassword,
        });
        onAuthenticated(res.token, res.user);
      } else if (mode === 'login') {
        const res = await api.login({
          identifier,
          password,
          roleIntent: 'student',
        });
        onAuthenticated(res.token, res.user);
      } else if (mode === 'admin') {
        if (adminStatus && !adminStatus.configured) {
          const res = await api.claimAdmin({
            name,
            email,
            username,
            password: regPassword,
          });
          onAuthenticated(res.token, res.user);
        } else {
          const res = await api.login({
            identifier: adminStatus?.viaEnv ? 'admin' : identifier,
            password,
            roleIntent: 'admin',
          });
          onAuthenticated(res.token, res.user);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdminClaimFlow = mode === 'admin' && adminStatus !== null && !adminStatus.configured;

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-12 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
        {/* Left Product Overview */}
        <section className="lg:col-span-7 flex flex-col justify-center">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.15] max-w-2xl [text-wrap:balance]">
              Online Quiz &amp; Automated Assessment System
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-[65ch]">
              Create, manage, and take timed multiple-choice quizzes with instant server-verified
              evaluation, persistent score history, and detailed performance reporting.
            </p>

            <div className="mt-8 border-t border-slate-200 divide-y divide-slate-200">
              <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
                <span className="sm:col-span-4 text-xs font-semibold text-blue-700">
                  Role-Based Access
                </span>
                <span className="sm:col-span-8 text-sm text-slate-700">
                  Dedicated student registration, credential sign-in, and administrator controls.
                </span>
              </div>
              <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
                <span className="sm:col-span-4 text-xs font-semibold text-blue-700">
                  Timed Assessments
                </span>
                <span className="sm:col-span-8 text-sm text-slate-700">
                  Published quiz catalog with live countdown timers and automatic submission on
                  expiry.
                </span>
              </div>
              <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
                <span className="sm:col-span-4 text-xs font-semibold text-blue-700">
                  Grading &amp; Analytics
                </span>
                <span className="sm:col-span-8 text-sm text-slate-700">
                  Automatic answer evaluation, stored attempt history, performance reports, and JSON
                  backup recovery.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Authentication Form Panel */}
        <section className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 h-full flex flex-col justify-center">
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => handleModeSwitch('login')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Student Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => handleModeSwitch('register')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'admin'}
                onClick={() => handleModeSwitch('admin')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Administrator
              </button>
            </div>

            {mode === 'login' && (
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">Sign in to your account</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Access published quizzes, timed attempts, and past results.
                </p>
              </div>
            )}

            {mode === 'register' && (
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">Create a student account</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Register with your name, email, and username to attempt quizzes.
                </p>
              </div>
            )}

            {mode === 'admin' && (
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                  {isAdminClaimFlow ? 'Claim Administrator Account' : 'Administrator Sign In'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {loadingAdminStatus
                    ? 'Checking administrator configuration...'
                    : isAdminClaimFlow
                    ? 'No administrator account exists yet. Create the primary administrator credentials below.'
                    : adminStatus?.viaEnv
                    ? 'Enter the server administrator passcode to manage quizzes and reports.'
                    : 'Sign in with your administrator username or email and password.'}
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {(mode === 'register' || isAdminClaimFlow) && (
                <>
                  <div>
                    <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auth-username"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Username
                    </label>
                    <input
                      id="auth-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex_r"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auth-reg-password"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Password {isAdminClaimFlow ? '(min 8 characters)' : '(min 6 characters)'}
                    </label>
                    <input
                      id="auth-reg-password"
                      type="password"
                      required
                      minLength={isAdminClaimFlow ? 8 : 6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Enter a strong password"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </>
              )}

              {(mode === 'login' || (mode === 'admin' && !isAdminClaimFlow)) && (
                <>
                  {!(mode === 'admin' && adminStatus?.viaEnv) && (
                    <div>
                      <label
                        htmlFor="auth-identifier"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Username or Email
                      </label>
                      <input
                        id="auth-identifier"
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={mode === 'admin' ? 'admin username or email' : 'username or email'}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      />
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      {mode === 'admin' && adminStatus?.viaEnv ? 'Administrator Passcode' : 'Password'}
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting || (mode === 'admin' && loadingAdminStatus)}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? 'Please wait...'
                  : mode === 'register'
                  ? 'Register Account'
                  : isAdminClaimFlow
                  ? 'Create Administrator Account'
                  : mode === 'admin'
                  ? 'Sign In as Administrator'
                  : 'Sign In'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
