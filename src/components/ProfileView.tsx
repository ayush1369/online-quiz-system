import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import type { User, UserProfileStats } from '../types';

interface ProfileViewProps {
  user: User;
  stats: UserProfileStats | null;
  loading: boolean;
  error: string | null;
  onUserUpdated: (updated: User) => void;
  onBrowseQuizzes: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileView({
  user,
  stats,
  loading,
  error,
  onUserUpdated,
  onBrowseQuizzes,
}: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl ?? '');
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user.name);
    setAvatarUrl(user.avatarUrl ?? '');
    setImgLoadFailed(false);
  }, [user]);

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSaveError(null);
    setSaveSuccess(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
      setImgLoadFailed(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await api.updateProfile({
        name: displayName.trim(),
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      onUserUpdated(res.user);
      setSaveSuccess('Profile updated successfully.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const isDataUrl = avatarUrl.startsWith('data:image/');
  const showAvatarImg = Boolean(avatarUrl.trim()) && !imgLoadFailed;

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Student Profile
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Update your display name and profile picture, and track your total points earned across
            all quizzes.
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

      {/* Total Points & Quiz Summary Strip */}
      {loading || !stats ? (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200 rounded-xl p-5 h-24 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Total Points Earned</div>
            <div className="mt-2 font-mono text-2xl font-bold text-blue-700 tabular-nums">
              {stats.totalPointsEarned}{' '}
              <span className="text-sm font-normal text-slate-500">
                / {stats.totalPossiblePoints}
              </span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Quizzes Completed</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {stats.quizzesCompleted}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Average Score</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {stats.averagePercentage}%
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Quizzes Passed</div>
            <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
              {stats.quizzesPassed}{' '}
              <span className="text-sm font-normal text-slate-500">
                (Best {stats.highestPercentage}%)
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Profile Settings Card */}
      <section className="mt-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-slate-100">
          {showAvatarImg ? (
            <img
              src={avatarUrl}
              alt={`${displayName || user.name} profile picture`}
              referrerPolicy="no-referrer"
              onError={() => setImgLoadFailed(true)}
              className="w-22 h-22 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
            />
          ) : (
            <div
              aria-label="Profile initials"
              className="w-22 h-22 rounded-xl bg-slate-900 text-white font-display text-2xl font-bold flex items-center justify-center shrink-0"
            >
              {getInitials(displayName || user.name)}
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">@{user.username}</span>
              <span aria-hidden="true">·</span>
              <span>{user.email}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{user.role}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileSelected}
                  className="sr-only"
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('');
                    setImgLoadFailed(false);
                    setSaveSuccess(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {saveError && (
          <div
            role="alert"
            className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div
            role="status"
            className="mt-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1">
              Display Name
            </label>
            <input
              id="profile-name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="profile-avatar-url"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Profile Picture URL (optional)
            </label>
            <input
              id="profile-avatar-url"
              type="url"
              value={isDataUrl ? '' : avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                setImgLoadFailed(false);
              }}
              placeholder={
                isDataUrl
                  ? 'Uploaded photo ready to save (or paste an https:// URL to replace)'
                  : 'https://example.com/avatar.jpg'
              }
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              Member since{' '}
              {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
