---
title: "RustyUKI"
description: "I’m building a Fedora-focused tool for creating and installing Unified Kernel Images, inspired by the time modern systems spend booting before Linux starts."
date: "2026-10-24"
tags: [Linux, Fedora, Open source]
status: "Pre-release / In development"
art: code
featured: false
draft: true
sample: false
visual: dither
visualAccent: "#e58a58"
visualLabel: "Fedora · UEFI · UKI"
visualAnimate: false
---

I’m building RustyUKI as a Rust command-line tool for creating and installing Unified Kernel Images (UKIs) on Fedora-based systems. I started it because I was frustrated by how long startup could feel on computers with SSDs and NVMe drives. While investigating where that time was going, I noticed how much of the boot path happens before the Linux kernel even starts.

That led me to UKIs. After learning about them through the [official UKI specification](https://uapi-group.org/specifications/specs/unified_kernel_image/) and the [ArchWiki](https://wiki.archlinux.org/title/Unified_kernel_image), I wanted to make a Fedora-friendly way to build them and try a shorter boot path on modern UEFI systems.

## The motivation

Fast storage does not make every part of startup instantaneous. Firmware, boot managers, configuration, and the handoff to the kernel all contribute to the experience. I wanted to investigate whether removing a separate bootloader step could make sense on systems that can load a UKI directly.

A UKI is a single EFI executable that can contain the Linux kernel, initramfs, and kernel command line. That makes it possible for UEFI firmware to load the image directly, without first starting GRUB. My goal with RustyUKI is to make the Fedora-side work of creating and maintaining that image manageable, including keeping it in sync with kernel updates.

The motivation is an engineering hypothesis, not a measured result: shortening the boot chain may reduce time before the kernel starts, but actual startup time depends on the firmware, hardware, operating system, and configuration. I have not established a benchmark showing how much RustyUKI changes boot time across systems.

## What RustyUKI does

I built RustyUKI to coordinate existing Linux tools rather than replace them. It uses `dracut` to generate an initramfs and `ukify` to assemble the UKI. I’ve added CLI commands to inspect configuration, build images, register EFI boot entries, reconcile images for installed kernels, and install a `kernel-install` hook for kernel events.

I also treat changing a boot path as a recovery problem. The install flow schedules a one-time trial boot using UEFI `BootNext`, retains the existing default boot entry while the new image is being tried, and promotes the UKI after a successful boot. I want the transition to be testable before changing the permanent boot order.

## Compatibility goals and limits

My preferred path is for compatible UEFI firmware to load a UKI directly. I also want a systemd-boot path available for UEFI systems whose firmware or setup makes direct UKI boot inconvenient. That compatibility path is still a design goal. I’ve implemented EFI entry registration and `bootctl` synchronization, but I haven’t added a dedicated fallback mode for unusual firmware configurations yet.

I currently support UEFI systems only, so legacy BIOS systems are out of scope. An older motherboard is a possible target only if it supports UEFI and can boot the configured image. I need to establish compatibility on real hardware rather than infer it from age alone.

## Current status

I’m developing RustyUKI as pre-release software. So far, I’ve built a Rust CLI for UKI generation through `dracut` and `ukify`, EFI entry management, one-time trial boots, kernel reconciliation, and a `kernel-install` hook. I haven’t added Secure Boot signing or pre-built RPM packages yet. Since it changes boot configuration, I recommend keeping a recovery route available before trying it.

I haven’t validated every Fedora release, motherboard, or boot configuration. Next, I want to test compatibility and measure startup carefully: compare boot stages on representative machines, verify kernel-update behavior, and document which systems can use direct firmware boot versus a systemd-boot route.

## Project links

- [RustyUKI source code and current documentation](https://github.com/GlitchSlayed/RustyUKI)
- [Unified Kernel Image specification](https://uapi-group.org/specifications/specs/unified_kernel_image/)
- [ArchWiki: Unified kernel image](https://wiki.archlinux.org/title/Unified_kernel_image)
