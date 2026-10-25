// Renders a control for every parameter of an engineering model.
import type { EngineeringModel } from '../../../lib/engineering/types';
import { ParameterControl } from './ParameterControl';

interface ParameterSetProps {
  model: EngineeringModel;
  scopeId: string;
  disabled?: boolean;
}

export function ParameterSet({ model, scopeId, disabled = false }: ParameterSetProps) {
  return (
    <div className="eng-parameter-set">
      {model.parameters.map((param) => (
        <ParameterControl key={param.id} param={param} scopeId={scopeId} disabled={disabled} />
      ))}
    </div>
  );
}
