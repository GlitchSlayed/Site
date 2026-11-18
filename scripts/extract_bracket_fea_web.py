#!/usr/bin/env python3
"""
Extract verified surface meshes and FEA solution fields from the bracket study NPZ archives
into lightweight web-ready JSON files for interactive in-browser 3D WebGL rendering.
"""

import zipfile
import io
import json
from pathlib import Path
import numpy as np

ZIP_PATH = Path('/home/vanshdatta/Documents/Projects/Bracket/Before_the_Metal_Is_Cut_Complete.zip')
OUT_DIR = Path('public/notebooks/aerospace-bracket/fea')
OUT_DIR.mkdir(parents=True, exist_ok=True)

VARIANTS = [
    ('r2', 'aerospace_bracket/results/r2_h2.npz', 2.0, 150.46),
    ('r5', 'aerospace_bracket/results/r5_h2.npz', 5.0, 151.47),
    ('r10', 'aerospace_bracket/results/r10_h2.npz', 10.0, 155.09),
]

with zipfile.ZipFile(ZIP_PATH) as z:
    for vid, npz_rel, radius_mm, mass_g in VARIANTS:
        print(f"Extracting {vid} from {npz_rel}...")
        raw = np.load(io.BytesIO(z.read(npz_rel)))
        p = raw['p']
        faces = raw['faces']
        owner = raw['owner']
        roi = raw['roi']

        # Map faces to unique surface nodes
        unique_nodes, inv_indices = np.unique(faces, return_inverse=True)
        new_faces = inv_indices.reshape(faces.shape)
        surf_p = p[unique_nodes]

        down_u = raw['down_limit_u'].reshape(-1, 3)[unique_nodes]
        side_u = raw['side_limit_u'].reshape(-1, 3)[unique_nodes]
        ult_u = down_u * 1.5

        # Surface face centroid stresses from owner tet centroids
        down_face_vm = raw['down_limit_vm'][owner]
        side_face_vm = raw['side_limit_vm'][owner]
        ult_face_vm = down_face_vm * 1.5

        # Map face centroid stresses to surface nodes via area-weighted or average accumulator
        node_vm_down = np.zeros(len(unique_nodes))
        node_vm_side = np.zeros(len(unique_nodes))
        node_counts = np.zeros(len(unique_nodes))
        for f_idx, (f, o) in enumerate(zip(new_faces, owner)):
            vm_d = down_face_vm[f_idx]
            vm_s = side_face_vm[f_idx]
            for nid in f:
                node_vm_down[nid] += vm_d
                node_vm_side[nid] += vm_s
                node_counts[nid] += 1
        node_counts[node_counts == 0] = 1
        node_vm_down /= node_counts
        node_vm_side /= node_counts
        node_vm_ult = node_vm_down * 1.5

        # Compute face normals and identify feature edges (dihedral angle > 28 deg)
        v0 = surf_p[new_faces[:, 0]]
        v1 = surf_p[new_faces[:, 1]]
        v2 = surf_p[new_faces[:, 2]]
        face_normals = np.cross(v1 - v0, v2 - v0)
        face_norm_lens = np.linalg.norm(face_normals, axis=1, keepdims=True)
        face_norm_lens[face_norm_lens == 0] = 1.0
        face_normals /= face_norm_lens

        edge_to_faces = {}
        for fi, tri in enumerate(new_faces):
            for e in [
                tuple(sorted((int(tri[0]), int(tri[1])))),
                tuple(sorted((int(tri[1]), int(tri[2])))),
                tuple(sorted((int(tri[2]), int(tri[0])))),
            ]:
                edge_to_faces.setdefault(e, []).append(fi)

        feature_edges = []
        cos_threshold = np.cos(np.radians(28.0))
        for e, f_indices in edge_to_faces.items():
            if len(f_indices) == 1:
                feature_edges.append(list(e))
            elif len(f_indices) >= 2:
                n1 = face_normals[f_indices[0]]
                n2 = face_normals[f_indices[1]]
                if np.dot(n1, n2) < cos_threshold:
                    feature_edges.append(list(e))

        down_u_mags = np.linalg.norm(down_u, axis=1)
        side_u_mags = np.linalg.norm(side_u, axis=1)

        data = {
            'id': vid,
            'radiusMm': radius_mm,
            'massGrams': mass_g,
            'numNodes': len(unique_nodes),
            'numTriangles': len(new_faces),
            'boundingBox': {
                'min': [round(float(v), 3) for v in surf_p.min(axis=0)],
                'max': [round(float(v), 3) for v in surf_p.max(axis=0)],
                'size': [round(float(v), 3) for v in (surf_p.max(axis=0) - surf_p.min(axis=0))],
            },
            'positions': [round(float(v), 4) for v in surf_p.flatten()],
            'triangles': [int(idx) for idx in new_faces.flatten()],
            'featureEdges': [int(idx) for pair in feature_edges for idx in pair],
            'roiFaces': [int(i) for i in np.where(roi)[0]],
            'loads': {
                'lc1': {
                    'label': 'LC1: 2,000 N Downward',
                    'peakStressMpa': round(float(down_face_vm.max()), 2),
                    'p99StressMpa': round(float(np.percentile(down_face_vm, 99)), 2),
                    'maxDisplacementMm': round(float(down_u_mags.max()), 5),
                    'displacements': [round(float(v), 5) for v in down_u.flatten()],
                    'nodalStress': [round(float(v), 2) for v in node_vm_down],
                },
                'lc2': {
                    'label': 'LC2: 500 N Sideways',
                    'peakStressMpa': round(float(side_face_vm.max()), 2),
                    'p99StressMpa': round(float(np.percentile(side_face_vm, 99)), 2),
                    'maxDisplacementMm': round(float(side_u_mags.max()), 5),
                    'displacements': [round(float(v), 5) for v in side_u.flatten()],
                    'nodalStress': [round(float(v), 2) for v in node_vm_side],
                },
                'lc3': {
                    'label': 'LC3: 3,000 N Factored',
                    'peakStressMpa': round(float(ult_face_vm.max()), 2),
                    'p99StressMpa': round(float(np.percentile(ult_face_vm, 99)), 2),
                    'maxDisplacementMm': round(float(down_u_mags.max() * 1.5), 5),
                    'displacements': [round(float(v), 5) for v in ult_u.flatten()],
                    'nodalStress': [round(float(v), 2) for v in node_vm_ult],
                },
            },
        }

        out_path = OUT_DIR / f"bracket_{vid}_fea.json"
        with open(out_path, 'w') as f:
            json.dump(data, f, separators=(',', ':'))
        size_kb = out_path.stat().st_size / 1024
        print(f"Saved {out_path} ({size_kb:.1f} KB, {len(unique_nodes)} nodes, {len(new_faces)} tris)")

print("All bracket FEA web datasets extracted successfully.")
