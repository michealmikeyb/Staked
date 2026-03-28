# Stakswipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tinder-style Lemmy PWA client where users swipe posts right (upvote) or left (downvote), scroll down to read comments, and overscroll-down from comments to save — all served from a Docker container with Helm deployment.

**Architecture:** Pure client-side React SPA. Browser talks directly to the user's Lemmy instance via `lemmy-js-client`. Auth token and instance URL live in `localStorage`. Vite serves with HMR in dev; Nginx serves the built `/dist` in production.

**Tech Stack:** React 18 + TypeScript, Vite 5, `lemmy-js-client`, `@use-gesture/react`, `framer-motion`, `vite-plugin-pwa`, Vitest + React Testing Library, Playwright (MCP), Nginx, Docker multi-stage, Helm.

---

## File Map

```
/
├── src/
│   ├── main.tsx                  # React root mount
│   ├── App.tsx                   # Auth routing: /login vs /feed
│   ├── App.css                   # Global resets, CSS variables
│   ├── test-setup.ts             # @testing-library/jest-dom import
│   ├── lib/
│   │   ├── store.ts              # localStorage: saveAuth, loadAuth, clearAuth
│   │   ├── store.test.ts
│   │   ├── lemmy.ts              # lemmy-js-client wrappers: login, fetchPosts, etc.
│   │   └── lemmy.test.ts
│   └── components/
│       ├── LoginPage.tsx         # Instance picker + username/password form
│       ├── LoginPage.module.css
│       ├── LoginPage.test.tsx
│       ├── FeedStack.tsx         # Post queue, pagination, renders PostCard stack
│       ├── FeedStack.test.tsx
│       ├── PostCard.tsx          # Swipeable card with Framer Motion drag
│       ├── PostCard.module.css
│       ├── PostCard.test.tsx
│       ├── CommentsPanel.tsx     # Pinned card header + scrollable comments
│       ├── CommentsPanel.module.css
│       ├── CommentsPanel.test.tsx
│       ├── SwipeHint.tsx         # ← → hint overlay shown on first launch
│       └── Toast.tsx             # Save confirmation toast
├── public/
│   ├── icon-192.png              # Orange S on dark bg (generate in Task 12)
│   └── icon-512.png
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── nginx.conf
├── Dockerfile
├── docker-compose.yml
├── .gitignore
└── helm/stakswipe/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── deployment.yaml
        └── service.yaml
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "stakswipe",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@use-gesture/react": "^10.3.1",
    "framer-motion": "^11.0.0",
    "lemmy-js-client": "^0.19.4",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^14.3.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Also create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create vite.config.ts** (PWA added in Task 12 — leave plugin array minimal for now)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: Create src/test-setup.ts**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#ff6b35" />
    <title>Stakswipe</title>
    <link rel="icon" type="image/png" href="/icon-192.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/App.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #111318;
  --card-bg: #1c1e24;
  --accent: #ff6b35;
  --text-primary: #f5f5f5;
  --text-secondary: #888888;
  --border: #2a2a35;
}

html, body, #root {
  height: 100%;
  width: 100%;
  background: var(--bg);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
  touch-action: none;
}
```

- [ ] **Step 8: Create src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Create src/App.tsx** (stub — will be expanded in Task 6)

```tsx
export default function App() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1 style={{ color: 'var(--accent)', fontSize: '2rem', fontWeight: 900 }}>Stakswipe</h1>
    </div>
  );
}
```

- [ ] **Step 10: Create .gitignore**

```
node_modules/
dist/
.superpowers/
*.local
```

- [ ] **Step 11: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 12: Verify dev server starts**

```bash
npm run dev
```

Expected output includes: `Local: http://localhost:5173/` — open it, see "Stakswipe" in orange.

- [ ] **Step 13: Verify tests run**

```bash
npm test
```

Expected: `No test files found` (no tests yet — this is fine, confirms Vitest is wired up).

- [ ] **Step 14: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts index.html src/
git commit -m "feat: scaffold React + Vite + Vitest project"
```

---

## Task 2: Docker dev environment

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# ── Dev stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Prod stage ─────────────────────────────────────────────────────────────
FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  stakswipe-dev:
    build:
      context: .
      target: dev
    ports:
      - "5173:5173"
    volumes:
      - ./src:/app/src
      - ./public:/app/public
      - ./index.html:/app/index.html
      - ./vite.config.ts:/app/vite.config.ts
    environment:
      - CHOKIDAR_USEPOLLING=true
```

`CHOKIDAR_USEPOLLING=true` ensures Vite HMR detects file changes through the Docker volume mount on Linux/Raspberry Pi.

- [ ] **Step 3: Start dev container**

```bash
docker compose up --build
```

Expected: container starts, Vite output shows `Local: http://localhost:5173/`. Open browser — see "Stakswipe" in orange. Edit `src/App.tsx` and confirm the change appears in the browser without refreshing.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Docker dev container with HMR volume mount"
```

---

## Task 3: store.ts — auth persistence

**Files:**
- Create: `src/lib/store.ts`
- Create: `src/lib/store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveAuth, loadAuth, clearAuth, type AuthState } from './store';

const VALID_AUTH: AuthState = {
  token: 'test-jwt-token',
  instance: 'lemmy.world',
  username: 'alice',
};

beforeEach(() => {
  localStorage.clear();
});

describe('saveAuth / loadAuth', () => {
  it('returns null when nothing is stored', () => {
    expect(loadAuth()).toBeNull();
  });

  it('round-trips auth state through localStorage', () => {
    saveAuth(VALID_AUTH);
    expect(loadAuth()).toEqual(VALID_AUTH);
  });

  it('returns null if token is missing', () => {
    saveAuth(VALID_AUTH);
    localStorage.removeItem('stakswipe_token');
    expect(loadAuth()).toBeNull();
  });

  it('returns null if instance is missing', () => {
    saveAuth(VALID_AUTH);
    localStorage.removeItem('stakswipe_instance');
    expect(loadAuth()).toBeNull();
  });
});

describe('clearAuth', () => {
  it('removes stored auth so loadAuth returns null', () => {
    saveAuth(VALID_AUTH);
    clearAuth();
    expect(loadAuth()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- store
```

Expected: FAIL — `Cannot find module './store'`

- [ ] **Step 3: Implement store.ts**

```typescript
// src/lib/store.ts
const KEYS = {
  TOKEN: 'stakswipe_token',
  INSTANCE: 'stakswipe_instance',
  USERNAME: 'stakswipe_username',
} as const;

export interface AuthState {
  token: string;
  instance: string;
  username: string;
}

export function saveAuth(auth: AuthState): void {
  localStorage.setItem(KEYS.TOKEN, auth.token);
  localStorage.setItem(KEYS.INSTANCE, auth.instance);
  localStorage.setItem(KEYS.USERNAME, auth.username);
}

export function loadAuth(): AuthState | null {
  const token = localStorage.getItem(KEYS.TOKEN);
  const instance = localStorage.getItem(KEYS.INSTANCE);
  const username = localStorage.getItem(KEYS.USERNAME);
  if (!token || !instance || !username) return null;
  return { token, instance, username };
}

export function clearAuth(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- store
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: add auth persistence (store.ts)"
```

---

## Task 4: lemmy.ts — API wrapper

**Files:**
- Create: `src/lib/lemmy.ts`
- Create: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/lemmy.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments } from './lemmy';

// Mock the entire lemmy-js-client module
vi.mock('lemmy-js-client', () => {
  const MockLemmyHttp = vi.fn().mockImplementation(() => ({
    login: vi.fn().mockResolvedValue({ jwt: 'mock-token' }),
    getPosts: vi.fn().mockResolvedValue({ posts: [{ post: { id: 1, name: 'Test Post' } }] }),
    likePost: vi.fn().mockResolvedValue({}),
    savePost: vi.fn().mockResolvedValue({}),
    getComments: vi.fn().mockResolvedValue({ comments: [{ comment: { id: 1, content: 'Hello' } }] }),
  }));
  return { LemmyHttp: MockLemmyHttp };
});

beforeEach(() => vi.clearAllMocks());

describe('login', () => {
  it('returns the JWT on success', async () => {
    const token = await login('lemmy.world', 'alice', 'secret');
    expect(token).toBe('mock-token');
  });

  it('throws if jwt is absent from response', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    vi.mocked(LemmyHttp).mockImplementationOnce(() => ({
      login: vi.fn().mockResolvedValue({}),
    } as never));
    await expect(login('lemmy.world', 'alice', 'wrong')).rejects.toThrow('Login failed');
  });
});

describe('fetchPosts', () => {
  it('returns an array of PostView', async () => {
    const posts = await fetchPosts('lemmy.world', 'tok', 1);
    expect(posts).toHaveLength(1);
    expect(posts[0].post.id).toBe(1);
  });
});

describe('upvotePost / downvotePost', () => {
  it('resolves without throwing', async () => {
    await expect(upvotePost('lemmy.world', 'tok', 1)).resolves.toBeUndefined();
    await expect(downvotePost('lemmy.world', 'tok', 1)).resolves.toBeUndefined();
  });
});

describe('savePost', () => {
  it('resolves without throwing', async () => {
    await expect(savePost('lemmy.world', 'tok', 1)).resolves.toBeUndefined();
  });
});

describe('fetchComments', () => {
  it('returns an array of CommentView', async () => {
    const comments = await fetchComments('lemmy.world', 'tok', 1);
    expect(comments).toHaveLength(1);
    expect(comments[0].comment.id).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- lemmy
```

Expected: FAIL — `Cannot find module './lemmy'`

- [ ] **Step 3: Implement lemmy.ts**

```typescript
// src/lib/lemmy.ts
import { LemmyHttp, type PostView, type CommentView } from 'lemmy-js-client';

export type { PostView, CommentView };

function client(instance: string): LemmyHttp {
  return new LemmyHttp(`https://${instance}`);
}

export async function login(
  instance: string,
  usernameOrEmail: string,
  password: string,
): Promise<string> {
  const res = await client(instance).login({ username_or_email: usernameOrEmail, password });
  if (!res.jwt) throw new Error('Login failed: no token returned');
  return res.jwt;
}

export async function fetchPosts(
  instance: string,
  token: string,
  page: number,
): Promise<PostView[]> {
  const res = await client(instance).getPosts({
    type_: 'All',
    sort: 'TopTwelveHour',
    page,
    limit: 10,
    auth: token,
  });
  return res.posts;
}

export async function upvotePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  await client(instance).likePost({ post_id: postId, score: 1, auth: token });
}

export async function downvotePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  await client(instance).likePost({ post_id: postId, score: -1, auth: token });
}

export async function savePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  await client(instance).savePost({ post_id: postId, save: true, auth: token });
}

export async function fetchComments(
  instance: string,
  token: string,
  postId: number,
): Promise<CommentView[]> {
  const res = await client(instance).getComments({
    post_id: postId,
    sort: 'Top',
    limit: 50,
    auth: token,
  });
  return res.comments;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- lemmy
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add Lemmy API wrapper (lemmy.ts)"
```

---

## Task 5: LoginPage component

**Files:**
- Create: `src/components/LoginPage.tsx`
- Create: `src/components/LoginPage.module.css`
- Create: `src/components/LoginPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/LoginPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';

vi.mock('../lib/lemmy', () => ({
  login: vi.fn().mockResolvedValue('mock-jwt'),
}));

vi.mock('../lib/store', () => ({
  saveAuth: vi.fn(),
}));

const mockOnLogin = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('LoginPage', () => {
  it('renders the Stakswipe title', () => {
    render(<LoginPage onLogin={mockOnLogin} />);
    expect(screen.getByText('Stakswipe')).toBeInTheDocument();
  });

  it('shows the instance dropdown with popular instances', () => {
    render(<LoginPage onLogin={mockOnLogin} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'lemmy.world' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'beehaw.org' })).toBeInTheDocument();
  });

  it('reveals custom input when "custom" option is selected', async () => {
    render(<LoginPage onLogin={mockOnLogin} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'custom');
    expect(screen.getByPlaceholderText('your.instance.com')).toBeInTheDocument();
  });

  it('calls onLogin with instance and username after successful login', async () => {
    const { login } = await import('../lib/lemmy');
    render(<LoginPage onLogin={mockOnLogin} />);

    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('lemmy.world', 'alice', 'secret');
      expect(mockOnLogin).toHaveBeenCalledWith({
        token: 'mock-jwt',
        instance: 'lemmy.world',
        username: 'alice',
      });
    });
  });

  it('displays an error message on login failure', async () => {
    const { login } = await import('../lib/lemmy');
    vi.mocked(login).mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage onLogin={mockOnLogin} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- LoginPage
```

Expected: FAIL — `Cannot find module './LoginPage'`

- [ ] **Step 3: Create LoginPage.module.css**

```css
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 24px;
  background: var(--bg);
}

.logo {
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--accent);
  letter-spacing: -1px;
  margin-bottom: 4px;
}

.tagline {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 40px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.form {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.select,
.input {
  width: 100%;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.select:focus,
.input:focus {
  border-color: var(--accent);
}

.button {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 14px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 8px;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #ff4444;
  font-size: 0.85rem;
  text-align: center;
}
```

- [ ] **Step 4: Implement LoginPage.tsx**

```tsx
// src/components/LoginPage.tsx
import { useState } from 'react';
import { login } from '../lib/lemmy';
import { saveAuth, type AuthState } from '../lib/store';
import styles from './LoginPage.module.css';

const POPULAR_INSTANCES = [
  'lemmy.world',
  'beehaw.org',
  'programming.dev',
  'lemmy.ml',
  'sh.itjust.works',
];

interface Props {
  onLogin: (auth: AuthState) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [selectedInstance, setSelectedInstance] = useState(POPULAR_INSTANCES[0]);
  const [customInstance, setCustomInstance] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const instance = selectedInstance === 'custom' ? customInstance.trim() : selectedInstance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instance || !username || !password) return;
    setError('');
    setLoading(true);
    try {
      const token = await login(instance, username, password);
      const auth: AuthState = { token, instance, username };
      saveAuth(auth);
      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.logo}>Stakswipe</div>
      <div className={styles.tagline}>Lemmy, fast</div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div>
          <div className={styles.label}>Instance</div>
          <select
            className={styles.select}
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
          >
            {POPULAR_INSTANCES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
            <option value="custom">custom...</option>
          </select>
        </div>
        {selectedInstance === 'custom' && (
          <input
            className={styles.input}
            placeholder="your.instance.com"
            value={customInstance}
            onChange={(e) => setCustomInstance(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}
        <input
          className={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <input
          className={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- LoginPage
```

Expected: PASS — 5 tests

- [ ] **Step 6: Use Playwright to visually check the login page**

Start the dev server (or docker compose) then:

```
mcp__playwright: navigate to http://localhost:5173
mcp__playwright: take screenshot
```

Verify: orange "Stakswipe" logo, dark background, instance dropdown, username/password fields, orange "Sign In" button.

- [ ] **Step 7: Commit**

```bash
git add src/components/LoginPage.tsx src/components/LoginPage.module.css src/components/LoginPage.test.tsx
git commit -m "feat: add login page with instance picker"
```

---

## Task 6: App.tsx — auth routing

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/App.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./lib/store', () => ({
  loadAuth: vi.fn().mockReturnValue(null),
  clearAuth: vi.fn(),
}));

vi.mock('./components/LoginPage', () => ({
  default: ({ onLogin }: { onLogin: unknown }) => <div>LoginPage</div>,
}));

vi.mock('./components/FeedStack', () => ({
  default: () => <div>FeedStack</div>,
}));

describe('App routing', () => {
  it('shows LoginPage when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('shows FeedStack when authenticated', async () => {
    const { loadAuth } = await import('./lib/store');
    vi.mocked(loadAuth).mockReturnValue({
      token: 'tok',
      instance: 'lemmy.world',
      username: 'alice',
    });
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- App.test
```

Expected: FAIL — FeedStack module not found (or assertion fails)

- [ ] **Step 3: Implement App.tsx**

```tsx
// src/App.tsx
import { useState } from 'react';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import LoginPage from './components/LoginPage';
import FeedStack from './components/FeedStack';

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <FeedStack auth={auth} onLogout={handleLogout} />;
}
```

Create a stub `src/components/FeedStack.tsx` so the app compiles (expanded in Task 7):

```tsx
// src/components/FeedStack.tsx
import { type AuthState } from '../lib/store';

interface Props {
  auth: AuthState;
  onLogout: () => void;
}

export default function FeedStack({ auth }: Props) {
  return (
    <div style={{ color: 'var(--text-primary)', padding: 24 }}>
      Logged in as {auth.username} on {auth.instance}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- App.test
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/FeedStack.tsx
git commit -m "feat: auth-based routing in App.tsx"
```

---

## Task 7: FeedStack + PostCard (static rendering)

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Create: `src/components/PostCard.tsx`
- Create: `src/components/PostCard.module.css`
- Create: `src/components/FeedStack.test.tsx`
- Create: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Write failing tests for FeedStack**

```tsx
// src/components/FeedStack.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FeedStack from './FeedStack';
import { type PostView } from '../lib/lemmy';

const MOCK_POST: PostView = {
  post: { id: 1, name: 'Test Post Title', body: 'body text', url: null, thumbnail_url: null, ap_id: '', local: true, published: '', updated: null, deleted: false, locked: false, removed: false, nsfw: false, embed_title: null, embed_description: null, embed_video_url: null, featured_community: false, featured_local: false, language_id: 0 },
  community: { id: 1, name: 'technology', title: 'Technology', actor_id: 'https://lemmy.world/c/technology', local: true, icon: null, banner: null, hidden: false, posting_restricted_to_mods: false, published: '', removed: false, deleted: false, nsfw: false, followers_url: '', inbox_url: '', shared_inbox_url: null, moderators_url: '', featured_url: null, instance_id: 0 },
  creator: { id: 1, name: 'alice', display_name: null, avatar: null, banned: false, published: '', updated: null, actor_id: '', local: true, deleted: false, bot_account: false, ban_expires: null, instance_id: 0, banner: null, bio: null, inbox_url: '', shared_inbox_url: null, matrix_user_id: null },
  counts: { post_id: 1, comments: 42, score: 847, upvotes: 900, downvotes: 53, newest_comment_time: '', newest_comment_time_necro: '', published: '', featured_community: false, featured_local: false, hot_rank: 0, hot_rank_active: 0 },
  subscribed: 'NotSubscribed',
  saved: false,
  read: false,
  creator_blocked: false,
  my_vote: null,
  unread_comments: 0,
} as unknown as PostView;

vi.mock('../lib/lemmy', () => ({
  fetchPosts: vi.fn().mockResolvedValue([MOCK_POST]),
}));

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

describe('FeedStack', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading state initially', () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders a post title after loading', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Write failing tests for PostCard**

```tsx
// src/components/PostCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostCard from './PostCard';
import { type PostView } from '../lib/lemmy';

const MOCK_POST = {
  post: { id: 1, name: 'Rust post', body: null, url: 'https://example.com', thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob' },
  counts: { score: 200, comments: 15 },
} as unknown as PostView;

describe('PostCard', () => {
  it('renders post title', () => {
    render(
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onOpenComments={vi.fn()}
      />
    );
    expect(screen.getByText('Rust post')).toBeInTheDocument();
  });

  it('renders community name', () => {
    render(
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onOpenComments={vi.fn()}
      />
    );
    expect(screen.getByText(/programming/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm test -- FeedStack PostCard
```

Expected: FAIL — modules not implemented

- [ ] **Step 4: Create PostCard.module.css**

```css
.card {
  position: absolute;
  width: 92vw;
  max-width: 420px;
  background: var(--card-bg);
  border-radius: 20px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  touch-action: none;
}

.card:active {
  cursor: grabbing;
}

.meta {
  padding: 14px 16px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.communityIcon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.communityName {
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 600;
}

.instanceName {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.title {
  padding: 0 16px 10px;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary);
}

.thumbnail {
  width: 100%;
  height: 180px;
  object-fit: cover;
  background: var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.excerpt {
  padding: 10px 16px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.footer {
  padding: 10px 16px 16px;
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  color: var(--accent);
}

.overlay {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  pointer-events: none;
}

.scrollHint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.6;
}
```

- [ ] **Step 5: Implement PostCard.tsx (static rendering — gestures added in Task 8)**

```tsx
// src/components/PostCard.tsx
import { type PostView } from '../lib/lemmy';
import styles from './PostCard.module.css';

interface Props {
  post: PostView;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onOpenComments: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try {
    return new URL(actorId).hostname;
  } catch {
    return '';
  }
}

export default function PostCard({ post, zIndex, scale, onSwipeRight, onSwipeLeft, onOpenComments }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = instanceFromActorId(community.actor_id);

  return (
    <div
      className={styles.card}
      style={{ zIndex, transform: `scale(${scale})`, transition: 'transform 0.2s' }}
    >
      <div className={styles.meta}>
        <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
        <div>
          <div className={styles.communityName}>c/{community.name}</div>
          <div className={styles.instanceName}>{instance} • {creator.name}</div>
        </div>
      </div>

      <div className={styles.title}>{p.name}</div>

      <div className={styles.thumbnail}>
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt="" loading="lazy" />
          : <span>No image</span>}
      </div>

      {p.body && (
        <div className={styles.excerpt}>{p.body}</div>
      )}

      <div className={styles.footer}>
        <span>▲ {counts.score}</span>
        <span>💬 {counts.comments}</span>
      </div>

      <div className={styles.scrollHint}>↓ scroll for comments</div>
    </div>
  );
}
```

- [ ] **Step 6: Implement FeedStack.tsx**

```tsx
// src/components/FeedStack.tsx
import { useState, useEffect, useCallback } from 'react';
import { fetchPosts, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import PostCard from './PostCard';

interface Props {
  auth: AuthState;
  onLogout: () => void;
}

const STACK_VISIBLE = 3; // how many cards to render in the DOM

export default function FeedStack({ auth, onLogout }: Props) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMore = useCallback(async (nextPage: number) => {
    try {
      const newPosts = await fetchPosts(auth.instance, auth.token, nextPage);
      setPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    loadMore(1);
  }, [loadMore]);

  // When posts drop low, fetch the next page
  useEffect(() => {
    if (posts.length <= 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage);
    }
  }, [posts.length, loading, page, loadMore]);

  function dismissTop() {
    setPosts((prev) => prev.slice(1));
  }

  if (loading && posts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <div style={{ color: '#ff4444' }}>{error}</div>
        <button onClick={onLogout} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
    );
  }

  const visible = posts.slice(0, STACK_VISIBLE);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative' }}>
      {visible.map((post, i) => {
        const isTop = i === 0;
        const scale = 1 - i * 0.04;
        const zIndex = STACK_VISIBLE - i;
        return (
          <PostCard
            key={post.post.id}
            post={post}
            zIndex={zIndex}
            scale={isTop ? 1 : scale}
            onSwipeRight={isTop ? dismissTop : () => {}}
            onSwipeLeft={isTop ? dismissTop : () => {}}
            onOpenComments={() => {}}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
npm test -- FeedStack PostCard
```

Expected: PASS — 4 tests total

- [ ] **Step 8: Playwright visual check**

```
mcp__playwright: navigate to http://localhost:5173
```

Log in, then:

```
mcp__playwright: take screenshot
```

Verify: stacked cards visible in centre of screen, community name in orange, post title, thumbnail placeholder, score and comment count.

- [ ] **Step 9: Commit**

```bash
git add src/components/FeedStack.tsx src/components/PostCard.tsx src/components/PostCard.module.css src/components/FeedStack.test.tsx src/components/PostCard.test.tsx
git commit -m "feat: feed stack with post cards (static rendering)"
```

---

## Task 8: Swipe gestures

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/FeedStack.tsx`

Swipe right → CCW rotation (~-12°), orange overlay, upvote + dismiss.
Swipe left → CW rotation (~+12°), grey overlay, downvote + dismiss.
Threshold: 120px displacement OR velocity > 500px/s.

- [ ] **Step 1: Write the failing gesture test**

```tsx
// Append to src/components/PostCard.test.tsx

import { fireEvent } from '@testing-library/react';

describe('PostCard gestures', () => {
  it('calls onSwipeRight when dragged far right', () => {
    const onSwipeRight = vi.fn();
    const { container } = render(
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={vi.fn()}
        onOpenComments={vi.fn()}
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: 200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: 200, clientY: 0 });
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('calls onSwipeLeft when dragged far left', () => {
    const onSwipeLeft = vi.fn();
    const { container } = render(
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={onSwipeLeft}
        onOpenComments={vi.fn()}
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: -200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: -200, clientY: 0 });
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- PostCard
```

Expected: FAIL — gesture callbacks not called

- [ ] **Step 3: Replace PostCard.tsx with gesture-enabled version**

```tsx
// src/components/PostCard.tsx
import { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { type PostView } from '../lib/lemmy';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120; // px
const VELOCITY_THRESHOLD = 0.5; // px/ms (use-gesture normalises to px/ms)

interface Props {
  post: PostView;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onOpenComments: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).hostname; } catch { return ''; }
}

export default function PostCard({ post, zIndex, scale, onSwipeRight, onSwipeLeft, onOpenComments }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = instanceFromActorId(community.actor_id);

  const x = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Rotation: right swipe tilts CCW (negative), left swipe tilts CW (positive)
  // At ±120px drag, rotate ±12°. Inverted from standard Tinder.
  const rotate = useTransform(x, [-150, 0, 150], [12, 0, -12]);

  // Overlay opacity: 0 at centre, 1 at ±120px
  const overlayOpacity = useTransform(x, [-120, 0, 120], [1, 0, 1]);

  // Orange (right) vs grey (left) overlay color
  const overlayColor = useTransform(x, (v) =>
    v > 0 ? `rgba(255,107,53,${Math.min(Math.abs(v) / 120, 1) * 0.45})`
           : `rgba(80,80,80,${Math.min(Math.abs(v) / 120, 1) * 0.45})`
  );

  const bind = useDrag(({ movement: [mx], velocity: [vx], last, cancel }) => {
    // Block horizontal drag from turning into scroll
    x.set(mx);

    if (last) {
      const shouldSwipe = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
      if (shouldSwipe && mx > 0) {
        // Fly off to the right
        animate(x, 600, { duration: 0.3, onComplete: onSwipeRight });
      } else if (shouldSwipe && mx < 0) {
        // Fly off to the left
        animate(x, -600, { duration: 0.3, onComplete: onSwipeLeft });
      } else {
        // Spring back to centre
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    }
  }, {
    axis: 'x',
    filterTaps: true,
    pointer: { touch: true },
  });

  return (
    <motion.div
      ref={cardRef}
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      {/* Swipe direction colour overlay */}
      <motion.div
        className={styles.overlay}
        style={{ backgroundColor: overlayColor, opacity: overlayOpacity }}
      />

      <div className={styles.meta}>
        <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
        <div>
          <div className={styles.communityName}>c/{community.name}</div>
          <div className={styles.instanceName}>{instance} • {creator.name}</div>
        </div>
      </div>

      <div className={styles.title}>{p.name}</div>

      <div className={styles.thumbnail}>
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt="" loading="lazy" />
          : <span>No image</span>}
      </div>

      {p.body && <div className={styles.excerpt}>{p.body}</div>}

      <div className={styles.footer}>
        <span>▲ {counts.score}</span>
        <span>💬 {counts.comments}</span>
      </div>

      <div className={styles.scrollHint} onClick={onOpenComments}>↓ comments</div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Wire upvote/downvote API calls into FeedStack**

Update `FeedStack.tsx` — replace the `onSwipeRight` and `onSwipeLeft` props passed to `PostCard`:

```tsx
// Add import at top of FeedStack.tsx
import { fetchPosts, upvotePost, downvotePost, type PostView } from '../lib/lemmy';

// Replace the PostCard render inside the map:
<PostCard
  key={post.post.id}
  post={post}
  zIndex={zIndex}
  scale={isTop ? 1 : scale}
  onSwipeRight={isTop ? async () => {
    await upvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
    dismissTop();
  } : () => {}}
  onSwipeLeft={isTop ? async () => {
    await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
    dismissTop();
  } : () => {}}
  onOpenComments={() => {}}
/>
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- PostCard FeedStack
```

Expected: PASS — all tests

- [ ] **Step 6: Playwright gesture check**

```
mcp__playwright: navigate to http://localhost:5173
mcp__playwright: take screenshot
```

After logging in:

```
mcp__playwright: drag from (center) right 200px — observe card flying off right with CCW rotation and orange tint
mcp__playwright: take screenshot
mcp__playwright: drag from (center) left 200px — observe card flying off left with CW rotation and grey tint
mcp__playwright: take screenshot
```

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCard.tsx src/components/FeedStack.tsx
git commit -m "feat: swipe gestures with Framer Motion (upvote/downvote)"
```

---

## Task 9: CommentsPanel

**Files:**
- Create: `src/components/CommentsPanel.tsx`
- Create: `src/components/CommentsPanel.module.css`
- Create: `src/components/CommentsPanel.test.tsx`
- Modify: `src/components/FeedStack.tsx`

When user taps "↓ comments" or drags the card upward, CommentsPanel slides up. The post card pins as a compact header. Scrolling back to top + pulling down further saves the post (Task 10).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/CommentsPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CommentsPanel from './CommentsPanel';
import { type PostView, type CommentView } from '../lib/lemmy';

const MOCK_POST = {
  post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice' },
  counts: { score: 847, comments: 2 },
} as unknown as PostView;

const MOCK_COMMENTS: CommentView[] = [
  {
    comment: { id: 10, content: 'Great article!', path: '0.10', published: '' },
    creator: { name: 'bob' },
    counts: { score: 42 },
  } as unknown as CommentView,
  {
    comment: { id: 11, content: 'I disagree.', path: '0.10.11', published: '' },
    creator: { name: 'carol' },
    counts: { score: 5 },
  } as unknown as CommentView,
];

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue(MOCK_COMMENTS),
}));

describe('CommentsPanel', () => {
  it('shows post title in pinned header', () => {
    render(<CommentsPanel post={MOCK_POST} auth={{ token: 't', instance: 'lemmy.world', username: 'u' }} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Test Post')).toBeInTheDocument();
  });

  it('loads and renders comments', async () => {
    render(<CommentsPanel post={MOCK_POST} auth={{ token: 't', instance: 'lemmy.world', username: 'u' }} onClose={vi.fn()} onSave={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Great article!')).toBeInTheDocument();
      expect(screen.getByText('I disagree.')).toBeInTheDocument();
    });
  });

  it('indents replies based on path depth', async () => {
    const { container } = render(<CommentsPanel post={MOCK_POST} auth={{ token: 't', instance: 'lemmy.world', username: 'u' }} onClose={vi.fn()} onSave={vi.fn()} />);
    await waitFor(() => screen.getByText('I disagree.'));
    // Depth-1 comment (path 0.10) has indent 0, depth-2 (0.10.11) has indent > 0
    const comments = container.querySelectorAll('[data-depth]');
    expect(Number(comments[0].getAttribute('data-depth'))).toBe(1);
    expect(Number(comments[1].getAttribute('data-depth'))).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- CommentsPanel
```

Expected: FAIL — module not found

- [ ] **Step 3: Create CommentsPanel.module.css**

```css
.panel {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.header {
  flex-shrink: 0;
  background: var(--card-bg);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.closeBtn {
  color: var(--accent);
  font-size: 1.3rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.headerTitle {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.headerMeta {
  font-size: 0.75rem;
  color: var(--accent);
  flex-shrink: 0;
}

.scrollArea {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.comment {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.commentAuthor {
  font-size: 0.72rem;
  color: var(--accent);
  margin-bottom: 4px;
}

.commentBody {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.5;
}

.commentScore {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.loading {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

.saveHint {
  text-align: center;
  padding: 8px;
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.6;
}
```

- [ ] **Step 4: Implement CommentsPanel.tsx**

```tsx
// src/components/CommentsPanel.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchComments, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import styles from './CommentsPanel.module.css';

interface Props {
  post: PostView;
  auth: AuthState;
  onClose: () => void;
  onSave: () => void;
}

function depthFromPath(path: string): number {
  // Path format: "0.parentId.childId" — depth = segments - 1
  return path.split('.').length - 1;
}

export default function CommentsPanel({ post, auth, onClose, onSave }: Props) {
  const { post: p, counts } = post;
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Overscroll-to-save: track touch start Y when scroll is at top
  const touchStartY = useRef(0);

  useEffect(() => {
    fetchComments(auth.instance, auth.token, p.id)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [auth, p.id]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 0;
    const dragDown = e.touches[0].clientY - touchStartY.current > 60;
    if (atTop && dragDown) {
      onSave();
    }
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
    >
      {/* Pinned post header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close comments">←</button>
        <div className={styles.headerTitle}>{p.name}</div>
        <div className={styles.headerMeta}>▲ {counts.score} · 💬 {counts.comments}</div>
      </div>

      <div
        ref={scrollRef}
        className={styles.scrollArea}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className={styles.saveHint}>↓ pull down to save post</div>

        {loading && <div className={styles.loading}>Loading comments…</div>}

        {comments.map((cv) => {
          const depth = depthFromPath(cv.comment.path);
          return (
            <div
              key={cv.comment.id}
              className={styles.comment}
              data-depth={depth}
              style={{ paddingLeft: `${16 + (depth - 1) * 14}px` }}
            >
              <div className={styles.commentAuthor}>@{cv.creator.name} · ▲ {cv.counts.score}</div>
              <div className={styles.commentBody}>{cv.comment.content}</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 5: Wire CommentsPanel into FeedStack**

Add to `FeedStack.tsx`:

```tsx
// Add imports
import { useState } from 'react'; // already imported
import { AnimatePresence } from 'framer-motion';
import CommentsPanel from './CommentsPanel';
import { savePost } from '../lib/lemmy';

// Add state inside FeedStack component (after existing state):
const [commentPost, setCommentPost] = useState<PostView | null>(null);

// Update onOpenComments in the PostCard render:
onOpenComments={() => setCommentPost(post)}

// Add after the card stack div:
<AnimatePresence>
  {commentPost && (
    <CommentsPanel
      post={commentPost}
      auth={auth}
      onClose={() => setCommentPost(null)}
      onSave={async () => {
        await savePost(auth.instance, auth.token, commentPost.post.id).catch(() => {});
        setCommentPost(null);
        dismissTop();
      }}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm test -- CommentsPanel FeedStack PostCard
```

Expected: PASS — all tests

- [ ] **Step 7: Playwright check — open comments**

Log in, then:

```
mcp__playwright: click the "↓ comments" hint on the top card
mcp__playwright: take screenshot
```

Verify: CommentsPanel slides up from bottom, pinned header shows post title and score, comments list loads.

- [ ] **Step 8: Commit**

```bash
git add src/components/CommentsPanel.tsx src/components/CommentsPanel.module.css src/components/CommentsPanel.test.tsx src/components/FeedStack.tsx
git commit -m "feat: comments panel with pinned header and overscroll-to-save"
```

---

## Task 10: SwipeHint + Toast

**Files:**
- Create: `src/components/SwipeHint.tsx`
- Create: `src/components/Toast.tsx`
- Modify: `src/components/FeedStack.tsx`

- [ ] **Step 1: Create SwipeHint.tsx**

Shown only on first launch (localStorage flag). Auto-hides after 3 seconds.

```tsx
// src/components/SwipeHint.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HINT_KEY = 'stakswipe_hint_seen';

export default function SwipeHint() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(HINT_KEY));

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(HINT_KEY, '1');
    }, 3000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            pointerEvents: 'none',
            zIndex: 200,
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', gap: 60, fontSize: '2rem' }}>
            <span>👎 ←</span>
            <span>→ 👍</span>
          </div>
          <div style={{ color: '#ccc', fontSize: '0.85rem', textAlign: 'center' }}>
            Swipe to vote<br />
            <span style={{ color: '#888' }}>Scroll down for comments</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Create Toast.tsx**

```tsx
// src/components/Toast.tsx
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export default function Toast({ message, visible, onHide }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, 2000);
    return () => clearTimeout(t);
  }, [visible, onHide]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          style={{
            position: 'fixed',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 20,
            fontWeight: 700,
            fontSize: '0.9rem',
            zIndex: 300,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Wire SwipeHint and Toast into FeedStack**

```tsx
// Add to imports in FeedStack.tsx:
import SwipeHint from './SwipeHint';
import Toast from './Toast';

// Add state:
const [toast, setToast] = useState('');
const [toastVisible, setToastVisible] = useState(false);

function showToast(msg: string) {
  setToast(msg);
  setToastVisible(true);
}

// Update CommentsPanel onSave to show toast:
onSave={async () => {
  await savePost(auth.instance, auth.token, commentPost.post.id).catch(() => {});
  setCommentPost(null);
  dismissTop();
  showToast('Post saved!');
}}

// Add before the closing </div>:
<SwipeHint />
<Toast message={toast} visible={toastVisible} onHide={() => setToastVisible(false)} />
```

- [ ] **Step 4: Playwright check**

Clear localStorage, reload:

```
mcp__playwright: navigate to http://localhost:5173
```

Log in, verify SwipeHint overlay appears and fades after 3 seconds.

Open comments, simulate save overscroll, verify orange "Post saved!" toast appears.

```
mcp__playwright: take screenshot
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SwipeHint.tsx src/components/Toast.tsx src/components/FeedStack.tsx
git commit -m "feat: swipe hint overlay and save toast"
```

---

## Task 11: PWA — manifest + service worker + icons

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`

- [ ] **Step 1: Generate icons using a script**

Run this in the project root to create simple canvas-based icons (requires Node):

```bash
node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ff6b35';
  ctx.font = \`bold \${Math.floor(size * 0.6)}px sans-serif\`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', size / 2, size / 2);
  return canvas.toBuffer('image/png');
}

fs.writeFileSync('public/icon-192.png', makeIcon(192));
fs.writeFileSync('public/icon-512.png', makeIcon(512));
console.log('Icons written.');
"
```

If `canvas` is not available, create the icons manually with any image editor — a dark background (`#111318`) with a bold orange (`#ff6b35`) "S" centred. Save as PNG at 192×192 and 512×512.

- [ ] **Step 2: Update vite.config.ts with PWA plugin**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Stakswipe',
        short_name: 'Stakswipe',
        description: 'Lemmy, fast. Swipe to vote.',
        theme_color: '#ff6b35',
        background_color: '#111318',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
```

- [ ] **Step 3: Build and verify manifest**

```bash
npm run build
```

Expected: `dist/` created, contains `manifest.webmanifest`, `sw.js`, and icon files.

```bash
cat dist/manifest.webmanifest
```

Expected: JSON with `name: "Stakswipe"`, `theme_color: "#ff6b35"`, `display: "standalone"`, icons array.

- [ ] **Step 4: Playwright PWA check**

```bash
npx vite preview --host 0.0.0.0 --port 4173
```

```
mcp__playwright: navigate to http://localhost:4173
mcp__playwright: take screenshot
```

Verify app loads from production build. Check browser DevTools > Application > Manifest — should show Stakswipe name, icons, standalone display.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts public/icon-192.png public/icon-512.png
git commit -m "feat: PWA manifest and service worker via vite-plugin-pwa"
```

---

## Task 12: Nginx config + production Docker image

**Files:**
- Create: `nginx.conf`
- The `Dockerfile` prod stage already references it (created in Task 2)

- [ ] **Step 1: Create nginx.conf**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — all paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

- [ ] **Step 2: Build the prod Docker image**

```bash
docker build --target prod -t stakswipe:latest .
```

Expected: build completes without errors.

- [ ] **Step 3: Run prod image locally and verify**

```bash
docker run --rm -p 8080:80 stakswipe:latest
```

```
mcp__playwright: navigate to http://localhost:8080
mcp__playwright: take screenshot
```

Verify: app loads, login page visible, no console errors.

- [ ] **Step 4: Stop the container (Ctrl-C), commit**

```bash
git add nginx.conf
git commit -m "feat: nginx SPA config and verify prod Docker image"
```

---

## Task 13: Helm chart

**Files:**
- Create: `helm/stakswipe/Chart.yaml`
- Create: `helm/stakswipe/values.yaml`
- Create: `helm/stakswipe/templates/deployment.yaml`
- Create: `helm/stakswipe/templates/service.yaml`

- [ ] **Step 1: Create Chart.yaml**

```yaml
apiVersion: v2
name: stakswipe
description: Lemmy swipe client PWA
type: application
version: 0.1.0
appVersion: "0.1.0"
```

- [ ] **Step 2: Create values.yaml**

```yaml
replicaCount: 1

image:
  repository: stakswipe
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  requests:
    cpu: 50m
    memory: 32Mi
  limits:
    cpu: 200m
    memory: 64Mi
```

- [ ] **Step 3: Create templates/deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
  labels:
    app: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: stakswipe
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: 80
              protocol: TCP
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
```

- [ ] **Step 4: Create templates/service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}
  labels:
    app: {{ .Release.Name }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: 80
      protocol: TCP
  selector:
    app: {{ .Release.Name }}
```

- [ ] **Step 5: Lint the chart**

```bash
helm lint helm/stakswipe/
```

Expected: `1 chart(s) linted, 0 chart(s) failed`

- [ ] **Step 6: Render templates to verify output**

```bash
helm template stakswipe helm/stakswipe/
```

Expected: valid Deployment and Service YAML printed, no errors.

- [ ] **Step 7: Commit**

```bash
git add helm/
git commit -m "feat: Helm chart for Kubernetes deployment"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Swipe right → upvote + dismiss | Task 8 |
| Swipe left → downvote + dismiss | Task 8 |
| Right swipe CCW rotation | Task 8 (rotate transform inverted) |
| Left swipe CW rotation | Task 8 |
| Orange overlay on right, grey on left | Task 8 |
| Scroll down → comments | Task 9 |
| Card pins as header in comments | Task 9 |
| Overscroll-down from comments top → save | Task 9 |
| Save toast | Task 10 |
| First-launch swipe hint | Task 10 |
| Default feed: All, sort: TopTwelveHour | Task 7 (FeedStack) |
| Instance picker with popular + custom | Task 5 |
| Auth persisted in localStorage | Task 3 + 5 |
| PWA manifest + service worker | Task 11 |
| Docker dev with HMR | Task 2 |
| Docker prod with Nginx | Task 12 |
| Helm chart | Task 13 |
| Playwright visual checks | Tasks 5, 7, 8, 9, 10, 11, 12 |

**Type consistency check:** `AuthState` defined in `store.ts`, used identically in `LoginPage`, `FeedStack`, `CommentsPanel`. `PostView` / `CommentView` from `lemmy-js-client`, re-exported from `lemmy.ts`. `onLogin(auth: AuthState)` in `LoginPage` matches `App.tsx` usage. ✓

**Placeholder scan:** No TBDs, TODOs, or vague steps found. ✓
