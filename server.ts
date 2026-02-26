import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { Parser } from "json2csv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hiring_test.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'candidate',
    email TEXT,
    full_name TEXT,
    status TEXT DEFAULT 'Applied',
    attempted_tests TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    department TEXT,
    description TEXT,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
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
    per_question_time INTEGER DEFAULT 0, -- 0 means disabled
    
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    type TEXT DEFAULT 'MCQ', -- MCQ, MULTI, TF, SHORT, FILL, MATCH
    question TEXT,
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
`);

// Seed initial data
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync("admin789", salt);
  const candidateHash = bcrypt.hashSync("pass123", salt);

  const insertUser = db.prepare("INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("admin", adminHash, "admin", "Maavis Admin", "hr@maavisprojects.com");
  insertUser.run("candidate1", candidateHash, "candidate", "John Doe", "john@example.com");

  const insertJob = db.prepare("INSERT INTO jobs (title, department, description) VALUES (?, ?, ?)");
  const civilJobId = insertJob.run("Senior Civil Engineer", "Engineering", "Lead infrastructure projects and site management.").lastInsertRowid;
  const pmJobId = insertJob.run("Project Manager", "Management", "Oversee project timelines, budgets, and stakeholders.").lastInsertRowid;

  const insertTest = db.prepare("INSERT INTO tests (job_id, name, description, total_time) VALUES (?, ?, ?, ?)");
  const civilTestId = insertTest.run(civilJobId, "Civil Engineering Proficiency", "Technical assessment for civil engineers.", 300).lastInsertRowid;
  const pmTestId = insertTest.run(pmJobId, "Project Management Essentials", "Assessment on PMP principles and scheduling.", 300).lastInsertRowid;

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/register", (req, res) => {
    const { username, password, full_name, email } = req.body;
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      db.prepare("INSERT INTO users (username, password_hash, full_name, email) VALUES (?, ?, ?, ?)").run(username, hash, full_name, email);
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Registration failed" });
      }
    }
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (user && bcrypt.compareSync(password, user.password_hash)) {
      res.json({ 
        success: true, 
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

  // Job Routes
  app.get("/api/jobs", (req, res) => {
    const jobs = db.prepare("SELECT * FROM jobs ORDER BY posted_at DESC").all();
    res.json(jobs);
  });

  // Candidate Routes
  app.get("/api/candidates", (req, res) => {
    const candidates = db.prepare("SELECT id, username, full_name, email, status FROM users WHERE role = 'candidate'").all();
    res.json(candidates);
  });

  app.patch("/api/candidates/:username/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE users SET status = ? WHERE username = ?").run(status, req.params.username);
    res.json({ success: true });
  });

  // Test Routes
  app.get("/api/jobs/:id/tests", (req, res) => {
    const tests = db.prepare("SELECT * FROM tests WHERE job_id = ?").all(req.params.id);
    res.json(tests);
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
      name, description, questions, adminUsername, jobId,
      grading_enabled, timing_enabled, randomization_enabled, anti_cheat_enabled,
      attempt_limit, show_answers, total_time, per_question_time
    } = req.body;
    
    const admin = db.prepare("SELECT role FROM users WHERE username = ?").get(adminUsername) as any;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const testId = db.prepare(`
      INSERT INTO tests (
        job_id, name, description, 
        grading_enabled, timing_enabled, randomization_enabled, anti_cheat_enabled,
        attempt_limit, show_answers, total_time, per_question_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId || null, name, description,
      grading_enabled ? 1 : 0, timing_enabled ? 1 : 0, randomization_enabled ? 1 : 0, anti_cheat_enabled ? 1 : 0,
      attempt_limit || 1, show_answers ? 1 : 0, total_time || 300, per_question_time || 0
    ).lastInsertRowid;

    const insertQ = db.prepare("INSERT INTO questions (test_id, question, options, answer, type, points) VALUES (?, ?, ?, ?, ?, ?)");
    
    questions.forEach((q: any) => {
      insertQ.run(
        testId, q.question, 
        q.options ? JSON.stringify(q.options) : null, 
        typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer),
        q.type || 'MCQ',
        q.points || 1
      );
    });

    res.json({ success: true, testId });
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
        const correct = JSON.parse(q.answer);
        if (Array.isArray(userAns) && userAns.length === correct.length && userAns.every(v => correct.includes(v))) {
          score += q.points;
        }
      } else if (q.type === 'SHORT' || q.type === 'FILL') {
        if (q.answer.toLowerCase().trim() === userAns.toLowerCase().trim()) {
          score += q.points;
        } else {
          manualReviewNeeded = 1;
        }
      } else if (q.type === 'MATCH') {
        const correct = JSON.parse(q.answer);
        const userPairs = userAns; // Object
        let allMatch = true;
        for (const key in correct) {
          if (correct[key] !== userPairs[key]) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) score += q.points;
      }
    });

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
      showAnswers: !!test.show_answers
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
