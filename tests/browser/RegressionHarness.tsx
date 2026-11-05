import { StrictMode, useState } from 'react';
import { EngineeringPlot } from '../../src/components/engineering/plots/EngineeringPlot';
import { EngineeringModelViewer } from '../../src/components/engineering/viewers/EngineeringModelViewer';
import { FunctionPlot } from '../../src/components/mdx/FunctionPlot';
import { ParamSlider } from '../../src/components/mdx/ParamSlider';

export default function RegressionHarness({ modelUrl }: { modelUrl: string }) {
  const [visible, setVisible] = useState(false);
  const [plotMounted, setPlotMounted] = useState(false);
  return <StrictMode>
    <ParamSlider scopeId="browser-regression" id="gain" label="Gain" min={1} max={10} defaultValue={7} />
    <button onClick={() => setPlotMounted(true)}>Mount scoped plot</button>
    {plotMounted && <FunctionPlot title="Scoped function" fn="gain*x" domain={[1,3]} samples={3} scopeId="browser-regression" />}
    <button onClick={() => setVisible(!visible)}>Toggle hidden plot</button>
    <div data-testid="hidden-plot" style={{ display: visible ? 'block' : 'none' }}>
      <EngineeringPlot config={{ title: 'Log axes', xAxis: {title:'X', type:'log'}, yAxis:{title:'Y', type:'log'}, series:[{id:'a',label:'Power',x:[1,10,100],y:[1,100,10000]}] }} />
    </div>
    <EngineeringModelViewer src={modelUrl} height={320} />
  </StrictMode>;
}
