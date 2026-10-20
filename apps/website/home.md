---
title: Open Character Format
description: OCF is an open, community-maintained format for tabletop RPG character data. Packs hold the rules for 5E, orc-2e and more; an open engine computes sheets for any app or VTT.
template: splash
hero:
  tagline: An open format for tabletop RPG characters that any VTT or app can read. A published spec, a shared test suite, a reference engine, and content packs.
  actions:
    - text: Quick start
      link: guides/quick-start/
      icon: right-arrow
    - text: Build an app with OCF
      link: guides/
      variant: secondary
    - text: Read the specification
      link: spec/
      variant: secondary
---

<div class="ocf-section">

## The engine knows the rules. The app owns the experience.

The engine works out what the game's rules say: which fields change, what needs rolling, which
options exist, and which one the rules recommend. The app decides everything the player sees and
does: how dice are rolled, how time passes, whether a choice is made automatically or put to the
player, and how it all looks.

</div>

<div class="ocf-section ocf-why">

## Why OCF

### For app builders

- **Take it anywhere.** Packs, homebrew content and characters move freely between every app
  that implements OCF: export from one, import into another, in an open format the community
  owns.
- **Never write a game's math.** Load a pack, call `computeSheet`, and every value on the sheet
  comes back with a breakdown of where it came from.
- **One integration, every game.** A growing list of games, from 5E and Second Edition fantasy and
  science-fantasy to Forged in the Dark, Fate, MÖRK BORG, Mothership, Godbound and the Without
  Number games, all run through the same engine calls.
- **Homebrew is a pack, not a fork.** A homebrew weapon or class loads beside the official
  packs, and queries pick it up without anyone editing the originals.
- **The sheet can't disagree with the rules.** A character file holds only the player's
  choices, and everything else is computed.
- **Your dice, your UI.** The engine says what to roll and what changes, and pauses mid-action
  while your app animates the dice and hands back what they landed on.
- **Old characters upgrade themselves.** Versioned packs ship upgrade scripts, so a character
  saved last year still loads after the rules change.
- **Fully internationalized.** The engine returns keys and codes, never English, and every
  pack's text lives in translation files, so your app speaks any language.

### For pack authors and engine builders

- **Model your favorite game in YAML.** A class, spell or playbook is a short data file that can
  live anywhere, checked by the published JSON Schemas and by the engine when it loads.
- **The test suite is the contract.** Plain-data conformance cases define correct behavior for
  every engine call, so a port knows exactly when it's done.
- **Bring your own language.** OCF ships a TypeScript reference engine, and the spec, JSON
  Schemas and test suite are language-neutral, so anyone can build an engine in Rust, Python,
  Go or anything else.
- **Already in use.** Realms of Shod builds its character sheets on the OCF engine today.

</div>

{/* ecosystem */}

<div class="ocf-section">

## What's here

- **[Guides](guides/):** how to use OCF characters in your own app: loading packs, storing
  characters, showing a sheet, changes, choices, dice and upgrades.
- **[The specification](spec/):** pack and character formats, the formula language, effects,
  dice and actions, and the engine calls, for anyone implementing OCF.
- **JSON Schemas** for every file format and engine call, at [`schemas/0.1/`](schemas/0.1/pack.schema.json).
- **A shared conformance test suite:** plain-data cases any port can run.

</div>
