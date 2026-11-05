import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { EMPTY_SCOPE, getScopeSnapshot, registerParameter, setParameter, subscribeParameter } from '../../../lib/engineering/scopedState';

export function useScopeSnapshot(scopeId?: string) {
  const subscribe = useCallback((notify: () => void) => {
    return scopeId ? subscribeParameter(scopeId, notify) : () => {};
  }, [scopeId]);
  const getSnapshot = useCallback(() => getScopeSnapshot(scopeId), [scopeId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SCOPE);
}
export interface UseScopedParameterOptions { scopeId: string; paramId: string; defaultValue: number; }
export function useScopedParameter({ scopeId, paramId, defaultValue }: UseScopedParameterOptions) {
  const snapshot = useScopeSnapshot(scopeId);
  useEffect(() => { registerParameter(scopeId, paramId, defaultValue); }, [scopeId, paramId, defaultValue]);
  const set = useCallback((next: number) => setParameter(scopeId, paramId, next), [scopeId, paramId]);
  return [snapshot[paramId] ?? defaultValue, set] as const;
}
