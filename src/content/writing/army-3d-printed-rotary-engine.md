---
title: "Trying to understand the Army's 3D printed heavy fuel rotary engine"
description: "The Army flew a drone powered by a 3D printed heavy fuel rotary engine in a series hybrid system. Here is my attempt to work through why each of those choices makes sense, and the questions I still have."
date: 2026-11-02
tags: ["Aerospace", "Propulsion", "Manufacturing", "3D Printing"]
sample: false
featured: false
---

## What happened

The Army Research Laboratory, part of DEVCOM, flew a mid-sized drone called VICTOR with a propulsion system that stacks three unusual choices on top of each other. The engine is a rotary, a Wankel style design. It burns heavy fuel instead of gasoline. Large parts of it were 3D printed in metal. And it does not drive the aircraft directly. It runs a generator, and electric motors do the flying, which makes the whole thing a series hybrid.

Any one of those choices would be a decent engineering story. I am a huge sucker for rotary "Dorito" engines anyways but seeing all four together is what got my attention, so I spent some time trying to understand why a research lab would combine them. I am a mechanical engineering senior, not an engine designer, so this is me reasoning from what the Army published, plus what I know from coursework and a manufacturing co-op. Where I am speculating, I will say so.

The source for all of this is the Army's own article: [Army research leads to first 3D-printed heavy-fuel engine](https://www.army.mil/article/296507/army_research_leads_to_first_3d_printed_heavy_fuel_engine).

## Why heavy fuel

This one is mostly logistics. The military runs on a small number of standardized fuels, and heavy fuels like JP-8 are already everywhere for jets and ground vehicles. A tactical drone that needs its own special gasoline creates a supply problem out of proportion to its size. Someone has to find it, ship it, and store it separately, forward, under bad conditions.

Heavy fuel is harder to burn in a small engine. It does not vaporize as easily as gasoline, it is harder to ignite, and small engines feel those problems more because everything happens faster and in less space. The Army article says the team used CFD modeling and a clean sheet design to work on fuel atomization and vaporization, which tells you exactly where the pain was. If heavy fuel were easy, nobody would need a research program.

## Why a rotary

<img src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXN5NHlmbnlzY3Z1c21iNG5jbnhuNGp0ZmIzNDgyZzRldW8zbjNkZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/HG06KvWJOUbJ55inMT/giphy.gif" alt="Wankel rotary engine spinning" width="420" />

Rotaries are compact and light for the power they make, and they have very few moving parts compared to a piston engine. For a drone, where volume and weight are the whole budget, that is attractive.

The weaknesses are just as well known. Sealing is the classic one. A rotary seals its chambers with apex seals that sweep along the housing, and sealing a moving triangle is a harder problem than sealing a piston ring. The Army article mentions minimizing compressed air and fuel vapor leaks as one of the things the design work improved. Read that as: they spent real effort on the rotary's oldest problem, because on heavy fuel a leaky chamber is also a chamber that will not ignite reliably.

So my read is that the rotary is not there because it is fashionable. It is there because the size and weight math works for a generator engine, and the program bet that modern modeling and manufacturing could push the known weaknesses down to an acceptable level. Whether that bet pays off over hundreds of operating hours is a different question, and I will come back to it.

## Why 3D printed

This is the part closest to my own experience, so it is also the part I have the strongest opinion on.

The quote in the article is that 3D metal printing let the team rapidly redesign components based on lessons learned from testing, and design an air cooled engine that is smaller and needs no liquid coolant. Both of those are the real advantages of additive manufacturing. Not magic, not printing an engine like a photo. Iteration speed, and geometry you cannot easily machine.

Air cooling through printed passages is a good example. You can print internal shapes and fin arrangements that would be expensive or impossible to cast and machine conventionally. You can also print a part, test it, change it, and print it again in days. On a research program where the design is still moving, that cycle time matters more than unit cost.

My 2 cents, from the manufacturing side: printed does not mean finished. Critical surfaces on an engine, sealing faces, bearing seats, anything with a real tolerance and finish requirement, almost certainly still saw machining and inspection after printing. That is normal and it is not a criticism. The honest way to describe a part like this is designed for additive, finished by machining, which is how most serious metal printing work actually goes. I would love to see the technical papers break out which components are printed and what post processing they needed.
n
## Why a series hybrid

In a series hybrid, the engine never touches the propeller. It runs a generator, the generator feeds electric motors, and the motors fly the aircraft. The engine in this system is paired with a 400 volt motor generator.

The advantage is that the engine can sit at its best operating point, the speed and load where it is most efficient and happiest, while the electric side handles everything variable: takeoff, hover, climb, maneuvering. Electric motors are very good at that variable work. Combustion engines mostly are not. For a VTOL drone, which needs a lot of power for a short time at takeoff and much less in cruise, that split makes sense to me. The engine gets sized closer to cruise and generation, and the battery and motors cover the peaks.

The cost is complexity and conversion losses. Fuel to shaft power to electricity to motor power loses something at every step. A hybrid only wins if the engine's improved operating point and the aircraft level benefits beat those losses. The Army clearly thinks they do for this mission. I would like to see the fuel consumption numbers that prove it, which brings me to the honest part of this post.

## My questions, because a flight demo is not a finished engine

- **How many hours does it last?** Rotary durability lives and dies on apex seal wear, and heavy fuel lubrication is not kind. A successful demonstration flight and a 500 hour service life are very different achievements.
- **What is the actual fuel consumption?** The whole argument for heavy fuel logistics and hybrid operation gets stronger or weaker on specific fuel consumption numbers. None are in the public article.
- **How does it start cold?** Heavy fuel and cold starts are a known painful combination, and contested environments are not famous for warm hangars.
- **What did printing do to cost and lead time at small scale?** For a lab, iteration speed is the win. For a fielded system built in the hundreds, the math changes.

None of that takes away from the result. Flying the system at all means the integration worked: fuel, sealing, cooling, generation, motors, aircraft. Integration is where programs usually go to die quietly. The follow on work mentioned in the article, including a swarm concept built around VICTOR, suggests the Army thinks the base system is real enough to build on.

## Why I am writing about it at all

Because it sits exactly on the seam between my two interests. Propulsion decides what an aircraft can do. Manufacturing decides whether the propulsion idea survives contact with reality. This program used manufacturing, specifically additive, as a design tool to make a hard propulsion problem tractable. As someone who spent a co-op making fixtures and drawings for parts that had to actually fly, that is the version of 3D printing I believe in. Not printing things because printing is cool. Printing them because the geometry, the cooling, and the iteration cycle demanded it.

If the journal papers from this program are public, I plan to dig into the combustion and sealing work next. That is where the real story is.
