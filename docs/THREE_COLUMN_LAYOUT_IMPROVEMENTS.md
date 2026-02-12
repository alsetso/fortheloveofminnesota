# Three-Column Layout Improvements

## Current Issues

1. **Performance**: Resize listener fires on every resize event (should be throttled/debounced)
2. **UX**: Abrupt sidebar show/hide (no smooth transitions)
3. **Functionality**: No manual toggle controls, no persistence
4. **Responsiveness**: Fixed breakpoints don't adapt to content needs
5. **Code Quality**: Magic numbers, duplicated logic

## Recommended Improvements

### 1. Performance Optimizations

**Use CSS Container Queries** (preferred) or **Throttled Resize Listener**

```typescript
// Option A: CSS Container Queries (best performance)
// Use @container queries in CSS instead of JS

// Option B: Throttled resize listener
import { useThrottle } from '@/hooks/useThrottle';

const throttledWidth = useThrottle(viewportWidth, 150);
```

**Benefits:**
- Reduces re-renders
- Better performance on resize
- Native browser optimization

### 2. Smooth Transitions

**Add CSS transitions for sidebar show/hide:**

```css
.sidebar-transition {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

.sidebar-hidden {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}
```

### 3. Manual Toggle Controls

**Add toggle buttons for sidebars:**

```typescript
const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

// Persist to localStorage
useEffect(() => {
  localStorage.setItem('leftSidebarCollapsed', String(leftSidebarCollapsed));
}, [leftSidebarCollapsed]);
```

### 4. Adaptive Widths

**Use CSS Grid with `minmax()` for better flexibility:**

```css
.layout-grid {
  display: grid;
  grid-template-columns: 
    minmax(0, 256px)  /* Left sidebar - can shrink to 0 */
    minmax(400px, 1fr)  /* Center - min 400px, max flexible */
    minmax(0, 320px);  /* Right sidebar - can shrink to 0 */
  gap: 0;
}

@media (max-width: 976px) {
  .layout-grid {
    grid-template-columns: 
      minmax(0, 256px)
      minmax(400px, 1fr);
  }
}

@media (max-width: 656px) {
  .layout-grid {
    grid-template-columns: minmax(400px, 1fr);
  }
}
```

### 5. Content-Aware Responsiveness

**Adjust based on content density, not just viewport:**

```typescript
const [contentWidth, setContentWidth] = useState(0);
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width;
    setContentWidth(width);
  });
  
  if (contentRef.current) {
    observer.observe(contentRef.current);
  }
  
  return () => observer.disconnect();
}, []);

// Hide sidebars if content is too narrow
const shouldShowSidebars = contentWidth > MIN_CENTER_WIDTH + LEFT_SIDEBAR_WIDTH;
```

### 6. Keyboard Shortcuts

**Add keyboard controls:**

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Cmd/Ctrl + B: Toggle left sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      setLeftSidebarCollapsed(prev => !prev);
    }
    // Cmd/Ctrl + Shift + B: Toggle right sidebar
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      setRightSidebarCollapsed(prev => !prev);
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

### 7. Improved Mobile Experience

**Better mobile sidebar handling:**

```typescript
// Slide-in sidebars on mobile instead of bottom nav
const [mobileSidebarOpen, setMobileSidebarOpen] = useState<'left' | 'right' | null>(null);

// Overlay with backdrop
{mobileSidebarOpen && (
  <>
    <div 
      className="fixed inset-0 bg-black/50 z-40 lg:hidden"
      onClick={() => setMobileSidebarOpen(null)}
    />
    <aside className="fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 bg-surface z-50 transform transition-transform lg:hidden">
      {mobileSidebarOpen === 'left' && leftSidebar}
      {mobileSidebarOpen === 'right' && rightSidebar}
    </aside>
  </>
)}
```

### 8. Constants & Configuration

**Extract magic numbers to constants:**

```typescript
const LAYOUT_CONSTANTS = {
  LEFT_SIDEBAR_WIDTH: 256,
  RIGHT_SIDEBAR_WIDTH: 320,
  MIN_CENTER_WIDTH: 400,
  HEADER_HEIGHT: 56,
  TRANSITION_DURATION: 200,
  RESIZE_THROTTLE_MS: 150,
} as const;
```

### 9. Accessibility Improvements

**Better ARIA labels and focus management:**

```typescript
<aside
  aria-label="Left sidebar navigation"
  aria-hidden={!effectiveCanShowLeftSidebar}
  role="complementary"
>
  {/* Sidebar content */}
</aside>

// Focus trap when sidebar opens on mobile
useEffect(() => {
  if (mobileSidebarOpen && sidebarRef.current) {
    sidebarRef.current.focus();
  }
}, [mobileSidebarOpen]);
```

### 10. CSS Grid Implementation (Recommended)

**Replace flexbox with CSS Grid for better control:**

```tsx
<div className="grid grid-cols-[256px_1fr_320px] gap-0 min-h-screen">
  {/* Left Sidebar */}
  <aside className={cn(
    "sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto",
    !effectiveCanShowLeftSidebar && "hidden"
  )}>
    {leftSidebar}
  </aside>
  
  {/* Center Content */}
  <main className="min-w-0 overflow-y-auto">
    {children}
  </main>
  
  {/* Right Sidebar */}
  <aside className={cn(
    "sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto",
    !effectiveCanShowRightSidebar && "hidden"
  )}>
    {rightSidebar}
  </aside>
</div>
```

## Implementation Priority

1. **High Priority:**
   - Throttle resize listener
   - Add smooth transitions
   - Extract constants

2. **Medium Priority:**
   - Manual toggle controls
   - Keyboard shortcuts
   - CSS Grid migration

3. **Low Priority:**
   - Content-aware responsiveness
   - Advanced mobile gestures
   - Persistence preferences

## Testing Considerations

- Test on various screen sizes (320px to 2560px+)
- Test with keyboard navigation
- Test with screen readers
- Test performance with many resize events
- Test sidebar persistence across page reloads
