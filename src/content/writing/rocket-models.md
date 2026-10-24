---
title: "What belongs in a first rocket flight model?"
description: "Build a model you can explain before adding a model you can’t verify."
date: 2026-10-23
tags: [Rocketry, Simulation]
sample: true
---
A first rocket trajectory model can begin with vertical motion. It is a limited model, but a useful one for learning force balance and numerical integration.

## Write the force balance

Take upward as positive. During a vertical ascent, a simplified equation is:

$$m\frac{dv}{dt}=T-mg-D.$$

Here $T$ is thrust, $m$ is instantaneous mass, and $D$ is the downward drag magnitude during ascent. After burnout, set thrust to zero. During descent, drag must reverse direction to oppose velocity.

## Build in stages

1. Check a gravity-only case against the analytic solution.
2. Add thrust with a simple, documented profile.
3. Include mass depletion consistently with the motor data.
4. Add drag and atmospheric variation.
5. Compare time steps and inspect convergence.

## Check units and signs

Keep units in SI throughout the solver. A thrust curve in newtons and a mass in grams can create a plausible-looking plot with completely wrong results.

A convenient signed drag force in one dimension is proportional to $-v|v|$. It naturally opposes velocity on both ascent and descent.

## Know the limits

A vertical model cannot describe wind drift, attitude dynamics, or stability. Treat it as an educational tool. Real launch planning requires appropriate validated tools and applicable launch procedures.
