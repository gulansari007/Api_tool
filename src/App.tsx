import { useState, useEffect } from 'react';
import {
  Cpu,
  Copy,
  Check,
  Plus,
  Trash2,
  Globe,
  FileJson,
  Play,
  AlertTriangle,
  Code2,
  RefreshCw,
  Sparkles,
  Info,
  Sun,
  Moon,
  X,
  Database,
  Settings,
  LogOut,
  User
} from 'lucide-react';
import type { HeaderItem, HttpMethod, TargetLanguage, FirebaseCredentials, SavedConfig } from './types';
import { parseJsonToSchema, type ParseResult } from './utils/parser';
import { generateUnifiedCode, generateModelCode } from './utils/generators';
import { isFirebaseEnabled, getFirebaseAuth, initializeFirebase } from './utils/firebase';
import { fetchSavedConfigs, saveSavedConfig, deleteSavedConfig } from './utils/persistence';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';

const DEFAULT_JSON = `{
  "status": "success",
  "data": {
    "id": 1024,
    "title": "API Code & Model Architect",
    "active": true,
    "author": {
      "name": "Alex Mercer",
      "verified": true,
      "tags": ["frontend", "tauri", "react"]
    },
    "metrics": {
      "downloads": 12850,
      "rating": 4.95
    }
  }
}`;

const DEFAULT_HEADERS: HeaderItem[] = [
  { id: '1', key: 'Authorization', value: 'Bearer token12345', active: true },
  { id: '2', key: 'Accept', value: 'application/json', active: true }
];

export default function App() {
  // Input settings
  const [activeTab, setActiveTab] = useState<'paste' | 'fetch' | 'history'>('paste');
  const [language, setLanguage] = useState<TargetLanguage>('typescript');
  const [pastedJson, setPastedJson] = useState<string>(DEFAULT_JSON);
  const [rootTypeName, setRootTypeName] = useState<string>('RootObject');

  // Mobile view toggle state
  const [mobileActiveView, setMobileActiveView] = useState<'input' | 'output'>('input');

  // Light / Dark Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // Data Model Modal open state
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);

  // Firebase Modals & Credentials
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Auth Form Fields
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Saved Config title & ID
  const [saveTitle, setSaveTitle] = useState<string>('');
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

  // Firebase Config Form Fields
  const [fbApiKey, setFbApiKey] = useState<string>('');
  const [fbAuthDomain, setFbAuthDomain] = useState<string>('');
  const [fbProjectId, setFbProjectId] = useState<string>('');
  const [fbAppId, setFbAppId] = useState<string>('');
  const [fbStatusMessage, setFbStatusMessage] = useState<string | null>(null);

  // Dynamic Auth Hooks
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [firebaseActive, setFirebaseActive] = useState<boolean>(isFirebaseEnabled());

  // Apply theme class to document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load existing Firebase Credentials into form fields
  useEffect(() => {
    const saved = localStorage.getItem('firebase_creds');
    if (saved) {
      try {
        const parsed: FirebaseCredentials = JSON.parse(saved);
        setFbApiKey(parsed.apiKey || '');
        setFbAuthDomain(parsed.authDomain || '');
        setFbProjectId(parsed.projectId || '');
        setFbAppId(parsed.appId || '');
      } catch (e) {
        console.error('Error parsing credentials:', e);
      }
    }
  }, []);

  // Set up Firebase Auth state listener
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        loadConfigs(user?.uid);
      });
      return () => unsubscribe();
    } else {
      setCurrentUser(null);
      loadConfigs();
    }
  }, [firebaseActive]);

  // Load configs whenever user changes
  const loadConfigs = async (uid?: string) => {
    const configs = await fetchSavedConfigs(uid);
    setSavedConfigs(configs);
  };

  // Live Fetch Settings
  const [apiUrl, setApiUrl] = useState<string>('https://api.github.com/repos/tauri-apps/tauri');
  const [httpMethod, setHttpMethod] = useState<HttpMethod>('GET');
  const [headers, setHeaders] = useState<HeaderItem[]>(DEFAULT_HEADERS);
  const [requestBody, setRequestBody] = useState<string>('{\n  "name": "new_project"\n}');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Parsing outputs
  const [parserResult, setParserResult] = useState<ParseResult>({
    rootType: { type: 'any' },
    schemas: []
  });
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Parse JSON automatically whenever it changes
  useEffect(() => {
    const result = parseJsonToSchema(pastedJson, rootTypeName);
    if (result.error) {
      setJsonError(result.error);
    } else {
      setJsonError(null);
      setParserResult(result);
    }
  }, [pastedJson, rootTypeName]);

  // Generate unified integration code
  const unifiedCode = generateUnifiedCode(
    language,
    parserResult,
    apiUrl,
    httpMethod,
    headers,
    requestBody,
    rootTypeName
  );

  // Generate separate model code for the modal
  const modelCode = generateModelCode(language, parserResult, rootTypeName);

  // Live API Fetch Handler
  const handleApiFetch = async () => {
    setLoading(true);
    setFetchError(null);

    const reqHeaders: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.active && h.key) {
        reqHeaders[h.key] = h.value;
      }
    });

    const options: RequestInit = {
      method: httpMethod,
      headers: reqHeaders,
    };

    if (httpMethod !== 'GET' && requestBody.trim()) {
      try {
        JSON.parse(requestBody);
        options.body = requestBody;
      } catch (err: any) {
        setFetchError(`Request body JSON is invalid: ${err.message}`);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(apiUrl, options);
      const text = await res.text();

      if (!res.ok) {
        setFetchError(`HTTP Error status ${res.status}: ${text.slice(0, 150)}`);
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(text);
        const prettyJson = JSON.stringify(parsed, null, 2);
        setPastedJson(prettyJson);
        setActiveTab('paste'); // Switch tab to show JSON
      } catch {
        setFetchError(`Received a successful response but it is not valid JSON. Content: ${text.slice(0, 150)}`);
      }
    } catch (err: any) {
      console.error('Fetch execution error:', err);
      if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
        setFetchError(
          'Network Block: Failed to fetch API endpoint. This is likely a CORS restriction issue in the browser. In production desktop applications (Tauri/Electron), CORS restrictions are bypassed. Try a server that supports CORS or run this locally.'
        );
      } else {
        setFetchError(`Request failure: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Header helpers
  const addHeader = () => {
    setHeaders([...headers, { id: Date.now().toString(), key: '', value: '', active: true }]);
  };

  const updateHeader = (id: string, field: 'key' | 'value' | 'active', val: any) => {
    setHeaders(headers.map((h) => (h.id === id ? { ...h, [field]: val } : h)));
  };

  const removeHeader = (id: string) => {
    setHeaders(headers.filter((h) => h.id !== id));
  };

  // Prettify input JSON helper
  const handlePrettifyJson = () => {
    try {
      const obj = JSON.parse(pastedJson);
      setPastedJson(JSON.stringify(obj, null, 2));
      setJsonError(null);
    } catch (err: any) {
      setJsonError(`Cannot prettify: ${err.message}`);
    }
  };

  // Save Configuration Handler
  const handleSaveConfig = async () => {
    if (!saveTitle.trim()) return;

    const payload = {
      title: saveTitle,
      url: apiUrl,
      method: httpMethod,
      headers,
      requestBody,
      pastedJson,
      rootTypeName,
      language
    };

    try {
      const saved = await saveSavedConfig(payload, selectedConfigId || undefined, currentUser?.uid);
      setSelectedConfigId(saved.id);
      setSaveTitle('');
      setIsSavingInline(false);
      await loadConfigs(currentUser?.uid);
    } catch (e: any) {
      console.error('Failed to save config:', e);
    }
  };

  // Load Saved Configuration into Editor State
  const handleLoadConfig = (config: SavedConfig) => {
    setSelectedConfigId(config.id);
    setApiUrl(config.url || '');
    setHttpMethod(config.method || 'GET');
    setHeaders(config.headers || []);
    setRequestBody(config.requestBody || '');
    setPastedJson(config.pastedJson || '');
    setRootTypeName(config.rootTypeName || 'RootObject');
    setLanguage(config.language || 'typescript');

    // Switch to paste tab to show source JSON
    setActiveTab('paste');
  };

  // Delete Saved Configuration Handler
  const handleDeleteConfig = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteSavedConfig(id, currentUser?.uid);
      if (selectedConfigId === id) {
        setSelectedConfigId(null);
      }
      await loadConfigs(currentUser?.uid);
    } catch (err) {
      console.error('Failed to delete configuration:', err);
    }
  };

  // Firebase credentials setup handler
  const handleSaveFirebaseConfig = async () => {
    setFbStatusMessage(null);

    const creds: FirebaseCredentials = {
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim(),
      projectId: fbProjectId.trim(),
      appId: fbAppId.trim()
    };

    if (!creds.apiKey || !creds.authDomain || !creds.projectId || !creds.appId) {
      setFbStatusMessage('Error: All credential fields are required.');
      return;
    }

    const res = await initializeFirebase(creds);
    if (res.success) {
      localStorage.setItem('firebase_creds', JSON.stringify(creds));
      setFirebaseActive(true);
      setFbStatusMessage('Success: Firebase configured and active.');
      setTimeout(() => setIsSettingsOpen(false), 1500);
    } else {
      setFbStatusMessage(`Error: ${res.error}`);
    }
  };

  const handleDisconnectFirebase = async () => {
    localStorage.removeItem('firebase_creds');
    // Initialize with empty keys to delete existing apps
    await initializeFirebase({ apiKey: '', authDomain: '', projectId: '', appId: '' });
    setFirebaseActive(false);
    setCurrentUser(null);
    setFbApiKey('');
    setFbAuthDomain('');
    setFbProjectId('');
    setFbAppId('');
    setFbStatusMessage('Success: Firebase disconnected.');
    loadConfigs(); // Refresh configs to local
    setTimeout(() => setIsSettingsOpen(false), 1500);
  };

  // Traditional Auth Action (Login or Signup)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError('Firebase is not initialized. Add project settings first.');
      setAuthLoading(false);
      return;
    }

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setIsAuthOpen(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Google Login Popup Auth
  const handleGoogleAuth = async () => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError('Firebase is not initialized. Add project settings first.');
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsAuthOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed.');
    }
  };

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
      setCurrentUser(null);
      loadConfigs(); // reload local storage configs
    }
  };

  // Unified filename resolver
  const getUnifiedFilename = (lang: TargetLanguage) => {
    const ext: Record<TargetLanguage, string> = {
      dart: 'integration.dart',
      javascript: 'integration.js',
      typescript: 'integration.ts',
      python: 'integration.py',
      java: 'Integration.java',
      kotlin: 'Integration.kt',
      csharp: 'Integration.cs',
      php: 'integration.php',
      go: 'integration.go',
      ruby: 'integration.rb',
      rust: 'integration.rs'
    };
    return ext[lang];
  };

  const filename = getUnifiedFilename(language);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200 font-sans">
      {/* Header bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] gap-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shrink-0">
            <Cpu className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight flex items-center gap-2">
              Codegenic
              <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 rounded border border-purple-500/30">
                v1.3.0
              </span>
            </h1>
            <p className="text-[10px] md:text-xs text-[var(--text-secondary)]">
              Generate Flawless API Request Code and Typed Models Instantly.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          {/* Target Root Object Name */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[120px]">
            <label className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">Root:</label>
            <input
              type="text"
              value={rootTypeName}
              onChange={(e) => setRootTypeName(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder="RootObject"
              className="px-2.5 py-1 text-xs font-mono bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] w-full sm:w-28 transition-colors duration-200"
            />
          </div>

          {/* Language Selector Dropdown */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[150px]">
            <label className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">Lang:</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as TargetLanguage)}
              className="px-2 py-1 text-xs font-semibold bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] cursor-pointer transition-colors duration-200 w-full"
            >
              <option value="typescript">TypeScript (Axios)</option>
              <option value="javascript">JavaScript ES6+ (Axios)</option>
              <option value="dart">Flutter / Dart (HTTP)</option>
              <option value="python">Python (Requests)</option>
              <option value="rust">Rust (Reqwest / Serde)</option>
              <option value="go">Go / Golang (Net/HTTP)</option>
              <option value="java">Java (HttpClient / Jackson)</option>
              <option value="kotlin">Kotlin (OkHttp / Serialization)</option>
              <option value="csharp">C# (.NET HttpClient)</option>
              <option value="php">PHP (Guzzle / DTO)</option>
              <option value="ruby">Ruby (Net::HTTP / Struct)</option>
            </select>
          </div>

          {/* Actions panel */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Auth widget status */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-1.5 py-1 rounded-lg">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] max-w-[80px] sm:max-w-none truncate">
                  {currentUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-1 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-secondary)] hover:text-red-500 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                  setIsAuthOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-primary)] transition-all cursor-pointer whitespace-nowrap"
              >
                <User size={12} />
                Sign In
              </button>
            )}

            {/* Settings Modal Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-primary)] transition-colors duration-200 cursor-pointer"
              title="Firebase Project configurations"
            >
              <Settings size={14} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-primary)] transition-colors duration-200 cursor-pointer"
              title="Toggle color theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile View Toggle Bar */}
      <div className="flex md:hidden border-b border-[var(--border-color)] bg-[var(--bg-editor-header)] p-1.5 gap-1 transition-colors duration-200 shrink-0">
        <button
          onClick={() => setMobileActiveView('input')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-colors cursor-pointer ${mobileActiveView === 'input'
              ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
              : 'text-[var(--text-secondary)]'
            }`}
        >
          <Settings size={13} />
          Configure Inputs
        </button>
        <button
          onClick={() => setMobileActiveView('output')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-colors cursor-pointer ${mobileActiveView === 'output'
              ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
              : 'text-[var(--text-secondary)]'
            }`}
        >
          <Code2 size={13} />
          View Generated Code
        </button>
      </div>

      {/* Main Content Workspace Split */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column: Inputs (38% width) */}
        <section className={`w-full md:w-[38%] border-b md:border-b-0 md:border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden transition-colors duration-200 ${mobileActiveView === 'input' ? 'flex' : 'hidden md:flex'
          }`}>
          {/* Tab Selector Header */}
          <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-editor-header)] p-1.5 gap-1 transition-colors duration-200">
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-md transition-all duration-200 cursor-pointer ${activeTab === 'paste'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-editor-header)]'
                }`}
            >
              <FileJson size={14} />
              Paste JSON
            </button>
            <button
              onClick={() => setActiveTab('fetch')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-md transition-all duration-200 cursor-pointer ${activeTab === 'fetch'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-editor-header)]'
                }`}
            >
              <Globe size={14} />
              Live API
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-md transition-all duration-200 cursor-pointer ${activeTab === 'history'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-editor-header)]'
                }`}
            >
              <Database size={14} />
              Saved Configs
            </button>
          </div>

          {/* Input Panel Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === 'paste' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Raw JSON Source
                  </span>
                  <button
                    onClick={handlePrettifyJson}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles size={12} />
                    Prettify JSON
                  </button>
                </div>

                <div className="flex-1 relative flex flex-col min-h-[350px]">
                  <textarea
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                    placeholder='{\n  "key": "value"\n}'
                    className="w-full flex-1 p-4 font-mono text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] shadow-inner transition-colors duration-200"
                  />
                  {jsonError && (
                    <div className="absolute bottom-2 left-2 right-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600 dark:text-red-400 flex items-start gap-2 backdrop-blur-md">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>{jsonError}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'fetch' && (
              <div className="space-y-4">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                  API Request Configurations
                </span>

                {/* HTTP Method and URL */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Endpoint URL</label>
                  <div className="flex gap-2">
                    <select
                      value={httpMethod}
                      onChange={(e) => setHttpMethod(e.target.value as HttpMethod)}
                      className="px-3 py-2 text-xs font-bold bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] cursor-pointer transition-colors duration-200"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://api.example.com/endpoint"
                      className="flex-1 px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-[var(--text-primary)] transition-colors duration-200"
                    />
                  </div>
                </div>

                {/* Headers Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Request Headers</label>
                    <button
                      onClick={addHeader}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      Add Header
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {headers.map((header) => (
                      <div key={header.id} className="flex items-center gap-2 bg-[var(--bg-primary)] p-1.5 rounded border border-[var(--border-color)] transition-colors duration-200">
                        <input
                          type="checkbox"
                          checked={header.active}
                          onChange={(e) => updateHeader(header.id, 'active', e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-[var(--border-color)] text-indigo-600 focus:ring-indigo-500 bg-[var(--bg-input)] transition-colors duration-200"
                        />
                        <input
                          type="text"
                          value={header.key}
                          onChange={(e) => updateHeader(header.id, 'key', e.target.value)}
                          placeholder="Header-Name"
                          className="flex-1 min-w-0 px-2 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-colors duration-200"
                        />
                        <span className="text-[var(--text-secondary)] text-xs">:</span>
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 min-w-0 px-2 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-colors duration-200"
                        />
                        <button
                          onClick={() => removeHeader(header.id)}
                          className="text-[var(--text-secondary)] hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {headers.length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-2">No custom headers configured</p>
                    )}
                  </div>
                </div>

                {/* Request Body Area */}
                {(httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'DELETE') && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Request Body (JSON)</label>
                    <textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      placeholder='{\n  "key": "value"\n}'
                      className="w-full h-32 p-3 font-mono text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 resize-none text-[var(--text-primary)] shadow-inner transition-colors duration-200"
                    />
                  </div>
                )}

                {/* Fetch and Run Trigger Button */}
                <button
                  onClick={handleApiFetch}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all duration-200 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Fetching Endpoint...
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      Fetch &amp; Generate Code
                    </>
                  )}
                </button>

                {/* Fetch Diagnostics Alerts */}
                {fetchError && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-750 dark:text-yellow-350 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle size={15} />
                      <span>Request Diagnostics Warning</span>
                    </div>
                    <p className="leading-relaxed">{fetchError}</p>
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[var(--text-secondary)]">
                      <Info size={11} />
                      <span>Note: Local desktop apps bypass web CORS blocks natively.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Configurations History
                  </span>
                  <span className="text-[10px] uppercase font-bold text-indigo-500 flex items-center gap-1">
                    <Database size={10} />
                    {currentUser ? 'Cloud Sync' : 'Local Storage'}
                  </span>
                </div>

                {/* Save Current Configuration trigger */}
                <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3.5 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Save current layout</span>
                    {!isSavingInline && (
                      <button
                        onClick={() => setIsSavingInline(true)}
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-400 cursor-pointer"
                      >
                        Save
                      </button>
                    )}
                  </div>

                  {isSavingInline && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        placeholder="Configuration Name (e.g. User Profile)"
                        className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] transition-colors duration-200"
                      />
                      <div className="flex justify-end gap-2 text-[11px]">
                        <button
                          onClick={() => {
                            setIsSavingInline(false);
                            setSaveTitle('');
                          }}
                          className="px-2 py-1 border border-[var(--border-color)] hover:bg-[var(--bg-editor-header)] text-[var(--text-secondary)] rounded transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveConfig}
                          disabled={!saveTitle.trim()}
                          className="px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Configurations List */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[420px] pr-1">
                  {savedConfigs.map((config) => (
                    <div
                      key={config.id}
                      onClick={() => handleLoadConfig(config)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 flex justify-between items-start ${selectedConfigId === config.id
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-[var(--text-primary)] shadow-sm'
                        : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-editor-header)]'
                        }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{config.title}</p>
                        <p className="text-[10px] font-mono text-[var(--text-secondary)] truncate flex items-center gap-1.5 mt-0.5">
                          <span className="uppercase text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 rounded">
                            {config.method}
                          </span>
                          {config.url}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConfig(e, config.id)}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {savedConfigs.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-4">No configurations saved yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Unified Code Outputs (62% width merged) */}
        <section className={`flex-1 flex overflow-hidden bg-[var(--bg-primary)] p-3 md:p-5 transition-colors duration-200 ${mobileActiveView === 'output' ? 'flex' : 'hidden md:flex'
          }`}>
          <div className="flex-1 h-full min-w-0">
            <CodeEditorMock
              code={unifiedCode}
              language={language}
              title={filename}
              panelLabel="Unified Integration Code"
              onViewDataModel={() => setIsModelModalOpen(true)}
            />
          </div>
        </section>
      </main>

      {/* Separated Data Model Code Popup Modal Overlay */}
      {isModelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-none">
          <div className="w-[95%] md:w-full md:max-w-4xl h-[90vh] md:h-[82vh] flex flex-col bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-editor-header)] transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <FileJson size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Data Model Schema / Structs
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Recursively mapped interfaces, classes, and models for {filename.replace('integration', 'models')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModelModalOpen(false)}
                className="flex items-center justify-center p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                title="Close modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Content Editor */}
            <div className="flex-1 overflow-hidden p-6 bg-[var(--bg-primary)] transition-colors duration-200">
              <CodeEditorMock
                code={modelCode || `// No nested data structures required for the parsed input.`}
                language={language}
                title={filename.replace('integration', 'models')}
                panelLabel="Data Model Definitions"
              />
            </div>
          </div>
        </div>
      )}

      {/* Firebase Configurations Credentials Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-none">
          <div className="w-[95%] sm:w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-editor-header)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Settings size={15} />
                Firebase Project Settings
              </h3>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setFbStatusMessage(null);
                }}
                className="text-slate-400 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Connect this application to your Firebase project. If set, configurations will sync to your Firestore database. Otherwise, they are saved locally.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">API KEY</label>
                  <input
                    type="text"
                    value={fbApiKey}
                    onChange={(e) => setFbApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] font-mono transition-colors duration-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">AUTH DOMAIN</label>
                  <input
                    type="text"
                    value={fbAuthDomain}
                    onChange={(e) => setFbAuthDomain(e.target.value)}
                    placeholder="my-project.firebaseapp.com"
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] font-mono transition-colors duration-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">PROJECT ID</label>
                    <input
                      type="text"
                      value={fbProjectId}
                      onChange={(e) => setFbProjectId(e.target.value)}
                      placeholder="my-project"
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] font-mono transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">APP ID</label>
                    <input
                      type="text"
                      value={fbAppId}
                      onChange={(e) => setFbAppId(e.target.value)}
                      placeholder="1:12345:web:abcd..."
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] font-mono transition-colors duration-200"
                    />
                  </div>
                </div>
              </div>

              {fbStatusMessage && (
                <div className={`p-2.5 rounded text-xs text-center border font-semibold ${fbStatusMessage.startsWith('Success')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                  }`}>
                  {fbStatusMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2 text-[11px] font-bold">
                <button
                  onClick={handleDisconnectFirebase}
                  className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  Disconnect Credentials
                </button>
                <button
                  onClick={handleSaveFirebaseConfig}
                  className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Save &amp; Connect App
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional Firebase Credentials Auth Sign In / Up Modal */}
      {isAuthOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-none">
          <div className="w-[95%] sm:w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-editor-header)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <User size={15} />
                {authMode === 'login' ? 'Sign In to Account' : 'Create an Account'}
              </h3>
              <button
                onClick={() => {
                  setIsAuthOpen(false);
                  setAuthError(null);
                }}
                className="text-slate-400 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Connect your account to sync your saved configurations automatically to the cloud. Sign in is entirely optional.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] transition-colors duration-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">PASSWORD</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-indigo-500 text-[var(--text-primary)] transition-colors duration-200"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-2.5 rounded text-xs text-center border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold leading-relaxed">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer flex justify-center items-center gap-1.5"
              >
                {authLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                {authMode === 'login' ? 'Sign In with Email' : 'Sign Up Account'}
              </button>

              <div className="relative flex items-center justify-center my-3">
                <span className="absolute bg-[var(--bg-secondary)] px-3 text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Or continue with</span>
                <div className="w-full border-t border-[var(--border-color)]"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-primary)] rounded-lg text-xs font-bold border border-[var(--border-color)] transition-colors cursor-pointer flex justify-center items-center gap-2"
              >
                {/* Google Simple SVG icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.107C18.29 1.945 15.34 1 12.24 1 6.01 1 1 6.01 1 12.24s5.01 11.24 11.24 11.24c6.5 0 10.82-4.57 10.82-11.02 0-.74-.08-1.3-.18-1.86h-10.64z" />
                </svg>
                Google Authentication
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setAuthError(null);
                  }}
                  className="text-xs font-bold text-indigo-500 hover:text-indigo-400 cursor-pointer"
                >
                  {authMode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal Simulated Code Editor View Component
interface EditorProps {
  code: string;
  language: TargetLanguage;
  title: string;
  panelLabel: string;
  onViewDataModel?: () => void;
}

function CodeEditorMock({ code, title, panelLabel, onViewDataModel }: EditorProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code to clipboard:', err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xl backdrop-blur transition-all duration-200">
      {/* Editor Header Panel Info */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-editor-header)] border-b border-[var(--border-color)] transition-colors duration-200">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none mb-1">
            {panelLabel}
          </span>
          <span className="text-xs font-mono font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Code2 size={12} className="text-purple-600 dark:text-purple-400" />
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onViewDataModel && (
            <button
              onClick={onViewDataModel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <Sparkles size={12} className="text-indigo-500" />
              View Data Model
            </button>
          )}

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 border cursor-pointer ${copied
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-editor-header)] text-[var(--text-primary)] border-[var(--border-color)]'
              }`}
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Mockup Editor Content */}
      <div className="flex-1 flex overflow-auto font-mono text-[12.5px] leading-relaxed p-4 bg-[var(--bg-editor)] selection:bg-indigo-500/10 transition-colors duration-200">
        {/* Visual Line Numbers */}
        <div className="select-none text-right pr-3.5 border-r border-[var(--border-editor)] text-[var(--text-editor-lines)] min-w-[2.5rem] transition-colors duration-200">
          {lines.map((_, idx) => (
            <div key={idx} className="h-5">
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Formatted Code Output - Raw display prevents highlighting leaks and copies clean string */}
        <pre className="pl-4 flex-1 overflow-x-auto text-[var(--text-code)] transition-colors duration-200">
          <code
            className="block h-full font-mono text-[12.5px] whitespace-pre"
            style={{ lineHeight: '20px' }}
          >
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
