# SPA Architecture Audit Report
## PCR-WRIT Meso-Scale Analysis (spa-kernel)

**Date**: 2026-05-07  
**Scale**: Meso (subsystem-level)  
**Status**: IN PROGRESS

---

## Executive Summary

The SPA architecture contains **5 unused modules** and **2 convoluted patterns** that create code complexity without contributing to the active application.

**Dead Code Files**: app.js, state.js, navigation.js, transitionController.js, renderView.js  
**Convoluted Patterns**: overlayManager.js (IIFE with orphaned window API), routes.js (dual purpose)  

---

## Detailed Findings

### 1. UNUSED MODULE: app.js
**Status**: Dead code  
**Size**: ~80 lines  
**Issue**: Old entrypoint that was replaced by main.js  
**Dependencies**:
- Imports: createNavigation, createState, createTransitionController, createViewRenderer
- All of these are only used by app.js
- Never imported by any active file

**Impact**: Increases cognitive load when reading architecture. Creates false import traces.

---

### 2. UNUSED MODULE: state.js
**Status**: Dead code  
**Size**: ~30 lines  
**Issue**: appKernel.js manages all state internally; this module is purely redundant  
**Internal State in appKernel**:
- `_si`, `_ii` (section/item indices)
- `_phase` (transition state: 'idle' | 'transitioning' | 'pulling')
- `_homeSectionLocked`, `_isGameActive`, `_queuedTarget` (lifecycle state)
- `_pullTargetSi`, `_pullTargetIi`, `_pullFromSurface`, etc. (gesture state)

**Design Issue**: state.js offers a generic pattern that's never used. appKernel chose the right path by owning state directly.

---

### 3. UNUSED MODULE: navigation.js
**Status**: Dead code  
**Size**: ~40 lines  
**Issue**: Only used by app.js (unused)  
**Actual Implementation**: renderNav.js provides all navigation DOM rendering  
**Why renderNav.js is correct**:
- Uses `SPA_SECTIONS` directly from spaData.js (proper data source)
- Implements `updateSectionNav()`, `updateItemDots()`, `setupItemNav()`
- Properly integrated with appKernel via renderNav callbacks

---

### 4. UNUSED MODULE: transitionController.js
**Status**: Dead code  
**Size**: ~25 lines  
**Issue**: Only used by app.js (unused)  
**Actual Implementation**: transitionKernel.js is the real transition handler  
**Key Difference**:
- transitionController.js: Naive morph-only pattern (assumes hero surface is orb)
- transitionKernel.js: Full canvas-based transition effects with rasterization support

---

### 5. UNUSED MODULE: renderView.js
**Status**: Dead code (partially)  
**Size**: ~35 lines  
**Issue**: Assumes old "routes" structure from app.js pattern  
**Status**: Not imported by main.js; would fail with current spaData.js contract

---

### 6. CONVOLUTED: overlayManager.js
**Status**: Integrated but convoluted  
**Pattern**: IIFE that sets `window.__SPA_Overlay`  
**Issue**:
- No imports in main.js (relies on script tag in index.html)
- Classic script pattern mixed with ES module architecture
- Creates global state without clear ownership
- Hard to reason about initialization order

**Current Integration**:
- In index.html: `<script src="js/spa/overlayManager.js"></script>` (before modules)
- appKernel calls `window.__SPA_Overlay` methods in goTo(), onTap(), etc.
- Works but violates module clarity

---

### 7. DUAL-PURPOSE: routes.js
**Status**: Functionally correct but naming confusion  
**Pattern**: IIFE that sets `window.__INDROLEND_ROUTES__`  
**Purpose**: Click action mapping for hero items (URL or overlay trigger)  
**Naming Issue**: "routes" suggests navigation routing, but it's really "click action mapping"  
**Usage**: appKernel.getClickAction() queries this for item interactions

---

## Redundancy Summary Table

| File | Lines | Purpose | Status | Replacement |
|------|-------|---------|--------|-------------|
| app.js | 80 | Old entrypoint | ❌ Dead | main.js |
| state.js | 30 | Generic state wrapper | ❌ Dead | appKernel internal state |
| navigation.js | 40 | Old nav renderer | ❌ Dead | renderNav.js |
| transitionController.js | 25 | Old transition logic | ❌ Dead | transitionKernel.js |
| renderView.js | 35 | Old view renderer | ❌ Dead | Not needed for current flow |
| **Total Dead Code** | **210** | | | |

---

## Convoluted Patterns

| Pattern | File | Issue | Recommendation |
|---------|------|-------|-----------------|
| IIFE + window API | overlayManager.js | Global state via script tag | Convert to ES module |
| Naming confusion | routes.js | "routes" ≠ routing (it's click actions) | Rename to itemActions.js |

---

## Architecture Improvement Plan

### Phase 1: Remove Dead Code
1. **Delete**: app.js, state.js, navigation.js, transitionController.js, renderView.js
2. **Validation**: No imports should break; all functionality exists elsewhere
3. **Impact**: -210 lines of pure dead code

### Phase 2: Clarify Patterns
1. **overlayManager.js**: Convert IIFE to ES module, import in main.js
2. **routes.js**: Rename to itemActions.js, update comments for clarity
3. **Validation**: No behavior change, just clarity

### Phase 3: Verify Integration
1. Test all subsystems work correctly
2. Verify no broken imports
3. Confirm CSP headers still valid

---

## Next Steps

1. Generate deletion operations following PCR-WRIT
2. Execute RITES (delete unused files)
3. Execute RITES (refactor convoluted patterns)
4. Regenerate PCR state with completed audit
5. Verify all systems operational

---

## Current WRIT Scope

**Allowed Modifications**:
- js/spa/**/*.js (all spa files)
- Can safely delete: app.js, state.js, navigation.js, transitionController.js, renderView.js
- Can safely refactor: overlayManager.js, routes.js, index.html (for import order)

**Protected Files**:
- appKernel.js, spaData.js, utils.js (working correctly; no changes needed)
- transitionKernel.js, surfaceManager.js (working correctly; no changes needed)

**Constraints**:
- No behavior changes to active systems
- Maintain vanilla JS architecture
- Preserve all runtime contracts
- CSP compliance maintained
