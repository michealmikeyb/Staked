# ProfileHeader Component Design

## Goal

Replace the two-section header on `ProfilePage` (MenuDrawer + separate profile info div) with a single unified 48px header bar matching the `CommunityHeader` pattern.

## New Component: `ProfileHeader`

**File:** `src/components/ProfileHeader.tsx`

### Props

```ts
interface Props {
  username: string;        // display username (without u/ prefix)
  instance: string;        // display instance
  onBack: () => void;
  onBlock?: () => Promise<void>;  // omit to hide hamburger (own profile)
}
```

`onBlock` being absent signals this is the viewer's own profile — the `☰` button is not rendered when `onBlock` is undefined.

### Layout

Single 48px flex bar, same background/border styles as `CommunityHeader`:

```
[ ←  ]  [ u/username@instance (centered, flex: 1) ]  [ ☰ ]
```

- **Left:** back button (`←`), same style as CommunityHeader
- **Center:** `u/username@instance`, font-weight 600, truncated if long
- **Right:** `☰` hamburger, only rendered when `onBlock` is defined

### State (owned by ProfileHeader)

- `showMenu: boolean` — menu panel open/closed
- `showConfirm: boolean` — confirm block panel open/closed
- `blocking: boolean` — API call in-flight
- `blockError: string` — error message to display

### Menu panel

Drops from `top: 48` (fixed), same styling as CommunityHeader menu panel. Single item: Block button using `menuItemStyle` (🚫 icon + "Block" label). Clicking opens the confirm panel.

### Confirm panel

Drops from `top: 48` (fixed), identical structure to CommunityHeader confirm panel:

- "Block u/username?" heading
- Optional error message
- Cancel + Block buttons; Block disabled while `blocking` is true

Error handling: on failure set `blockError`; on success `onBlock` resolves and `ProfileHeader` closes the panel (navigation is handled by `ProfilePage` inside the `onBlock` callback).

## Changes to `ProfilePage`

- Remove `MenuDrawer` import and usage
- Remove the profile info `div` (username/instance/hamburger)
- Remove `showMenu`, `showConfirm`, `blocking`, `blockError` state and `menuItemStyle`
- Add `<ProfileHeader>` at the top, passing `onBlock={handleBlockPerson}` when viewing another user, omitting it when viewing own profile
- `handleBlockPerson` and `personId` state remain in `ProfilePage` unchanged
- Menu/confirm overlay `top` values: update from `112` to `48` (no longer need to clear the two-section header)

## Testing

- `ProfileHeader.test.tsx` (new): unit tests covering
  - renders `u/username@instance` centered
  - no hamburger when `onBlock` is undefined
  - hamburger present when `onBlock` is provided
  - clicking hamburger opens menu panel with Block button
  - clicking Block opens confirm panel
  - confirm panel shows correct username
  - successful block calls `onBlock` and closes panel
  - failed block shows error, panel stays open
  - cancel closes confirm panel
- `ProfilePage.test.tsx`: update existing tests to use the new header structure (no MenuDrawer, no profile info div — query via ProfileHeader's rendered elements)
