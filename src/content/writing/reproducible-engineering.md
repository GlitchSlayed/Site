---
title: "An engineering plot should come with its assumptions."
description: "Small habits that make a technical project easier to reproduce, review, and improve."
date: 2026-10-22
tags: [Technology, Scientific computing]
sample: true
---
A clean plot is useful. A clean plot that another person can reproduce is much more useful.

## Keep inputs separate

Store physical inputs in a clearly named configuration file. Record units and sources alongside them. Keep plotting preferences separate from the model itself.

```python
# Example input structure; values are illustrative.
inputs = {
    "mass_kg": 1.2,
    "reference_area_m2": 0.003,
    "drag_coefficient": 0.5,
}
```

## Preserve the reasoning

A project README should answer: What question does this model address? Which equations does it solve? What assumptions limit its use? How can someone reproduce the figures?

## Test something independent

Compare against an analytic special case, published benchmark, or independent implementation. Repeating your equation in a test only confirms that you typed it twice.

## Publish enough to learn from

Include source code, environment instructions, labeled figures, and a discussion of uncertainty. A result is easier to trust when the route to it is visible.
