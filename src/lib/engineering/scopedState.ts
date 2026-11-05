// Shared parameter values and immutable snapshots for React external-store consumers.
export type ParamListener = (value: number) => void;
export type ScopeListener = (paramId: string, value: number) => void;
export type ScopeSnapshot = Readonly<Record<string, number>>;
interface ScopeEntry {
  value?: number;
  listeners: Set<ParamListener>;
}
interface ScopeContainer {
  entries: Map<string, ScopeEntry>;
  scopeListeners: Set<ScopeListener>;
  snapshot: ScopeSnapshot;
}
export const EMPTY_SCOPE: ScopeSnapshot = Object.freeze({});
const scopes = new Map<string, ScopeContainer>();
function getScope(scopeId: string): ScopeContainer {
  let scope = scopes.get(scopeId);
  if (!scope) {
    scope = { entries: new Map(), scopeListeners: new Set(), snapshot: EMPTY_SCOPE };
    scopes.set(scopeId, scope);
  }
  return scope;
}
export function getScopeSnapshot(scopeId?: string): ScopeSnapshot {
  return scopeId ? scopes.get(scopeId)?.snapshot ?? EMPTY_SCOPE : EMPTY_SCOPE;
}
export function registerParameter(scopeId: string, paramId: string, defaultValue: number): void {
  if (getParameter(scopeId, paramId) === undefined) setParameter(scopeId, paramId, defaultValue);
}
export function getParameter(scopeId: string, paramId: string): number | undefined {
  return scopes.get(scopeId)?.entries.get(paramId)?.value;
}
export function setParameter(scopeId: string, paramId: string, value: number): void {
  const scope = getScope(scopeId);
  let entry = scope.entries.get(paramId);
  if (entry && Object.is(entry.value, value)) return;
  if (!entry) {
    entry = { listeners: new Set() };
    scope.entries.set(paramId, entry);
  }
  entry.value = value;
  scope.snapshot = Object.freeze({ ...scope.snapshot, [paramId]: value });
  entry.listeners.forEach(listener => listener(value));
  scope.scopeListeners.forEach(listener => listener(paramId, value));
}
export function subscribeParameter(scopeId: string, listener: ScopeListener): () => void;
export function subscribeParameter(scopeId: string, paramId: string, listener: ParamListener): () => void;
export function subscribeParameter(scopeId: string, arg1: string | ScopeListener, arg2?: ParamListener): () => void {
  const scope = getScope(scopeId);
  if (typeof arg1 === 'function') {
    scope.scopeListeners.add(arg1);
    return () => { scope.scopeListeners.delete(arg1); };
  }
  let entry = scope.entries.get(arg1);
  if (!entry) {
    // Listening must not invent a value and override a later registered default.
    entry = { listeners: new Set() };
    scope.entries.set(arg1, entry);
  }
  const listener = arg2!;
  entry.listeners.add(listener);
  return () => { entry.listeners.delete(listener); };
}
export function destroyScope(scopeId: string): void { scopes.delete(scopeId); }
export const clearScope = destroyScope;
