// Lightweight scoped state for sharing parameters between visualization instances.
// Each scope is isolated; unrelated visualizations are never accidentally linked.

export type ParamListener = (value: number) => void;
export type ScopeListener = (paramId: string, value: number) => void;

interface ScopeEntry {
  value: number;
  listeners: Set<ParamListener>;
}

interface ScopeContainer {
  entries: Map<string, ScopeEntry>;
  scopeListeners: Set<ScopeListener>;
}

const scopes = new Map<string, ScopeContainer>();

function getScope(scopeId: string): ScopeContainer {
  let scope = scopes.get(scopeId);
  if (!scope) {
    scope = {
      entries: new Map(),
      scopeListeners: new Set(),
    };
    scopes.set(scopeId, scope);
  }
  return scope;
}

export function registerParameter(scopeId: string, paramId: string, defaultValue: number): void {
  const scope = getScope(scopeId);
  if (!scope.entries.has(paramId)) {
    scope.entries.set(paramId, { value: defaultValue, listeners: new Set() });
  }
}

export function getParameter(scopeId: string, paramId: string): number | undefined {
  return getScope(scopeId).entries.get(paramId)?.value;
}

export function setParameter(scopeId: string, paramId: string, value: number): void {
  const scope = getScope(scopeId);
  let entry = scope.entries.get(paramId);
  if (!entry) {
    entry = { value, listeners: new Set() };
    scope.entries.set(paramId, entry);
  } else {
    entry.value = value;
  }

  // Notify parameter-specific listeners
  entry.listeners.forEach((listener) => {
    try {
      listener(value);
    } catch (e) {
      console.error(e);
    }
  });

  // Notify scope-wide listeners
  scope.scopeListeners.forEach((listener) => {
    try {
      listener(paramId, value);
    } catch (e) {
      console.error(e);
    }
  });
}

// Overload 1: subscribe to all parameters in a scope
export function subscribeParameter(scopeId: string, listener: ScopeListener): () => void;
// Overload 2: subscribe to a single parameter in a scope
export function subscribeParameter(scopeId: string, paramId: string, listener: ParamListener): () => void;
// Implementation:
export function subscribeParameter(
  scopeId: string,
  arg1: string | ScopeListener,
  arg2?: ParamListener,
): () => void {
  const scope = getScope(scopeId);

  if (typeof arg1 === 'function') {
    // Scope-wide listener
    const listener = arg1;
    scope.scopeListeners.add(listener);
    return () => {
      scope.scopeListeners.delete(listener);
    };
  }

  // Single parameter listener
  const paramId = arg1;
  const listener = arg2!;
  let entry = scope.entries.get(paramId);
  if (!entry) {
    entry = { value: 0, listeners: new Set() };
    scope.entries.set(paramId, entry);
  }
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function destroyScope(scopeId: string): void {
  scopes.delete(scopeId);
}

export const clearScope = destroyScope;
