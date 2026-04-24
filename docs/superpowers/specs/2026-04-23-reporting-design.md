# Reporting Feature Design

## Overview

Add the ability to report posts and comments to moderators via the Lemmy API. Auth-required. Surfaces as a bottom sheet with predefined reason chips and an optional free-text detail field.

## API Layer

Two new functions in `src/lib/lemmy.ts`:

```ts
reportPost(instance: string, token: string, postId: number, reason: string): Promise<void>
reportComment(instance: string, token: string, commentId: number, reason: string): Promise<void>
```

Both delegate to `lemmy-js-client`'s `createPostReport` and `createCommentReport`. The reason string is either the selected chip label alone, or `"chip — detail"` when the user fills in the optional detail field.

Comment ID resolution (local vs. source instance) is handled by the caller (`CommentItem`) before invoking `reportComment`, consistent with the existing `likeComment` pattern.

## `ReportSheet` Component

New files: `src/components/ReportSheet.tsx`, `src/components/ReportSheet.module.css`

### Props

```ts
interface Props {
  target: { type: 'post'; postId: number } | { type: 'comment'; commentId: number } | null;
  auth: AuthState;
  onClose: () => void;
}
```

The sheet is visible when `target` is non-null. Uses the same slide-up animation and backdrop pattern as `ReplySheet`.

### UI

1. **Title** — "Report post" or "Report comment" depending on `target.type`
2. **Reason chips** — single-select, required before submit. Options: Spam, Harassment, Hate speech, NSFW, Misinformation, Other
3. **Optional detail textarea** — placeholder "Additional details (optional)"
4. **Submit button** — disabled until a chip is selected; shows loading state during API call
5. **Success state** — replaces form content with "Report submitted", auto-closes after 1.5s
6. **Error state** — inline error message on API failure; sheet stays open so the user can retry

### Reason string construction

- Chip only: `"Spam"`
- Chip + detail: `"Spam — user keeps posting unrelated links"`

## Wiring

### `PostCardShell`

- Single `reportTarget` state: `{ type: 'post'; postId: number } | { type: 'comment'; commentId: number } | null`
- **Post report:** add **⚑ Report** button to the footer row (auth-gated, alongside Save/Share/Comment). Sets `reportTarget = { type: 'post', postId: post.id }`.
- **Comment report:** provided via `onReport` prop threaded through `CommentList` → `CommentItem`. Handler sets `reportTarget = { type: 'comment', commentId: cv.comment.id }`.
- One `<ReportSheet>` instance rendered per `PostCardShell`, receives `reportTarget`. Only one of post or comment can be open at a time.

### `CommentItem`

- New `onReport` prop: `(cv: CommentView) => void`
- **⚑ Report** button added to the comment action row
- Hidden for own comments (reuses the existing `isOwnComment` guard)
- Before calling `onReport`, resolves the local comment ID via `resolveCommentId` (same pattern as voting) and passes the resolved ID up

### `CommentList`

- Threads `onReport` prop from `PostCardShell` through to each `CommentItem`

## Error handling

- Network/API errors surface as an inline error message in the sheet; the sheet stays open
- If the user is not logged in, the Report button is not shown (auth-gated)

## Testing

- Unit test `ReportSheet`: chip selection enables submit, reason string construction, success/error states
- Unit test `reportPost` and `reportComment` in `lemmy.test.ts`
- `PostCardShell` test: Report button present when auth provided, absent when not
- `CommentItem` test: Report button present on non-own comments, absent on own comments
