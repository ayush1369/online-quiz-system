import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'quizlab.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
    duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
    passing_percentage INTEGER NOT NULL DEFAULT 60 CHECK(passing_percentage BETWEEN 1 AND 100),
    is_published INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option INTEGER NOT NULL CHECK(correct_option BETWEEN 0 AND 3),
    marks INTEGER NOT NULL DEFAULT 1 CHECK(marks > 0),
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    submitted_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('in_progress', 'submitted', 'expired')),
    score INTEGER NOT NULL DEFAULT 0,
    total_marks INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    percentage REAL NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    auto_submitted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS attempt_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option INTEGER,
    is_correct INTEGER NOT NULL DEFAULT 0,
    UNIQUE(attempt_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS quiz_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
    attempt_id INTEGER REFERENCES quiz_attempts(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    topic TEXT NOT NULL DEFAULT 'Quiz Content',
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
if (!userColumns.some((col) => col.name === 'avatar_url')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
}

const quizColumns = db.prepare('PRAGMA table_info(quizzes)').all() as Array<{ name: string }>;
if (!quizColumns.some((col) => col.name === 'difficulty')) {
  db.exec(
    "ALTER TABLE quizzes ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK(difficulty IN ('Easy', 'Medium', 'Hard'));"
  );
}

function seedInitialQuizzes(): void {
  const alreadySeeded = db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get('seeded_v1') as { value: string } | undefined;

  if (alreadySeeded) {
    return;
  }

  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (title, description, category, difficulty, duration_minutes, passing_percentage, is_published)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  const insertQuestion = db.prepare(`
    INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedTx = db.transaction(() => {
    const srsQuiz = insertQuiz.run(
      'Software Requirements Engineering',
      'Core concepts from requirements analysis: functional vs. non-functional requirements, SRS structure, dependency mapping, and stakeholder ownership.',
      'Software Engineering',
      'Easy',
      10,
      60
    );
    const srsId = Number(srsQuiz.lastInsertRowid);

    const srsQuestions: Array<[string, string, string, string, string, number, number]> = [
      [
        'Which distinction best separates Functional Requirements from Non-Functional Requirements in an SRS document?',
        'Functional requirements describe what the system should do; non-functional requirements describe how well it should perform',
        'Functional requirements apply only to administrators; non-functional requirements apply only to end users',
        'Functional requirements are written after deployment; non-functional requirements are written during prototyping',
        'Functional requirements specify server hardware; non-functional requirements specify database table names',
        0,
        2,
      ],
      [
        'In a standard Software Requirements Specification, which stage directly follows submitting quiz answers?',
        'User Registration',
        'Automatic Evaluation',
        'Create Quiz',
        'View Available Quizzes',
        1,
        2,
      ],
      [
        'What is the primary goal of documenting requirement dependencies in an SRS?',
        'To replace database schema design entirely',
        'To trace build order, impact analysis, and prerequisite functionality across modules',
        'To eliminate the need for user authentication',
        'To compress UI stylesheets before production deployment',
        1,
        2,
      ],
      [
        'Which Non-Functional Requirement addresses protecting user passwords and preventing unauthorized access to records?',
        'Usability',
        'Compatibility',
        'Security',
        'Scalability',
        2,
        2,
      ],
      [
        'When a timed online quiz countdown reaches zero, what should the assessment system do?',
        'Discard all selected options and lock the user account',
        'Reset the timer back to full duration automatically',
        'Automatically submit the quiz for evaluation',
        'Prompt the administrator to manually grade the attempt',
        2,
        2,
      ],
    ];

    srsQuestions.forEach((q, idx) => {
      insertQuestion.run(srsId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], idx + 1);
    });

    const dsaQuiz = insertQuiz.run(
      'Data Structures & Algorithms Fundamentals',
      'Asymptotic complexity, balanced search trees, hash tables, graph traversal strategies, and linear data structures.',
      'Computer Science',
      'Hard',
      12,
      60
    );
    const dsaId = Number(dsaQuiz.lastInsertRowid);

    const dsaQuestions: Array<[string, string, string, string, string, number, number]> = [
      [
        'What is the average-case time complexity for looking up a key in a well-sized hash table?',
        'O(n)',
        'O(log n)',
        'O(1)',
        'O(n log n)',
        2,
        2,
      ],
      [
        'Which traversal order of a Binary Search Tree (BST) yields keys in non-decreasing sorted order?',
        'Pre-order traversal',
        'In-order traversal',
        'Post-order traversal',
        'Breadth-first level order',
        1,
        2,
      ],
      [
        'Which data structure is used internally by Breadth-First Search (BFS) to track frontier vertices?',
        'Priority Min-Heap',
        'LIFO Stack',
        'FIFO Queue',
        'Disjoint-Set Union',
        2,
        2,
      ],
      [
        'What is the worst-case time complexity of Merge Sort on an array of n elements?',
        'O(n)',
        'O(n log n)',
        'O(n^2)',
        'O(log n)',
        1,
        2,
      ],
      [
        'Which property guarantees that an AVL tree maintains O(log n) search height?',
        'Every leaf node resides at the exact same depth',
        'The height difference between left and right subtrees of any node is at most 1',
        'Every parent key is strictly smaller than all descendant keys',
        'All internal nodes have exactly two children',
        1,
        2,
      ],
    ];

    dsaQuestions.forEach((q, idx) => {
      insertQuestion.run(dsaId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], idx + 1);
    });

    const dbQuiz = insertQuiz.run(
      'Web Engineering & Relational Databases',
      'Parameterized SQL queries, ACID transactions, REST API status semantics, password hashing, and authentication boundaries.',
      'Systems & Web',
      'Medium',
      10,
      60
    );
    const dbId = Number(dbQuiz.lastInsertRowid);

    const dbQuestions: Array<[string, string, string, string, string, number, number]> = [
      [
        'Why should backend database queries always use parameterized placeholders instead of string interpolation?',
        'To reduce JSON payload size over HTTP',
        'To separate SQL syntax from untrusted input and prevent SQL injection',
        'To bypass foreign key constraints in relational tables',
        'To allow browsers to execute SQL directly from HTML',
        1,
        2,
      ],
      [
        'Which HTTP status code indicates that a request requires valid user authentication credentials?',
        '201 Created',
        '401 Unauthorized',
        '404 Not Found',
        '502 Bad Gateway',
        1,
        2,
      ],
      [
        'In ACID transactions, what does Atomicity guarantee?',
        'Multiple concurrent queries run on separate CPU cores',
        'All operations in a transaction succeed together or roll back completely',
        'Database tables automatically compress old rows after 30 days',
        'Indexes are rebuilt after every single SELECT query',
        1,
        2,
      ],
      [
        'Why is a slow, salted key derivation function such as scrypt preferred over plain SHA-256 for storing user passwords?',
        'scrypt produces shorter 4-character hashes for easy memorization',
        'scrypt allows the server to decrypt passwords back to plaintext',
        'Per-user salts block rainbow tables and memory-hard hashing slows brute-force attacks',
        'Plain SHA-256 cannot hash strings longer than 16 characters',
        2,
        2,
      ],
      [
        'Where should automatic quiz answer grading (FR10) execute to preserve data integrity and prevent client tampering?',
        'Inside a hidden CSS attribute on the browser quiz card',
        'On the backend server comparing submitted answers against stored database keys',
        'Inside URL query parameters sent back to the client',
        'Inside a static JSON file bundled into public frontend assets',
        1,
        2,
      ],
    ];

    dbQuestions.forEach((q, idx) => {
      insertQuestion.run(dbId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], idx + 1);
    });

    db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run('seeded_v1', 'true');
  });

  seedTx();
}

seedInitialQuizzes();
