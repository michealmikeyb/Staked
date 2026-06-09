# Backend Abstraction Design

## Background and motivation

Stakswipe is currently a single-backend Lemmy client. The 40-function `src/lib/lemmy.ts` module is imported directly by ~30 components, and Lemmy-flavored types (`PostView`, `CommentView`, `SortType`, `CommentSortType`, `StakType`, `CommunityInfo`, `CommunityView`, `CommentReplyView`, `PersonMentionView`) flow through the entire UI. Federation-specific behavior — the 3-tier cross-instance comment fallback in `useCommentLoader`, `actor_id`/`ap_id` parsing in `urlUtils`, `instance`/`token` plumbing in every component — is interleaved with presentation code.

The next backend the project will integrate with is Bluesky. To prepare for that integration without rewriting Bluesky support twice, this refactor decouples the UI from Lemmy. The UI talks to a neutral `Backend` interface through React context. A Lemmy adapter implements the interface against `lemmy-js-client`. A mock adapter does the same for tests and as the foundation for future dev-mode swapping.

## Scope

**In scope:**
- New `src/lib/api/` module: neutral domain types, `Backend` interface, capabilities, context provider, registry, two adapter packages (Lemmy + mock).
- Full migration of all ~30 components, hooks, and tests off the direct `lib/lemmy.ts` imports onto the new abstraction.
- Migration path for existing logged-in users (transparent — no forced re-login).
- Test infrastructure that uses the mock backend in place of per-file `vi.mock('../lib/lemmy')` blocks.

**Out of scope (deferred):**
- Bluesky adapter implementation. Lands in a follow-up session.
- Multi-account UX (add-account flow, multi-stak switching across multiple logged-in accounts). The persistence shape supports it (`Session[]`); the UI doesn't expose it.
- Generalized data-driven login form. `LoginPage` stays Lemmy-specific this round.
- Dev-mode UI toggle to swap in the mock backend. The registry is structured so a toggle is a 1-line addition later.
- Dynamic `sourceNoun` ("Community" vs "Feed") substitution in UI strings. Capability is defined; UI uses literals this round.

## Goals and non-goals

**Goals:**
- UI components hold no Lemmy-specific concepts. No imports from `lib/lemmy`, no `instance`/`token` plumbing, no `actor_id`/`ap_id` field access.
- Adding a new backend is "write a new adapter implementing `Backend`" — no UI changes required.
- The mock adapter exercises every method of the interface, doubling as the test backend.
- All existing app behavior is preserved (every feature works the same way after the migration).

**Non-goals:**
- Adding new product features.
- Changing visible URLs, route structures, or settings semantics beyond what the abstraction requires.
- Performance optimization. Behavior parity over speed.

## Architecture overview

```
src/
  lib/
    api/
      types.ts          # neutral domain types
      capabilities.ts   # Capabilities interface
      backend.ts        # Backend + sub-service interfaces
      context.tsx       # BackendProvider, useBackend()
      registry.ts       # backendId → factory(session) → Backend
      backends/
        lemmy/
          index.ts      # createLemmyBackend(session) → Backend
          client.ts     # LemmyHttp factory; the ONLY file importing lemmy-js-client
          session.ts    # Lemmy-side session data shape; listStaks()
          mappers.ts    # native ↔ neutral type mappers
          feed.ts
          posts.ts
          comments.ts   # 3-tier federation fallback lives here
          sources.ts
          users.ts
          notifs.ts
          search.ts
          media.ts
        mock/
          index.ts      # createMockBackend(fixtures?, capabilities?) → Backend
          fixtures.ts   # MockFixtures + makePost/makeComment/makeUser/makeSource builders
          state.ts      # in-memory mutable store
    store.ts            # Session[] persistence + migration
    SettingsContext.tsx # unchanged shape; sort/stak fields become opaque strings
```

**Key relationships:**
- `App.tsx` reads `Session[]` and the active stak ref from `store.ts`, constructs the active backend via `registry.ts`, and wraps the tree in `<BackendProvider value={backend}>`.
- Components call `const backend = useBackend()` and invoke sub-services: `backend.feed.getTimeline(...)`, `backend.comments.list(...)`, etc.
- `lemmy-js-client` is imported only by `backends/lemmy/client.ts`. One chokepoint replaces the current ~30+ direct imports.
- Switching adapters later is reading `Session.backendId` and looking up the factory — no UI changes.

## Neutral domain types

```ts
// src/lib/api/types.ts
export type ID = string;  // opaque to UI; adapter-internal native id encoded as string
export type Vote = 1 | 0 | -1;

export interface Session {
  id: string;                    // local UUID for storage indexing
  backendId: string;             // 'lemmy' | 'mock' | future
  viewer: User | null;           // null = anonymous browsing
  data: Record<string, unknown>; // adapter-private; opaque to UI
}

export interface User {
  id: ID;
  handle: string;                // "alice@lemmy.world" | "alice.bsky.social"
  displayName?: string;
  avatar?: string;
  profileUrl: string;
  bio?: string;
}

export interface Source {
  id: ID;
  handle: string;                // "news@lemmy.world" or feed-URI form
  name: string;
  icon?: string;
  banner?: string;
  description?: string;
  counts: { members: number; posts: number };
  viewer?: { subscribed: 'yes' | 'no' | 'pending' };
}

export interface Post {
  id: ID;
  source: Source;                // partial OK for list views
  author: User;
  title?: string;                // optional: Bluesky posts have none
  body?: string;
  mediaUrl?: string;
  externalUrl?: string;
  nsfw: boolean;
  publishedAt: string;           // ISO 8601
  permalink: string;
  counts: { score: number; comments: number };
  viewer?: { vote: Vote; saved: boolean };
}

export interface Comment {
  id: ID;
  postId: ID;
  parentId: ID | null;
  depth: number;                 // 0 = top-level
  author: User;
  body: string;
  publishedAt: string;
  permalink: string;
  counts: { score: number };
  viewer?: { vote: Vote };
  deleted?: boolean;
  removed?: boolean;
}

export interface Notification {
  id: ID;
  kind: 'reply' | 'mention';
  read: boolean;
  receivedAt: string;
  comment: Comment;
  post: Pick<Post, 'id' | 'title' | 'permalink'>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;     // opaque; null = end
}

export interface Stak {
  sessionId: string;
  id: string;                    // backend-defined: 'all' | 'local' | 'subscribed' for Lemmy
  label: string;
  icon?: string;
}

export interface FeedOption {
  id: string;                    // round-tripped to backend opaquely
  label: string;
}

export interface SortOption {
  id: string;
  label: string;
}
```

**Why these shapes:**

- `Session.data` is opaque (`Record<string, unknown>`) — no Lemmy-specific field names in the neutral type. The Lemmy adapter privately types it as `{ instance: string; token: string | null }`.
- `Page<T>` with opaque cursor avoids forcing `page: number` semantics on backends with AT cursors.
- `Comment.parentId` + `depth` replaces Lemmy's path-based threading. The Lemmy adapter parses `comment.path` to populate these (second-to-last segment → `parentId`; segment count − 1 → `depth`). Tree-building in the UI gets simpler.
- `Post.source` carries a full(-ish) `Source` so feed renders don't need a follow-up fetch.
- `Notification` is one discriminated type, not two parallel arrays. The Lemmy adapter merges `getReplies` + `getPersonMentions` into one stream sorted by `receivedAt`. The current `InboxPage` already wraps these in a `NotifItem` union — this is a small change.
- `FeedOption` (what was `SortType`) and `Stak` are data, not enums. Each backend declares its own. UI dropdowns are entirely data-driven.

## Backend interface

```ts
// src/lib/api/backend.ts
export interface Backend {
  readonly backendId: string;
  readonly capabilities: Capabilities;
  readonly session: Session | null;

  listStaks(): Stak[];                 // staks under this backend's session

  auth: AuthService;
  feed: FeedService;
  posts: PostService;
  comments: CommentService;
  sources: SourceService;
  users: UserService;
  notifications: NotificationService;
  search: SearchService;
  media: MediaService;
}

export interface AuthService {
  // Adapter-specific credentials passed opaquely.
  // Lemmy: { instance, usernameOrEmail, password }
  login(credentials: Record<string, string>): Promise<Session>;
  logout(): Promise<void>;
}

export interface FeedService {
  getTimeline(opts: { feedId: string; stakId: string; cursor: string | null }): Promise<Page<Post>>;
  getSourceFeed(sourceHandle: string, opts: { feedId: string; cursor: string | null }): Promise<Page<Post>>;
  getSavedPosts(opts: { cursor: string | null }): Promise<Page<Post>>;
}

export interface PostService {
  get(postId: ID): Promise<Post>;
  getByPermalink(url: string): Promise<Post | null>;
  vote(postId: ID, vote: Vote): Promise<void>;
  save(postId: ID, saved: boolean): Promise<void>;
  report(postId: ID, reason: string): Promise<void>;
  delete(postId: ID): Promise<void>;
  create(input: { sourceHandle: string; title?: string; body?: string; url?: string; nsfw?: boolean }): Promise<Post>;
}

export interface CommentService {
  list(postId: ID, opts: { sortId: string }): Promise<Comment[]>;
  vote(commentId: ID, vote: Vote): Promise<void>;
  create(input: { postId: ID; parentId?: ID; body: string }): Promise<Comment>;
  edit(commentId: ID, body: string): Promise<Comment>;
  delete(commentId: ID): Promise<void>;
  report(commentId: ID, reason: string): Promise<void>;
}

export interface SourceService {
  get(handle: string): Promise<Source>;
  subscribe(sourceId: ID, subscribe: boolean): Promise<void>;
  block(sourceId: ID, block: boolean): Promise<void>;
}

export interface UserService {
  get(handle: string): Promise<User>;
  getPosts(handle: string, opts: { cursor: string | null }): Promise<Page<Post>>;
  getComments(handle: string, opts: { cursor: string | null }): Promise<Page<Comment>>;
  block(userId: ID, block: boolean): Promise<void>;
}

export interface NotificationService {
  unreadCount(): Promise<number>;
  list(opts: { unreadOnly: boolean; cursor: string | null }): Promise<Page<Notification>>;
  markRead(notificationId: ID): Promise<void>;
}

export interface SearchService {
  posts(query: string, opts: { cursor: string | null }): Promise<Page<Post>>;
  sources(query: string, opts: { cursor: string | null }): Promise<Page<Source>>;
}

export interface MediaService {
  uploadImage(file: File): Promise<{ url: string }>;
}
```

```ts
// src/lib/api/capabilities.ts
export interface Capabilities {
  canDownvote: boolean;
  canBrowseAnonymously: boolean;
  hasNsfwFlag: boolean;
  hasSavedPosts: boolean;
  feedOptions: FeedOption[];          // primary feed picker (was sortOptions)
  commentSortOptions: SortOption[];   // comment-level sort
  sourceNoun: string;                 // "Community" for Lemmy; capability defined, UI strings still literal this round
}
```

**Notes:**

- `auth.login` takes `Record<string, string>` so the interface stays neutral. `LoginPage` stays Lemmy-flavored this round (instance + user + pass form) and submits via this method. Generalizing the form is deferred.
- `posts.getByPermalink` is the new home for `SharedPostPage`'s "load by URL" behavior. Lemmy adapter parses Lemmy / Kbin / Mbin URL shapes internally.
- `resolvePostId` / `resolveCommentId` disappear from the public surface — they're Lemmy adapter internals.
- `Backend.session` is read-only. State changes flow through `auth.login` / `auth.logout`, which return new sessions persisted by `BackendProvider`.

## Lemmy adapter

```
backends/lemmy/
  index.ts        # createLemmyBackend(session: Session) → Backend
  client.ts       # LemmyHttp factory
  session.ts      # LemmySessionData type; listStaks() → All / Local / Subscribed
  mappers.ts      # PostView → Post, CommentView → Comment, etc.
  feed.ts         # FeedService — anonymous instance routing lives here
  posts.ts
  comments.ts     # 3-tier federation fallback + cross-stitching
  sources.ts
  users.ts
  notifs.ts       # merges replies + mentions into one Notification stream
  search.ts
  media.ts        # pictrs upload
```

**Behaviors that move from UI into the adapter:**

1. **3-tier comment fallback (`backends/lemmy/comments.ts`).** Today this lives in `src/hooks/useCommentLoader.ts` and runs at render time. The algorithm:
   - The neutral `postId` is encoded as `"${localId}|${apId}"` by the Lemmy mapper (an opaque round-trippable string). The comment service parses both halves out.
   - **Tier 1** — Try the source instance derived from `apId`. Fail soft.
   - **Tier 2** — Call `resolve_object` on the community's instance to find a local post ID, then fetch comments there.
   - **Tier 3** — Authenticated fetch from the user's home instance; if that fails or returns nothing, anonymous fetch from the home instance.
   - **Cross-stitching** — When the home-instance fetch returns novel comments (federated comments not yet seen on the source), insert them into the source tree, re-mapping `path` to anchor under the correct source-side parent. (Same algorithm as today's `useCommentLoader` lines 68–99.)
   - All output goes through the mapper, producing flat `Comment[]` with `parentId` + `depth`.

2. **Anonymous instance routing (`backends/lemmy/feed.ts`).** When `session.viewer === null`, the adapter picks the instance via the user's `settings.lemmy.anonInstance` if set, otherwise via `getAnonInstance(feedId)` (existing helper, moved into the adapter). The UI never sees instance picking.

3. **`postId` encoding.** Lemmy's `Post.id` is the local federated ID. To preserve cross-instance behavior, the mapper sets `Post.id = "${localId}|${apId}"`. All adapter methods that take a `postId` parse this string. Encoding is fully internal — UI never inspects.

4. **`Source.handle`.** Set to `${community.name}@${instanceFromActorId(community.actor_id)}` by the mapper. `sources.get(handle)` splits the handle to call Lemmy's `getCommunity` with the right `name`.

5. **`urlUtils.ts` retention.** The bits used by the UI stay (`isImageUrl`, `buildShareUrl` adapted to take a neutral `Post`). `instanceFromActorId` and `sourceFromApId` move into `backends/lemmy/`.

**Stak list:** Logged-in Lemmy session returns `[{id:'all', label:'All'}, {id:'local', label:'Local'}, {id:'subscribed', label:'Subscribed'}]`. Anonymous Lemmy session returns `[{id:'all', label:'All'}, {id:'local', label:'Local'}]` (no Subscribed without a user).

**Anonymous Lemmy session lifecycle.** Today's "Anonymous" stak is preserved by having `App.tsx` auto-construct an in-memory anonymous Lemmy session at boot — it is NOT persisted in `stakswipe_sessions`. When the user has no logged-in session, the anonymous session is the only one; when they're logged in, both co-exist and the stak switcher flattens the union. The anonymous session uses the configured `settings.lemmy.anonInstance` (or `getAnonInstance(feedId)`).

**Capabilities:** `canDownvote: true`, `canBrowseAnonymously: true`, `hasNsfwFlag: true`, `hasSavedPosts: true`, `feedOptions` lists all Lemmy `SortType` values with display labels, `commentSortOptions` lists `CommentSortType` values, `sourceNoun: 'Community'`.

## Mock adapter

```
backends/mock/
  index.ts       # createMockBackend(fixtures?, capabilities?) → Backend
  fixtures.ts    # MockFixtures + builders: makePost / makeComment / makeUser / makeSource
  state.ts       # in-memory mutable store: posts, comments, votes, saves, subs, notifications
```

- All write methods mutate the in-memory store so tests can assert post-mutation state.
- Defaults: one stable Source, three Users, ten Posts, threaded Comments — a sane baseline for component tests.
- `listStaks()` returns one stak `{id:'all', label:'All'}`.
- Capabilities mirror Lemmy's shape so component tests written against Lemmy capabilities work without modification.
- Exported `state` object on the returned backend lets tests inspect mutations: `backend.state.votes[postId]`, `backend.state.saves[postId]`, etc.

## Component migration

The refactor touches ~30 files. Most edits are mechanical (type swap + field rename). Highlights of the non-mechanical changes:

| File | Change |
|---|---|
| `App.tsx` | Load `Session[]` + active stak ref from store. Build backend via `registry.ts`. Wrap tree in `<BackendProvider>`. |
| `FeedStack.tsx` | Replace `fetchPosts` / `fetchCommunityPosts` with `backend.feed.getTimeline` / `getSourceFeed`. `page: number` becomes `cursor: string \| null`. Stak switching reads/writes the active stak ref via context. |
| `PostCard.tsx` | Prop `post: PostView` → `post: Post`. Internal destructuring flattens. |
| `PostCardShell.tsx` | Replace hand-rolled `Post`/`Community`/`Creator`/`Counts` interfaces with neutral types. Rename fields: `name` → `title`, `actor_id` → `handle`/`profileUrl`, `ap_id` → `permalink`. |
| `useCommentLoader.ts` | Collapses to `useAsync(() => backend.comments.list(postId, { sortId }))`. ~80 lines of federation logic move into the Lemmy adapter. |
| `CommentItem.tsx` | `likeComment` → `backend.comments.vote`. Drop `resolveCommentId` — adapter handles it. |
| `HeaderBar.tsx` | Delete `SORT_OPTIONS` constant; dropdown reads `useBackend().capabilities.feedOptions`. Delete `STAKS` constant; pills come from a `useStaks()` hook that flattens `listStaks()` across active backends. |
| `MenuDrawer.tsx` | Stak list and sort options come from context, not constants. |
| `LoginPage.tsx` | Stays Lemmy-shaped (instance + user + pass). Submits to `backend.auth.login({ instance, usernameOrEmail, password })`. |
| `SettingsPage.tsx` | `defaultSort: SortType` → `defaultFeedId: string`. `activeStak: StakType` → `activeStakId: string`. `commentSort: CommentSortType` → `defaultCommentSortId: string`. `anonInstance` moves to `settings.lemmy.anonInstance`. |
| `InboxPage.tsx` | Drop local `NotifItem` union; use `Notification` from API. Two-tab UI retained, filtered by `notification.kind`. |
| `ProfilePage.tsx` | `fetchPersonDetails` → `backend.users.get(handle)` + `getPosts` + `getComments`. |
| `CreatePostPage.tsx` | `resolveCommunityId` + `createPost` → `backend.posts.create({ sourceHandle, ... })`. `uploadImage` → `backend.media.uploadImage`. |
| `ReportSheet.tsx` | `reportPost` / `reportComment` → `backend.posts.report` / `backend.comments.report`. |
| `SearchPage.tsx` | `searchPosts` / `searchCommunities` → `backend.search.posts` / `backend.search.sources`. |
| `useNotificationPolling.ts` | `fetchUnreadCount` → `backend.notifications.unreadCount`. |
| `useShare.ts` / `urlUtils.ts` | `buildShareUrl` takes a neutral `Post`; uses `post.permalink`. `shareLinkFormat` semantics preserved. |
| `store.ts` | New `Session[]` schema with migration; settings field renames. |
| All test files | Per-file `vi.mock('../lib/lemmy')` deletions; switch to `renderWithBackend`. |

**What disappears:**
- `src/lib/lemmy.ts` (replaced by `backends/lemmy/`).
- `src/hooks/useCommentLoader.ts` (logic moves into Lemmy adapter; usages become inline `useAsync`).
- `instanceFromActorId`, `sourceFromApId` (move into `backends/lemmy/`).
- `SortType`, `CommentSortType`, `StakType` type aliases (replaced by opaque `string`).
- `NotifItem` union in `InboxPage.tsx`.
- `PostCardShell`'s hand-rolled interfaces.
- Every test's `vi.mock('../lib/lemmy', ...)` block.

## Persistence and migration

New storage keys:

- `stakswipe_sessions` — `Session[]` JSON.
- `stakswipe_active_stak` — `{ sessionId, stakId }` JSON.
- `stakswipe_settings` — same key, renamed fields (`defaultFeedId`, `activeStakId`, `defaultCommentSortId`, `lemmy.anonInstance`).

**Legacy migration (one-shot on first load after upgrade):**

```ts
function loadSessionsWithMigration(): { sessions: Session[]; activeStak: ActiveStakRef | null } {
  const raw = localStorage.getItem('stakswipe_sessions');
  if (raw) return { sessions: JSON.parse(raw), activeStak: loadActiveStak() };

  // Legacy keys
  const token = localStorage.getItem('stakswipe_token');
  const instance = localStorage.getItem('stakswipe_instance');
  const username = localStorage.getItem('stakswipe_username');
  if (!token || !instance || !username) return { sessions: [], activeStak: null };

  const session: Session = {
    id: crypto.randomUUID(),
    backendId: 'lemmy',
    viewer: synthesizeUserFromLegacy(username, instance),
    data: { instance, token },
  };
  saveSessions([session]);

  const legacyStak = JSON.parse(localStorage.getItem('stakswipe_settings') || '{}').activeStak ?? 'All';
  const stakId = legacyStak === 'Anonymous' ? 'all' : String(legacyStak).toLowerCase();
  saveActiveStak({ sessionId: session.id, stakId });

  // Legacy keys retained for one release as rollback safety.
  return { sessions: [session], activeStak: loadActiveStak() };
}
```

`synthesizeUserFromLegacy` builds a minimal `User` from `{ instance, username }`. The Lemmy adapter refreshes the real `viewer` (avatar/displayName) lazily after construction. If the token has expired, the user lands on the login page (current behavior).

Settings field renames are mechanical and one-shot.

Legacy keys (`stakswipe_token`, `stakswipe_instance`, `stakswipe_username`, plus the renamed settings fields) are NOT deleted in this refactor. A follow-up commit a release later removes them. This preserves a rollback escape hatch.

## Testing strategy

1. **Lemmy adapter unit tests** in `backends/lemmy/*.test.ts`. New coverage:
   - Mappers: `PostView` → `Post` field-by-field, including `Post.id` encoding round-trip.
   - `CommentService.list`: 3-tier fallback paths, cross-stitching novel home comments.
   - `posts.getByPermalink`: Lemmy / Kbin / Mbin URL shape parsing.
   - `feed.getTimeline`: anonymous instance picking, anon-instance setting override.

2. **`renderWithBackend` test helper** in `src/test-utils.tsx`:
   ```ts
   export function renderWithBackend(
     ui: ReactElement,
     opts?: { fixtures?: MockFixtures; capabilities?: Partial<Capabilities> },
   ) {
     const backend = createMockBackend(opts?.fixtures, opts?.capabilities);
     return { ...render(<BackendProvider value={backend}>{ui}</BackendProvider>), backend };
   }
   ```
   Component tests use this; assertions on writes target `backend.state.*`.

3. **Mock backend sanity test** in `backends/mock/index.test.ts` exercises every method on the `Backend` interface. This catches mock regressions and serves as the executable spec for the interface.

4. **Migration test** in `store.test.ts` covers legacy → new schema, including `activeStak` mapping and settings field renames.

5. **Per-file `vi.mock('../lib/lemmy')` blocks** are deleted as each component is migrated.

## Rollout sequence

The migration is staged so the app builds and tests pass at every step. `lib/lemmy.ts` remains untouched until the very end.

Implementation is expected to span multiple conversation sessions. Each phase below ends with an explicit **compact point** — a state where the codebase is buildable, tests pass, and a fresh session can resume from the design doc plus the current `main` without needing prior conversation context.

1. **Foundations** — Define neutral types, `Backend` interface, capabilities, `BackendProvider` / `useBackend`, registry. No behavior wired yet. The build compiles (interfaces only); no tests change.
   - **Compact point A.** Verify: `npm run build` succeeds; nothing imports from `src/lib/api/` yet. Resume context: design doc + the new `src/lib/api/` directory.

2. **Mock backend** — Implement `createMockBackend` with fixtures and in-memory state. Verify with the mock sanity test.
   - **Compact point B.** Verify: `npm test` passes including the new `backends/mock/index.test.ts`. Resume context: design doc + `backends/mock/`.

3. **Lemmy adapter** — Implement end-to-end behind the new interface. All Lemmy adapter unit tests pass. Old `lib/lemmy.ts` still exists, still works — components are still on it.
   - **Compact point C.** Verify: `npm test` passes including new `backends/lemmy/*.test.ts`; app still runs against legacy `lib/lemmy.ts`. Resume context: design doc + `backends/lemmy/` + `backends/mock/`.

4. **Test helper** — Add `renderWithBackend` to `src/test-utils.tsx`. No component migrations yet.
   - **Compact point D.** Verify: `npm test` passes. Resume context: design doc + `src/test-utils.tsx`.

5. **Component migration, leaf-up.** Each round is independent of the others — each round can be done in its own session.
   - **Round 1**: `CommentItem`, `CommentList` (and tests).
     - **Compact point E1.** Verify: `npm test` passes; `npm run build` succeeds; the two migrated components have no imports from `lib/lemmy`. Resume context: design doc + grep `lib/lemmy` to see remaining migrations.
   - **Round 2**: `PostCardShell`, `PostCard`, `useCommentLoader` → inline `useAsync` (and tests).
     - **Compact point E2.** Same verification.
   - **Round 3**: `FeedStack`, `HeaderBar`, `MenuDrawer` (and tests).
     - **Compact point E3.** Same verification.
   - **Round 4**: All page components (`InboxPage`, `ProfilePage`, `SettingsPage`, `SavedPage`, `SearchPage`, `CreatePostPage`, `PostDetailPage`, `PostViewPage`, `SharedPostPage`, `CommunityAboutPage`, `ProfilePostDetailPage`, `SavedPostDetailPage`, `LoginPage`) (and tests). Each page is independent of the others, so this round can itself be split across sessions — finish migrating one page (component + tests, build passes, tests pass) before compacting. Each finished page is its own intra-round compact point.
     - **Compact point E4.** All round-4 pages migrated. Same verification as E1–E3.
   - **Round 5**: Sheets and small components (`ReportSheet`, `ReplySheet` if touched, `CommunityHeader`, `ProfileHeader`).
     - **Compact point E5.** Same verification.

6. **Wire-up** — Migrate `App.tsx` + `store.ts` with the legacy-key migration. This flips live behavior to the new backend. Verify in browser that a logged-in user survives the migration; verify anonymous browsing still works.
   - **Compact point F.** Verify: `npm test` passes; manual smoke test in browser (login, feed, vote, comment, stak switch). Resume context: design doc + `App.tsx` + `src/lib/store.ts`.

7. **Delete `lib/lemmy.ts`** and any straggling `vi.mock('../lib/lemmy')` blocks. The build verifies nothing references the old module.
   - **Compact point G.** Verify: `npm run build` succeeds; `grep -r "lib/lemmy" src/` returns nothing. Refactor is complete.

8. **Follow-up commit (later release)** — Remove legacy localStorage keys. Not part of the initial refactor; scheduled at least one release after compact point G.

**Unsafe to compact mid-round** — Do not compact mid-step within a round. For example, partway through migrating `PostCardShell` (round 2), the codebase has half-migrated types and the surrounding conversation likely holds the in-progress field renames. Either finish the round, or revert and start the round fresh in a new session.

## Open / deferred items

- **Generalized `LoginPage`**: Form stays Lemmy-shaped. Generalize when adding Bluesky.
- **"Add account" UI**: Architecture supports `Session[]`; UI doesn't expose it yet.
- **Dev-mode mock-backend toggle**: Registry knows about `'mock'`. Adding a settings toggle is a 1-line change in `App.tsx` later.
- **Dynamic `sourceNoun` label**: Capability defined; UI strings stay as literals ("Community", "c/foo") this round. Hooking up later is mechanical.
- **Lemmy "Subscribed" stak without login**: Anonymous Lemmy sessions don't return a "Subscribed" stak. That's intentional (no user → no subscriptions).

## Risks

- **Field-by-field type mapping is fiddly.** Many small fields, many tests. Mitigated by leaf-up rollout and the mock-backend sanity test catching missing fields early.
- **The federation cross-stitching logic is subtle.** Moving it from `useCommentLoader` into `backends/lemmy/comments.ts` is a relocation, but the test surface needs to cover the same cases. Mitigated by porting the existing tests for `useCommentLoader` into adapter tests.
- **`Post.id` encoding (`"${localId}|${apId}"`) leaks if anything outside the adapter ever parses it.** Mitigated by treating the string as opaque everywhere and naming/typing it `ID` (no parsing exposed). Lint or grep audit confirms no external parsing.
- **Settings field rename ripples through `SettingsContext` consumers.** Mitigated by migration test + leaf-up rollout finding consumers.
- **Merged notification cursor.** `NotificationService.list` combines Lemmy's separately-paginated `getReplies` and `getPersonMentions` into one cursor-paginated stream. The Lemmy adapter encodes the joint cursor as `"${repliesCursor}|${mentionsCursor}"`, splits on read, and merges the two pages by `publishedAt`. Documented here so the adapter implementer doesn't reinvent it.
- **`feedId` vs `stakId` semantics differ between backends.** Lemmy uses both dimensions (sort × content filter). Future backends with only one dimension (e.g., Bluesky, where each "stak" is a feed URI) will populate `capabilities.feedOptions` with a single placeholder and route on `stakId` only. The neutral `getTimeline` signature accommodates both shapes; UI passes whatever the active backend's capabilities dictate.
