---
title: "AirDrop on GNOME: Building airdrop-gnome, Still Very WIP"
description: "Why I am building a GNOME Shell extension for real AirDrop transfers, what owlyd actually does, and the walls I keep hitting, most of them wearing an Intel badge."
date: 2026-11-02
tags: ["Linux", "GNOME", "Rust", "Open Source", "Projects"]
sample: false
featured: false
---

# AirDrop on GNOME: Building airdrop-gnome, Still Very WIP

## The itch

My daily driver is Fedora with GNOME. My phone is an iPhone. Those two facts get along fine right up until I want to move a photo, a PDF, or a screenshot from one to the other, at which point I am suddenly emailing files to myself like it is 2009.

There are good tools for this. Warpinator and LocalSend both work. But neither of them speaks AirDrop, which means the iPhone cannot just see my laptop in the share sheet the way it sees every other Apple device. AirDrop is not a file format or a network share. It is its own protocol stack, built on Apple's AWDL radio protocol, and if you want a Linux machine to show up as a real AirDrop target, something has to do the unglamorous work of speaking AWDL.

That something already exists. It is called [Owly](https://github.com/t4t5/owly), by t4t5, and it handles the radio layer on Linux. What it does not have is a GNOME-native face. So I started building one: **airdrop-gnome**, a GNOME Shell extension that puts AirDrop in Quick Settings, where it belongs. The repo is a day old as I write this. This post is a status report, not a launch announcement.

## What I am building

The project has three pieces:

1. **The GNOME Shell extension** (TypeScript, compiled to GJS). A Quick Settings tile and menu that lists nearby Apple devices, sends files through the native file picker, and asks before accepting anything incoming.
2. **airdrop-bridge**, a small Rust daemon I am writing that runs in the user session. It holds the radio lease, wraps the `owly` command line tool for discovery and transfers, runs the state machines, and exposes a clean D-Bus interface to the extension.
3. **Owly itself**, upstream and unmodified. I made an early decision to build a bridge instead of forking Owly, and I wrote that decision down in the repo as an architecture record. Forking would mean owning a radio stack. I have classes.

Receiving has three modes, because discoverability is a privacy choice, not a default: Off, Everyone for 10 Minutes, and Always On. Even in Always On, every incoming transfer still needs an explicit accept from me. That part is not negotiable.

## What owlyd is, and what it does

Owly ships two components, and the split matters.

**owlyd** is a privileged system service. It runs as root with network admin capabilities and owns the Wi-Fi radio. When something asks it for access, it creates the `awdl0` network interface, puts the card on the right channel, and tracks AWDL peers. It hands out leases, and when the process holding a lease exits, the radio is released automatically. Think of it as the building manager for the radio. It decides who gets the room and for how long.

**The owly CLI** is the unprivileged half. It takes a lease from owlyd, then does the actual AirDrop work in user space over `awdl0`: mDNS discovery, the AirDrop HTTP endpoints, the transfers themselves.

Here is the part that shaped my whole design: owlyd does no discovery, no transfers, and no UI. It is radio only. So my bridge sits between the two worlds, talking to owlyd on the system bus, spawning the owly CLI for transfers, and serving the extension on the session bus. Three processes, two D-Bus buses, one radio.

## The walls

**Wall one: my Wi-Fi card.** My laptop has an Intel AX200, and on Intel cards Owly runs in what is called exclusive mode. When the AirDrop radio is active, the card sits on channel 6 doing AWDL, and it is not doing anything else. Normal Wi-Fi disconnects. Open the AirDrop window, lose your internet, finish the transfer, get your internet back. That is not a bug in my code. It is the hardware and driver reality, and the honest response is to design around it: ask for explicit consent before taking the adapter, scope that consent to the card and mode, and restore Wi-Fi reliably when the lease ends. Some MediaTek and Realtek cards can run in a shared mode. Intel cannot, at least not today. This is the single biggest restriction on the whole project, and it is not mine to fix.

**Wall two: GNOME Shell is a strict landlord.** Extensions are not allowed to block the shell thread, do network work, or touch files directly from the UI process. Everything has to be asynchronous D-Bus calls to a backend. That is a good rule. It is also why the bridge exists at all instead of the extension just calling owly itself.

**Wall three: testing hurts.** Every real hardware test on my machine means disconnecting my own Wi-Fi on purpose. So there is a mock mode, turned on with `AIRDROP_MOCK=1`, that fakes the backend so I can work on the UI without sawing off the branch I am sitting on. The repo also has a D-Bus contract test suite, because with three processes involved, "it worked once" is not evidence.

**Wall four: scope.** This targets Fedora and Ubuntu with GNOME Shell 50 and 51, and a pinned Owly version (0.4.2). Packaging, firewall rules on the `awdl0` interface, and SELinux all still have to be validated properly before anyone should call this a beta.

## Where it stands

Honest status: work in progress, early. The bridge and the extension exist, the D-Bus contract between them is defined and tested, receiving modes and incoming approval are designed in, and the architecture decision is written down. What is not done is the long tail: sustained hardware testing, packaging for Fedora and Ubuntu, and the hardening pass. My own milestone list in the repo runs from a backend contract all the way to release gates, and I am at the front of it, not the end.

If you run GNOME on an Intel Wi-Fi card and this still sounds worth it, that probably means the itch is real for you too. The repo is public: [Gnome-Airdrop](https://github.com/GlitchSlayed/Gnome-Airdrop). Mock mode means you can kick the tires without losing your Wi-Fi. Yet.
