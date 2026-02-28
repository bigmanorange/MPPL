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
  Check,
  X
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
  tests_taken: number;
}

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard' | 'admin' | 'instructions' | 'test' | 'result'>('login');
  const [userRole, setUserRole] = useState<'candidate' | 'admin'>('candidate');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tests, setTests] = useState<Test[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [score, setScore] = useState<{ score: number; total: number; manualReviewNeeded: boolean; showAnswers: boolean; gradingEnabled?: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<number[]>([]);
  const [allResults, setAllResults] = useState<Result[]>([]);
  const [selectedCandidateResults, setSelectedCandidateResults] = useState<Result[]>([]);
  const [selectedResultDetail, setSelectedResultDetail] = useState<any | null>(null);
  const [isEditingTest, setIsEditingTest] = useState<number | null>(null);
  
  // Admin User Management State
  const [adminUserForm, setAdminUserForm] = useState({ username: '', password: '', full_name: '', email: '', role: 'candidate' });
  const [adminPasswordForm, setAdminPasswordForm] = useState({ username: '', password: '' });
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bulkImportJson, setBulkImportJson] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [assignments, setAssignments] = useState<{[key: number]: number[]}>({});
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
  
  const [adminTab, setAdminTab] = useState<'overview' | 'assessments' | 'candidates' | 'users' | 'results'>('overview');
  const [showAssignEmail, setShowAssignEmail] = useState(false);
  const [assignEmailForm, setAssignEmailForm] = useState({ email: '', testId: '' });
  
  // Admin Create Test State
  const [newTestName, setNewTestName] = useState('');
  const [newTestDesc, setNewTestDesc] = useState('');
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

  const fetchResultDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/results/${id}/details`);
      const data = await res.json();
      setSelectedResultDetail(data);
    } catch (err) {
      console.error('Failed to fetch result detail:', err);
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
        setUserId(data.id);
        setUserRole(data.role);
        setFullName(data.full_name);
        setUserStatus(data.status);
        setAttemptedIds(data.attempted_tests);
        if (data.role === 'admin') {
          setView('admin');
        } else {
          fetchTests(data.id);
          setView('dashboard');
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const fetchTests = async (uid?: number) => {
    try {
      const url = uid ? `/api/tests?user_id=${uid}` : '/api/tests';
      const res = await fetch(url);
      const data = await res.json();
      setTests(data);
    } catch (err) {
      setError('Failed to load tests');
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

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchUserAssignments = async (uid: number) => {
    try {
      const res = await fetch(`/api/assignments/${uid}`);
      const data = await res.json();
      setAssignments(prev => ({ ...prev, [uid]: data }));
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  };

  const toggleAssignment = async (uid: number, tid: number) => {
    const isAssigned = assignments[uid]?.includes(tid);
    const method = isAssigned ? 'DELETE' : 'POST';
    const url = isAssigned ? `/api/assignments/${uid}/${tid}` : '/api/assignments';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: isAssigned ? undefined : JSON.stringify({ user_id: uid, test_id: tid }),
      });
      if (res.ok) {
        fetchUserAssignments(uid);
      }
    } catch (err) {
      alert('Assignment update failed');
    }
  };

  const fetchCandidateResults = async (username: string) => {
    try {
      const res = await fetch(`/api/candidates/${username}/results`);
      const data = await res.json();
      setSelectedCandidateResults(data);
    } catch (err) {
      console.error('Failed to fetch candidate results:', err);
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

  const handleCreateTest = async () => {
    if (!newTestName) {
      alert("Please enter a test name");
      return;
    }

    // Validation
    for (let i = 0; i < newQuestions.length; i++) {
      const q = newQuestions[i];
      if (!q.question.trim()) {
        alert(`Question ${i + 1} is empty`);
        return;
      }
      if (['MCQ', 'MULTI', 'MATCH'].includes(q.type)) {
        if (q.type === 'MATCH') {
          if (q.options.left.some((opt: string) => !opt.trim()) || q.options.right.some((opt: string) => !opt.trim())) {
            alert(`Please fill all matching items for Question ${i + 1}`);
            return;
          }
        } else {
          if (q.options.some((opt: string) => !opt.trim())) {
            alert(`Please fill all options for Question ${i + 1}`);
            return;
          }
          if (q.type === 'MCQ' && !q.answer) {
            alert(`Please select a correct answer for Question ${i + 1}`);
            return;
          }
          if (q.type === 'MULTI' && (!Array.isArray(q.answer) || q.answer.length === 0)) {
            alert(`Please select at least one correct answer for Question ${i + 1}`);
            return;
          }
        }
      } else if (['SHORT', 'FILL'].includes(q.type)) {
        if (!String(q.answer).trim()) {
          alert(`Please provide a correct answer for Question ${i + 1}`);
          return;
        }
      }
    }

    try {
      const url = isEditingTest ? `/api/tests/${isEditingTest}` : '/api/tests';
      const method = isEditingTest ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTestName,
          description: newTestDesc,
          questions: newQuestions,
          adminUsername: username,
          ...newTestConfig
        })
      });
      if (res.ok) {
        setNewTestName('');
        setNewTestDesc('');
        setNewQuestions([{ question: '', type: 'MCQ', options: ['', '', '', ''], answer: '', points: 1 }]);
        setIsEditingTest(null);
        fetchTests();
      }
    } catch (err) {
      console.error('Failed to save test:', err);
    }
  };

  const handleEditTest = async (test: Test) => {
    try {
      const res = await fetch(`/api/tests/${test.id}`);
      const data = await res.json();
      setNewTestName(data.name);
      setNewTestDesc(data.description);
      setNewQuestions(data.questions);
      setNewTestConfig({
        grading_enabled: data.grading_enabled === 1,
        timing_enabled: data.timing_enabled === 1,
        randomization_enabled: data.randomization_enabled === 1,
        anti_cheat_enabled: data.anti_cheat_enabled === 1,
        attempt_limit: data.attempt_limit,
        show_answers: data.show_answers === 1,
        total_time: data.total_time,
        per_question_time: data.per_question_time
      });
      setIsEditingTest(test.id);
    } catch (err) {
      console.error('Failed to fetch test for editing:', err);
    }
  };

  const handleAssignByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignEmailForm),
      });
      if (res.ok) {
        setAssignEmailForm({ email: '', testId: '' });
        setShowAssignEmail(false);
        alert('Assessment invite sent successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send invite');
      }
    } catch (err) {
      alert('Connection error');
    }
  };

  const handleAdminCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUserForm),
      });
      if (res.ok) {
        setAdminUserForm({ username: '', password: '', full_name: '', email: '', role: 'candidate' });
        fetchCandidates();
        fetchUsers();
        alert('User created successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create user');
      }
    } catch (err) {
      alert('Connection error');
    }
  };

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/users/${adminPasswordForm.username}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordForm.password }),
      });
      if (res.ok) {
        setAdminPasswordForm({ username: '', password: '' });
        alert('Password updated successfully');
      } else {
        alert('Failed to update password');
      }
    } catch (err) {
      alert('Connection error');
    }
  };

  const handleAdminDeleteUser = async (username: string) => {
    if (!confirm(`Are you sure you want to delete user ${username}? This will also delete all their results.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${username}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchCandidates();
        fetchUsers();
        alert('User deleted successfully');
      } else {
        alert('Failed to delete user');
      }
    } catch (err) {
      alert('Connection error');
    }
  };

  const handleSelfChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${username}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setNewPassword('');
        setConfirmPassword('');
        setShowProfileSettings(false);
        alert('Password updated successfully');
      } else {
        alert('Failed to update password');
      }
    } catch (err) {
      alert('Connection error');
    }
  };

  const handleBulkImport = () => {
    try {
      const imported = JSON.parse(bulkImportJson);
      if (Array.isArray(imported)) {
        setNewQuestions([...newQuestions, ...imported]);
        setBulkImportJson('');
        setShowBulkImport(false);
        alert(`Imported ${imported.length} questions successfully!`);
      } else {
        alert('Invalid format. Please provide a JSON array of questions.');
      }
    } catch (err) {
      alert('Invalid JSON format.');
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
          showAnswers: data.showAnswers,
          gradingEnabled: data.gradingEnabled
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

  useEffect(() => {
    if (view === 'admin') {
      fetchTests();
      fetchCandidates();
      fetchUsers();
      fetchResults();
    } else if (view === 'dashboard' && userId) {
      fetchTests(userId);
    }
  }, [view, userId]);

  useEffect(() => {
    if (view === 'test' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (view === 'test' && timeLeft === 0) {
      handleSubmit();
    }
  }, [view, timeLeft, handleSubmit]);

  const enterFullScreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
  };

  const exitFullScreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      if (!document.fullscreenElement && view === 'test' && selectedTest?.anti_cheat_enabled) {
        alert("SECURITY ALERT: Fullscreen mode exited. This has been logged.");
        setTabSwitchCount(prev => prev + 1);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
    };
  }, [view, selectedTest]);

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
                <button onClick={() => setShowProfileSettings(true)} className="p-3 bg-black/5 hover:bg-black/10 rounded-2xl transition-colors">
                  <Settings className="w-5 h-5 text-black/40" />
                </button>
                <button onClick={() => setView('login')} className="p-3 bg-black/5 hover:bg-black/10 rounded-2xl transition-colors">
                  <LogOut className="w-5 h-5 text-black/40" />
                </button>
              </div>
            </div>

            {showProfileSettings && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-[32px] border border-black/5 shadow-xl mb-8 max-w-md mx-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-serif font-medium">Profile Settings</h3>
                  <button onClick={() => setShowProfileSettings(false)} className="text-black/30 hover:text-black">Close</button>
                </div>
                <form onSubmit={handleSelfChangePassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">New Password</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Confirm Password</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#0F172A] text-white py-3 rounded-xl font-bold hover:bg-[#1E293B] transition-all">
                    Update Password
                  </button>
                </form>
              </motion.div>
            )}

            <div className="space-y-8">
              <h3 className="text-2xl font-serif font-medium flex items-center gap-3">
                <Layers className="w-6 h-6 text-amber-500" />
                Available Assessments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tests.map(test => {
                  const attempts = attemptedIds.filter(id => id === test.id).length;
                  const isCompleted = attempts >= test.attempt_limit;
                  return (
                    <motion.div 
                      key={test.id}
                      whileHover={{ y: -4 }}
                      className={`bg-white p-8 rounded-[32px] border border-black/5 shadow-sm flex flex-col justify-between ${isCompleted ? 'opacity-60' : ''}`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-amber-600">
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          {isCompleted && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">Completed</span>
                          )}
                        </div>
                        <h4 className="text-xl font-medium mb-2">{test.name}</h4>
                        <p className="text-sm text-black/40 mb-6 line-clamp-2">{test.description}</p>
                        
                        <div className="flex items-center gap-4 mb-8">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-black/30 uppercase">
                            <Timer className="w-3 h-3" />
                            {formatTime(test.total_time)}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-black/30 uppercase">
                            <ShieldAlert className="w-3 h-3" />
                            {test.anti_cheat_enabled ? 'Proctored' : 'Standard'}
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => !isCompleted && startTest(test)}
                        disabled={isCompleted}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                          isCompleted 
                          ? 'bg-black/5 text-black/20 cursor-not-allowed' 
                          : 'bg-[#0F172A] text-white hover:bg-[#1E293B] shadow-lg hover:shadow-xl'
                        }`}
                      >
                        {isCompleted ? 'Test Completed' : 'Start Assessment'}
                        {!isCompleted && <ChevronRight className="w-4 h-4" />}
                      </button>
                    </motion.div>
                  );
                })}
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
            <div className="flex flex-col md:flex-row justify-between items-center mb-12 bg-[#0F172A] p-8 rounded-[40px] shadow-xl gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-serif font-black text-[#0F172A] italic">M</span>
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-medium text-white">Maavis Command Center</h2>
                  <p className="text-amber-500/80 text-sm font-mono tracking-widest uppercase">Modular Assessment Platform</p>
                </div>
              </div>
              
              <div className="flex flex-wrap justify-center gap-2 bg-white/5 p-2 rounded-3xl">
                {[
                  { id: 'overview', label: 'Overview', icon: Layers },
                  { id: 'assessments', label: 'Assessments', icon: CheckSquare },
                  { id: 'candidates', label: 'Candidates', icon: User },
                  { id: 'users', label: 'Users', icon: ShieldAlert },
                  { id: 'results', label: 'Results', icon: ClipboardX },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id as any)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all text-xs font-bold ${
                      adminTab === tab.id 
                      ? 'bg-amber-500 text-[#0F172A] shadow-lg shadow-amber-500/20' 
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowProfileSettings(!showProfileSettings)}
                  className={`p-4 rounded-2xl transition-all ${showProfileSettings ? 'bg-amber-500 text-[#0F172A]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                >
                  <Settings className="w-6 h-6" />
                </button>
                <button onClick={() => setView('login')} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors text-white">
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="space-y-8">
              {showProfileSettings && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm mb-8 max-w-md mx-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-serif font-medium">Admin Profile Settings</h3>
                    <button onClick={() => setShowProfileSettings(false)} className="text-black/30 hover:text-black">Close</button>
                  </div>
                  <form onSubmit={handleSelfChangePassword} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">New Password</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Confirm Password</label>
                      <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                        required
                      />
                    </div>
                    <button type="submit" className="w-full bg-[#0F172A] text-white py-3 rounded-xl font-bold hover:bg-[#1E293B] transition-all">
                      Update Admin Password
                    </button>
                  </form>
                </motion.div>
              )}

              {adminTab === 'overview' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
                      <CheckSquare className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="text-3xl font-serif font-bold text-[#0F172A]">{tests.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">Active Assessments</p>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                      <User className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-3xl font-serif font-bold text-[#0F172A]">{candidates.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">Total Candidates</p>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                      <ClipboardX className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="text-3xl font-serif font-bold text-[#0F172A]">{allResults.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">Completed Tests</p>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                      <ShieldAlert className="w-6 h-6 text-rose-600" />
                    </div>
                    <p className="text-3xl font-serif font-bold text-[#0F172A]">{allResults.filter(r => r.tab_switches > 0).length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">Proctoring Alerts</p>
                  </div>

                  <div className="md:col-span-2 lg:col-span-3 bg-[#0F172A] p-10 rounded-[40px] text-white overflow-hidden relative">
                    <div className="relative z-10">
                      <h3 className="text-2xl font-serif font-medium mb-4">Welcome back, Admin</h3>
                      <p className="text-white/60 text-sm max-w-md mb-8">You have {allResults.filter(r => r.manual_review_needed).length} assessments pending manual review. Your pipeline is currently active with {candidates.filter(c => c.status === 'Applied').length} new applications.</p>
                      <div className="flex gap-4">
                        <button onClick={() => setAdminTab('assessments')} className="bg-amber-500 text-[#0F172A] px-6 py-3 rounded-2xl font-bold text-sm hover:bg-amber-600 transition-all">Create New Test</button>
                        <button onClick={() => setAdminTab('candidates')} className="bg-white/10 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all">View Pipeline</button>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] -mr-32 -mt-32" />
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-6">Quick Actions</h4>
                    <div className="space-y-3">
                      <button onClick={() => setAdminTab('users')} className="w-full flex items-center gap-3 p-4 bg-black/[0.02] hover:bg-black/[0.05] rounded-2xl transition-all group">
                        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <User className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold text-black/70">Add New User</span>
                      </button>
                      <button onClick={exportResults} className="w-full flex items-center gap-3 p-4 bg-black/[0.02] hover:bg-black/[0.05] rounded-2xl transition-all group">
                        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <Download className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold text-black/70">Export All Data</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {adminTab === 'assessments' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 xl:grid-cols-3 gap-8"
                >
                  {/* Left Column: Manage Assessments */}
                  <div className="xl:col-span-1 space-y-8">
                    <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
                      <h3 className="text-xl font-serif font-medium mb-6 flex items-center gap-3">
                        <Settings className="w-5 h-5 text-amber-500" />
                        Manage Assessments
                      </h3>
                      <div className="space-y-4">
                        {tests.map(test => (
                          <div key={test.id} className="p-4 bg-black/[0.02] rounded-2xl border border-black/5 flex justify-between items-center">
                            <div>
                              <p className="font-bold text-sm">{test.name}</p>
                              <p className="text-[10px] text-black/30">{test.description.substring(0, 50)}...</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleEditTest(test)}
                                className="p-2 bg-white border border-black/5 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-all"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this test?')) {
                                    await fetch(`/api/tests/${test.id}`, { method: 'DELETE' });
                                    fetchTests();
                                  }
                                }}
                                className="p-2 bg-white border border-black/5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Quiz Creator */}
                  <div className="xl:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                      <h3 className="text-2xl font-serif font-medium mb-8 flex items-center gap-3">
                        <Plus className="w-6 h-6 text-amber-500" />
                        {isEditingTest ? 'Edit Assessment' : 'Modular Quiz Creator'}
                      </h3>
                      
                      <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
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
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setShowBulkImport(!showBulkImport)}
                                className="flex items-center gap-2 text-xs text-black/40 font-bold hover:bg-black/5 px-4 py-2 rounded-xl transition-all"
                              >
                                <Download className="w-4 h-4" />
                                BULK IMPORT
                              </button>
                              <button 
                                onClick={() => setNewQuestions([...newQuestions, { question: '', type: 'MCQ', options: ['', '', '', ''], answer: '', points: 1 }])}
                                className="flex items-center gap-2 text-xs text-amber-600 font-bold hover:bg-amber-50 px-4 py-2 rounded-xl transition-all"
                              >
                                <Plus className="w-4 h-4" />
                                ADD QUESTION
                              </button>
                            </div>
                          </div>

                          {showBulkImport && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-black/[0.02] rounded-[32px] border border-black/5 space-y-4"
                            >
                              <p className="text-[10px] text-black/40">Paste a JSON array of questions. Example: <code className="bg-black/5 p-1 rounded">{'[{"question": "...", "type": "MCQ", "options": ["...", "..."], "answer": "...", "points": 1}]'}</code></p>
                              <textarea 
                                value={bulkImportJson}
                                onChange={e => setBulkImportJson(e.target.value)}
                                placeholder='[{"question": "...", "type": "MCQ", ...}]'
                                className="w-full h-32 bg-white border border-black/5 rounded-2xl p-4 text-xs font-mono outline-none"
                              />
                              <div className="flex justify-end gap-3">
                                <button onClick={() => setShowBulkImport(false)} className="text-xs text-black/30 font-bold">Cancel</button>
                                <button onClick={handleBulkImport} className="bg-[#0F172A] text-white px-6 py-2 rounded-full text-xs font-bold">Import Questions</button>
                              </div>
                            </motion.div>
                          )}

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
                                    ) : (q.type === 'MCQ' || q.type === 'MULTI') ? (
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                          {q.options.map((opt: string, oIdx: number) => (
                                            <div key={oIdx} className="flex gap-2">
                                              <input 
                                                type="text" 
                                                placeholder={`Option ${oIdx + 1}`}
                                                value={opt}
                                                onChange={e => {
                                                  const updated = [...newQuestions];
                                                  updated[qIdx].options[oIdx] = e.target.value;
                                                  setNewQuestions(updated);
                                                }}
                                                className="flex-1 bg-white border border-black/5 rounded-xl py-3 px-4 outline-none text-xs"
                                              />
                                              {q.type === 'MULTI' && (
                                                <button 
                                                  onClick={() => {
                                                    const updated = [...newQuestions];
                                                    const current = updated[qIdx].answer as string[];
                                                    if (current.includes(opt)) {
                                                      updated[qIdx].answer = current.filter(v => v !== opt);
                                                    } else {
                                                      updated[qIdx].answer = [...current, opt];
                                                    }
                                                    setNewQuestions(updated);
                                                  }}
                                                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                                    (q.answer as string[]).includes(opt)
                                                    ? 'bg-emerald-500 text-white' 
                                                    : 'bg-black/5 text-black/20'
                                                  }`}
                                                >
                                                  <Check className="w-4 h-4" />
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        {q.type === 'MCQ' && (
                                          <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Correct Answer:</span>
                                            <select 
                                              value={q.answer}
                                              onChange={e => {
                                                const updated = [...newQuestions];
                                                updated[qIdx].answer = e.target.value;
                                                setNewQuestions(updated);
                                              }}
                                              className="bg-white border border-black/5 rounded-xl px-4 py-2 text-xs font-medium outline-none"
                                            >
                                              <option value="">Select Correct Option</option>
                                              {q.options.filter((o: string) => o.trim()).map((opt: string, i: number) => (
                                                <option key={i} value={opt}>{opt}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    ) : q.type === 'TF' ? (
                                      <div className="flex gap-4">
                                        {['True', 'False'].map(val => (
                                          <button
                                            key={val}
                                            onClick={() => {
                                              const updated = [...newQuestions];
                                              updated[qIdx].answer = val;
                                              setNewQuestions(updated);
                                            }}
                                            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
                                              q.answer === val 
                                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                              : 'bg-black/5 text-black/40 hover:bg-black/10'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Correct Answer (Case Insensitive)</p>
                                        <input 
                                          type="text" 
                                          placeholder="Type the correct answer here..."
                                          value={q.answer}
                                          onChange={e => {
                                            const updated = [...newQuestions];
                                            updated[qIdx].answer = e.target.value;
                                            setNewQuestions(updated);
                                          }}
                                          className="w-full bg-amber-50 border border-amber-100 rounded-2xl py-4 px-5 outline-none text-sm text-amber-900 font-medium"
                                        />
                                      </div>
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
                          {isEditingTest ? 'UPDATE ASSESSMENT' : 'PUBLISH MODULAR ASSESSMENT'}
                        </button>
                        {isEditingTest && (
                          <button 
                            onClick={() => {
                              setIsEditingTest(null);
                              setNewTestName('');
                              setNewTestDesc('');
                              setNewQuestions([{ question: '', type: 'MCQ', options: ['', '', '', ''], answer: '', points: 1 }]);
                            }}
                            className="w-full text-black/40 text-xs font-bold mt-4 hover:text-black transition-colors"
                          >
                            CANCEL EDITING
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {adminTab === 'candidates' && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                  <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-serif font-medium flex items-center gap-3">
                        <User className="w-6 h-6 text-amber-500" />
                        Candidate Pipeline
                      </h3>
                      <button 
                        onClick={() => setShowAssignEmail(!showAssignEmail)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-[#0F172A] rounded-xl text-xs font-bold hover:bg-amber-600 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Invite by Email
                      </button>
                    </div>

                    {showAssignEmail && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 p-6 bg-amber-50 rounded-[32px] border border-amber-100"
                      >
                        <h4 className="text-xs font-bold uppercase tracking-widest text-amber-900/40 mb-4">Send Assessment Invitation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <input 
                            type="email" 
                            placeholder="Candidate Email"
                            value={assignEmailForm.email}
                            onChange={e => setAssignEmailForm({...assignEmailForm, email: e.target.value})}
                            className="bg-white border-none rounded-xl py-3 px-4 text-sm outline-none"
                          />
                          <select 
                            value={assignEmailForm.testId}
                            onChange={e => setAssignEmailForm({...assignEmailForm, testId: e.target.value})}
                            className="bg-white border-none rounded-xl py-3 px-4 text-sm outline-none"
                          >
                            <option value="">Select Assessment</option>
                            {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <button 
                            onClick={handleAssignByEmail}
                            className="bg-[#0F172A] text-white rounded-xl py-3 px-4 text-sm font-bold hover:bg-[#1E293B] transition-all"
                          >
                            Send Invitation
                          </button>
                        </div>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {candidates.map(cand => (
                        <div key={cand.id} className="p-6 bg-black/[0.02] rounded-[32px] border border-black/5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm font-serif font-bold text-amber-500">
                                {cand.full_name?.charAt(0) || 'C'}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{cand.full_name}</p>
                                <p className="text-[10px] text-black/30">{cand.email}</p>
                              </div>
                            </div>
                            <select 
                              value={cand.status}
                              onChange={(e) => updateCandidateStatus(cand.username, e.target.value)}
                              className="text-[10px] font-bold bg-white border border-black/10 rounded-lg px-2 py-1 outline-none"
                            >
                              <option value="Applied">Applied</option>
                              <option value="Shortlisted">Shortlisted</option>
                              <option value="Interviewed">Interviewed</option>
                              <option value="Hired">Hired</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-black/5">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setAssigningUserId(cand.id);
                                  fetchUserAssignments(cand.id);
                                }}
                                className="p-2 bg-white border border-black/5 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-all"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => fetchCandidateResults(cand.username)}
                                className="p-2 bg-white border border-black/5 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-all"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{cand.tests_taken} Tests Taken</span>
                          </div>

                          {assigningUserId === cand.id && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 p-4 bg-white border border-black/5 rounded-2xl space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <p className="text-[10px] font-bold text-black/30 uppercase">Assign Assessments:</p>
                                <button onClick={() => setAssigningUserId(null)} className="text-[10px] text-black/30 hover:text-black">Close</button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {tests.map(t => (
                                  <label key={t.id} className="flex items-center justify-between p-2 hover:bg-black/5 rounded-xl cursor-pointer">
                                    <span className="text-xs">{t.name}</span>
                                    <input 
                                      type="checkbox" 
                                      checked={assignments[cand.id]?.includes(t.id)}
                                      onChange={() => toggleAssignment(cand.id, t.id)}
                                      className="w-4 h-4 accent-amber-500"
                                    />
                                  </label>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                    <h3 className="text-xl font-serif font-medium mb-6">Candidate History</h3>
                    <div className="space-y-4">
                      {selectedCandidateResults.length > 0 ? (
                        selectedCandidateResults.map(r => (
                          <div key={r.id} className="p-4 bg-black/[0.02] rounded-2xl border border-black/5">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold">{r.test_name}</span>
                              <span className="text-xs font-mono font-bold text-amber-600">{r.score}/{r.total}</span>
                            </div>
                            <p className="text-[10px] text-black/30">{new Date(r.timestamp).toLocaleDateString()}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-black/30 italic">Select a candidate to view history</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {adminTab === 'users' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                  {/* Left Column: Create User */}
                  <div className="lg:col-span-1 space-y-8">
                    <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                      <h3 className="text-xl font-serif font-medium mb-6 flex items-center gap-3">
                        <Plus className="w-5 h-5 text-amber-500" />
                        Create New User
                      </h3>
                      <form onSubmit={handleAdminCreateUser} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Full Name</label>
                          <input 
                            type="text" 
                            value={adminUserForm.full_name}
                            onChange={e => setAdminUserForm({...adminUserForm, full_name: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Email</label>
                          <input 
                            type="email" 
                            value={adminUserForm.email}
                            onChange={e => setAdminUserForm({...adminUserForm, email: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Username</label>
                          <input 
                            type="text" 
                            value={adminUserForm.username}
                            onChange={e => setAdminUserForm({...adminUserForm, username: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Password</label>
                          <input 
                            type="password" 
                            value={adminUserForm.password}
                            onChange={e => setAdminUserForm({...adminUserForm, password: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Role</label>
                          <select 
                            value={adminUserForm.role}
                            onChange={e => setAdminUserForm({...adminUserForm, role: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                          >
                            <option value="candidate">Candidate</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <button type="submit" className="w-full bg-[#0F172A] text-white py-3 rounded-xl font-bold hover:bg-[#1E293B] transition-all">
                          Create User
                        </button>
                      </form>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                      <h3 className="text-xl font-serif font-medium mb-6 flex items-center gap-3">
                        <Lock className="w-5 h-5 text-amber-500" />
                        Reset Password
                      </h3>
                      <form onSubmit={handleAdminChangePassword} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Username</label>
                          <input 
                            type="text" 
                            value={adminPasswordForm.username}
                            onChange={e => setAdminPasswordForm({...adminPasswordForm, username: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">New Password</label>
                          <input 
                            type="password" 
                            value={adminPasswordForm.password}
                            onChange={e => setAdminPasswordForm({...adminPasswordForm, password: e.target.value})}
                            className="w-full bg-black/5 border-none rounded-xl py-3 px-4 outline-none text-sm"
                            required
                          />
                        </div>
                        <button type="submit" className="w-full bg-amber-500 text-[#0F172A] py-3 rounded-xl font-bold hover:bg-amber-600 transition-all">
                          Update Password
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: User List */}
                  <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                    <h3 className="text-2xl font-serif font-medium mb-8 flex items-center gap-3">
                      <ShieldAlert className="w-6 h-6 text-amber-500" />
                      System Users
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-black/5">
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">User</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Role</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Status</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {users.map(u => (
                            <tr key={u.id} className="group">
                              <td className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center font-serif font-bold text-amber-500">
                                    {u.full_name?.charAt(0) || 'U'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold">{u.full_name}</p>
                                    <p className="text-[10px] text-black/30">{u.username}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${u.role === 'admin' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                  {u.role.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-4">
                                <span className="text-[10px] font-bold text-black/40">{u.status || 'Active'}</span>
                              </td>
                              <td className="py-4">
                                <button 
                                  onClick={() => handleAdminDeleteUser(u.username)}
                                  className="p-2 text-black/20 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {adminTab === 'results' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-serif font-medium flex items-center gap-3">
                        <ClipboardX className="w-6 h-6 text-amber-500" />
                        Assessment Results
                      </h3>
                      <button onClick={exportResults} className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-xs font-bold transition-all">
                        <Download className="w-4 h-4" />
                        Export CSV
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-black/5">
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Candidate</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Assessment</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Score</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Date</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Alerts</th>
                            <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-black/30">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {allResults.map(res => (
                            <tr key={res.id} className="group hover:bg-black/[0.01] transition-colors">
                              <td className="py-4">
                                <p className="text-sm font-bold">{res.full_name}</p>
                                <p className="text-[10px] text-black/30">{res.username}</p>
                              </td>
                              <td className="py-4">
                                <p className="text-sm font-medium">{res.test_name}</p>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono font-bold text-amber-600">{res.score}/{res.total}</span>
                                  <span className="text-[10px] text-black/30">({Math.round((res.score/res.total)*100)}%)</span>
                                </div>
                              </td>
                              <td className="py-4">
                                <p className="text-xs text-black/40">{new Date(res.timestamp).toLocaleDateString()}</p>
                              </td>
                              <td className="py-4">
                                {res.tab_switches > 0 ? (
                                  <div className="flex items-center gap-1 text-rose-500">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="text-[10px] font-bold">{res.tab_switches} Switches</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-500">Clean</span>
                                )}
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => fetchResultDetail(res.id)}
                                    className="p-2 bg-white border border-black/5 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-all"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {res.manual_review_needed && (
                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Manual Review Needed" />
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
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
                  onClick={() => {
                    enterFullScreen();
                    setView('test');
                  }}
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
                onClick={() => {
                  exitFullScreen();
                  handleSubmit();
                }}
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
              
              {score.gradingEnabled ? (
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
              ) : (
                <div className="bg-black/5 rounded-3xl p-8 mb-8">
                  <p className="text-sm text-black/60">
                    Your assessment has been submitted successfully. The results will be shared with you after manual review by the recruitment team.
                  </p>
                </div>
              )}

              {score.gradingEnabled && score.manualReviewNeeded && (
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
        {selectedResultDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white">
                <div>
                  <h2 className="text-2xl font-serif font-medium">{selectedResultDetail.full_name}</h2>
                  <p className="text-sm text-black/40">{selectedResultDetail.test_name} • {new Date(selectedResultDetail.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">Final Score</p>
                    <p className="text-3xl font-serif font-medium">{selectedResultDetail.score} / {selectedResultDetail.total}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedResultDetail(null)}
                    className="p-3 bg-black/5 hover:bg-black/10 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-black/40" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-black/[0.02] p-6 rounded-3xl border border-black/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">Tab Switches</p>
                    <p className="text-2xl font-serif font-medium flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${selectedResultDetail.tab_switches > 2 ? 'text-red-500' : 'text-amber-500'}`} />
                      {selectedResultDetail.tab_switches}
                    </p>
                  </div>
                  <div className="bg-black/[0.02] p-6 rounded-3xl border border-black/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">Status</p>
                    <p className="text-2xl font-serif font-medium">
                      {selectedResultDetail.manual_review_needed ? 'Pending Review' : 'Graded'}
                    </p>
                  </div>
                  <div className="bg-black/[0.02] p-6 rounded-3xl border border-black/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">Accuracy</p>
                    <p className="text-2xl font-serif font-medium">
                      {Math.round((selectedResultDetail.score / selectedResultDetail.total) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-serif font-medium flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-500" />
                    Detailed Question Breakdown
                  </h3>
                  
                  {selectedResultDetail.questions.map((q: any, idx: number) => {
                    const userAnswer = selectedResultDetail.answers.find((a: any) => a.id === q.id)?.answer;
                    
                    // Calculate points earned for this question (mirroring server logic)
                    let pointsEarned = 0;
                    if (q.type === 'MCQ' || q.type === 'TF') {
                      if (q.answer === userAnswer) pointsEarned = q.points;
                    } else if (q.type === 'MULTI') {
                      const correct = Array.isArray(q.answer) ? q.answer : [];
                      const userArr = Array.isArray(userAnswer) ? userAnswer : [];
                      let correctCount = 0;
                      userArr.forEach(val => {
                        if (correct.includes(val)) correctCount++;
                        else correctCount--;
                      });
                      pointsEarned = Math.max(0, (correctCount / correct.length) * q.points);
                    } else if (q.type === 'MATCH') {
                      const correct = q.answer || {};
                      const userPairs = userAnswer || {};
                      const keys = Object.keys(correct);
                      let matchCount = 0;
                      keys.forEach(key => {
                        if (correct[key] === userPairs[key]) matchCount++;
                      });
                      pointsEarned = (matchCount / keys.length) * q.points;
                    } else {
                      if (String(q.answer).toLowerCase().trim() === String(userAnswer || '').toLowerCase().trim()) {
                        pointsEarned = q.points;
                      }
                    }
                    pointsEarned = Math.round(pointsEarned * 100) / 100;

                    const isCorrect = pointsEarned === q.points;
                    const isPartial = pointsEarned > 0 && pointsEarned < q.points;
                    
                    return (
                      <div key={q.id} className="p-8 bg-white border border-black/5 rounded-[32px] space-y-6 shadow-sm">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex gap-4">
                            <span className="w-10 h-10 bg-black/5 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0">{idx + 1}</span>
                            <div>
                              <p className="font-serif text-lg font-medium mb-1">{q.question}</p>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest bg-black/5 px-2 py-0.5 rounded-md">{q.type}</span>
                                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{q.points} Points Total</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase mb-2 inline-block ${
                              isCorrect ? 'bg-emerald-50 text-emerald-600' : 
                              isPartial ? 'bg-amber-50 text-amber-600' : 
                              'bg-red-50 text-red-600'
                            }`}>
                              {isCorrect ? 'Full Marks' : isPartial ? 'Partial Credit' : 'No Marks'}
                            </div>
                            <p className="text-sm font-mono font-bold text-black/40">{pointsEarned} / {q.points}</p>
                          </div>
                        </div>

                        {/* Options Section */}
                        {(q.type === 'MCQ' || q.type === 'MULTI' || q.type === 'TF') && q.options && (
                          <div className="ml-14 space-y-2">
                            <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">Available Options</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(q.options) && q.options.map((opt: string, i: number) => (
                                <div key={i} className={`px-3 py-1.5 rounded-xl text-xs border ${
                                  (Array.isArray(q.answer) ? q.answer.includes(opt) : q.answer === opt)
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 font-medium'
                                    : 'bg-black/[0.02] border-black/5 text-black/40'
                                }`}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-8 ml-14">
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-2">
                              <User className="w-3 h-3" />
                              Candidate's Response
                            </p>
                            <div className={`p-5 rounded-[24px] text-sm min-h-[80px] flex flex-col justify-center ${
                              isCorrect ? 'bg-emerald-50/30 border border-emerald-100/50' : 
                              isPartial ? 'bg-amber-50/30 border border-amber-100/50' : 
                              'bg-red-50/30 border border-red-100/50'
                            }`}>
                              {q.type === 'MATCH' ? (
                                <div className="space-y-2">
                                  {Object.entries(userAnswer || {}).map(([l, r]: any) => (
                                    <div key={l} className="flex items-center justify-between text-xs bg-white/50 p-2 rounded-lg border border-black/5">
                                      <span className="font-medium">{l}</span>
                                      <span className="text-black/20">→</span>
                                      <span className={r === q.answer[l] ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{r}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : Array.isArray(userAnswer) ? (
                                <div className="flex flex-wrap gap-2">
                                  {userAnswer.map((val: string) => (
                                    <span key={val} className={`px-2 py-1 rounded-lg text-xs font-bold ${q.answer.includes(val) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {val}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="font-medium">{String(userAnswer || 'No Answer')}</span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3" />
                              Correct Key
                            </p>
                            <div className="p-5 bg-black/[0.02] border border-black/5 rounded-[24px] text-sm min-h-[80px] flex flex-col justify-center">
                              {q.type === 'MATCH' ? (
                                <div className="space-y-2">
                                  {Object.entries(q.answer || {}).map(([l, r]: any) => (
                                    <div key={l} className="flex items-center justify-between text-xs bg-white/50 p-2 rounded-lg border border-black/5">
                                      <span className="font-medium">{l}</span>
                                      <span className="text-black/20">→</span>
                                      <span className="text-emerald-600 font-bold">{r}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : Array.isArray(q.answer) ? (
                                <div className="flex flex-wrap gap-2">
                                  {q.answer.map((val: string) => (
                                    <span key={val} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">
                                      {val}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="font-medium text-emerald-700">{String(q.answer)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
