import type {
  AdminFeedbackResponse,
  AdminReports,
  AdminStatus,
  AdminUserRecord,
  AttemptStart,
  FeedbackRecord,
  FeedbackTopic,
  Question,
  Quiz,
  QuizDifficulty,
  QuizLeaderboard,
  QuizResultDetail,
  QuizResultSummary,
  User,
  UserProfileStats,
} from './types';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message =
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  getAdminStatus(): Promise<AdminStatus> {
    return apiRequest('/api/auth/admin-status');
  },

  claimAdmin(payload: {
    name: string;
    email: string;
    username: string;
    password: string;
  }): Promise<{ token: string; user: User }> {
    return apiRequest('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  register(payload: {
    name: string;
    email: string;
    username: string;
    password: string;
  }): Promise<{ token: string; user: User }> {
    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: {
    identifier: string;
    password: string;
    roleIntent: 'student' | 'admin';
  }): Promise<{ token: string; user: User }> {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return apiRequest('/api/auth/logout', { method: 'POST' });
  },

  getQuizzes(): Promise<{ quizzes: Quiz[] }> {
    return apiRequest('/api/quizzes');
  },

  getQuizDetail(quizId: number): Promise<{ quiz: Quiz; questions: Question[] }> {
    return apiRequest(`/api/quizzes/${quizId}`);
  },

  createQuiz(payload: {
    title: string;
    description: string;
    category: string;
    difficulty: QuizDifficulty;
    durationMinutes: number;
    passingPercentage: number;
    isPublished: boolean;
  }): Promise<{ quiz: Quiz }> {
    return apiRequest('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateQuiz(
    quizId: number,
    payload: Partial<{
      title: string;
      description: string;
      category: string;
      difficulty: QuizDifficulty;
      durationMinutes: number;
      passingPercentage: number;
      isPublished: boolean;
    }>
  ): Promise<{ quiz: Quiz }> {
    return apiRequest(`/api/quizzes/${quizId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteQuiz(quizId: number): Promise<{ ok: boolean }> {
    return apiRequest(`/api/quizzes/${quizId}`, { method: 'DELETE' });
  },

  addQuestion(
    quizId: number,
    payload: {
      questionText: string;
      options: string[];
      correctOption: number;
      marks: number;
    }
  ): Promise<{ question: Question }> {
    return apiRequest(`/api/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateQuestion(
    questionId: number,
    payload: {
      questionText: string;
      options: string[];
      correctOption: number;
      marks: number;
    }
  ): Promise<{ question: Question }> {
    return apiRequest(`/api/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteQuestion(questionId: number): Promise<{ ok: boolean }> {
    return apiRequest(`/api/questions/${questionId}`, { method: 'DELETE' });
  },

  startQuizAttempt(quizId: number): Promise<AttemptStart> {
    return apiRequest(`/api/quizzes/${quizId}/start`, { method: 'POST' });
  },

  submitAttempt(
    attemptId: number,
    payload: { answers: Record<string, number>; autoSubmitted?: boolean }
  ): Promise<{ result: QuizResultDetail }> {
    return apiRequest(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyResults(): Promise<{ results: QuizResultSummary[] }> {
    return apiRequest('/api/results/me');
  },

  getResultDetail(attemptId: number): Promise<{ result: QuizResultDetail }> {
    return apiRequest(`/api/results/${attemptId}`);
  },

  getLeaderboard(): Promise<{ leaderboards: QuizLeaderboard[] }> {
    return apiRequest('/api/leaderboard');
  },

  getMyFeedback(): Promise<{ feedback: FeedbackRecord[] }> {
    return apiRequest('/api/feedback/me');
  },

  submitFeedback(payload: {
    quizId?: number | null;
    attemptId?: number | null;
    rating: number;
    topic: FeedbackTopic;
    comment: string;
  }): Promise<{ feedback: FeedbackRecord }> {
    return apiRequest('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAdminFeedback(): Promise<AdminFeedbackResponse> {
    return apiRequest('/api/admin/feedback');
  },

  getProfile(): Promise<{ user: User; stats: UserProfileStats }> {
    return apiRequest('/api/profile');
  },

  updateProfile(payload: { name: string; avatarUrl: string | null }): Promise<{ user: User }> {
    return apiRequest('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getAdminUsers(): Promise<{ users: AdminUserRecord[] }> {
    return apiRequest('/api/admin/users');
  },

  getAdminReports(): Promise<AdminReports> {
    return apiRequest('/api/admin/reports');
  },

  async downloadReportsCsv(): Promise<string> {
    const headers: Record<string, string> = {};
    if (memoryToken) {
      headers['Authorization'] = `Bearer ${memoryToken}`;
    }
    const response = await fetch('/api/admin/reports/csv', { headers });
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      throw new Error(
        data && typeof data.error === 'string'
          ? data.error
          : `CSV export failed with status ${response.status}`
      );
    }
    return response.text();
  },

  exportBackup(): Promise<unknown> {
    return apiRequest('/api/admin/backup');
  },

  restoreBackup(payload: unknown): Promise<{ restoredQuizzes: number; restoredQuestions: number }> {
    return apiRequest('/api/admin/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
