export type UserRole = 'student' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AdminStatus {
  configured: boolean;
  viaEnv: boolean;
  claimed: boolean;
}

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface Quiz {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: QuizDifficulty;
  durationMinutes: number;
  passingPercentage: number;
  isPublished: boolean;
  createdAt: string;
  questionCount: number;
  totalMarks: number;
}

export interface Question {
  id: number;
  quizId: number;
  questionText: string;
  options: string[];
  marks: number;
  sortOrder: number;
  correctOption?: number;
}

export interface AttemptStart {
  attemptId: number;
  quiz: {
    id: number;
    title: string;
    description: string;
    category: string;
    difficulty: QuizDifficulty;
    durationMinutes: number;
    passingPercentage: number;
    totalMarks: number;
  };
  startedAt: string;
  expiresAt: string;
  questions: Question[];
}

export interface QuestionBreakdown {
  questionId: number;
  questionText: string;
  options: string[];
  selectedOption: number | null;
  correctOption: number;
  isCorrect: boolean;
  marks: number;
  earnedMarks: number;
}

export interface QuizResultSummary {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  category: string;
  passingPercentage: number;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
  passed: boolean;
  autoSubmitted: boolean;
}

export interface QuizResultDetail extends QuizResultSummary {
  breakdown: QuestionBreakdown[];
}

export interface AdminUserRecord extends User {
  attemptCount: number;
  averagePercentage: number;
}

export interface AdminQuizStat {
  quizId: number;
  title: string;
  category: string;
  durationMinutes: number;
  passingPercentage: number;
  attemptCount: number;
  averagePercentage: number;
  highestPercentage: number;
  passCount: number;
}

export interface AdminRecentAttempt {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  userId: number;
  userName: string;
  username: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  autoSubmitted: boolean;
  submittedAt: string;
}

export interface AdminReports {
  summary: {
    totalStudents: number;
    totalQuizzes: number;
    totalAttempts: number;
    averagePercentage: number;
    passRate: number;
  };
  quizStats: AdminQuizStat[];
  recentAttempts: AdminRecentAttempt[];
}

export interface LeaderboardEntry {
  rank: number;
  attemptId: number;
  userName: string;
  username: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  durationSeconds: number;
  submittedAt: string;
  isCurrentUser: boolean;
}

export interface QuizLeaderboard {
  quizId: number;
  quizTitle: string;
  category: string;
  durationMinutes: number;
  passingPercentage: number;
  totalParticipants: number;
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
}

export interface UserProfileStats {
  totalPointsEarned: number;
  totalPossiblePoints: number;
  quizzesCompleted: number;
  quizzesPassed: number;
  averagePercentage: number;
  highestPercentage: number;
}

export type FeedbackTopic =
  | 'Quiz Content'
  | 'Difficulty & Timing'
  | 'Platform & UI'
  | 'Bug Report'
  | 'Suggestion';

export interface FeedbackRecord {
  id: number;
  userId: number;
  userName: string;
  username: string;
  quizId: number | null;
  quizTitle: string | null;
  attemptId: number | null;
  rating: number;
  topic: FeedbackTopic;
  comment: string;
  createdAt: string;
}

export interface AdminFeedbackResponse {
  summary: {
    totalCount: number;
    averageRating: number;
  };
  feedback: FeedbackRecord[];
}
