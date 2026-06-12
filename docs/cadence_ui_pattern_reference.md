# Cadence UI Pattern Reference
**Phase E2 — Phase 1 Deliverable**
**Sources audited:** `app/dashboard/plan/daily/page.tsx`, `app/dashboard/plan/weekly/page.tsx`, `app/dashboard/settings/page.tsx`, `app/dashboard/goals/[id]/page.tsx`, `app/onboarding/energy/page.tsx`

---

## 1. Color Tokens

### Base Palette
| Token name | Hex | Usage |
|---|---|---|
| Primary blue | `#3B7DFF` | CTAs, links, selected state, progress fill alternative |
| Success green | `#34C759` | Toggle-on, task-added state |
| Danger red | `#FF3B30` | High-priority dot, destructive icon tints |
| Medium orange | `#FF9500` | Medium-priority dot, low-energy icon active |
| Finance green | `#16A34A` | Finance category, active goal status, milestone check, success text |
| Delete red | `#DC2626` | Delete button text, delete confirm background fill |
| Primary text | `#1C1C1E` | Headings, body copy, most labels |
| Secondary text | `#3C3C43` | Muted text, chevron icons, cancel buttons |
| Tertiary text | `#8E8E93` | Metadata, form labels, placeholders, section labels, divider icons |
| Primary border | `#E5E5EA` | Card borders, row dividers |
| Input border | `#D1D1D6` | Input/select field borders (slightly darker) |
| Divider fill | `#F2F2F7` | Thin row dividers, icon container backgrounds, chip unselected bg |
| Input bg | `#F8F8FC` | All input/textarea/select backgrounds |
| Select bg (detail) | `#F9F9FB` | Select fields inside detail-edit forms (warmer variant) |
| Card bg | `white` | Standard card background |
| Goal card bg | `#F8F8FC` | Weekly Must-Move goal card background |

### Tint Surfaces
| Hex | Context |
|---|---|
| `#EFF6FF` | Blue info banner background, Career badge bg, numbered step circle bg, selection-list selected bg |
| `#1D4ED8` | Blue info banner text (paired with `#EFF6FF` / `#DBEAFE`) |
| `#F0FFF4` | Success info banner background, Finance badge bg, completed milestone fill |
| `#FFF7ED` | Warning info banner background, Business badge bg |
| `#FFF0F5` | Health badge bg |
| `#F0F9FF` | Travel badge bg |
| `#FDF4FF` | Relationships / Personal Growth badge bg |
| `#FFFBEB` | Business badge bg (alternate), Parked status bg |
| `#F0FDF4` | Community badge bg |
| `#F5F5F5` | Archived status bg |
| `#FFF5F5` | Inline delete confirm banner bg |
| `#FFF0F0` | Center-modal danger icon circle bg |

---

## 2. Category Color System

Used for badges, category chip selectors, and chart colors. Source: `goals/[id]/page.tsx` `CATEGORY_COLORS`.

```ts
Career:           { bg: '#EFF6FF', color: '#3B7DFF' }
Finance:          { bg: '#F0FFF4', color: '#16A34A' }
Health:           { bg: '#FFF0F5', color: '#EC4899' }
Creative:         { bg: '#FFF7ED', color: '#EA580C' }
Travel:           { bg: '#F0F9FF', color: '#0284C7' }
Relationships:    { bg: '#FDF4FF', color: '#9333EA' }
Business:         { bg: '#FFFBEB', color: '#D97706' }
Community:        { bg: '#F0FDF4', color: '#15803D' }
Personal Growth:  { bg: '#FDF4FF', color: '#9333EA' }
Education:        { bg: '#EFF6FF', color: '#3B7DFF' }
Fallback:         { bg: '#F2F2F7', color: '#8E8E93' }
```

---

## 3. Priority System

```ts
const PRIORITY_DOT: Record<string, string> = {
  high:   '#FF3B30',
  medium: '#FF9500',
  low:    '#34C759',
}
```

**Priority dot (task meta row):** `width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[priority] ?? '#C7C7CC'`
**Priority dot (legend):** `width: 8, height: 8, borderRadius: '50%'`

---

## 4. Status Badge Colors

Used for goal status pills:

```ts
active:           { bg: '#F0FFF4', color: '#16A34A' }
parking/parked:   { bg: '#FFFBEB', color: '#D97706' }
archived:         { bg: '#F5F5F5', color: '#8E8E93' }
inbox (default):  { bg: '#EFF6FF', color: '#3B7DFF' }
```

---

## 5. Typography Scale

| Role | fontSize | fontWeight | color |
|---|---|---|---|
| Page title (h1) | 26 | 700 | `#1C1C1E` |
| Page subtitle | 14 | 400 | `#8E8E93` |
| Counter / stat | 20 | 700 | `#1C1C1E` |
| Card section header | 16 | 700 | `#1C1C1E` |
| Modal title | 18 | 700 | `#1C1C1E` |
| Modal subtitle | 12 | 400 | `#8E8E93` |
| Body — primary | 15 | 500 | `#1C1C1E` (task title) |
| Body — standard | 14 | 400 | `#1C1C1E` |
| Body — accent | 14 | 600 | `#1C1C1E` (detail values) |
| Body — blue | 14 | 400 | `#3B7DFF` (refined goal text, goal link) |
| Meta / time | 13 | 400 | `#8E8E93` |
| Form label | 13 | 400 | `#8E8E93` |
| Badge / pill | 12 | 500 | varies by badge type |
| Section label | 12 | 600 | `#8E8E93`, `textTransform: 'uppercase'`, `letterSpacing: 0.5`, `margin: '24px 0 8px 4px'` |
| Small meta | 12 | 400 | `#8E8E93` |
| Number step | 12 | 700 | `#3B7DFF` |

All text inherits `fontFamily: 'inherit'` on interactive elements.

---

## 6. Cards

### Standard content card
```css
background: white;
borderRadius: 16;
padding: '18px 20px';
border: '0.5px solid #E5E5EA';
marginBottom: 12;
```

### Compact card (Low Energy block, list cards)
```css
background: white;
borderRadius: 16;
padding: '16px 18px';
border: '0.5px solid #E5E5EA';
```

### Settings card (no internal padding — rows have own padding)
```css
background: white;
borderRadius: 16;
border: '0.5px solid #E5E5EA';
overflow: 'hidden';
```

### Weekly Must-Move goal card
```css
background: '#F8F8FC';
borderRadius: 12;
padding: '14px';
```

### Info banner — blue
```css
background: '#EFF6FF';
border: '1px solid #DBEAFE';
borderRadius: 14;
padding: '14px 16px';
```
Text color: `#1D4ED8`. Icon stroke: `#3B7DFF`.

### Info banner — success (green)
```css
background: '#F0FFF4';
border: '1px solid #BBF7D0';
borderRadius: 16;
padding: '18px';
```

### Info banner — warning (orange)
```css
background: '#FFF7ED';
border: '1px solid #FED7AA';
borderRadius: 16;
padding: '18px';
```

---

## 7. Task Card (Daily Plan — E2 primary target)

This is the exact element that will receive a recurrence badge overlay in E2.

**Grouped list pattern:** consecutive task cards share a collapsed border stack. First card gets top-rounded corners; last gets bottom-rounded corners; middle cards get no radius and no bottom border.

```tsx
// Container
style={{
  background: 'white',
  borderRadius: index === 0
    ? '16px 16px 0 0'
    : index === listLength - 1 ? '0 0 16px 16px' : '0',
  padding: '16px 18px',
  border: '0.5px solid #E5E5EA',
  borderBottom: index < listLength - 1 ? 'none' : '0.5px solid #E5E5EA',
  display: 'flex', alignItems: 'flex-start', gap: 14,
}}

// Checkbox button
style={{
  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
  background: task.completed ? '#3B7DFF' : 'white',
  border: task.completed ? 'none' : '2px solid #D1D1D6',
  cursor: 'pointer', padding: 0, marginTop: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}}
// Checkmark: <svg width="12" height="12" stroke="white" strokeWidth="3" />

// Meta row (time + priority dot)
style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}

// Time label
style={{ fontSize: 13, color: '#8E8E93' }}

// Priority dot
style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[priority] ?? '#C7C7CC', flexShrink: 0 }}

// Task title
style={{
  fontSize: 15, fontWeight: 500,
  color: completed ? '#8E8E93' : '#1C1C1E',
  textDecoration: completed ? 'line-through' : 'none',
  margin: '0 0 3px',
}}

// Goal link (shown when task.goal_id has a name)
style={{ fontSize: 12, color: '#3B7DFF', margin: '1px 0 3px' }}
// content: "From: {goalName}"

// Duration text
style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}
// content: "{n} hour(s)"

// Action buttons (Swap / Snooze)
const actionBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: '#8E8E93', fontFamily: 'inherit', padding: '4px 0',
}
```

---

## 8. Milestone Row

```tsx
// Row container
style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}

// Unchecked circle
style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #D1D1D6', flexShrink: 0, cursor: 'pointer' }}

// Checked SVG circle
// <circle cx="12" cy="12" r="10" fill="#F0FFF4" stroke="#16A34A" /> + polyline checkmark

// Text
style={{ fontSize: 14, color: completed ? '#8E8E93' : '#1C1C1E', textDecoration: completed ? 'line-through' : 'none' }}
```

---

## 9. Progress Bar

```tsx
// Track
style={{ background: '#E5E5EA', borderRadius: 6, height: 8, overflow: 'hidden' }}

// Fill
style={{ height: '100%', width: `${progress}%`, background: '#1C1C1E', borderRadius: 6, transition: 'width 0.4s ease' }}
```

---

## 10. Badges / Pills

```tsx
// Category badge (detail page header)
style={{ fontSize: 12, fontWeight: 500, background: catStyle.bg, color: catStyle.color, padding: '4px 10px', borderRadius: 20 }}

// Quarter badge (neutral)
style={{ fontSize: 12, color: '#8E8E93', background: '#F2F2F7', padding: '4px 8px', borderRadius: 20 }}

// Status badge
style={{ fontSize: 12, fontWeight: 500, background: sStyle.bg, color: sStyle.color, padding: '4px 10px', borderRadius: 20 }}

// Weekly suggested-task category badge
style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}
// (same bg/color from getCatStyle)
```

---

## 11. Toggle Switch

Same pattern used in Low Energy block (daily plan) and Settings.

```tsx
// Track
style={{
  width: 50, height: 30, borderRadius: 15,
  background: isOn ? '#34C759' : '#E5E5EA',
  border: 'none', cursor: 'pointer',
  position: 'relative', padding: 0,
  transition: 'background 0.2s',  // (settings page adds this)
}}

// Knob
style={{
  width: 26, height: 26, borderRadius: '50%',
  background: 'white',
  position: 'absolute', top: 2,
  left: isOn ? 22 : 2,
  transition: 'left 0.2s',
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
}}
```

---

## 12. Buttons

### Primary CTA (full-width)
```tsx
style={{
  width: '100%', padding: '15px', borderRadius: 14, border: 'none',
  background: isEnabled ? '#3B7DFF' : '#D1D1D6',
  color: 'white', fontSize: 15, fontWeight: 600, cursor: isEnabled ? 'pointer' : 'default',
  fontFamily: 'inherit',
  opacity: isLoading ? 0.6 : 1,
}}
```

### Secondary outline (paired buttons, bottom actions)
```tsx
style={{
  flex: 1, padding: '13px', borderRadius: 12,
  background: 'white', border: '0.5px solid #E5E5EA',
  color: '#1C1C1E', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}}
// Accent variant (blue text): color: '#3B7DFF', fontWeight: 600
```

### Save / Cancel pair (inline edit)
```tsx
const saveBtn = {
  padding: '7px 16px', background: '#1C1C1E', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit',
}
const cancelBtn = {
  padding: '7px 16px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
  fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit',
}
```

### Ghost action (SectionActions — Add / Edit / Regenerate)
```tsx
const actionBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', fontWeight: 500,
}
// Icon size: 12×12, stroke: currentColor
```

### Frosted secondary button (on gradient surface)
```tsx
// Usage: secondary action buttons rendered on a gradient-background panel
// (e.g. "View My QR Code" / "Scan a Code" inside the Add a Friend gradient panel)
{
  flex: 1, padding: '10px', borderRadius: 10,
  background: 'rgba(255,255,255,0.18)',
  border: '1px solid rgba(255,255,255,0.28)',
  color: 'white', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}
```

### Ghost muted action (Swap / Snooze)
```tsx
{ background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: '#8E8E93', fontFamily: 'inherit', padding: '4px 0' }
```

### Status action (Pause / Archive / Activate)
```tsx
{
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10,
  fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit',
}
// Active restore variant: color: '#16A34A'
```

### Delete trigger (full-width ghost danger)
```tsx
{
  width: '100%', padding: '14px', background: 'white',
  border: '0.5px solid #E5E5EA', borderRadius: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontSize: 14, fontWeight: 500, color: '#DC2626',
  cursor: 'pointer', fontFamily: 'inherit',
}
```

---

## 13. Chip / Segmented Selectors

### Category grid (3-column, task creation modal)
```tsx
// Grid wrapper
style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}

// Each chip
style={{
  padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12, fontWeight: 500,
  background: isSelected ? catStyle.color : '#F2F2F7',
  color:      isSelected ? 'white'         : '#3C3C43',
}}
```

### Priority selector (3-button row)
```tsx
// Row wrapper
style={{ display: 'flex', gap: 8 }}

// Each button
style={{
  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 500,
  background: isSelected ? PRIORITY_DOT[p] : '#F2F2F7',
  color:      isSelected ? 'white'          : '#3C3C43',
}}
```

### Time-slot grid (onboarding)
```tsx
// Grid wrapper
style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}

// Each slot button
style={{
  borderRadius: 10, padding: '10px 4px', fontSize: 13, fontWeight: 500,
  border: isSelected ? `2px solid ${color}` : '1px solid #D1D1D6',
  background: isSelected ? `${color}15` : 'white',  // 15 = ~8% opacity hex
}}
```

### Selection list (Settings theme picker)
```tsx
// Selected item
style={{ border: '2px solid #3B7DFF', background: '#EFF6FF' }}
// Unselected item
style={{ border: '2px solid #F2F2F7', background: 'white' }}
// Checkmark icon shown on selected state only
```

---

## 14. Form Fields

### Text input (modal forms)
```tsx
style={{
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '0.5px solid #D1D1D6', fontSize: 15, color: '#1C1C1E',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#F8F8FC',
}}
```

### Date / Time input (modal forms)
```tsx
style={{
  width: '100%', padding: '11px 12px', borderRadius: 12,
  border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#F8F8FC',
}}
```

### Select / Dropdown — modal form variant
```tsx
style={{
  width: '100%', padding: '11px 12px', borderRadius: 12,
  border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#F8F8FC', appearance: 'none',
}}
```

### Select / Dropdown — inline detail edit variant
```tsx
style={{
  width: '100%', border: '1px solid #E5E5EA', borderRadius: 10,
  padding: '10px 12px', fontSize: 14, color: '#1C1C1E',
  fontFamily: 'inherit', outline: 'none',
  background: '#F9F9FB', appearance: 'none', boxSizing: 'border-box',
}}
```

### Textarea
```tsx
style={{
  width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 10,
  padding: '12px', fontSize: 14, color: '#1C1C1E',
  fontFamily: 'inherit', resize: 'none', outline: 'none',
  boxSizing: 'border-box', background: '#F8F8FC',
}}
```

Form label pattern: `<p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Label</p>` preceding each field.

---

## 15. Modal Patterns

### Bottom-Sheet Modal (task creation, generate plan, etc.)

```tsx
// Overlay
style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  zIndex: 200,
}}
onClick={() => setShowModal(false)}  // close on overlay tap

// Sheet
style={{
  background: 'white', borderRadius: '24px 24px 0 0',
  width: '100%', maxWidth: 480,
  maxHeight: '85vh', overflowY: 'auto',
  padding: '24px 20px 40px',
}}
onClick={e => e.stopPropagation()}

// Close button (X)
style={{
  background: '#F2F2F7', border: 'none', borderRadius: '50%',
  width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
}}
// X icon: width/height 14, stroke '#3C3C43', strokeWidth 2.5

// Header layout
style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}
// Title: fontSize 18, fontWeight 700, color '#1C1C1E'
// Subtitle: fontSize 12, color '#8E8E93', margin '3px 0 0'
```

**Settings variant** (drag-handle style, slightly smaller radius):
- `borderRadius: '20px 20px 0 0'`, `padding: '20px 16px 36px'`
- Drag handle: `width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 20px'`

### Center Modal (confirmation / destructive)

```tsx
// Overlay
style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 24px', zIndex: 200,
}}

// Card
style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 340, width: '100%' }}

// Danger icon circle
style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF0F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center' }}
```

### Inline Delete Confirm (in-page, no overlay)

```tsx
// Container
style={{ background: '#FFF5F5', borderRadius: 14, padding: '16px 20px', border: '1px solid #FECACA' }}

// Title
style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', margin: '0 0 4px' }}

// Body
style={{ fontSize: 13, color: '#7F1D1D', margin: '0 0 14px' }}

// Confirm button
style={{ flex: 1, padding: '10px', background: '#DC2626', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer' }}

// Cancel button
style={{ flex: 1, padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer' }}
```

---

## 16. Expandable / Accordion Section

Pattern from deferred tasks section in daily plan:

```tsx
// Header button (border-radius changes on open/close)
style={{
  width: '100%', background: 'white', border: '0.5px solid #E5E5EA',
  borderRadius: isOpen ? '16px 16px 0 0' : 16,
  padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}}

// Header label
style={{ fontSize: 14, fontWeight: 500, color: '#3C3C43' }}

// Chevron icon (rotates on open)
// width/height 16, stroke '#8E8E93', strokeWidth 2.5
style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
```

Settings page uses `maxHeight` + `opacity` for smooth CSS animation:
```css
transition: 'max-height 0.25s ease, opacity 0.2s ease'
```

---

## 17. Toast Notification

```tsx
style={{
  position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
  background: '#1C1C1E', color: 'white',
  padding: '12px 20px', borderRadius: 12,
  fontSize: 14, fontWeight: 500, zIndex: 300,
  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)',
}}
```
Auto-dismiss after **3000ms**. `bottom: 90` clears the bottom nav bar.

---

## 18. Row Item (Settings List)

```tsx
// Row
style={{ padding: '13px 16px', borderBottom: '0.5px solid #F2F2F7' }}

// Icon container
style={{ width: 36, height: 36, borderRadius: 8,
  background: iconColor,  // varies per item
  display: 'flex', alignItems: 'center', justifyContent: 'center' }}
```

---

## 19. Numbered Step

```tsx
// Number circle (Action Steps in goal detail)
style={{
  width: 24, height: 24, borderRadius: '50%',
  background: '#EFF6FF', color: '#3B7DFF',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
}}
```

---

## 20. Navigation

### Back button (chevron-left)
Daily plan variant (blue):
```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px',
  display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14 }}
// Icon: width/height 16, stroke '#3B7DFF', strokeWidth 2.5
```

Goal detail variant (neutral):
```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0,
  color: '#3C3C43', fontFamily: 'inherit', fontSize: 15 }}
// Icon: width/height 18, stroke '#3C3C43', strokeWidth 2.5
```

---

## 21. Spacing System

| Context | Value |
|---|---|
| Page horizontal padding | `16px` |
| Modal / content horizontal padding | `20px` |
| Page top padding (below status bar) | `56px` |
| Section gap (margin-bottom between cards) | `12px` standard, `14px` common |
| Card internal padding — compact | `16px 18px` |
| Card internal padding — standard | `18px 20px` |
| Modal internal padding | `24px 20px 40px` (40px bottom = home indicator clearance) |
| Modal bottom padding (settings style) | `20px 16px 36px` |
| Between list items within card (gap) | `10px`, `12px`, or `0` (shared border) |
| Two-column form grid gap | `12px` |
| Three-column chip grid gap | `8px` |
| Four-column slot grid gap | `8px` |
| Chip/button row gap | `8px` |

---

## 22. zIndex Hierarchy

| Layer | zIndex |
|---|---|
| Page content | implicit 0 |
| Bottom nav (estimated) | ~100 |
| Bottom-sheet / center modal overlays | 200 |
| Toast | 300 |

---

## 23. Missing Pattern — Day-of-Week Picker

**No day-of-week picker exists anywhere in the codebase.** The onboarding energy page uses a time-slot grid (4-column, hourly slots); no day-selector was found.

**E2 will need a new pattern for this.** Recommended approach (stop and confirm with user before implementing):
- 7-button row (`Su Mo Tu We Th Fr Sa`) matching the time-slot button style: `borderRadius: 10`, selected = solid blue `#3B7DFF` / white text, unselected = `#F2F2F7` / `#3C3C43`
- Wrap at narrow viewports using `flexWrap: 'wrap'`

---

## 24. Inconsistencies Found (do not fix — flagged for awareness)

| # | Issue | Values observed |
|---|---|---|
| 1 | Bottom-sheet modal border-radius | Task creation: `'24px 24px 0 0'` vs Settings: `'20px 20px 0 0'` |
| 2 | Select border style in detail edit | `border: '1px solid #E5E5EA'` (full 1px) vs modal form `'0.5px solid #D1D1D6'` |
| 3 | Select background in detail edit | `'#F9F9FB'` vs modal form `'#F8F8FC'` |
| 4 | Card padding not systematized | `'18px 20px'`, `'16px 18px'`, `'14px 16px'` all in use |
| 5 | Small button border-radius | Status action buttons use `borderRadius: 10`; secondary outline uses `borderRadius: 12` |
| 6 | Back button color | Daily plan: `#3B7DFF` (blue); Goals detail: `#3C3C43` (neutral) |
| 7 | Checkbox size | Task checkbox: 24×24; Milestone circle: 22×22 |
| 8 | Primary CTA font weight | Most pages: `fontWeight: 600`; Add Block submit: `fontWeight: 700` |
| 9 | Two different danger reds | Priority/icon danger: `#FF3B30`; Delete button/confirm: `#DC2626` |

---

## 26. Reward UI Patterns (Phase 3 Variable Rewards)

These patterns are exclusive to the variable rewards system (`app/dashboard/components/rewards/`). They do not override existing tokens — they extend them.

### Reward Modal Card
Extension of the Center Modal pattern (section 15) with larger radius and more vertical padding to accommodate reward icons.

```css
background: white;
borderRadius: 28;
padding: '40px 28px 36px';
maxWidth: 340;
width: '100%';
position: relative;
overflow: hidden;            /* required: clips the glass streak animation */
boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)';
```

**Scrim:** `rgba(0,0,0,0.45)`, `zIndex: 400` (above toast at 300).

**Card entry animation:** `scale: 0.92→1`, `y: 20→0`, spring stiffness 300 / damping 28.  
**Card exit:** `opacity: 0`, `scale: 0.96`, `y: 8`. Duration 0.2s.  
**Reduced motion:** fade only (`opacity: 0→1`), no spring, no scale.

### Glass Streak Sweep
A soft diagonal highlight that sweeps once across the card after entry — gives the card a premium light-reflective quality.

```tsx
// Overlay sits inside the card (overflow:hidden on card clips it)
initial={{ x: '-110%' }}
animate={{ x: '220%' }}
transition={{ duration: 0.85, ease: 'easeOut', delay: 0.35 }}

background: 'linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.10) 50%, transparent 75%)'
pointerEvents: 'none'
zIndex: 2
```
Not rendered when `useReducedMotion()` is true.

### Reward Icon Ring (all modal rewards except Perfect Week and Streak Milestone)
A filled accent circle with a floating outer ring and a single entry pulse. Approved in user review June 10, 2026.

```
Inner circle:  72×72px, filled accent color, borderRadius 50%
               boxShadow: `0 6px 24px ${accent}44`
Gap:           10px between inner circle edge and outer ring centre-line
Outer ring:    92×92px container; ring is border: 2px solid accent, borderRadius 50%, opacity 0.55
Pulse:         outer ring animates scale [1, 1.07, 1] opacity [0.55, 0.25, 0.55]
               once on entry, duration 0.9s, delay 0.65s. No repeat.
Icon:          28×28px white stroke, strokeWidth 1.8–2.0, centered in inner circle
```

Accent colors by reward type (all existing tokens):
| Reward | Accent |
|---|---|
| first_move, back_in_rhythm | `#FF9500` (Medium orange) |
| full_day | `#3B7DFF` (Primary blue) |
| perfect_week, first_reflection | `#9333EA` (Relationships purple) |
| streak_milestone | `linear-gradient(135deg, #FF9500, #FF3B30)` |
| goal_complete | `linear-gradient(135deg, #FBBF24, #D97706)` |

### Quiet Win Toast (lavender variant)
Inline toast replacing the standard dark toast for Quiet Win only. Not a modal — no scrim, no takeover.

```css
background: '#F5F3FF';      /* new: Reward accent (lavender) */
border: '1px solid #DDD6FE';
borderRadius: 12;
padding: '11px 18px';
color: '#5B21B6';
fontSize: 14; fontWeight: 500;
```
"Nice." accent text: `color: '#7C3AED', fontWeight: 600`.  
Auto-dismiss: **2000ms** (vs standard 3000ms — it is intentionally briefer).  
Position: `bottom: 100px` (10px higher than standard toast to clear nav bar).  
Bloom: soft radial `rgba(167,139,250,0.18)` glow behind the toast card, fades in with the toast.

**New color token: Reward accent (lavender)**
| Token | Hex | Usage |
|---|---|---|
| Lavender bg | `#F5F3FF` | Quiet Win toast background |
| Lavender border | `#DDD6FE` | Quiet Win toast border |
| Lavender text | `#5B21B6` | Quiet Win toast text |
| Lavender accent | `#7C3AED` | "Nice." text and check circle fill |
| Lavender bloom | `rgba(167,139,250,0.18)` | Toast background glow |

---

## 25. E2 Usage Rules

1. **All new UI must reference a token from sections 1–22 above.** No new hex values, no new spacing values.
2. **If a pattern does not exist** (e.g., day-of-week picker, recurrence badge), stop and surface the gap to the user before writing any code.
3. **The task card in section 7** is the exact element the recurrence badge will overlay. The badge must not alter the card's outer dimensions or border layout.
4. **The task creation modal in section 15** is the exact form the Recurrence accordion section will be added to. New fields must use form tokens from section 14 and chip/selector tokens from section 13.
