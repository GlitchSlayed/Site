---
title: "GOFR: Glitchy's Opinionated Fedora Remix"
description: "A Fedora-based Linux remix exploring modern boot infrastructure, performance-oriented defaults, and a refreshed command-line experience."
category: "Operating Systems"
status: "Concept"
tags: ["Fedora", "Systemd", "Rust", "Open Source"]
date: "2026-10-24"
art: code
featured: true
draft: false
visual: dither
visualAccent: "#739cda"
visualLabel: "Fedora remix · Concept"
visualAnimate: false
---
# GOFR: Glitchy's Opinionated Fedora Remix

**GOFR** (pronounced *Gopher*) is a planned **Fedora**-based Linux distribution remix built around a relatively simple idea: take the Fedora Workstation experience I already enjoy and make a handful of opinionated changes to its underlying architecture, boot process, kernel, and command-line environment.

The goal isn't to reinvent Fedora or build an entirely new operating system. Instead, GOFR aims to preserve what makes Fedora great while experimenting with modern Linux technologies and alternative defaults that I believe could improve the overall experience.

The project is currently in its **conceptual and early planning phase**. The specifications below represent design goals rather than completed or validated features.

As a heads-up I often go by the name **Glitchy** or **GlitchSlayed** digitally, so that is where the name stems from.

---
## Project Goals

GOFR is guided by several principles:

- **Stay close to Fedora.** Preserve the familiar Fedora Workstation experience, including GNOME, Wayland, DNF5, RPM packaging, and Fedora's existing system infrastructure.
- **Modernize the boot process.** Explore systemd-boot and Unified Kernel Images (UKIs) as an alternative to the traditional GRUB-based boot configuration.
- **Explore performance-oriented defaults.** Integrate the CachyOS kernel while preserving Fedora's compatibility and maintainability.
- **Improve the command-line experience.** Experiment with newer tools such as Brush, zoxide, and uutils coreutils.
- **Minimize unnecessary changes.** Avoid excessive customization, redundant components, or changes made solely for aesthetic reasons.
- **Remain maintainable.** Prioritize standard packaging, reliable updates, and upstream compatibility over fragile custom scripts.

---

## Planned Architecture

| Component | Planned GOFR Default |
|---|---|
| Base distribution | Fedora Workstation |
| Desktop environment | GNOME / Wayland |
| Package management | DNF5 / RPM |
| Kernel | CachyOS kernel via Fedora COPR |
| Bootloader | systemd-boot |
| Boot format | Unified Kernel Images |
| EFI System Partition | 4 GiB |
| Root filesystem | Btrfs |
| Swap | zram |
| Third-party repositories | RPM Fusion Free & Nonfree |
| Default user shell | Brush |
| Directory navigation | zoxide |
| User-facing core utilities | uutils, where compatible |
| Security | SELinux enforcing; planned Secure Boot support |
| Initial platform | x86_64 UEFI |

---

### 1. Fedora as the Foundation

Fedora Workstation is the foundation of GOFR because it already provides a modern, well-maintained Linux environment without requiring extensive modification.

GOFR intends to retain Fedora's existing desktop stack, package management, security policies, and update infrastructure.

The intention is for GOFR to feel like Fedora, not an entirely different operating system.

### 2. Modern Boot Infrastructure

One of GOFR's most significant planned changes is replacing GRUB with **systemd-boot** and using **Unified Kernel Images (UKIs)**.

A UKI combines the kernel, initramfs, and associated boot information into a single EFI executable, offering a more integrated approach to Linux boot management.

The intended boot sequence is:

`UEFI → systemd-boot → UKI → CachyOS Kernel → Fedora Userspace`

GOFR also proposes a 4 GiB EFI System Partition to accommodate multiple kernel images, updates, and recovery options.

A central engineering challenge will be ensuring that kernel installation, updates, removal, and fallback behavior work reliably without manual intervention.

### 3. CachyOS Kernel Integration

GOFR plans to use the CachyOS kernel through its Fedora COPR packaging.

The motivation is to explore alternative kernel configurations, scheduler behavior, and performance-oriented optimizations while retaining Fedora as the underlying operating system.

The project will need to evaluate:

- Compatibility with supported Fedora releases.
- Hardware requirements and CPU architecture support.
- Integration with systemd's kernel installation mechanisms.
- Automatic UKI generation during kernel updates.
- Reliable recovery when an update fails.
- Real-world performance differences compared with Fedora's stock kernel.

The objective is not to assume that an alternative kernel is universally faster, but to determine whether its design and configuration offer worthwhile benefits.

### 4. A Modern Command-Line Environment

GOFR also experiments with a newer collection of command-line tools.

**Brush** is a Rust-based shell aiming for Bash compatibility. It is planned as the default interactive and login shell for newly created users, while Bash remains available for system compatibility.

**zoxide** provides smarter directory navigation by learning frequently visited locations.

**uutils coreutils** is a Rust implementation of traditional Unix core utilities. GOFR aims to make these tools available and potentially prefer them for interactive use without compromising system scripts that depend on GNU coreutils.

Together, these tools represent an opportunity to explore newer implementations of familiar Linux components without unnecessarily disrupting the existing system.

### 5. Repository and Software Defaults

GOFR plans to enable RPM Fusion Free and Nonfree by default, simplifying access to software that Fedora does not include in its standard repositories.

This decision introduces additional considerations involving redistribution, package signing, licensing, and repository trust, all of which will need to be addressed before publishing installable images.

## Development Roadmap

The roadmap is provisional and may change as technical limitations and design decisions become clearer.

- [ ] **Phase 1: Research and Architecture:** Validate upstream dependencies, select image-building tools, and finalize major architectural decisions.
- [ ] **Phase 2: Configuration and Packaging:** Develop GOFR-specific RPM packages for system defaults, boot configuration, and integration.
- [ ] **Phase 3: Virtual Machine Prototype:** Build an initial disk image and validate systemd-boot, UKIs, and the CachyOS kernel.
- [ ] **Phase 4: Installable ISO:** Produce an installable Fedora-based ISO with the intended defaults.
- [ ] **Phase 5: Automated Testing:** Validate installation, boot behavior, package updates, kernel lifecycle, and recovery.
- [ ] **Phase 6: Release Infrastructure:** Establish reproducible build procedures, GitHub Actions, documentation, and versioned development releases.

## Technical Challenges

Several aspects of GOFR require additional research before implementation.

**Kernel and UKI lifecycle:** Kernel updates must reliably generate new bootable UKIs while retaining an appropriate fallback.

**Installer integration:** Fedora's installation tooling must be adapted to support the intended partition layout and installed-system boot configuration.

**Shell compatibility:** Brush needs to work reliably as a login shell without interfering with system components that expect Bash.

**Coreutils compatibility:** Rust-based replacements must be introduced without breaking system utilities or package-management operations.

**Secure Boot:** Signing, key management, and firmware trust enrollment require a practical design before Secure Boot can be supported.

**Redistribution:** GOFR must account for Fedora branding requirements, third-party repository licensing, and software redistribution policies.

## Current Status

**Conceptual / Planning**

GOFR currently exists as a defined concept and proposed technical architecture. Its core design goals and initial implementation requirements have been outlined, but no completed distribution image or validated release is being claimed.

The immediate priority is moving from architecture planning to a working virtual machine prototype.

## Long-Term Vision

The ideal end result is a small, maintainable Fedora remix that remains close to upstream Fedora while providing an alternative set of modern system defaults.

Even if GOFR never grows beyond a personal project, the development process offers an opportunity to learn more about Linux distribution engineering, RPM packaging, bootloaders, systemd, kernel integration, image building, and automated testing.

For now, GOFR is an experiment in what a slightly more opinionated Fedora could look like.
