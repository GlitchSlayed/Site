declare module 'occt-import-js' {
  export interface OcctMeshFace {
    first: number;
    last: number;
    color?: [number, number, number];
  }

  export interface OcctMeshEdge {
    first: number;
    last: number;
    color?: [number, number, number];
  }

  export interface OcctMesh {
    name?: string;
    color?: [number, number, number];
    attributes: {
      position: { array: Float32Array | number[] };
      normal?: { array: Float32Array | number[] };
    };
    index: { array: Uint32Array | number[] };
    brep_faces?: OcctMeshFace[];
    edge_lines?: OcctMeshEdge[];
  }

  export interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
  }

  export interface OcctOptions {
    locateFile?: (file: string) => string;
  }

  export default function initOpenCascade(options?: OcctOptions): Promise<{
    ReadStepFile: (data: Uint8Array, params?: any) => OcctResult;
    ReadIgesFile: (data: Uint8Array, params?: any) => OcctResult;
    ReadBrepFile: (data: Uint8Array, params?: any) => OcctResult;
  }>;
}
