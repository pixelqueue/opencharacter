# Upgrading characters

A character pins the exact versions of its packs. When a pack publishes a new version, nothing
happens to existing characters until **your app** decides to upgrade them. This page covers when
and how.

## Most updates need nothing

Only base state is saved, so most new pack versions (a fixed formula, a corrected item, new
content, better display hints) need no upgrade work at all. The character's saved state means the
same thing under the new version; only the computed sheet changes.

Some updates do change what saved state means: an item renamed or removed, a choice split in two
or removed, a state key moved from a copy to one of its picks or granted content, a new required
choice. Those versions have a **breaking** version bump (the minor version while a pack is 0.x, such
as 0.1.4 → 0.2.0; the major version from 1.0.0, such as 1.4.2 → 2.0.0) and ship an
**upgrade script**, written by the pack's author, that moves characters across. The pack build
refuses to release such a version without one, so your app never has to work out what a change
meant.

Upgrade scripts are data in the pack release, not code. A pack's latest release carries all of
its scripts, so any older pinned version can be upgraded from it. Their steps (`renameContent`,
`removeChoice`, `moveState`, `removeState`, …, with `item` to narrow a state step to one item and
an owner path for a choice nested in an inline option) are listed in the spec's
[upgrade scripts](../../../packages/spec/docs/upgrades.md#upgrade-scripts).

## The `upgrade` call

```ts
const result = upgrade(oldRuleset, newRuleset, character);
if (result.ok) {
  showReport(result.report); // let the player review
  if (playerAccepts) {
    character = result.character; // now pins the new versions
    askAbout(result.pending); // new required choices, if any
  }
} else {
  // result.errors: unknown-id (a pinned pack isn't in the new ruleset), no-upgrade-path,
  // homebrew-error (the character's homebrew doesn't load on the old ruleset)
}
```

- **`oldRuleset`** is the ruleset the character was saved with: its pinned versions. That's one
  reason to keep old pack releases around ([Packs and rulesets](packs-and-rulesets.md#which-packs-a-character-uses)).
- **`newRuleset`** is the ruleset to move to. Every pack the character pins must be in it; packs
  the character doesn't use are ignored.
- For each pack, the engine chains the upgrade scripts one version at a time (1.2 → 1.3 → 2.0),
  skipping versions that changed nothing.

Upgrading is deterministic and **never asks the player anything**. New required choices come back
in `pending`, for your app to put to the player the usual way
([Building characters](building-characters.md#pending-choices)).

## The "what changed" report

The engine computes the character under both versions and reports the differences:

```json
"report": {
  "values": [
    { "field": "5e-srd-5.1:combat.ac", "before": 16, "after": 17 }
  ],
  "steps": [
    { "pack": "5e-srd-5.1", "from": "0.2.1", "to": "0.3.0",
      "step": { "op": "renameContent", "from": "feats.sharpshooter", "to": "feats.sharp-shooter" } }
  ],
  "homebrew": [],
  "errors": []
}
```

- **`values`**: every field whose value changed, with `before` and `after`. A field that exists on
  one side only has only one of them.
- **`steps`**: each upgrade step that changed this character, and the script it came from. A
  `moveState` may drop a value instead of moving it (the target pick or grant is missing, the
  value equals the target's default, or the target already has one); that's listed as a step too.
- **`homebrew`**: each place in the character's homebrew a step rewrote, as `{ path, step }`
  (`path` a JSON Pointer into the upgraded character).
- **`errors`**: anything in the upgraded character that still doesn't resolve (a reference no
  script handled). Show these; the character still computes without the broken part. Homebrew
  that no longer loads on the new ruleset is `homebrew-error`; the upgraded character still comes
  back, so the player can fix the custom content with a `setHomebrew` change
  ([Changing characters](changing-characters.md)).

Show the report before the player accepts: "Armor Class 16 → 17; Sharpshooter renamed to Sharp
Shooter". Name fields and content with their translated names.

## When to upgrade

That's an app decision, and different apps choose differently:

- **Ask the player.** Show "update available" with the report, and upgrade on accept. Good for
  personal characters.
- **Upgrade the campaign.** The GM moves the campaign to new pack versions, and every character in
  it is upgraded together, so the table plays by the same rules.
- **Never, for finished things.** A character from a completed campaign can stay pinned forever.
  It keeps computing exactly as it did.

Since `upgrade` doesn't change anything until you save its result, you can also run it just to
preview what an update would do.

## Next

- [Apps not written in JavaScript](other-languages.md).
