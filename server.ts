import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getUserById,
  hasClaimedAdminAccount,
  hashPassword,
  isAdminPasscodeEnvConfigured,
  requireAdmin,
  requireAuth,
  revokeAuthToken,
  signAuthToken,
  timingSafeEqualString,
  verifyPassword,
} from './server/auth.ts';
import type { AuthenticatedRequest } from './server/auth.ts';
import { db } from './server/db.ts';

const PORT = 3000;

type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

const VALID_DIFFICULTIES: readonly QuizDifficulty[] = ['Easy', 'Medium', 'Hard'];

function parseDifficulty(raw: unknown): QuizDifficulty | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = VALID_DIFFICULTIES.find((d) => d.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}

interface QuizRow {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: QuizDifficulty;
  duration_minutes: number;
  passing_percentage: number;
  is_published: number;
  created_at: string;
  question_count?: number;
  total_marks?: number;
}

interface QuestionRow {
  id: number;
  quiz_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: number;
  marks: number;
  sort_order: number;
}

interface AttemptRow {
  id: number;
  quiz_id: number;
  user_id: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'expired';
  score: number;
  total_marks: number;
  correct_count: number;
  incorrect_count: number;
  percentage: number;
  passed: number;
  auto_submitted: number;
}

function mapQuizRow(row: QuizRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: parseDifficulty(row.difficulty) ?? 'Medium',
    durationMinutes: row.duration_minutes,
    passingPercentage: row.passing_percentage,
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    questionCount: Number(row.question_count ?? 0),
    totalMarks: Number(row.total_marks ?? 0),
  };
}

function mapQuestionRow(row: QuestionRow, includeAnswer: boolean) {
  const base = {
    id: row.id,
    quizId: row.quiz_id,
    questionText: row.question_text,
    options: [row.option_a, row.option_b, row.option_c, row.option_d],
    marks: row.marks,
    sortOrder: row.sort_order,
  };
  if (includeAnswer) {
    return { ...base, correctOption: row.correct_option };
  }
  return base;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parsePositiveInt(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // NFR5 Availability health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // FR3: Check if administrator credentials are configured
  app.get('/api/auth/admin-status', (_req, res) => {
    const viaEnv = isAdminPasscodeEnvConfigured();
    const claimed = hasClaimedAdminAccount();
    res.json({
      configured: viaEnv || claimed,
      viaEnv,
      claimed,
    });
  });

  // FR3: One-time first-run administrator setup/claim when ADMIN_PASSCODE env is unset
  app.post('/api/auth/claim-admin', (req, res) => {
    if (isAdminPasscodeEnvConfigured()) {
      res.status(409).json({
        error: 'Administrator passcode is managed via server environment configuration.',
      });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Administrator name must be between 2 and 80 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      res.status(400).json({
        error: 'Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.',
      });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
      return;
    }

    const claimTx = db.transaction(() => {
      if (hasClaimedAdminAccount()) {
        return { conflict: 'Administrator account has already been claimed.' } as const;
      }

      const duplicate = db
        .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
        .get(email, username) as { id: number } | undefined;
      if (duplicate) {
        return { conflict: 'Email or username is already registered.' } as const;
      }

      const passwordHash = hashPassword(password);
      const info = db
        .prepare(
          "INSERT INTO users (name, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
        )
        .run(name, email, username, passwordHash);

      const user = getUserById(Number(info.lastInsertRowid));
      return { user } as const;
    });

    const outcome = claimTx();
    if ('conflict' in outcome) {
      res.status(409).json({ error: outcome.conflict });
      return;
    }
    if (!outcome.user) {
      res.status(500).json({ error: 'Unable to create administrator account.' });
      return;
    }

    const token = signAuthToken({ id: outcome.user.id, role: outcome.user.role });
    res.status(201).json({ token, user: outcome.user });
  });

  // FR1: Student / End-User Registration
  app.post('/api/auth/register', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      res.status(400).json({
        error: 'Username must be 3–32 characters (letters, numbers, ".", "_", "-").',
      });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = db
      .prepare('SELECT id, email, username FROM users WHERE email = ? OR username = ?')
      .get(email, username) as { id: number; email: string; username: string } | undefined;

    if (existing) {
      const conflictField = existing.email === email ? 'email address' : 'username';
      res.status(409).json({ error: `An account with that ${conflictField} already exists.` });
      return;
    }

    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        "INSERT INTO users (name, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'student')"
      )
      .run(name, email, username, passwordHash);

    const user = getUserById(Number(result.lastInsertRowid));
    if (!user) {
      res.status(500).json({ error: 'Failed to load created user.' });
      return;
    }

    const token = signAuthToken({ id: user.id, role: user.role });
    res.status(201).json({ token, user });
  });

  // FR2 & FR3: User Login & Admin Login
  app.post('/api/auth/login', (req, res) => {
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const roleIntent = req.body?.roleIntent === 'admin' ? 'admin' : 'student';

    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }

    // Check env ADMIN_PASSCODE override first when logging in as admin
    if (roleIntent === 'admin' && isAdminPasscodeEnvConfigured()) {
      const envPasscode = process.env.ADMIN_PASSCODE!.trim();
      if (!timingSafeEqualString(password, envPasscode)) {
        res.status(401).json({ error: 'Invalid administrator credentials.' });
        return;
      }

      let adminRow = db
        .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .get() as { id: number } | undefined;

      if (!adminRow) {
        const info = db
          .prepare(
            "INSERT INTO users (name, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
          )
          .run('System Administrator', 'admin@quizlab.local', 'admin', hashPassword(envPasscode));
        adminRow = { id: Number(info.lastInsertRowid) };
      }

      const adminUser = getUserById(adminRow.id);
      if (!adminUser) {
        res.status(500).json({ error: 'Administrator session failed.' });
        return;
      }
      const token = signAuthToken({ id: adminUser.id, role: 'admin' });
      res.json({ token, user: adminUser });
      return;
    }

    const userRow = db
      .prepare('SELECT id, password_hash, role FROM users WHERE email = ? OR username = ?')
      .get(identifier, identifier) as
      | { id: number; password_hash: string; role: 'student' | 'admin' }
      | undefined;

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid username/email or password.' });
      return;
    }

    if (roleIntent === 'admin' && userRow.role !== 'admin') {
      res.status(403).json({ error: 'This account does not have administrator privileges.' });
      return;
    }

    const user = getUserById(userRow.id);
    if (!user) {
      res.status(500).json({ error: 'Unable to load user profile.' });
      return;
    }

    const token = signAuthToken({ id: user.id, role: user.role });
    res.json({ token, user });
  });

  // FR14: Secure Logout
  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authToken) {
      revokeAuthToken(req.authToken);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // User Profile & Total Points Summary
  app.get('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const statsRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(score), 0) AS total_points_earned,
           COALESCE(SUM(total_marks), 0) AS total_possible_points,
           COUNT(*) AS quizzes_completed,
           COUNT(CASE WHEN passed = 1 THEN 1 END) AS quizzes_passed,
           COALESCE(ROUND(AVG(percentage), 1), 0) AS average_percentage,
           COALESCE(MAX(percentage), 0) AS highest_percentage
         FROM quiz_attempts
         WHERE user_id = ? AND status = 'submitted'`
      )
      .get(req.user!.id) as {
      total_points_earned: number;
      total_possible_points: number;
      quizzes_completed: number;
      quizzes_passed: number;
      average_percentage: number;
      highest_percentage: number;
    };

    res.json({
      user: req.user,
      stats: {
        totalPointsEarned: statsRow.total_points_earned,
        totalPossiblePoints: statsRow.total_possible_points,
        quizzesCompleted: statsRow.quizzes_completed,
        quizzesPassed: statsRow.quizzes_passed,
        averagePercentage: statsRow.average_percentage,
        highestPercentage: statsRow.highest_percentage,
      },
    });
  });

  app.put('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawAvatar = req.body?.avatarUrl;

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Display name must be between 2 and 80 characters.' });
      return;
    }

    let sanitizedAvatar: string | null = null;
    if (typeof rawAvatar === 'string' && rawAvatar.trim().length > 0) {
      const trimmed = rawAvatar.trim();
      const isSafeDataImage =
        /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed) &&
        trimmed.length <= 350_000;

      if (isSafeDataImage) {
        sanitizedAvatar = trimmed;
      } else {
        let isValidHttps = false;
        try {
          const parsed = new URL(trimmed);
          isValidHttps = parsed.protocol === 'https:' && trimmed.length <= 1024;
        } catch {
          isValidHttps = false;
        }
        if (!isValidHttps) {
          res.status(400).json({
            error:
              'Profile picture must be an uploaded PNG/JPEG/WEBP image (under 250KB) or a valid https:// image URL.',
          });
          return;
        }
        sanitizedAvatar = trimmed;
      }
    }

    db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?').run(
      name,
      sanitizedAvatar,
      req.user!.id
    );

    const updatedUser = getUserById(req.user!.id);
    if (!updatedUser) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    res.json({ user: updatedUser });
  });

  // FR6: View Available Quizzes
  app.get('/api/quizzes', requireAuth, (req: AuthenticatedRequest, res) => {
    const isAdmin = req.user?.role === 'admin';
    const sql = isAdmin
      ? `
        SELECT q.*, COUNT(qs.id) AS question_count, COALESCE(SUM(qs.marks), 0) AS total_marks
        FROM quizzes q
        LEFT JOIN questions qs ON qs.quiz_id = q.id
        GROUP BY q.id
        ORDER BY q.created_at DESC, q.id DESC
      `
      : `
        SELECT q.*, COUNT(qs.id) AS question_count, COALESCE(SUM(qs.marks), 0) AS total_marks
        FROM quizzes q
        LEFT JOIN questions qs ON qs.quiz_id = q.id
        WHERE q.is_published = 1
        GROUP BY q.id
        HAVING COUNT(qs.id) > 0
        ORDER BY q.created_at DESC, q.id DESC
      `;

    const rows = db.prepare(sql).all() as QuizRow[];
    res.json({ quizzes: rows.map(mapQuizRow) });
  });

  // FR4 & FR5: Quiz details with questions (correctOption visible only to Admin)
  app.get('/api/quizzes/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const quizId = parsePositiveInt(req.params.id);
    if (!quizId) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const isAdmin = req.user?.role === 'admin';
    const quizRow = db
      .prepare(
        `SELECT q.*, COUNT(qs.id) AS question_count, COALESCE(SUM(qs.marks), 0) AS total_marks
         FROM quizzes q
         LEFT JOIN questions qs ON qs.quiz_id = q.id
         WHERE q.id = ?
         GROUP BY q.id`
      )
      .get(quizId) as QuizRow | undefined;

    if (!quizRow || (!isAdmin && !quizRow.is_published)) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const questions = db
      .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC')
      .all(quizId) as QuestionRow[];

    res.json({
      quiz: mapQuizRow(quizRow),
      questions: questions.map((q) => mapQuestionRow(q, isAdmin)),
    });
  });

  // FR4: Create Quiz (Admin)
  app.post('/api/quizzes', requireAdmin, (req: AuthenticatedRequest, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const category =
      req.body?.category === undefined
        ? 'General'
        : typeof req.body.category === 'string'
        ? req.body.category.trim()
        : '';
    const rawDifficulty = req.body?.difficulty;
    const difficulty = rawDifficulty === undefined ? 'Medium' : parseDifficulty(rawDifficulty);
    const durationMinutes = Number(req.body?.durationMinutes);
    const passingPercentage = Number(req.body?.passingPercentage ?? 60);
    const isPublished = req.body?.isPublished === false ? 0 : 1;

    if (title.length < 3 || title.length > 140) {
      res.status(400).json({ error: 'Quiz title must be between 3 and 140 characters.' });
      return;
    }
    if (category.length < 2 || category.length > 60) {
      res.status(400).json({ error: 'Category must be between 2 and 60 characters.' });
      return;
    }
    if (description.length < 5 || description.length > 600) {
      res.status(400).json({ error: 'Description must be between 5 and 600 characters.' });
      return;
    }
    if (!difficulty) {
      res.status(400).json({ error: 'Difficulty must be Easy, Medium, or Hard.' });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
      res.status(400).json({ error: 'Duration must be an integer between 1 and 180 minutes.' });
      return;
    }
    if (!Number.isInteger(passingPercentage) || passingPercentage < 1 || passingPercentage > 100) {
      res.status(400).json({ error: 'Passing percentage must be between 1 and 100.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO quizzes (title, description, category, difficulty, duration_minutes, passing_percentage, is_published, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        description,
        category || 'General',
        difficulty,
        durationMinutes,
        passingPercentage,
        isPublished,
        req.user!.id
      );

    const created = db
      .prepare(
        `SELECT q.*, 0 AS question_count, 0 AS total_marks FROM quizzes q WHERE q.id = ?`
      )
      .get(Number(result.lastInsertRowid)) as QuizRow;

    res.status(201).json({ quiz: mapQuizRow(created) });
  });

  // FR4: Update Quiz (Admin)
  app.put('/api/quizzes/:id', requireAdmin, (req, res) => {
    const quizId = parsePositiveInt(req.params.id);
    if (!quizId) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as QuizRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : existing.title;
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : existing.description;
    const category =
      req.body?.category === undefined
        ? existing.category
        : typeof req.body.category === 'string'
        ? req.body.category.trim()
        : '';
    const difficulty =
      req.body?.difficulty !== undefined
        ? parseDifficulty(req.body.difficulty)
        : parseDifficulty(existing.difficulty) ?? 'Medium';
    const durationMinutes =
      req.body?.durationMinutes !== undefined
        ? Number(req.body.durationMinutes)
        : existing.duration_minutes;
    const passingPercentage =
      req.body?.passingPercentage !== undefined
        ? Number(req.body.passingPercentage)
        : existing.passing_percentage;
    const isPublished =
      req.body?.isPublished !== undefined ? (req.body.isPublished ? 1 : 0) : existing.is_published;

    if (title.length < 3 || title.length > 140) {
      res.status(400).json({ error: 'Quiz title must be between 3 and 140 characters.' });
      return;
    }
    if (category.length < 2 || category.length > 60) {
      res.status(400).json({ error: 'Category must be between 2 and 60 characters.' });
      return;
    }
    if (description.length < 5 || description.length > 600) {
      res.status(400).json({ error: 'Description must be between 5 and 600 characters.' });
      return;
    }
    if (!difficulty) {
      res.status(400).json({ error: 'Difficulty must be Easy, Medium, or Hard.' });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
      res.status(400).json({ error: 'Duration must be an integer between 1 and 180 minutes.' });
      return;
    }
    if (!Number.isInteger(passingPercentage) || passingPercentage < 1 || passingPercentage > 100) {
      res.status(400).json({ error: 'Passing percentage must be between 1 and 100.' });
      return;
    }

    db.prepare(
      `UPDATE quizzes
       SET title = ?, description = ?, category = ?, difficulty = ?, duration_minutes = ?, passing_percentage = ?, is_published = ?
       WHERE id = ?`
    ).run(
      title,
      description,
      category || 'General',
      difficulty,
      durationMinutes,
      passingPercentage,
      isPublished,
      quizId
    );

    const updated = db
      .prepare(
        `SELECT q.*, COUNT(qs.id) AS question_count, COALESCE(SUM(qs.marks), 0) AS total_marks
         FROM quizzes q
         LEFT JOIN questions qs ON qs.quiz_id = q.id
         WHERE q.id = ?
         GROUP BY q.id`
      )
      .get(quizId) as QuizRow;

    res.json({ quiz: mapQuizRow(updated) });
  });

  // FR4: Delete Quiz (Admin)
  app.delete('/api/quizzes/:id', requireAdmin, (req, res) => {
    const quizId = parsePositiveInt(req.params.id);
    if (!quizId) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const info = db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    res.json({ ok: true });
  });

  // FR5: Add Question to Quiz (Admin)
  app.post('/api/quizzes/:id/questions', requireAdmin, (req, res) => {
    const quizId = parsePositiveInt(req.params.id);
    if (!quizId) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const quiz = db.prepare('SELECT id FROM quizzes WHERE id = ?').get(quizId);
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const questionText = typeof req.body?.questionText === 'string' ? req.body.questionText.trim() : '';
    const options = Array.isArray(req.body?.options)
      ? req.body.options.map((o: unknown) => (typeof o === 'string' ? o.trim() : ''))
      : [];
    const correctOption = Number(req.body?.correctOption);
    const marks = Number(req.body?.marks ?? 1);

    if (questionText.length < 5 || questionText.length > 500) {
      res.status(400).json({ error: 'Question text must be between 5 and 500 characters.' });
      return;
    }
    if (options.length !== 4 || options.some((opt: string) => opt.length === 0)) {
      res.status(400).json({ error: 'All four answer options must be non-empty.' });
      return;
    }
    if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption > 3) {
      res.status(400).json({ error: 'Correct option index must be between 0 and 3.' });
      return;
    }
    if (!Number.isInteger(marks) || marks < 1 || marks > 20) {
      res.status(400).json({ error: 'Marks per question must be between 1 and 20.' });
      return;
    }

    const maxOrder = db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM questions WHERE quiz_id = ?')
      .get(quizId) as { max_order: number };

    const info = db
      .prepare(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        quizId,
        questionText,
        options[0],
        options[1],
        options[2],
        options[3],
        correctOption,
        marks,
        maxOrder.max_order + 1
      );

    const created = db
      .prepare('SELECT * FROM questions WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as QuestionRow;

    res.status(201).json({ question: mapQuestionRow(created, true) });
  });

  // FR5: Edit Question (Admin)
  app.put('/api/questions/:id', requireAdmin, (req, res) => {
    const questionId = parsePositiveInt(req.params.id);
    if (!questionId) {
      res.status(400).json({ error: 'Invalid question ID.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as
      | QuestionRow
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const questionText =
      typeof req.body?.questionText === 'string' ? req.body.questionText.trim() : existing.question_text;
    const options = Array.isArray(req.body?.options)
      ? req.body.options.map((o: unknown) => (typeof o === 'string' ? o.trim() : ''))
      : [existing.option_a, existing.option_b, existing.option_c, existing.option_d];
    const correctOption =
      req.body?.correctOption !== undefined ? Number(req.body.correctOption) : existing.correct_option;
    const marks = req.body?.marks !== undefined ? Number(req.body.marks) : existing.marks;

    if (questionText.length < 5 || questionText.length > 500) {
      res.status(400).json({ error: 'Question text must be between 5 and 500 characters.' });
      return;
    }
    if (options.length !== 4 || options.some((opt: string) => opt.length === 0)) {
      res.status(400).json({ error: 'All four answer options must be non-empty.' });
      return;
    }
    if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption > 3) {
      res.status(400).json({ error: 'Correct option index must be between 0 and 3.' });
      return;
    }
    if (!Number.isInteger(marks) || marks < 1 || marks > 20) {
      res.status(400).json({ error: 'Marks per question must be between 1 and 20.' });
      return;
    }

    db.prepare(
      `UPDATE questions
       SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ?
       WHERE id = ?`
    ).run(questionText, options[0], options[1], options[2], options[3], correctOption, marks, questionId);

    const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as QuestionRow;
    res.json({ question: mapQuestionRow(updated, true) });
  });

  // FR5: Delete Question (Admin)
  app.delete('/api/questions/:id', requireAdmin, (req, res) => {
    const questionId = parsePositiveInt(req.params.id);
    if (!questionId) {
      res.status(400).json({ error: 'Invalid question ID.' });
      return;
    }

    const info = db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    res.json({ ok: true });
  });

  // FR7 & FR8: Start Quiz Attempt with Server-Authoritative Timer
  app.post('/api/quizzes/:id/start', requireAuth, (req: AuthenticatedRequest, res) => {
    const quizId = parsePositiveInt(req.params.id);
    if (!quizId) {
      res.status(400).json({ error: 'Invalid quiz ID.' });
      return;
    }

    const quiz = db
      .prepare('SELECT * FROM quizzes WHERE id = ? AND is_published = 1')
      .get(quizId) as QuizRow | undefined;

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found or not published.' });
      return;
    }

    const questions = db
      .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC')
      .all(quizId) as QuestionRow[];

    if (questions.length === 0) {
      res.status(400).json({ error: 'This quiz has no questions yet.' });
      return;
    }

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const now = new Date();
    const expires = new Date(now.getTime() + quiz.duration_minutes * 60 * 1000);

    const info = db
      .prepare(
        `INSERT INTO quiz_attempts (quiz_id, user_id, started_at, expires_at, status, total_marks)
         VALUES (?, ?, ?, ?, 'in_progress', ?)`
      )
      .run(quizId, req.user!.id, now.toISOString(), expires.toISOString(), totalMarks);

    res.status(201).json({
      attemptId: Number(info.lastInsertRowid),
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        difficulty: parseDifficulty(quiz.difficulty) ?? 'Medium',
        durationMinutes: quiz.duration_minutes,
        passingPercentage: quiz.passing_percentage,
        totalMarks,
      },
      startedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      questions: questions.map((q) => mapQuestionRow(q, false)),
    });
  });

  // FR9, FR10, FR11, FR12: Submit Answers & Automatic Server Evaluation
  app.post('/api/attempts/:attemptId/submit', requireAuth, (req: AuthenticatedRequest, res) => {
    const attemptId = parsePositiveInt(req.params.attemptId);
    if (!attemptId) {
      res.status(400).json({ error: 'Invalid attempt ID.' });
      return;
    }

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId) as
      | AttemptRow
      | undefined;

    if (!attempt) {
      res.status(404).json({ error: 'Quiz attempt not found.' });
      return;
    }
    if (attempt.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to submit this attempt.' });
      return;
    }
    if (attempt.status !== 'in_progress') {
      res.status(409).json({ error: 'This quiz attempt has already been submitted.' });
      return;
    }

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow | undefined;
    if (!quiz) {
      res.status(404).json({ error: 'Associated quiz no longer exists.' });
      return;
    }

    const questions = db
      .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC')
      .all(attempt.quiz_id) as QuestionRow[];

    const rawAnswers =
      req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const autoSubmitted = Boolean(req.body?.autoSubmitted) || Date.now() > Date.parse(attempt.expires_at);

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    const breakdown: Array<{
      questionId: number;
      questionText: string;
      options: string[];
      selectedOption: number | null;
      correctOption: number;
      isCorrect: boolean;
      marks: number;
      earnedMarks: number;
    }> = [];

    const insertAnswer = db.prepare(`
      INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET
        selected_option = excluded.selected_option,
        is_correct = excluded.is_correct
    `);

    const gradeTx = db.transaction(() => {
      for (const q of questions) {
        totalMarks += q.marks;
        const rawChoice = (rawAnswers as Record<string, unknown>)[String(q.id)];
        const selectedOption =
          typeof rawChoice === 'number' && Number.isInteger(rawChoice) && rawChoice >= 0 && rawChoice <= 3
            ? rawChoice
            : null;
        const isCorrect = selectedOption !== null && selectedOption === q.correct_option;

        if (isCorrect) {
          score += q.marks;
          correctCount += 1;
        } else {
          incorrectCount += 1;
        }

        insertAnswer.run(attemptId, q.id, selectedOption, isCorrect ? 1 : 0);

        breakdown.push({
          questionId: q.id,
          questionText: q.question_text,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          selectedOption,
          correctOption: q.correct_option,
          isCorrect,
          marks: q.marks,
          earnedMarks: isCorrect ? q.marks : 0,
        });
      }

      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 1000) / 10 : 0;
      const passed = percentage >= quiz.passing_percentage ? 1 : 0;
      const submittedAt = new Date().toISOString();

      db.prepare(
        `UPDATE quiz_attempts
         SET submitted_at = ?, status = 'submitted', score = ?, total_marks = ?,
             correct_count = ?, incorrect_count = ?, percentage = ?, passed = ?, auto_submitted = ?
         WHERE id = ?`
      ).run(
        submittedAt,
        score,
        totalMarks,
        correctCount,
        incorrectCount,
        percentage,
        passed,
        autoSubmitted ? 1 : 0,
        attemptId
      );

      return {
        attemptId,
        quizId: quiz.id,
        quizTitle: quiz.title,
        category: quiz.category,
        passingPercentage: quiz.passing_percentage,
        startedAt: attempt.started_at,
        submittedAt,
        score,
        totalMarks,
        correctCount,
        incorrectCount,
        percentage,
        passed: Boolean(passed),
        autoSubmitted,
        breakdown,
      };
    });

    const resultPayload = gradeTx();
    res.json({ result: resultPayload });
  });

  // FR12: Student Past Quiz Results History
  app.get('/api/results/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT a.*, q.title AS quiz_title, q.category AS quiz_category, q.passing_percentage
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.user_id = ? AND a.status = 'submitted'
         ORDER BY a.submitted_at DESC, a.id DESC`
      )
      .all(req.user!.id) as Array<
      AttemptRow & { quiz_title: string; quiz_category: string; passing_percentage: number }
    >;

    res.json({
      results: rows.map((r) => ({
        attemptId: r.id,
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        category: r.quiz_category,
        passingPercentage: r.passing_percentage,
        startedAt: r.started_at,
        submittedAt: r.submitted_at,
        score: r.score,
        totalMarks: r.total_marks,
        correctCount: r.correct_count,
        incorrectCount: r.incorrect_count,
        percentage: r.percentage,
        passed: Boolean(r.passed),
        autoSubmitted: Boolean(r.auto_submitted),
      })),
    });
  });

  // FR11 & FR12: Detailed Graded Attempt Result (Owner or Admin)
  app.get('/api/results/:attemptId', requireAuth, (req: AuthenticatedRequest, res) => {
    const attemptId = parsePositiveInt(req.params.attemptId);
    if (!attemptId) {
      res.status(400).json({ error: 'Invalid attempt ID.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT a.*, q.title AS quiz_title, q.category AS quiz_category, q.passing_percentage
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.id = ?`
      )
      .get(attemptId) as
      | (AttemptRow & { quiz_title: string; quiz_category: string; passing_percentage: number })
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Quiz result not found.' });
      return;
    }

    if (row.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to view this result.' });
      return;
    }

    const answerRows = db
      .prepare(
        `SELECT qs.id AS question_id, qs.question_text, qs.option_a, qs.option_b, qs.option_c, qs.option_d,
                qs.correct_option, qs.marks, aa.selected_option, aa.is_correct
         FROM questions qs
         LEFT JOIN attempt_answers aa ON aa.question_id = qs.id AND aa.attempt_id = ?
         WHERE qs.quiz_id = ?
         ORDER BY qs.sort_order ASC, qs.id ASC`
      )
      .all(attemptId, row.quiz_id) as Array<{
      question_id: number;
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_option: number;
      marks: number;
      selected_option: number | null;
      is_correct: number | null;
    }>;

    res.json({
      result: {
        attemptId: row.id,
        quizId: row.quiz_id,
        quizTitle: row.quiz_title,
        category: row.quiz_category,
        passingPercentage: row.passing_percentage,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        score: row.score,
        totalMarks: row.total_marks,
        correctCount: row.correct_count,
        incorrectCount: row.incorrect_count,
        percentage: row.percentage,
        passed: Boolean(row.passed),
        autoSubmitted: Boolean(row.auto_submitted),
        breakdown: answerRows.map((a) => ({
          questionId: a.question_id,
          questionText: a.question_text,
          options: [a.option_a, a.option_b, a.option_c, a.option_d],
          selectedOption: a.selected_option,
          correctOption: a.correct_option,
          isCorrect: Boolean(a.is_correct),
          marks: a.marks,
          earnedMarks: a.is_correct ? a.marks : 0,
        })),
      },
    });
  });

  // Global Leaderboard: Top performers per published quiz ranked by score & completion time
  app.get('/api/leaderboard', requireAuth, (req: AuthenticatedRequest, res) => {
    const publishedQuizzes = db
      .prepare(
        `SELECT q.id, q.title, q.category, q.duration_minutes, q.passing_percentage
         FROM quizzes q
         WHERE q.is_published = 1
           AND EXISTS (SELECT 1 FROM questions qs WHERE qs.quiz_id = q.id)
         ORDER BY q.id ASC`
      )
      .all() as Array<{
      id: number;
      title: string;
      category: string;
      duration_minutes: number;
      passing_percentage: number;
    }>;

    const attemptsStmt = db.prepare(
      `SELECT a.id AS attempt_id, a.user_id, u.name AS user_name, u.username,
              a.score, a.total_marks, a.percentage, a.passed, a.started_at, a.submitted_at,
              MAX(0, CAST(ROUND((julianday(a.submitted_at) - julianday(a.started_at)) * 86400) AS INTEGER)) AS duration_seconds
       FROM quiz_attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.quiz_id = ? AND a.status = 'submitted' AND a.submitted_at IS NOT NULL
       ORDER BY a.percentage DESC, a.score DESC, duration_seconds ASC, a.submitted_at ASC`
    );

    const leaderboards = publishedQuizzes.map((quiz) => {
      const rows = attemptsStmt.all(quiz.id) as Array<{
        attempt_id: number;
        user_id: number;
        user_name: string;
        username: string;
        score: number;
        total_marks: number;
        percentage: number;
        passed: number;
        started_at: string;
        submitted_at: string;
        duration_seconds: number;
      }>;

      const seenUsers = new Set<number>();
      const rankedAll: Array<{
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
      }> = [];

      for (const r of rows) {
        if (seenUsers.has(r.user_id)) continue;
        seenUsers.add(r.user_id);
        rankedAll.push({
          rank: rankedAll.length + 1,
          attemptId: r.attempt_id,
          userName: r.user_name,
          username: r.username,
          score: r.score,
          totalMarks: r.total_marks,
          percentage: r.percentage,
          passed: Boolean(r.passed),
          durationSeconds: r.duration_seconds,
          submittedAt: r.submitted_at,
          isCurrentUser: r.user_id === req.user!.id,
        });
      }

      const currentUserEntry = rankedAll.find((e) => e.isCurrentUser) ?? null;

      return {
        quizId: quiz.id,
        quizTitle: quiz.title,
        category: quiz.category,
        durationMinutes: quiz.duration_minutes,
        passingPercentage: quiz.passing_percentage,
        totalParticipants: rankedAll.length,
        entries: rankedAll.slice(0, 10),
        currentUserEntry,
      };
    });

    res.json({ leaderboards });
  });

  const VALID_FEEDBACK_TOPICS = [
    'Quiz Content',
    'Difficulty & Timing',
    'Platform & UI',
    'Bug Report',
    'Suggestion',
  ] as const;

  type FeedbackTopicValue = (typeof VALID_FEEDBACK_TOPICS)[number];

  // Student Feedback: View Own Submitted Feedback
  app.get('/api/feedback/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT f.id, f.user_id, u.name AS user_name, u.username,
                f.quiz_id, q.title AS quiz_title, f.attempt_id,
                f.rating, f.topic, f.comment, f.created_at
         FROM quiz_feedback f
         JOIN users u ON u.id = f.user_id
         LEFT JOIN quizzes q ON q.id = f.quiz_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC, f.id DESC`
      )
      .all(req.user!.id) as Array<{
      id: number;
      user_id: number;
      user_name: string;
      username: string;
      quiz_id: number | null;
      quiz_title: string | null;
      attempt_id: number | null;
      rating: number;
      topic: FeedbackTopicValue;
      comment: string;
      created_at: string;
    }>;

    res.json({
      feedback: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        username: r.username,
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        attemptId: r.attempt_id,
        rating: r.rating,
        topic: r.topic,
        comment: r.comment,
        createdAt: r.created_at,
      })),
    });
  });

  // Student Feedback: Submit Rating & Comment
  app.post('/api/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
    const rating = Number(req.body?.rating);
    const rawTopic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : 'Quiz Content';
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const rawQuizId = req.body?.quizId;
    const rawAttemptId = req.body?.attemptId;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Please select a rating between 1 and 5 stars.' });
      return;
    }

    const topic = VALID_FEEDBACK_TOPICS.find((t) => t === rawTopic);
    if (!topic) {
      res.status(400).json({ error: 'Please select a valid feedback topic.' });
      return;
    }

    if (comment.length < 5 || comment.length > 1000) {
      res.status(400).json({ error: 'Feedback comment must be between 5 and 1000 characters.' });
      return;
    }

    let quizId: number | null = null;
    if (rawQuizId !== undefined && rawQuizId !== null && rawQuizId !== '') {
      quizId = parsePositiveInt(rawQuizId);
      if (!quizId) {
        res.status(400).json({ error: 'Invalid quiz selection.' });
        return;
      }
      const quizExists = db.prepare('SELECT id FROM quizzes WHERE id = ?').get(quizId);
      if (!quizExists) {
        res.status(404).json({ error: 'Selected quiz was not found.' });
        return;
      }
    }

    let attemptId: number | null = null;
    if (rawAttemptId !== undefined && rawAttemptId !== null && rawAttemptId !== '') {
      attemptId = parsePositiveInt(rawAttemptId);
      if (!attemptId) {
        res.status(400).json({ error: 'Invalid attempt reference.' });
        return;
      }
      const attempt = db
        .prepare('SELECT id, user_id, quiz_id FROM quiz_attempts WHERE id = ?')
        .get(attemptId) as { id: number; user_id: number; quiz_id: number } | undefined;

      if (!attempt) {
        res.status(404).json({ error: 'Quiz attempt not found.' });
        return;
      }
      if (attempt.user_id !== req.user!.id && req.user!.role !== 'admin') {
        res.status(403).json({ error: 'You do not have permission to attach feedback to this attempt.' });
        return;
      }
      if (quizId === null) {
        quizId = attempt.quiz_id;
      }
      const existingAttemptFeedback = db
        .prepare('SELECT id FROM quiz_feedback WHERE user_id = ? AND attempt_id = ?')
        .get(req.user!.id, attemptId);
      if (existingAttemptFeedback) {
        res.status(409).json({ error: 'Feedback has already been submitted for this quiz attempt.' });
        return;
      }
    }

    const info = db
      .prepare(
        `INSERT INTO quiz_feedback (user_id, quiz_id, attempt_id, rating, topic, comment)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.user!.id, quizId, attemptId, rating, topic, comment);

    const created = db
      .prepare(
        `SELECT f.id, f.user_id, u.name AS user_name, u.username,
                f.quiz_id, q.title AS quiz_title, f.attempt_id,
                f.rating, f.topic, f.comment, f.created_at
         FROM quiz_feedback f
         JOIN users u ON u.id = f.user_id
         LEFT JOIN quizzes q ON q.id = f.quiz_id
         WHERE f.id = ?`
      )
      .get(Number(info.lastInsertRowid)) as {
      id: number;
      user_id: number;
      user_name: string;
      username: string;
      quiz_id: number | null;
      quiz_title: string | null;
      attempt_id: number | null;
      rating: number;
      topic: FeedbackTopicValue;
      comment: string;
      created_at: string;
    };

    res.status(201).json({
      feedback: {
        id: created.id,
        userId: created.user_id,
        userName: created.user_name,
        username: created.username,
        quizId: created.quiz_id,
        quizTitle: created.quiz_title,
        attemptId: created.attempt_id,
        rating: created.rating,
        topic: created.topic,
        comment: created.comment,
        createdAt: created.created_at,
      },
    });
  });

  // Admin: View All Student Feedback
  app.get('/api/admin/feedback', requireAdmin, (_req, res) => {
    const summary = db
      .prepare(
        `SELECT COUNT(*) AS total_count, COALESCE(ROUND(AVG(rating), 1), 0) AS avg_rating
         FROM quiz_feedback`
      )
      .get() as { total_count: number; avg_rating: number };

    const rows = db
      .prepare(
        `SELECT f.id, f.user_id, u.name AS user_name, u.username,
                f.quiz_id, q.title AS quiz_title, f.attempt_id,
                f.rating, f.topic, f.comment, f.created_at
         FROM quiz_feedback f
         JOIN users u ON u.id = f.user_id
         LEFT JOIN quizzes q ON q.id = f.quiz_id
         ORDER BY f.created_at DESC, f.id DESC`
      )
      .all() as Array<{
      id: number;
      user_id: number;
      user_name: string;
      username: string;
      quiz_id: number | null;
      quiz_title: string | null;
      attempt_id: number | null;
      rating: number;
      topic: FeedbackTopicValue;
      comment: string;
      created_at: string;
    }>;

    res.json({
      summary: {
        totalCount: summary.total_count,
        averageRating: summary.avg_rating,
      },
      feedback: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        username: r.username,
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        attemptId: r.attempt_id,
        rating: r.rating,
        topic: r.topic,
        comment: r.comment,
        createdAt: r.created_at,
      })),
    });
  });

  // FR1 & FR13: Admin View Registered Users
  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const users = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.username, u.role, u.created_at,
                COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) AS attempt_count,
                COALESCE(ROUND(AVG(CASE WHEN a.status = 'submitted' THEN a.percentage END), 1), 0) AS average_percentage
         FROM users u
         LEFT JOIN quiz_attempts a ON a.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC, u.id DESC`
      )
      .all() as Array<{
      id: number;
      name: string;
      email: string;
      username: string;
      role: 'student' | 'admin';
      created_at: string;
      attempt_count: number;
      average_percentage: number;
    }>;

    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        role: u.role,
        createdAt: u.created_at,
        attemptCount: u.attempt_count,
        averagePercentage: u.average_percentage,
      })),
    });
  });

  // FR13: Admin View Quiz & User Performance Reports
  app.get('/api/admin/reports', requireAdmin, (_req, res) => {
    const summary = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
           (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
           (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'submitted') AS total_attempts,
           (SELECT COALESCE(ROUND(AVG(percentage), 1), 0) FROM quiz_attempts WHERE status = 'submitted') AS avg_percentage,
           (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'submitted' AND passed = 1) AS passed_attempts`
      )
      .get() as {
      total_students: number;
      total_quizzes: number;
      total_attempts: number;
      avg_percentage: number;
      passed_attempts: number;
    };

    const quizStats = db
      .prepare(
        `SELECT q.id, q.title, q.category, q.duration_minutes, q.passing_percentage,
                COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) AS attempt_count,
                COALESCE(ROUND(AVG(CASE WHEN a.status = 'submitted' THEN a.percentage END), 1), 0) AS avg_percentage,
                COALESCE(MAX(CASE WHEN a.status = 'submitted' THEN a.percentage END), 0) AS high_percentage,
                COUNT(CASE WHEN a.status = 'submitted' AND a.passed = 1 THEN 1 END) AS pass_count
         FROM quizzes q
         LEFT JOIN quiz_attempts a ON a.quiz_id = q.id
         GROUP BY q.id
         ORDER BY attempt_count DESC, q.id ASC`
      )
      .all() as Array<{
      id: number;
      title: string;
      category: string;
      duration_minutes: number;
      passing_percentage: number;
      attempt_count: number;
      avg_percentage: number;
      high_percentage: number;
      pass_count: number;
    }>;

    const recentAttempts = db
      .prepare(
        `SELECT a.id AS attempt_id, a.quiz_id, q.title AS quiz_title, u.id AS user_id,
                u.name AS user_name, u.username, a.score, a.total_marks, a.percentage,
                a.passed, a.auto_submitted, a.submitted_at
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         JOIN users u ON u.id = a.user_id
         WHERE a.status = 'submitted'
         ORDER BY a.submitted_at DESC, a.id DESC
         LIMIT 50`
      )
      .all() as Array<{
      attempt_id: number;
      quiz_id: number;
      quiz_title: string;
      user_id: number;
      user_name: string;
      username: string;
      score: number;
      total_marks: number;
      percentage: number;
      passed: number;
      auto_submitted: number;
      submitted_at: string;
    }>;

    const passRate =
      summary.total_attempts > 0
        ? Math.round((summary.passed_attempts / summary.total_attempts) * 1000) / 10
        : 0;

    res.json({
      summary: {
        totalStudents: summary.total_students,
        totalQuizzes: summary.total_quizzes,
        totalAttempts: summary.total_attempts,
        averagePercentage: summary.avg_percentage,
        passRate,
      },
      quizStats: quizStats.map((qs) => ({
        quizId: qs.id,
        title: qs.title,
        category: qs.category,
        durationMinutes: qs.duration_minutes,
        passingPercentage: qs.passing_percentage,
        attemptCount: qs.attempt_count,
        averagePercentage: qs.avg_percentage,
        highestPercentage: qs.high_percentage,
        passCount: qs.pass_count,
      })),
      recentAttempts: recentAttempts.map((ra) => ({
        attemptId: ra.attempt_id,
        quizId: ra.quiz_id,
        quizTitle: ra.quiz_title,
        userId: ra.user_id,
        userName: ra.user_name,
        username: ra.username,
        score: ra.score,
        totalMarks: ra.total_marks,
        percentage: ra.percentage,
        passed: Boolean(ra.passed),
        autoSubmitted: Boolean(ra.auto_submitted),
        submittedAt: ra.submitted_at,
      })),
    });
  });

  // FR13: Export Student Performance Analytics CSV (Admin)
  app.get('/api/admin/reports/csv', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT a.id AS attempt_id, u.name AS student_name, u.username, u.email,
                q.title AS quiz_title, q.category, a.score, a.total_marks,
                a.correct_count, a.incorrect_count, a.percentage, a.passed,
                a.auto_submitted, a.started_at, a.submitted_at
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         JOIN users u ON u.id = a.user_id
         WHERE a.status = 'submitted'
         ORDER BY a.submitted_at DESC, a.id DESC`
      )
      .all() as Array<{
      attempt_id: number;
      student_name: string;
      username: string;
      email: string;
      quiz_title: string;
      category: string;
      score: number;
      total_marks: number;
      correct_count: number;
      incorrect_count: number;
      percentage: number;
      passed: number;
      auto_submitted: number;
      started_at: string;
      submitted_at: string | null;
    }>;

    const escapeCsvCell = (val: unknown): string => {
      const str = val === null || val === undefined ? '' : String(val);
      const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${formulaSafe.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Attempt ID',
      'Student Name',
      'Username',
      'Email',
      'Quiz Title',
      'Category',
      'Score',
      'Total Marks',
      'Correct Answers',
      'Incorrect Answers',
      'Percentage',
      'Outcome',
      'Auto Submitted',
      'Started At',
      'Submitted At',
    ];

    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) =>
        [
          r.attempt_id,
          r.student_name,
          r.username,
          r.email,
          r.quiz_title,
          r.category,
          r.score,
          r.total_marks,
          r.correct_count,
          r.incorrect_count,
          `${r.percentage}%`,
          r.passed ? 'Passed' : 'Not Passed',
          r.auto_submitted ? 'Yes' : 'No',
          r.started_at,
          r.submitted_at ?? '',
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];

    const csvContent = lines.join('\r\n');
    const fileDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quizlab-performance-report-${fileDate}.csv"`
    );
    res.send(csvContent);
  });

  // NFR10: Backup Export (Admin)
  app.get('/api/admin/backup', requireAdmin, (_req, res) => {
    const quizzes = db.prepare('SELECT * FROM quizzes ORDER BY id ASC').all() as QuizRow[];
    const questions = db.prepare('SELECT * FROM questions ORDER BY quiz_id ASC, sort_order ASC').all() as QuestionRow[];

    const backup = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      quizzes: quizzes.map((q) => ({
        ...mapQuizRow(q),
        questions: questions
          .filter((qs) => qs.quiz_id === q.id)
          .map((qs) => mapQuestionRow(qs, true)),
      })),
    };

    res.json(backup);
  });

  // NFR10: Backup Restore (Admin)
  app.post('/api/admin/restore', requireAdmin, (req: AuthenticatedRequest, res) => {
    const quizzesPayload = Array.isArray(req.body?.quizzes) ? req.body.quizzes : null;
    if (!quizzesPayload || quizzesPayload.length === 0) {
      res.status(400).json({ error: 'Backup payload must contain a non-empty quizzes array.' });
      return;
    }

    const insertQuiz = db.prepare(
      `INSERT INTO quizzes (title, description, category, difficulty, duration_minutes, passing_percentage, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertQuestion = db.prepare(
      `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let restoredQuizzes = 0;
    let restoredQuestions = 0;

    try {
      const restoreTx = db.transaction(() => {
        for (const qItem of quizzesPayload) {
          if (
            typeof qItem?.title !== 'string' ||
            typeof qItem?.description !== 'string' ||
            !Number.isInteger(Number(qItem?.durationMinutes))
          ) {
            throw new Error('Invalid quiz entry in backup file.');
          }

          const info = insertQuiz.run(
            qItem.title.trim().slice(0, 140),
            qItem.description.trim().slice(0, 600),
            typeof qItem.category === 'string' && qItem.category.trim() ? qItem.category.trim() : 'General',
            parseDifficulty(qItem.difficulty) ?? 'Medium',
            Math.min(180, Math.max(1, Number(qItem.durationMinutes))),
            Math.min(100, Math.max(1, Number(qItem.passingPercentage ?? 60))),
            qItem.isPublished === false ? 0 : 1,
            req.user!.id
          );
          const newQuizId = Number(info.lastInsertRowid);
          restoredQuizzes += 1;

          const qList = Array.isArray(qItem.questions) ? qItem.questions : [];
          qList.forEach((qs: Record<string, unknown>, index: number) => {
            const opts = Array.isArray(qs?.options) ? qs.options : [];
            if (
              typeof qs?.questionText !== 'string' ||
              opts.length !== 4 ||
              opts.some((o) => typeof o !== 'string' || !o.trim())
            ) {
              throw new Error('Invalid question entry in backup file.');
            }
            const correctOption = Number(qs.correctOption);
            if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption > 3) {
              throw new Error('Invalid correctOption index in backup file.');
            }
            const marks = Math.min(20, Math.max(1, Number(qs.marks ?? 1)));
            insertQuestion.run(
              newQuizId,
              qs.questionText.trim(),
              String(opts[0]).trim(),
              String(opts[1]).trim(),
              String(opts[2]).trim(),
              String(opts[3]).trim(),
              correctOption,
              marks,
              index + 1
            );
            restoredQuestions += 1;
          });
        }
      });

      restoreTx();
      res.status(201).json({ restoredQuizzes, restoredQuestions });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore backup.';
      res.status(400).json({ error: message });
    }
  });

  // Frontend serving (Vite dev middleware in dev, static dist/ in production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizLab server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start QuizLab server:', err);
  process.exit(1);
});
