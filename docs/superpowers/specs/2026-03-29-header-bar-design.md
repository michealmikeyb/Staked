# Header Bar Design

**Date:** 2026-03-29
**Status:** Approved

## Overview

Add a fixed header bar to the main feed view containing a home logo, sort picker, and menu drawer. The header only appears when the user is logged in (i.e. inside FeedStack).

## Layout

Header layout option C: logo on the left with the sort label immediately to its right, hamburger menu button on the far right. Single row, 48px tall.

```
[ S ]  Top 12h ▾         ≡
 logo   sort label    hamburger
```

The outer FeedStack container becomes a flex column. The header sits at the top (48px). The card stack area takes `calc(100dvh - 48px)` and centers the cards within that space.

## HeaderBar Component

**File:** `src/components/HeaderBar.tsx`
**Styling:** Inline styles, matching the existing pattern in the codebase.

**Props:**
```ts
interface HeaderBarProps {
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  onMenuOpen: () => void;
}
```

**Elements:**
- **S logo button** (left) — orange `#ff6b35` rounded square, 32×32px. Tapping is a no-op for now (already on home).
- **Sort label** (beside logo) — shows current sort name (e.g. "Top 12h"), tapping opens the sort dropdown.
- **Hamburger button** (right) — three bars, tapping toggles the menu drawer.

## Sort Picker

**Trigger:** Tap sort label in the header.
**Presentation:** Dropdown falls from below the header, positioned absolute, overlaying the card stack. Z-index above cards.
**Options (6):**

| Display label | Lemmy `SortType` |
|---|---|
| Active | `Active` |
| Hot | `Hot` |
| New | `New` |
| Top 6h | `TopSixHour` |
| Top 12h | `TopTwelveHour` |
| Top Day | `TopDay` |

Active sort is highlighted in orange with a checkmark. Tapping an option:
1. Closes the dropdown
2. Resets feed state: `posts → []`, `page → 1`, `canLoadMore → true`
3. Triggers `loadMore(1)` with the new sort

**State:** `showSortDropdown: boolean` in FeedStack.

### lemmy.ts change

`fetchPosts` gains a `sort` parameter, replacing the hardcoded `'TopTwelveHour'`:

```ts
export async function fetchPosts(
  instance: string,
  token: string,
  page: number,
  sort: SortType = 'TopTwelveHour',
): Promise<PostView[]>
```

## Menu Drawer

**Trigger:** Tap hamburger button.
**Presentation:** Tile grid drops down from below the header, overlaying the card stack. A semi-transparent backdrop (`rgba(0,0,0,0.5)`) covers the cards behind it.
**Dismiss:** Tap a tile, tap the backdrop, or tap the hamburger button again.

**Tiles (3-column grid):**

| Icon | Label | Destination |
|---|---|---|
| 🔖 | Saved | Dead link (no-op, closes drawer) |
| 👤 | Profile | Dead link (no-op, closes drawer) |
| 📬 | Inbox | Dead link (no-op, closes drawer) |

**State:** `showDrawer: boolean` in FeedStack.

## State in FeedStack

New state added to FeedStack:

```ts
const [sortType, setSortType] = useState<SortType>('TopTwelveHour');
const [showSortDropdown, setShowSortDropdown] = useState(false);
const [showDrawer, setShowDrawer] = useState(false);
```

Sort change handler:
```ts
function handleSortChange(newSort: SortType) {
  setSortType(newSort);
  setShowSortDropdown(false);
  setPosts([]);
  setPage(1);
  setCanLoadMore(true);
  loadMore(1, newSort);
}
```

`loadMore` gains a `sort: SortType` parameter so it doesn't need to close over the `sortType` state variable. All existing `loadMore` call sites pass `sortType` (or `newSort` when changing). The `useCallback` dep array includes `auth` only, as before.

## Out of Scope

- Saved, Profile, and Inbox pages (dead links for now)
- Routing / navigation system
- The home button doing anything beyond its current no-op
