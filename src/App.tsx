import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User, 
  Timer, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  LogOut,
  ShieldAlert,
  ClipboardX,
  MousePointer2,
  Plus,
  Trash2,
  Download,
  Settings,
  Eye,
  MessageSquare,
  CheckSquare,
  AlignLeft,
  Type as TypeIcon,
  Layers,
  Check
} from 'lucide-react';

// Types
interface Question {
  id: number;
  question: string;
  type: 'MCQ' | 'MULTI' | 'TF' | 'SHORT' | 'FILL' | 'MATCH';
  options: any;
  points: number;
}

interface Answer {
  id: number;
  answer: any;
}

interface Job {
  id: number;
  title: string;
  department: string;
  description: string;
}

interface Test {
  id: number;
  name: string;
  description: string;
  grading_enabled: boolean;
  timing_enabled: boolean;
  randomization_enabled: boolean;
  anti_cheat_enabled: boolean;
  attempt_limit: number;
  show_answers: boolean;
  total_time: number;
  per_question_time: number;
}

interface Result {
  id: number;
  username: string;
  full_name: string;
  test_name: string;
  score: number;
  total: number;
  timestamp: string;
  tab_switches: number;
  manual_review_needed: boolean;
  feedback: string;
  answers: string;
}

interface Candidate {
  id: number;
  username: string;
  full_name: string;
  email: string;
  status: string;
}

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard' | 'admin' | 'instructions' | 'test' | 'result'>('login');
  const [userRole, setUserRole] = useState<'candidate' | 'admin'>('candidate');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [score, setScore] = useState<{ score: number; total: number; manualReviewNeeded: boolean; showAnswers: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<number[]>([]);
  const [allResults, setAllResults] = useState<Result[]>([]);
  
  // Admin Create Test State
  const [newTestName, setNewTestName] = useState('');
  const [newTestDesc, setNewTestDesc] = useState('');
  const [newTestJobId, setNewTestJobId] = useState<number | ''>('');
  const [newTestConfig, setNewTestConfig] = useState({
    grading_enabled: true,
    timing_enabled: true,
    randomization_enabled: true,
    anti_cheat_enabled: true,
    attempt_limit: 1,
    show_answers: false,
    total_time: 300,
    per_question_time: 0
  });
  const [newQuestions, setNewQuestions] = useState<any[]>([
    { question: '', type: 'MCQ', options: ['', '', '', ''], answer: '', points: 1 }
  ]);
  
  // Matching state for test taking
  const [matchingPairs, setMatchingPairs] = useState<{[key: string]: string}>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, full_name: fullName, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Registration successful! Please login.');
        setView('login');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      setAllResults(data);
    } catch (err) {
      setError('Failed to load results');
    }
  };

  const handleAnswer = (qId: number, answer: any) => {
    setCurrentAnswers(prev => {
      const filtered = prev.filter(a => a.id !== qId);
      return [...filtered, { id: qId, answer }];
    });
  };

  const handleMatching = (qId: number, left: string, right: string) => {
    const newPairs = { ...matchingPairs, [left]: right };
    setMatchingPairs(newPairs);
    handleAnswer(qId, newPairs);
    setSelectedLeft(null);
  };

  const exportResults = () => {
    window.open('/api/results/export', '_blank');
  };

  const handleFeedback = async (resId: number, feedback: string) => {
    try {
      await fetch(`/api/results/${resId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      fetchResults();
    } catch (err) {
      alert('Failed to save feedback');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserRole(data.role);
        setFullName(data.full_name);
        setUserStatus(data.status);
        setAttemptedIds(data.attempted_tests);
        if (data.role === 'admin') {
          fetchResults();
          fetchCandidates();
          fetchJobs();
          setView('admin');
        } else {
          fetchJobs();
          setView('dashboard');
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      setError('Failed to load jobs');
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates');
      const data = await res.json();
      setCandidates(data);
    } catch (err) {
      setError('Failed to load candidates');
    }
  };

  const fetchTestsForJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/tests`);
      const data = await res.json();
      setTests(data);
    } catch (err) {
      setError('Failed to load tests');
    }
  };

  const updateCandidateStatus = async (targetUsername: string, status: string) => {
    try {
      const res = await fetch(`/api/candidates/${targetUsername}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchCandidates();
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const startTest = async (test: Test) => {
    const attempts = attemptedIds.filter(id => id === test.id).length;
    if (attempts >= test.attempt_limit) return;
    try {
      const res = await fetch(`/api/tests/${test.id}/questions`);
      const data = await res.json();
      setQuestions(data);
      setSelectedTest(test);
      setTimeLeft(test.total_time);
      setCurrentAnswers([]);
      setTabSwitchCount(0);
      setMatchingPairs({});
      setView('instructions');
    } catch (err) {
      setError('Failed to load questions');
    }
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !selectedTest) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tests/${selectedTest.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, answers: currentAnswers, tab_switches: tabSwitchCount }),
      });
      const data = await res.json();
      if (res.ok) {
        setScore({ 
          score: data.score, 
          total: data.total, 
          manualReviewNeeded: data.manualReviewNeeded,
          showAnswers: data.showAnswers
        });
        setAttemptedIds(prev => [...prev, selectedTest.id]);
        setView('result');
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch (err) {
      setError('Submission error');
    } finally {
      setIsSubmitting(false);
    }
  }, [username, currentAnswers, isSubmitting, selectedTest, tabSwitchCount]);

  const handleCreateTest = async () => {
    if (!newTestName || !newTestDesc || !newTestJobId) return;
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newTestName, 
          description: newTestDesc, 
          questions: newQuestions,
          adminUsername: username,
          jobId: newTestJobId,
          ...newTestConfig
        }),
      });
      if (res.ok) {
        setNewTestName('');
        setNewTestDesc('');
        setNewTestJobId('');
        setNewQuestions([{ question: '', type: 'MCQ', options: ['', '', '', ''], answer: '', points: 1 }]);
        alert('Test created successfully!');
      }
    } catch (err) {
      alert('Failed to create test');
    }
  };

  useEffect(() => {
    if (view === 'test' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (view === 'test' && timeLeft === 0) {
      handleSubmit();
    }
  }, [view, timeLeft, handleSubmit]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && view === 'test' && selectedTest?.anti_cheat_enabled) {
        setTabSwitchCount(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [view, selectedTest]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (view === 'test' && selectedTest?.anti_cheat_enabled) e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [view, selectedTest]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans selection:bg-amber-100">
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-center min-h-screen p-4 bg-[#0F172A]"
          >
            <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl border border-white/10">
              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 bg-[#0F172A] rounded-3xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-4xl font-serif font-black text-amber-500 italic">M</span>
                </div>
                <h1 className="text-3xl font-serif font-medium text-center text-[#0F172A]">Maavis Talent Hub</h1>
                <p className="text-sm text-black/40 mt-2">Infrastructure & Projects Recruitment</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-black/5 border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/5 border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 text-emerald-500 text-sm bg-emerald-50 p-3 rounded-xl"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {success}
                  </motion.div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-full py-4 font-medium transition-all flex items-center justify-center gap-2 group shadow-lg"
                >
                  Access Hub
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-amber-500" />
                </button>

                <p className="text-center text-sm text-black/40 mt-4">
                  New candidate? <button type="button" onClick={() => setView('register')} className="text-amber-600 font-bold hover:underline">Register here</button>
                </p>
              </form>
            </div>
          </motion.div>
        )}

        {view === 'register' && (
          <motion.div 
            key="register"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-center min-h-screen p-4 bg-[#0F172A]"
          >
            <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl border border-white/10">
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-[#0F172A] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-3xl font-serif font-black text-amber-500 italic">M</span>
                </div>
                <h1 className="text-2xl font-serif font-medium text-center text-[#0F172A]">Join Maavis Talent</h1>
                <p className="text-xs text-black/40 mt-2">Create your candidate profile</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black/5 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                    placeholder="Choose a username"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-black/5 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                    placeholder="Your legal name"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/5 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                    placeholder="email@example.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-black/40 ml-1">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/5 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none"
                    placeholder="Create a strong password"
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-full py-4 font-medium transition-all shadow-lg"
                >
                  Create Account
                </button>

                <button 
                  type="button" 
                  onClick={() => setView('login')}
                  className="w-full text-center text-sm text-black/40 hover:text-black transition-colors"
                >
                  Already have an account? Login
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {view === 'dashboard' && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-6xl mx-auto py-12 px-4"
          >
            <div className="flex justify-between items-center mb-12 bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-[#0F172A] rounded-2xl flex items-center justify-center">
                  <span className="text-xl font-serif font-black text-amber-500 italic">M</span>
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-medium">Candidate Dashboard</h2>
                  <p className="text-black/50 text-sm">Welcome, {fullName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right mr-4">
                  <p className="text-[10px] uppercase tracking-widest text-black/30">Application Status</p>
                  <p className={`text-sm font-bold ${userStatus === 'Hired' ? 'text-emerald-600' : 'text-amber-600'}`}>{userStatus}</p>
                </div>
                <button onClick={() => setView('login')} className="p-3 bg-black/5 hover:bg-black/10 rounded-2xl transition-colors">
                  <LogOut className="w-5 h-5 text-black/40" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-xl font-serif font-medium flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-amber-500" />
                  Available Opportunities
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {jobs.map(job => (
                    <motion.div 
                      key={job.id}
                      whileHover={{ x: 4 }}
                      className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex justify-between items-center group cursor-pointer"
                      onClick={() => {
                        setSelectedJob(job);
                        fetchTestsForJob(job.id);
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                            {job.department}
                          </span>
                          <h4 className="text-lg font-medium">{job.title}</h4>
                        </div>
                        <p className="text-sm text-black/40 line-clamp-1">{job.description}</p>
                      </div>
                      <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-serif font-medium flex items-center gap-2">
                  <Timer className="w-5 h-5 text-amber-500" />
                  Required Assessments
                </h3>
                {selectedJob ? (
                  <div className="space-y-4">
                    {tests.length > 0 ? tests.map(test => {
                      const isAttempted = attemptedIds.includes(test.id);
                      return (
                        <div key={test.id} className={`bg-white p-6 rounded-3xl border border-black/5 shadow-sm ${isAttempted ? 'opacity-50' : ''}`}>
                          <h4 className="font-medium mb-2">{test.name}</h4>
                          <p className="text-xs text-black/40 mb-4">{test.description}</p>
                          <button 
                            onClick={() => !isAttempted && startTest(test)}
                            disabled={isAttempted}
                            className={`w-full py-3 rounded-2xl text-sm font-medium transition-all ${
                              isAttempted 
                              ? 'bg-black/5 text-black/30' 
                              : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                            }`}
                          >
                            {isAttempted ? 'Completed' : 'Start Test'}
                          </button>
                        </div>
                      );
                    }) : (
                      <div className="bg-white p-8 rounded-3xl border border-dashed border-black/10 text-center">
                        <p className="text-sm text-black/30 italic">No tests assigned for this role yet.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/50 p-12 rounded-[32px] border border-dashed border-black/10 flex flex-col items-center justify-center text-center">
                    <MousePointer2 className="w-8 h-8 text-black/10 mb-4" />
                    <p className="text-sm text-black/30">Select a job to view assessments</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'admin' && (
          <motion.div 
            key="admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-7xl mx-auto py-12 px-4"
          >
            <div className="flex justify-between items-center mb-12 bg-[#0F172A] p-8 rounded-[40px] shadow-xl">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-serif font-black text-[#0F172A] italic">M</span>
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-medium text-white">Maavis Command Center</h2>
                  <p className="text-amber-500/80 text-sm font-mono tracking-widest uppercase">Modular Assessment Platform</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={exportResults}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all font-medium"
                >
                  <Download className="w-5 h-5" />
                  Export CSV
                </button>
                <button onClick={() => setView('login')} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors text-white">
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {/* Left Column: Pipeline & Results */}
              <div className="xl:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                  <h3 className="text-xl font-serif font-medium mb-6 flex items-center gap-3">
                    <User className="w-5 h-5 text-amber-500" />
                    Candidate Pipeline
                  </h3>
                  <div className="space-y-4">
                    {candidates.map(cand => (
                      <div key={cand.id} className="p-4 bg-black/[0.02] rounded-2xl border border-black/5 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{cand.full_name}</p>
                          <p className="text-[10px] text-black/30">{cand.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <select 
                            value={cand.status}
                            onChange={(e) => updateCandidateStatus(cand.username, e.target.value)}
                            className="text-xs bg-white border border-black/10 rounded-lg px-2 py-1 outline-none"
                          >
                            <option value="Applied">Applied</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="Interviewed">Interviewed</option>
                            <option value="Hired">Hired</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                  <h3 className="text-xl font-serif font-medium mb-6 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                    Assessment Results
                  </h3>
                  <div className="space-y-6">
                    {allResults.map(res => (
                      <div key={res.id} className="p-6 bg-black/[0.02] rounded-3xl border border-black/5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-base block">{res.full_name}</span>
                            <span className="text-xs text-black/40">{res.test_name} • {new Date(res.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-lg font-bold block">{res.score}/{res.total}</span>
                            {res.manual_review_needed && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Manual Review Needed</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="h-2 flex-1 bg-black/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500" 
                              style={{ width: `${(res.score / res.total) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-black/30">{Math.round((res.score / res.total) * 100)}%</span>
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-black/40">
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {res.tab_switches} Switches
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {res.feedback ? 'Feedback Sent' : 'No Feedback'}
                          </div>
                        </div>

                        <div className="pt-2">
                          <textarea 
                            placeholder="Add feedback or review comments..."
                            defaultValue={res.feedback}
                            onBlur={(e) => handleFeedback(res.id, e.target.value)}
                            className="w-full bg-white border border-black/5 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Quiz Creator */}
              <div className="xl:col-span-2">
                <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm sticky top-8">
                  <h3 className="text-2xl font-serif font-medium mb-8 flex items-center gap-3">
                    <Plus className="w-6 h-6 text-amber-500" />
                    Modular Quiz Creator
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2 block">Job Association</label>
                        <select 
                          value={newTestJobId}
                          onChange={e => setNewTestJobId(Number(e.target.value))}
                          className="w-full bg-black/5 border-none rounded-2xl py-4 px-5 outline-none text-sm"
                        >
                          <option value="">Select Job Role</option>
                          {jobs.map(job => (
                            <option key={job.id} value={job.id}>{job.title} ({job.department})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2 block">Quiz Details</label>
                        <input 
                          type="text" 
                          placeholder="Quiz Name"
                          value={newTestName}
                          onChange={e => setNewTestName(e.target.value)}
                          className="w-full bg-black/5 border-none rounded-2xl py-4 px-5 outline-none text-sm mb-3"
                        />
                        <textarea 
                          placeholder="Quiz Description"
                          value={newTestDesc}
                          onChange={e => setNewTestDesc(e.target.value)}
                          className="w-full bg-black/5 border-none rounded-2xl py-4 px-5 outline-none h-24 text-sm resize-none"
                        />
                      </div>
                    </div>

                    {/* Modular Configuration */}
                    <div className="p-6 bg-black/[0.02] rounded-[32px] border border-black/5">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-6 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Module Configuration
                      </h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${newTestConfig.grading_enabled ? 'bg-amber-500' : 'bg-black/10'}`}>
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newTestConfig.grading_enabled ? 'left-5' : 'left-1'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={newTestConfig.grading_enabled} onChange={e => setNewTestConfig({...newTestConfig, grading_enabled: e.target.checked})} />
                            <span className="text-xs font-medium text-black/70 group-hover:text-black">Auto Grading</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${newTestConfig.timing_enabled ? 'bg-amber-500' : 'bg-black/10'}`}>
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newTestConfig.timing_enabled ? 'left-5' : 'left-1'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={newTestConfig.timing_enabled} onChange={e => setNewTestConfig({...newTestConfig, timing_enabled: e.target.checked})} />
                            <span className="text-xs font-medium text-black/70 group-hover:text-black">Timer Module</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${newTestConfig.randomization_enabled ? 'bg-amber-500' : 'bg-black/10'}`}>
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newTestConfig.randomization_enabled ? 'left-5' : 'left-1'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={newTestConfig.randomization_enabled} onChange={e => setNewTestConfig({...newTestConfig, randomization_enabled: e.target.checked})} />
                            <span className="text-xs font-medium text-black/70 group-hover:text-black">Randomize Order</span>
                          </label>
                        </div>
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${newTestConfig.anti_cheat_enabled ? 'bg-amber-500' : 'bg-black/10'}`}>
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newTestConfig.anti_cheat_enabled ? 'left-5' : 'left-1'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={newTestConfig.anti_cheat_enabled} onChange={e => setNewTestConfig({...newTestConfig, anti_cheat_enabled: e.target.checked})} />
                            <span className="text-xs font-medium text-black/70 group-hover:text-black">Anti-Cheat</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${newTestConfig.show_answers ? 'bg-amber-500' : 'bg-black/10'}`}>
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newTestConfig.show_answers ? 'left-5' : 'left-1'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={newTestConfig.show_answers} onChange={e => setNewTestConfig({...newTestConfig, show_answers: e.target.checked})} />
                            <span className="text-xs font-medium text-black/70 group-hover:text-black">Show Answers</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-black/30">Attempts:</span>
                            <input type="number" value={newTestConfig.attempt_limit} onChange={e => setNewTestConfig({...newTestConfig, attempt_limit: Number(e.target.value)})} className="w-12 bg-white border border-black/5 rounded-lg px-2 py-1 text-xs outline-none" />
                          </div>
                        </div>
                      </div>
                      
                      {newTestConfig.timing_enabled && (
                        <div className="mt-6 pt-6 border-t border-black/5 grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-black/30 block mb-1">Total Time (sec)</label>
                            <input type="number" value={newTestConfig.total_time} onChange={e => setNewTestConfig({...newTestConfig, total_time: Number(e.target.value)})} className="w-full bg-white border border-black/5 rounded-xl px-4 py-2 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-black/30 block mb-1">Per Question (sec)</label>
                            <input type="number" value={newTestConfig.per_question_time} onChange={e => setNewTestConfig({...newTestConfig, per_question_time: Number(e.target.value)})} className="w-full bg-white border border-black/5 rounded-xl px-4 py-2 text-sm outline-none" placeholder="0 = disabled" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Question Builder */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-black/40">Question Bank</h4>
                        <button 
                          onClick={() => setNewQuestions([...newQuestions, { question: '', type: 'MCQ', options: ['', '', '', ''], answer: '', points: 1 }])}
                          className="flex items-center gap-2 text-xs text-amber-600 font-bold hover:bg-amber-50 px-4 py-2 rounded-xl transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          ADD QUESTION
                        </button>
                      </div>

                      <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {newQuestions.map((q, qIdx) => (
                          <motion.div 
                            layout
                            key={qIdx} 
                            className="p-6 bg-black/[0.02] rounded-[32px] border border-black/5 space-y-4 relative group"
                          >
                            <button 
                              onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== qIdx))}
                              className="absolute top-6 right-6 p-2 text-black/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="flex gap-3">
                                  <select 
                                    value={q.type}
                                    onChange={e => {
                                      const updated = [...newQuestions];
                                      updated[qIdx].type = e.target.value;
                                      if (e.target.value === 'MATCH') {
                                        updated[qIdx].options = { left: ['', '', ''], right: ['', '', ''] };
                                        updated[qIdx].answer = {};
                                      } else if (e.target.value === 'TF') {
                                        updated[qIdx].options = ['True', 'False'];
                                        updated[qIdx].answer = 'True';
                                      } else if (e.target.value === 'MULTI') {
                                        updated[qIdx].answer = [];
                                      }
                                      setNewQuestions(updated);
                                    }}
                                    className="bg-white border border-black/5 rounded-xl px-3 py-2 text-[10px] font-bold outline-none"
                                  >
                                    <option value="MCQ">MCQ</option>
                                    <option value="MULTI">Multiple Select</option>
                                    <option value="TF">True/False</option>
                                    <option value="SHORT">Short Answer</option>
                                    <option value="FILL">Fill in Blank</option>
                                    <option value="MATCH">Matching</option>
                                  </select>
                                  <input 
                                    type="number" 
                                    placeholder="Pts"
                                    value={q.points}
                                    onChange={e => {
                                      const updated = [...newQuestions];
                                      updated[qIdx].points = Number(e.target.value);
                                      setNewQuestions(updated);
                                    }}
                                    className="w-16 bg-white border border-black/5 rounded-xl px-3 py-2 text-[10px] font-bold outline-none"
                                  />
                                </div>
                                <input 
                                  type="text" 
                                  placeholder={`Question ${qIdx + 1}`}
                                  value={q.question}
                                  onChange={e => {
                                    const updated = [...newQuestions];
                                    updated[qIdx].question = e.target.value;
                                    setNewQuestions(updated);
                                  }}
                                  className="w-full bg-white border border-black/5 rounded-2xl py-4 px-5 outline-none text-sm font-medium"
                                />

                                {/* Options based on type */}
                                {q.type === 'MATCH' ? (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold text-black/30">Left List</p>
                                      {q.options.left.map((opt: string, oIdx: number) => (
                                        <input 
                                          key={oIdx}
                                          type="text"
                                          value={opt}
                                          onChange={e => {
                                            const updated = [...newQuestions];
                                            updated[qIdx].options.left[oIdx] = e.target.value;
                                            setNewQuestions(updated);
                                          }}
                                          className="w-full bg-white border border-black/5 rounded-xl py-2 px-3 text-xs outline-none"
                                          placeholder={`Item ${oIdx + 1}`}
                                        />
                                      ))}
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold text-black/30">Right List (Correct Pairs)</p>
                                      {q.options.right.map((opt: string, oIdx: number) => (
                                        <input 
                                          key={oIdx}
                                          type="text"
                                          value={opt}
                                          onChange={e => {
                                            const updated = [...newQuestions];
                                            updated[qIdx].options.right[oIdx] = e.target.value;
                                            // Update answer automatically for matching
                                            const leftItem = updated[qIdx].options.left[oIdx];
                                            if (leftItem) {
                                              updated[qIdx].answer = { ...updated[qIdx].answer, [leftItem]: e.target.value };
                                            }
                                            setNewQuestions(updated);
                                          }}
                                          className="w-full bg-amber-50 border border-amber-100 rounded-xl py-2 px-3 text-xs outline-none"
                                          placeholder={`Match for Item ${oIdx + 1}`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ) : (q.type !== 'SHORT' && q.type !== 'FILL') ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    {q.options.map((opt: string, oIdx: number) => (
                                      <div key={oIdx} className="relative">
                                        <input 
                                          type="text" 
                                          placeholder={`Option ${oIdx + 1}`}
                                          value={opt}
                                          onChange={e => {
                                            const updated = [...newQuestions];
                                            updated[qIdx].options[oIdx] = e.target.value;
                                            setNewQuestions(updated);
                                          }}
                                          className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 outline-none text-xs"
                                        />
                                        <button 
                                          onClick={() => {
                                            const updated = [...newQuestions];
                                            if (q.type === 'MULTI') {
                                              const current = updated[qIdx].answer as string[];
                                              if (current.includes(opt)) {
                                                updated[qIdx].answer = current.filter(v => v !== opt);
                                              } else {
                                                updated[qIdx].answer = [...current, opt];
                                              }
                                            } else {
                                              updated[qIdx].answer = opt;
                                            }
                                            setNewQuestions(updated);
                                          }}
                                          className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                            (q.type === 'MULTI' ? (q.answer as string[]).includes(opt) : q.answer === opt)
                                            ? 'bg-emerald-500 text-white' 
                                            : 'bg-black/5 text-transparent'
                                          }`}
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <input 
                                    type="text" 
                                    placeholder="Correct Answer"
                                    value={q.answer}
                                    onChange={e => {
                                      const updated = [...newQuestions];
                                      updated[qIdx].answer = e.target.value;
                                      setNewQuestions(updated);
                                    }}
                                    className="w-full bg-amber-50 border border-amber-100 rounded-2xl py-4 px-5 outline-none text-sm text-amber-900 font-medium"
                                  />
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleCreateTest}
                      className="w-full bg-[#0F172A] text-white py-5 rounded-full font-bold mt-8 hover:bg-[#1E293B] transition-all shadow-xl flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 className="w-6 h-6 text-amber-500" />
                      PUBLISH MODULAR ASSESSMENT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'instructions' && (
          <motion.div 
            key="instructions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center min-h-screen p-4"
          >
            <div className="w-full max-w-2xl bg-white rounded-[40px] p-10 shadow-2xl border border-black/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-[#0F172A] rounded-2xl flex items-center justify-center">
                  <span className="text-xl font-serif font-black text-amber-500 italic">M</span>
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-medium">{selectedTest?.name}</h2>
                  <p className="text-black/30 text-xs uppercase tracking-widest font-bold">Maavis Projects Assessment</p>
                </div>
              </div>
              
              <div className="space-y-6 mb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTest?.timing_enabled && (
                    <div className="p-4 bg-amber-50 rounded-2xl flex gap-4">
                      <Timer className="w-6 h-6 text-amber-600 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-amber-900">{formatTime(selectedTest.total_time)}</h3>
                        <p className="text-sm text-amber-700/70">Total time allocated.</p>
                      </div>
                    </div>
                  )}
                  {selectedTest?.anti_cheat_enabled && (
                    <div className="p-4 bg-slate-50 rounded-2xl flex gap-4">
                      <ShieldAlert className="w-6 h-6 text-slate-600 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-slate-900">Proctored Session</h3>
                        <p className="text-sm text-slate-700/70">Anti-cheat protocols are active.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-black/5 p-6 rounded-3xl space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">Security Protocols</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm">
                      <ClipboardX className="w-4 h-4 text-black/40" />
                      Copy-paste and Right-click are restricted.
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <AlertTriangle className="w-4 h-4 text-black/40" />
                      Window focus loss will be flagged to HR.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setView('dashboard')}
                  className="flex-1 bg-black/5 hover:bg-black/10 text-black rounded-full py-5 font-medium transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setView('test')}
                  className="flex-[2] bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-full py-5 text-lg font-medium transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                  Confirm & Start
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'test' && selectedTest && (
          <motion.div 
            key="test"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto py-12 px-4"
          >
            <header className="sticky top-4 z-50 bg-white/90 backdrop-blur-xl border border-black/5 rounded-full px-8 py-4 mb-12 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center text-amber-500 font-serif italic font-black">
                  M
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">{selectedTest?.name}</p>
                  <p className="font-medium text-sm">{fullName}</p>
                </div>
              </div>

              {selectedTest.timing_enabled && (
                <div className={`flex items-center gap-3 px-6 py-2 rounded-full transition-colors ${timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-[#0F172A] text-white'}`}>
                  <Timer className="w-4 h-4" />
                  <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
                </div>
              )}
            </header>

            <div className="space-y-8">
              {questions.map((q, idx) => (
                <motion.div 
                  key={q.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-black/5"
                >
                  <div className="flex gap-6">
                    <span className="text-5xl font-serif font-black text-black/5 select-none">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="flex-1 pt-2">
                      <h3 className="text-xl md:text-2xl font-medium mb-8 leading-relaxed">
                        {q.question}
                      </h3>
                      
                      {q.type === 'MCQ' || q.type === 'TF' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {q.options.map((opt: string) => {
                            const isSelected = currentAnswers.find(a => a.id === q.id)?.answer === opt;
                            return (
                              <button
                                key={opt}
                                onClick={() => handleAnswer(q.id, opt)}
                                className={`text-left p-5 rounded-2xl border-2 transition-all group relative overflow-hidden ${
                                  isSelected 
                                  ? 'border-amber-500 bg-amber-50/50' 
                                  : 'border-black/5 hover:border-black/20 bg-black/[0.02]'
                                }`}
                              >
                                <div className="flex items-center justify-between relative z-10">
                                  <span className={`font-medium ${isSelected ? 'text-amber-900' : 'text-black/70'}`}>
                                    {opt}
                                  </span>
                                  {isSelected && <Check className="w-5 h-5 text-amber-500" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : q.type === 'MULTI' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {q.options.map((opt: string) => {
                            const selected = (currentAnswers.find(a => a.id === q.id)?.answer || []) as string[];
                            const isSelected = selected.includes(opt);
                            return (
                              <button
                                key={opt}
                                onClick={() => {
                                  const next = isSelected ? selected.filter(v => v !== opt) : [...selected, opt];
                                  handleAnswer(q.id, next);
                                }}
                                className={`text-left p-5 rounded-2xl border-2 transition-all group relative overflow-hidden ${
                                  isSelected 
                                  ? 'border-amber-500 bg-amber-50/50' 
                                  : 'border-black/5 hover:border-black/20 bg-black/[0.02]'
                                }`}
                              >
                                <div className="flex items-center justify-between relative z-10">
                                  <span className={`font-medium ${isSelected ? 'text-amber-900' : 'text-black/70'}`}>
                                    {opt}
                                  </span>
                                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-black/10'
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : q.type === 'MATCH' ? (
                        <div className="grid grid-cols-2 gap-8 p-6 bg-black/[0.02] rounded-3xl border border-black/5">
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-4">Select Item</p>
                            {q.options.left.map((left: string) => (
                              <button
                                key={left}
                                onClick={() => setSelectedLeft(left)}
                                className={`w-full p-3 rounded-xl text-xs font-medium text-left transition-all border-2 ${
                                  selectedLeft === left 
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-lg' 
                                  : matchingPairs[left]
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700 opacity-50'
                                  : 'bg-white border-black/5 hover:border-black/10'
                                }`}
                              >
                                {left}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-4">Match With</p>
                            {q.options.right.map((right: string) => (
                              <button
                                key={right}
                                disabled={!selectedLeft}
                                onClick={() => selectedLeft && handleMatching(q.id, selectedLeft, right)}
                                className={`w-full p-3 rounded-xl text-xs font-medium text-left transition-all border-2 ${
                                  Object.values(matchingPairs).includes(right)
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700 opacity-50'
                                  : !selectedLeft
                                  ? 'bg-black/5 border-transparent text-black/20 cursor-not-allowed'
                                  : 'bg-white border-black/5 hover:border-amber-500 hover:text-amber-600'
                                }`}
                              >
                                {right}
                              </button>
                            ))}
                          </div>
                          {Object.keys(matchingPairs).length > 0 && (
                            <div className="col-span-2 mt-4 pt-4 border-t border-black/5">
                              <p className="text-[10px] font-bold text-black/30 mb-2">Current Matches:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(matchingPairs).map(([l, r]) => (
                                  <div key={l} className="bg-white border border-black/5 px-3 py-1 rounded-full text-[10px] flex items-center gap-2">
                                    <span className="font-bold">{l}</span>
                                    <ChevronRight className="w-2 h-2 text-black/20" />
                                    <span className="text-black/60">{r}</span>
                                    <button onClick={() => {
                                      const next = { ...matchingPairs };
                                      delete next[l];
                                      setMatchingPairs(next);
                                      handleAnswer(q.id, next);
                                    }} className="ml-1 text-red-500 hover:text-red-700">×</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Type your answer here..."
                          value={currentAnswers.find(a => a.id === q.id)?.answer || ''}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                          className="w-full bg-black/5 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-amber-500 transition-all outline-none text-lg font-medium"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-16 flex flex-col items-center gap-6">
              {tabSwitchCount > 0 && selectedTest.anti_cheat_enabled && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-6 py-3 rounded-full text-sm border border-red-200 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  SECURITY ALERT: {tabSwitchCount} TAB SWITCHES
                </div>
              )}
              
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-16 py-5 rounded-full text-lg font-medium transition-all shadow-xl hover:shadow-2xl disabled:opacity-50 flex items-center gap-3"
              >
                {isSubmitting ? 'Processing...' : 'Submit Assessment'}
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
              </button>
            </div>
          </motion.div>
        )}

        {view === 'result' && score && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center min-h-screen p-4"
          >
            <div className="w-full max-w-md bg-white rounded-[40px] p-10 text-center shadow-2xl border border-black/5">
              <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12 text-amber-600" />
              </div>
              <h2 className="text-4xl font-serif font-medium mb-2">Submission Received</h2>
              <p className="text-black/50 mb-8">{selectedTest?.name}</p>
              
              <div className="bg-black/5 rounded-3xl p-8 mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">Assessment Score</p>
                <div className="text-6xl font-serif font-medium">
                  {score.score}<span className="text-2xl text-black/20 mx-2">/</span>{score.total}
                </div>
                <div className="mt-4 h-2 bg-black/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(score.score / score.total) * 100}%` }}
                    className="h-full bg-amber-500"
                  />
                </div>
              </div>

              {score.manualReviewNeeded && (
                <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-800 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  Subjective answers are pending manual review.
                </div>
              )}

              <button 
                onClick={() => setView('dashboard')}
                className="flex items-center justify-center gap-2 text-black/40 hover:text-black transition-colors w-full py-4 text-sm font-medium"
              >
                Return to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
