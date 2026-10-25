// React integration for the scoped parameter store.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getParameter,
  registerParameter,
  setParameter,
  subscribeParameter,
} from '../../../lib/engineering/scopedState';

export interface UseScopedParameterOptions {
  scopeId: string;
  paramId: string;
  defaultValue: number;
}

/** Read/write a parameter within an isolated scope. Values stay synchronized
 *  across every component instance that shares the same scopeId + paramId. */
export function useScopedParameter({ scopeId, paramId, defaultValue }: UseScopedParameterOptions) {
  const [value, setValue] = useState(() => {
    registerParameter(scopeId, paramId, defaultValue);
    return getParameter(scopeId, paramId) ?? defaultValue;
  });

  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  useEffect(() => {
    const unsubscribe = subscribeParameter(scopeId, paramId, (next) => {
      setValueRef.current(next);
    });
    return unsubscribe;
  }, [scopeId, paramId]);

  const set = useCallback(
    (next: number) => {
      setParameter(scopeId, paramId, next);
    },
    [scopeId, paramId],
  );

  return [value, set] as const;
}
