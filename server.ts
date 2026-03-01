import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { Parser } from "json2csv";
import nodemailer from "nodemailer";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support external data directory for persistent storage
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, "hiring_test.db");

const db = new Database(DB_PATH);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'candidate',
    email TEXT UNIQUE,
    full_name TEXT,
    status TEXT DEFAULT 'Applied',
    attempted_tests TEXT DEFAULT '[]',
    verified INTEGER DEFAULT 0,
    verification_token TEXT
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS email_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    test_id INTEGER,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Modular Config
    grading_enabled INTEGER DEFAULT 1,
    timing_enabled INTEGER DEFAULT 1,
    randomization_enabled INTEGER DEFAULT 1,
    anti_cheat_enabled INTEGER DEFAULT 1,
    attempt_limit INTEGER DEFAULT 1,
    show_answers INTEGER DEFAULT 0,
    
    total_time INTEGER DEFAULT 300, -- in seconds
    per_question_time INTEGER DEFAULT 0 -- 0 means disabled
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    type TEXT DEFAULT 'MCQ', -- MCQ, MULTI, TF, SHORT, FILL, MATCH
    question TEXT,
    image_url TEXT,
    options TEXT, -- JSON array of strings or objects for MATCH
    answer TEXT, -- JSON string or array
    points INTEGER DEFAULT 1,
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    test_id INTEGER,
    score REAL,
    total REAL,
    answers TEXT, -- JSON of user answers
    tab_switches INTEGER DEFAULT 0,
    manual_review_needed INTEGER DEFAULT 0,
    feedback TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    user_id INTEGER,
    test_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, test_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );
`);

// Seed initial data
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync("admin789", salt);

  const insertUser = db.prepare("INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("admin", adminHash, "admin", "Maavis Admin", "hr@maavisprojects.com");

  const insertTest = db.prepare("INSERT INTO tests (name, description, total_time) VALUES (?, ?, ?)");
  const civilTestId = insertTest.run("Civil Engineering Proficiency", "Technical assessment for civil engineers.", 300).lastInsertRowid;
  const pmTestId = insertTest.run("Project Management Essentials", "Assessment on PMP principles and scheduling.", 300).lastInsertRowid;

  const insertQ = db.prepare("INSERT INTO questions (test_id, question, options, answer, type) VALUES (?, ?, ?, ?, ?)");
  
  // MCQ
  insertQ.run(civilTestId, "What is the primary purpose of a retaining wall?", JSON.stringify(["Decoration", "Soil stability", "Water storage", "Soundproofing"]), "Soil stability", "MCQ");
  
  // True/False
  insertQ.run(civilTestId, "Concrete has high tensile strength.", JSON.stringify(["True", "False"]), "False", "TF");
  
  // Multiple Answer
  insertQ.run(pmTestId, "Which of the following are project management methodologies? (Select all that apply)", JSON.stringify(["Agile", "Waterfall", "Scrum", "Python"]), JSON.stringify(["Agile", "Waterfall", "Scrum"]), "MULTI");
  
  // Short Answer
  insertQ.run(pmTestId, "What does PMP stand for?", null, "Project Management Professional", "SHORT");

  // Matching
  const matchingOptions = {
    left: ["Agile", "Waterfall", "Scrum"],
    right: ["Iterative", "Sequential", "Framework"]
  };
  const matchingAnswer = {
    "Agile": "Iterative",
    "Waterfall": "Sequential",
    "Scrum": "Framework"
  };
  insertQ.run(pmTestId, "Match the methodology with its characteristic:", JSON.stringify(matchingOptions), JSON.stringify(matchingAnswer), "MATCH");
}

// Email Transporter (Placeholder - user should configure)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("📧 Email simulation (No SMTP config):", { to, subject });
    return;
  }
  try {
    await transporter.sendMail({ from: `"MAAVIS Hub" <${process.env.SMTP_USER}>`, to, subject, html });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to capture App URL
  app.use((req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    const currentUrl = `${protocol}://${host}`;
    
    const existingUrl = db.prepare("SELECT value FROM config WHERE key = 'app_url'").get() as any;
    if (!existingUrl) {
      db.prepare("INSERT INTO config (key, value) VALUES ('app_url', ?)").run(currentUrl);
      console.log(`🌐 App URL detected and saved: ${currentUrl}`);
    }
    next();
  });

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    const { username, password, full_name, email } = req.body;
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const token = crypto.randomBytes(32).toString('hex');
      
      const result = db.prepare("INSERT INTO users (username, password_hash, full_name, email, verification_token) VALUES (?, ?, ?, ?, ?)").run(username, hash, full_name, email, token);
      const userId = result.lastInsertRowid;

      // Check for pending invites
      const invites = db.prepare("SELECT test_id FROM email_invites WHERE email = ?").all(email) as any[];
      for (const invite of invites) {
        db.prepare("INSERT OR IGNORE INTO assignments (user_id, test_id) VALUES (?, ?)").run(userId, invite.test_id);
      }
      db.prepare("DELETE FROM email_invites WHERE email = ?").run(email);

      // Send verification email
      const appUrl = (db.prepare("SELECT value FROM config WHERE key = 'app_url'").get() as any)?.value || `http://localhost:3000`;
      await sendEmail(email, "Verify your MAAVIS account", `
        <h1>Welcome to MAAVIS Talent Hub</h1>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${appUrl}/api/verify?token=${token}">Verify Email</a>
      `);

      res.json({ success: true, message: "Registration successful. Please check your email for verification." });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username or Email already exists" });
      } else {
        res.status(500).json({ error: "Registration failed: " + err.message });
      }
    }
  });

  app.get("/api/verify", (req, res) => {
    const { token } = req.query;
    const user = db.prepare("SELECT id FROM users WHERE verification_token = ?").get(token) as any;
    if (user) {
      db.prepare("UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?").run(user.id);
      res.send("<h1>Email Verified!</h1><p>You can now log in to the MAAVIS Talent Hub.</p><a href='/'>Go to Login</a>");
    } else {
      res.status(400).send("Invalid or expired token.");
    }
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (user && bcrypt.compareSync(password, user.password_hash)) {
      if (user.role === 'candidate' && user.verified === 0) {
        return res.status(403).json({ error: "Please verify your email before logging in." });
      }
      res.json({ 
        success: true, 
        id: user.id,
        username: user.username, 
        role: user.role,
        full_name: user.full_name,
        status: user.status,
        attempted_tests: JSON.parse(user.attempted_tests || '[]')
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Candidate Routes
  app.get("/api/candidates", (req, res) => {
    const candidates = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.email, u.status,
             (SELECT COUNT(*) FROM results r WHERE r.username = u.username) as tests_taken
      FROM users u 
      WHERE u.role = 'candidate'
    `).all();
    res.json(candidates);
  });

  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT id, username, full_name, email, role, status FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/users", (req, res) => {
    const { username, password, full_name, email, role } = req.body;
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      db.prepare("INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)").run(username, hash, full_name, email, role || 'candidate');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: "User creation failed: " + err.message });
    }
  });

  app.patch("/api/admin/users/:username/password", (req, res) => {
    const { password } = req.body;
    const { username } = req.params;
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, username);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Password update failed" });
    }
  });

  app.delete("/api/admin/users/:username", (req, res) => {
    const { username } = req.params;
    try {
      const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
      if (user) {
        db.prepare("DELETE FROM assignments WHERE user_id = ?").run(user.id);
      }
      // Also delete results for this user
      db.prepare("DELETE FROM results WHERE username = ?").run(username);
      db.prepare("DELETE FROM users WHERE username = ?").run(username);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "User deletion failed" });
    }
  });

  app.get("/api/candidates/:username/results", (req, res) => {
    const results = db.prepare(`
      SELECT r.*, t.name as test_name 
      FROM results r 
      JOIN tests t ON r.test_id = t.id 
      WHERE r.username = ?
      ORDER BY r.timestamp DESC
    `).all(req.params.username);
    res.json(results);
  });

  app.patch("/api/candidates/:username/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE users SET status = ? WHERE username = ?").run(status, req.params.username);
    res.json({ success: true });
  });

  // Assignment Routes
  /* ================= ADMIN INVITE ROUTE ================= */

app.post("/api/admin/invite", async (req, res) => {
  try {
    const { email, testId } = req.body;

    if (!email || !testId) {
      return res.status(400).json({ error: "Missing email or testId" });
    }

    const test = db.prepare(
      "SELECT name FROM tests WHERE id = ?"
    ).get(testId) as any;

    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // check if user already exists
    const user = db.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).get(email) as any;

    if (user) {
      db.prepare(
        "INSERT OR IGNORE INTO assignments (user_id, test_id) VALUES (?, ?)"
      ).run(user.id, testId);
    } else {
      db.prepare(
        "INSERT INTO email_invites (email, test_id) VALUES (?, ?)"
      ).run(email, testId);
    }

    const appUrl =
      (db.prepare(
        "SELECT value FROM config WHERE key = 'app_url'"
      ).get() as any)?.value || "http://localhost:3000";

    await sendEmail(
      email,
      `Assessment Invite: ${test.name}`,
      `
      <h2>MAAVIS Talent Hub</h2>
      <p>You have been invited to complete:</p>
      <b>${test.name}</b>
      <br/><br/>
      <a href="${appUrl}">Start Assessment</a>
      `
    );

    res.json({ success: true });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    res.status(500).json({ error: "Invite failed" });
  }
});
  // Test Routes
  app.get("/api/tests", (req, res) => {
    const { user_id } = req.query;
    if (user_id) {
      const tests = db.prepare(`
        SELECT t.* 
        FROM tests t 
        JOIN assignments a ON t.id = a.test_id 
        WHERE a.user_id = ?
        ORDER BY t.created_at DESC
      `).all(user_id);
      res.json(tests);
    } else {
      const tests = db.prepare("SELECT * FROM tests ORDER BY created_at DESC").all();
      res.json(tests);
    }
  });

  app.get("/api/tests/:id", (req, res) => {
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(req.params.id);
    const questions = db.prepare("SELECT * FROM questions WHERE test_id = ?").all(req.params.id) as any[];
    res.json({ 
      ...test, 
      questions: questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        answer: (q.type === 'MCQ' || q.type === 'TF' || q.type === 'SHORT' || q.type === 'FILL') ? q.answer : JSON.parse(q.answer)
      }))
    });
  });

  app.get("/api/tests/:id/questions", (req, res) => {
    const test = db.prepare("SELECT randomization_enabled FROM tests WHERE id = ?").get(req.params.id) as any;
    const questions = db.prepare("SELECT id, question, options, type, points FROM questions WHERE test_id = ?").all(req.params.id) as any[];
    
    const formatted = questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null
    }));

    if (test && test.randomization_enabled) {
      res.json(formatted.sort(() => Math.random() - 0.5));
    } else {
      res.json(formatted);
    }
  });

  app.post("/api/tests", (req, res) => {
    const { 
      name, description, questions, adminUsername,
      grading_enabled, timing_enabled, randomization_enabled, anti_cheat_enabled,
      attempt_limit, show_answers, total_time, per_question_time
    } = req.body;
    
    const admin = db.prepare("SELECT role FROM users WHERE username = ?").get(adminUsername) as any;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const testId = db.prepare(`
      INSERT INTO tests (
        name, description, 
        grading_enabled, timing_enabled, randomization_enabled, anti_cheat_enabled,
        attempt_limit, show_answers, total_time, per_question_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, description,
      grading_enabled ? 1 : 0, timing_enabled ? 1 : 0, randomization_enabled ? 1 : 0, anti_cheat_enabled ? 1 : 0,
      attempt_limit || 1, show_answers ? 1 : 0, total_time || 300, per_question_time || 0
    ).lastInsertRowid;

    const insertQ = db.prepare("INSERT INTO questions (test_id, question, image_url, options, answer, type, points) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    questions.forEach((q: any) => {
      insertQ.run(
        testId, q.question, q.image_url || null,
        q.options ? JSON.stringify(q.options) : null, 
        typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer),
        q.type || 'MCQ',
        q.points || 1
      );
    });

    res.json({ success: true, testId });
  });

  app.put("/api/tests/:id", (req, res) => {
    const { 
      name, description, questions, adminUsername,
      grading_enabled, timing_enabled, randomization_enabled, anti_cheat_enabled,
      attempt_limit, show_answers, total_time, per_question_time
    } = req.body;
    
    const admin = db.prepare("SELECT role FROM users WHERE username = ?").get(adminUsername) as any;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    db.prepare(`
      UPDATE tests SET 
        name = ?, description = ?, 
        grading_enabled = ?, timing_enabled = ?, randomization_enabled = ?, anti_cheat_enabled = ?,
        attempt_limit = ?, show_answers = ?, total_time = ?, per_question_time = ?
      WHERE id = ?
    `).run(
      name, description,
      grading_enabled ? 1 : 0, timing_enabled ? 1 : 0, randomization_enabled ? 1 : 0, anti_cheat_enabled ? 1 : 0,
      attempt_limit || 1, show_answers ? 1 : 0, total_time || 300, per_question_time || 0,
      req.params.id
    );

    // Refresh questions
    db.prepare("DELETE FROM questions WHERE test_id = ?").run(req.params.id);
    const insertQ = db.prepare("INSERT INTO questions (test_id, question, image_url, options, answer, type, points) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    questions.forEach((q: any) => {
      insertQ.run(
        req.params.id, q.question, q.image_url || null,
        q.options ? JSON.stringify(q.options) : null, 
        typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer),
        q.type || 'MCQ',
        q.points || 1
      );
    });

    res.json({ success: true });
  });

  app.post("/api/tests/:id/submit", (req, res) => {
    const { username, answers, tab_switches } = req.body;
    const testId = req.params.id;
    
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(testId) as any;
    if (!test) return res.status(404).json({ error: "Test not found" });

    const user = db.prepare("SELECT attempted_tests FROM users WHERE username = ?").get(username) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const attempted = JSON.parse(user.attempted_tests || '[]');
    const attemptsCount = attempted.filter((id: number) => id === Number(testId)).length;
    
    if (attemptsCount >= test.attempt_limit) {
      return res.status(403).json({ error: "Attempt limit reached" });
    }

    const allQuestions = db.prepare("SELECT * FROM questions WHERE test_id = ?").all(testId) as any[];
    let score = 0;
    let totalPoints = 0;
    let manualReviewNeeded = 0;

    allQuestions.forEach(q => {
      totalPoints += q.points;
      const userAns = answers.find((a: any) => a.id === q.id)?.answer;
      
      if (!userAns) return;

      if (q.type === 'MCQ' || q.type === 'TF') {
        if (q.answer === userAns) score += q.points;
      } else if (q.type === 'MULTI') {
        const correct = JSON.parse(q.answer) as string[];
        const userArr = Array.isArray(userAns) ? userAns : [];
        
        // Partial credit logic: (Correct selected - Incorrect selected) / Total Correct
        let correctCount = 0;
        userArr.forEach(val => {
          if (correct.includes(val)) correctCount++;
          else correctCount--; // Penalty for wrong choice
        });
        
        const earned = Math.max(0, (correctCount / correct.length) * q.points);
        score += earned;
      } else if (q.type === 'SHORT' || q.type === 'FILL') {
        const normalizedCorrect = q.answer.toLowerCase().trim();
        const normalizedUser = String(userAns).toLowerCase().trim();
        if (normalizedCorrect === normalizedUser) {
          score += q.points;
        } else {
          manualReviewNeeded = 1;
        }
      } else if (q.type === 'MATCH') {
        const correct = JSON.parse(q.answer) as Record<string, string>;
        const userPairs = userAns as Record<string, string>;
        const keys = Object.keys(correct);
        let matchCount = 0;
        
        keys.forEach(key => {
          if (correct[key] === userPairs[key]) matchCount++;
        });
        
        const earned = (matchCount / keys.length) * q.points;
        score += earned;
      }
    });

    // Round score to 2 decimal places
    score = Math.round(score * 100) / 100;

    attempted.push(Number(testId));
    db.prepare("UPDATE users SET attempted_tests = ? WHERE username = ?").run(JSON.stringify(attempted), username);
    
    db.prepare(`
      INSERT INTO results (username, test_id, score, total, answers, tab_switches, manual_review_needed) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(username, testId, score, totalPoints, JSON.stringify(answers), tab_switches || 0, manualReviewNeeded);

    res.json({ 
      success: true, 
      score, 
      total: totalPoints, 
      manualReviewNeeded: !!manualReviewNeeded,
      showAnswers: !!test.show_answers,
      gradingEnabled: !!test.grading_enabled
    });
  });

  app.get("/api/results", (req, res) => {
    const results = db.prepare(`
      SELECT r.*, t.name as test_name, u.full_name 
      FROM results r 
      JOIN tests t ON r.test_id = t.id 
      JOIN users u ON r.username = u.username
      ORDER BY r.timestamp DESC
    `).all();
    res.json(results);
  });

  app.get("/api/results/:id/details", (req, res) => {
    const result = db.prepare(`
      SELECT r.*, t.name as test_name, u.full_name 
      FROM results r 
      JOIN tests t ON r.test_id = t.id 
      JOIN users u ON r.username = u.username
      WHERE r.id = ?
    `).get(req.params.id) as any;

    if (!result) return res.status(404).json({ error: "Result not found" });

    const questions = db.prepare("SELECT * FROM questions WHERE test_id = ?").all(result.test_id) as any[];
    
    res.json({
      ...result,
      answers: JSON.parse(result.answers || '[]'),
      questions: questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        answer: (q.type === 'MCQ' || q.type === 'TF' || q.type === 'SHORT' || q.type === 'FILL') ? q.answer : JSON.parse(q.answer)
      }))
    });
  });

  app.get("/api/results/export", (req, res) => {
    const results = db.prepare(`
      SELECT r.id, u.full_name, u.username, t.name as test_name, r.score, r.total, r.tab_switches, r.timestamp 
      FROM results r 
      JOIN tests t ON r.test_id = t.id 
      JOIN users u ON r.username = u.username
    `).all();
    
    try {
      const parser = new Parser();
      const csv = parser.parse(results);
      res.header('Content-Type', 'text/csv');
      res.attachment('results.csv');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.patch("/api/results/:id/feedback", (req, res) => {
    const { feedback } = req.body;
    db.prepare("UPDATE results SET feedback = ? WHERE id = ?").run(feedback, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/tests/:id", (req, res) => {
    const testId = req.params.id;
    db.prepare("DELETE FROM questions WHERE test_id = ?").run(testId);
    db.prepare("DELETE FROM tests WHERE id = ?").run(testId);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
