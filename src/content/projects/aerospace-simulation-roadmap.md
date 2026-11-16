---
title: "Learning Aerospace Simulation"
description: "A 12-week self-study program in structural FEA, CFD, and propulsion simulation, built around a bracket FEA study, a NACA 0012 airfoil study, and a rocket nozzle capstone."
date: "2026-11-16"
tags: [Aerospace, Simulation]
status: In Development
art: wing
featured: false
draft: false
sample: false
---

My co-op at Arkwin taught me how aerospace hardware gets built. Fixtures, tooling, drawings, watching parts I helped set up go through machining and test. What it did not teach me is the other half of the job: predicting how a part behaves before any metal is cut. That is what simulation is for, and it is the gap I want to close.

So I put together a 12-week self-study program, about 5 to 7 hours a week, covering computational structural mechanics, CFD, and propulsion simulation. The point is not just learning which buttons to press in a solver. It is learning enough theory to check the solver's work, because an unchecked simulation result is just a colorful picture.

Everything runs on open-source tools. FreeCAD for geometry, CalculiX for structural FEA, Gmsh for meshing, OpenFOAM and later SU2 for CFD, and ParaView for visualization. Fedora is the primary environment, Windows covers CAD and anything Hofstra provides access to.

## Current status

Just starting. The roadmap is written, the first project is specced in detail, and a hand calculation reference for the opening exercise is done. No software is installed yet and no simulations have been run. I will update this page as each step actually happens, and I will only report results I have actually produced.

## The roadmap

| Phase | Weeks | What happens | Deliverable |
| --- | --- | --- | --- |
| Foundations | 1-2 | Install the toolchain. Model a cantilever beam, calculate its tip deflection by hand, then check the solver against the hand calculation. | Calculation notebook |
| Project 1: bracket FEA | 3-5 | Static structural analysis of an aerospace mounting bracket, with a mesh independence study and hand calculation checks. | FEA technical report |
| Advanced structural | 6-7 | Modal analysis on the bracket. Buckling, fatigue, and factor of safety. | Extension to the Project 1 report |
| CFD foundations | 8-9 | OpenFOAM tutorial cases: lid-driven cavity and flow around a cylinder. Mesh resolution effects. | CFD fundamentals report |
| Project 2: airfoil CFD | 10-11 | NACA 0012 in SU2 at multiple angles of attack, validated against published experimental data. | Airfoil performance report |
| Integration | 12 | Clean up both projects, document assumptions and limitations, write the summaries. | Two documented projects |
| Project 3: rocket nozzle | After | Converging-diverging nozzle: analytical design, geometry, compressible CFD, validation against ideal theory. | Capstone, longer term |

## Project 1: the bracket

The first real project is a clevis-style mounting bracket, the kind of part that holds an actuator or a line replaceable unit in place. Base plate 100 by 60 by 6 mm, bolted down at four corners. A vertical web rises from the base with a 12 mm lug hole near the top, where a pin carries the load. The material is aluminum 7075-T6.

The main load case is 2000 N straight down at the lug hole, treated as limit load, with a second run at 3000 N for the ultimate case. A second load case puts 500 N out of plane at the lug, which bends the web sideways.

What makes it a study instead of a single solver run:

- Hand calculations first. Lug bearing, net section tension, shear tear-out, and web bending, worked before the solver runs so I know what answer to expect.
- A mesh convergence study. At least four mesh densities, tracking stress at the web fillet and displacement at the lug until both settle within 2 percent.
- A fillet radius study. Running the fillet at 2, 5, and 10 mm to watch the stress concentration change with geometry.
- Honest boundary conditions. The bolt holes are fixed, the base face is not, and the load goes on as a bearing distribution, not a point force. The report will name what the model leaves out: no bolt preload, no contact, no friction, linear material.

Weeks 6 and 7 reuse the same model for modal analysis, the first six natural frequencies and mode shapes, checked against a cantilever beam estimate of the web.

## How this connects to the wind tunnel work

Project 2 runs the NACA 0012 in SU2 and validates it against published wind tunnel data. My [Three Airfoils in Hofstra's Wind Tunnel](https://glitchslayed.github.io/Site/projects/hofstra-wind-tunnel-airfoil-testing/) project is the experimental version of the same question. One day the two should meet: the same airfoil, one set of numbers from a solver, one set from a tunnel, and an honest account of where they agree and where they do not.

## Working rules

- Hand calculations before solver results, every time.
- No result gets reported without a mesh convergence check or a comparison against theory or data.
- Every week produces something tangible, even if it is small.
- If the solver and the hand calculation disagree, the first suspects are units, boundary conditions, and how the load was applied.
