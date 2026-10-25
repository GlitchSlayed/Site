// Lightweight scoped state for sharing parameters between visualization instances.
// Each scope is isolated; unrelated visualizations are never accidentally linked.

type Listener = (value: number) => void;

interface ScopeEntry {
  value: number;
  listeners: Set<Listener>;
}

const scopes = new Map<string, Map<string, ScopeEntry>>();

function getScope(scopeId: string): Map<string, ScopeEntry> {
  let scope = scopes.get(scopeId);
  if (!scope) {
    scope = new Map();
    scopes.set(scopeId, scope);
  }
  return scope;
}

export function registerParameter(scopeId: string, paramId: string, defaultValue: number): void {
  const scope = getScope(scopeId);
  if (!scope.has(paramId)) {
    scope.set(paramId, { value: defaultValue, listeners: new Set() });
  }
}

export function getParameter(scopeId: string, paramId: string): number | undefined {
  return getScope(scopeId).get(paramId)?.value;
}

export function setParameter(scopeId: string, paramId: string, value: number): void {
  const entry = getScope(scopeId).get(paramId);
  if (!entry) return;
  entry.value = value;
  entry.listeners.forEach((listener) => listener(value));
}

export function subscribeParameter(scopeId: string, paramId: string, listener: Listener): () => void {
  const entry = getScope(scopeId).get(paramId);
  if (!entry) return () => {};
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function destroyScope(scopeId: string): void {
  scopes.delete(scopeId);
}
