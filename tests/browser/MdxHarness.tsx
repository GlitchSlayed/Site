import { DataTable, HeatmapPlot, ScatterPlot, LinePlot, EngineeringNote, EquationBlock, Measurement, NotebookCell, MetricGrid, MetricCard } from '../../src/components/mdx';
export default function MdxHarness() {
  return <div data-testid="mdx-fixture">
    <EngineeringNote kind="assumption" title="Fixture data">All values are illustrative.</EngineeringNote>
    <EquationBlock equation="F = ma" description="Force is mass times acceleration." variables={[{symbol:'m',meaning:'Mass',unit:'kg'}]} />
    <Measurement label="Example reading" value={12.4} uncertainty={.3} unit="N" />
    <MetricGrid columns={2}><MetricCard label="A" value={1} /><MetricCard label="B" value={2} /></MetricGrid>
    <DataTable title="Readings" pageSize={2} columns={[{key:'run',label:'Run'},{key:'force',label:'Force',unit:'N'}]} data={[{run:'B',force:2},{run:'A',force:1},{run:'C',force:3}]} />
    <HeatmapPlot title="Measured field" data={[[1,NaN],[3,4]]} height={180} interpolate={false} />
    <ScatterPlot title="Repeated observations" points={[{x:1,y:2,category:'A'},{x:1,y:3,category:'A'},{x:2,y:4,category:'B'}]} />
    <LinePlot title="Independent sampling" series={[{label:'A',x:[0,2],y:[0,2]},{label:'B',x:[0,1,2],y:[1,2,3]}]} />
    <NotebookCell title="Source example" code="print(1 + 1)">2</NotebookCell>
  </div>;
}
