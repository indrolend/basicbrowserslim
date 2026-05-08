# PCR-WRIT Protocol Implementation

## Project: basic-browser-spa

This document defines how the **PCR-WRIT Protocol** is applied to the `basic-browser-spa` project.

---

## 1. Operational Context (PCR - Process of Contextual Reduction)

### Current State
- **Project Type**: Vanilla JS Single-Page Application (SPA)
- **Architecture**: No bundler, no framework. ES modules + classic scripts served as static files.
- **MVP Core**: `index.html`, `main.js`, `style.css`
- **Subsystems**:
  - `spa-kernel` (app orchestration)
  - `navigation` (nav model, rendering)
  - `rendering` (hero, nav, view rendering)
  - `transitions` (transition kernel, canvas rasterization)
  - `particles` (particle engine, sampler, plans)
  - `overlays` (overlay manager, apps, views)

### Key Runtime Assumptions
- Static server delivery (no dynamic asset loading)
- No CORS or fetch from external APIs
- Single-threaded animation loop with 60fps target
- Canvas-based transition effects
- Content-Security-Policy enforced (see `index.html`)

---

## 2. Scoped Operations (WRIT - Write Instruction Transformation)

### WRIT Structure for This Project

All tasks must define a WRIT in the following format:

```yaml
writ:
  scale: [micro|meso|macro]
  objective: [Clear statement of task]
  subsystem: [spa-kernel|navigation|rendering|transitions|particles|overlays]
  
  allowed_files:
    - [List of files AI is permitted to modify]
  
  protected_files:
    - [List of files that MUST NOT be modified]
  
  constraints:
    - [List of operational constraints]
  
  validation:
    - [List of checks to perform before/after]
```

### Default Protected Files
- `index.html` (security headers, DOM structure)
- `basic-browser-spa.prompt.md` (architectural reference)
- `js/spa/appKernel.js` (core app orchestration)
- `js/spa/state.js` (application state contract)
- `js/spa/utils.js` (shared utilities)
- `.git/**` (version control)

### Default Allowed Files
- `state.json` (PCR state management)
- `active-writ.yaml` (current WRIT definition)
- `main.js` (entry point)
- `style.css` (styling)
- `js/spa/**/*.js` (subsystem implementations)

---

## 3. Procedural Execution (RITES)

### RITES Workflow

1. **Reduction** (`pcr.derive()`):
   - Read `state.json` to understand current operational context
   - Identify active subsystems and constraints
   - Filter irrelevant project history

2. **Construction** (`writ.generate()`):
   - Define task-specific WRIT with clear scope
   - Identify allowed/protected files
   - List specific constraints for the task

3. **Validation** (`validate.before()`):
   - Verify WRIT scope is feasible
   - Check that no protected files are in allowed list
   - Confirm all constraints are measurable

4. **Execution** (`transform.apply()`):
   - Perform modifications strictly within allowed files
   - Adhere to all defined constraints
   - Generate clear change summaries

5. **Regeneration** (`pcr.update()`):
   - Update `state.json` with new operational context
   - Document completed transformations
   - Update `active-writ.yaml` for next task

---

## 4. Rules for Development

### Before Starting Any Task
1. Read `state.json` to understand current operational context
2. Generate or review the `active-writ.yaml` for scope/constraints
3. Confirm protected files are not in the modification scope
4. Verify all necessary files are in the allowed list

### During Modifications
1. Only modify files listed in `allowed_files` of the active WRIT
2. Never modify files listed in `protected_files`
3. Preserve all runtime contracts (see `basic-browser-spa.prompt.md`)
4. Maintain vanilla JS architecture (no bundlers, no external deps)

### After Modifications
1. Validate that changes respect scope boundaries
2. Verify syntax correctness (run through JS parser)
3. Confirm constraint adherence (performance, security, etc.)
4. Update `state.json` with completion status
5. Generate next WRIT if new work is upcoming

---

## 5. Validation Examples

### Scope Validation
```
✅ PASS: Modified only files in allowed_files
✅ PASS: No protected files touched
✅ PASS: No external dependencies introduced
```

### Constraint Validation
```
✅ PASS: Vanilla JS maintained (no bundler)
✅ PASS: Static asset delivery preserved
✅ PASS: CSP compliance maintained
✅ PASS: Runtime contract (spaData.js) intact
```

### Performance Validation
```
✅ PASS: Particle engine optimization → 60fps sustained
✅ PASS: Transition kernel < 16ms frame time
✅ PASS: No blocking main-thread operations
```

---

## 6. Quick Reference

### Commands for Protocol Adherence

| Operation | Command/Check |
|-----------|---------------|
| View current state | `cat state.json` |
| View active WRIT | `cat active-writ.yaml` |
| Check allowed files | `grep "allowed_files" active-writ.yaml` |
| Check protected files | `grep "protected_files" active-writ.yaml` |
| Validate JS syntax | `node -c js/spa/[file].js` |
| Update state after task | Edit `state.json` with task completion metadata |

---

## 7. Future WRIT Examples

### Example 1: Optimize Particle Engine (Meso-scale)
```yaml
writ:
  scale: meso
  subsystem: particles
  objective: "Optimize particle sampler for 60fps sustained performance"
  allowed_files:
    - "js/spa/particleSampler.js"
    - "js/spa/particleEngine.js"
  protected_files:
    - [all defaults from PROTOCOL.md]
  constraints:
    - "Maintain particle visual fidelity"
    - "Preserve sampler contract (spaData.js)"
    - "Achieve < 16ms frame time"
```

### Example 2: Add New Navigation Feature (Micro-scale)
```yaml
writ:
  scale: micro
  subsystem: navigation
  objective: "Add keyboard navigation support"
  allowed_files:
    - "js/spa/navigation.js"
    - "main.js"
  protected_files:
    - [all defaults from PROTOCOL.md]
  constraints:
    - "Preserve existing click/gesture handlers"
    - "No new dependencies"
    - "Maintain keyboard accessibility"
```

---

## 8. Summary

The PCR-WRIT Protocol ensures:
- ✅ **Operational Continuity**: `state.json` tracks current context
- ✅ **Scoped Transformations**: `active-writ.yaml` defines boundaries
- ✅ **Reconstructable Work**: RITES validation ensures clarity
- ✅ **Low Ambiguity**: Clear allowed/protected file lists
- ✅ **Validation at Every Step**: Comprehensive checks before/after

**All development on this project must adhere to this protocol.**
