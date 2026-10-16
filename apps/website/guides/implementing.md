# Implementing OCF

This page is the view from above: how much of OCF your app needs, and where the engine should run.
The other guides cover each part in depth; this one says which parts you need and in what order.

## Adopt it in levels

OCF covers everything from a static stat block to a virtual tabletop's attack resolution, but no
app needs all of it on day one. Each level below builds on the one before, and each is a complete,
useful app on its own. Most apps get real value at level 2 or 3.

| Level                      | Your app                                                                     | Engine calls                    |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| **1. Read-only sheet**     | Loads packs, computes a character, shows every value and where it came from  | `loadRuleset`, `computeSheet`   |
| **2. Editable form**       | Turns the pack's input fields into a form and sends edits back as changes    | `applyChanges`                  |
| **3. Content and choices** | Adds items and features, levels up, asks pending choices, creates characters | `listOptions`                   |
| **4. Live rules**          | Turns conditions and spells on and off, shows competing options and issues   | the same calls, more output     |
| **5. Rolls and actions**   | Runs attacks and checks, pausing for your own dice and animation             | `startAction`, `continueAction` |
| **6. Many characters**     | Targets, helpers, monsters, linked sheets such as a FitD crew                | actions with participants       |
| **7. Lifecycle**           | Pins pack versions, adds homebrew, upgrades saved characters                 | `upgrade`                       |

### 1. Read-only sheet

Load the packs a character uses into a ruleset, compute the character, and render the values. Each
value comes with a breakdown, so even a read-only sheet can answer "why is my AC 17?". An app that
only displays characters, such as a campaign wiki or a stat-block viewer, can stop here.

Read: [Quick start](quick-start.md), [Packs and rulesets](packs-and-rulesets.md),
[Showing a sheet](showing-a-sheet.md).

### 2. Editable form

The form comes from the ruleset, not from the character file. The pack marks which fields are
inputs (ability scores, hit points spent, a name) and gives each one a type and a range; its display
hints group and order them. An edit becomes a `set` or `adjust` change, and `applyChanges` checks it
against the rules before you save. Because the form is built from data, the same code edits a
character from any game.

Read: [Storing characters](storing-characters.md), [Changing characters](changing-characters.md),
[Laying out the sheet](showing-a-sheet.md#laying-out-the-sheet).

### 3. Content and choices

Characters own content (classes, spells, gear) and make choices (a fighting style, two skills). The
sheet lists the choices still pending; `listOptions` says which options are eligible and which one
the rules recommend. Character creation is the same thing from an empty character: a guided start
that asks each question, or a random start that takes the recommendations.

Read: [Building characters](building-characters.md).

### 4. Live rules

Temporary effects (Bless, Poisoned, raging) are content your app turns on and off; the engine
applies their effects and never tracks time. The sheet also reports competing options, such as two
ways to compute armor class, and rules issues, such as a score above its maximum, for your app to
show or resolve.

Read: [Effects](showing-a-sheet.md#effects), [Temporary effects](changing-characters.md#temporary-effects),
[Rules issues](showing-a-sheet.md#rules-issues).

### 5. Rolls and actions

`computeSheet` lists the actions a character can take now. `startAction` builds the roll and
either rolls it or pauses for your app to roll: animate the dice, then hand back what they landed
on with `continueAction`. The result is an outcome (hit, miss, partial success) and the changes it
proposes, which your app applies.

Read: [Rolling dice](rolling-dice.md), [Showing text](showing-text.md).

### 6. Many characters

An attack has a target, a group action has helpers, and a FitD crew is a sheet linked to its
scoundrels. Other characters take part as participants, and the changes an action proposes say
which character they're for.

Read: [Other characters](other-characters.md).

### 7. Lifecycle

Packs are versioned. Pin the versions each character or campaign uses, cache the ruleset per set
of versions, and upgrade saved characters when you move to a new pack version. Homebrew is another
pack, loaded beside the official ones, or kept inside a single character.

Read: [Packs and rulesets](packs-and-rulesets.md), [Upgrading characters](upgrading-characters.md),
[Custom content](storing-characters.md#custom-content-homebrew).

## Where the engine runs

The engine is a library with no runtime dependencies, so it runs wherever your code does. Where you
put it decides who is trusted and how characters sync.

| Shape           | The engine runs       | Good for                                        | Watch for                                       |
| --------------- | --------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **Client only** | In the browser or app | Offline, local-first and single-player apps     | Players can edit their own files; sync is yours |
| **Server only** | On your server        | Shared campaigns, multiplayer, a trusted record | Every change is a round trip                    |
| **Hybrid**      | In both               | Instant previews with a trusted record          | Both sides must load the same pack versions     |

Whatever the shape, the loop is the same: the character file is the only state you save, every
change goes through `applyChanges`, and everything shown comes from `computeSheet`.

Not writing JavaScript? Embed the reference engine, run it as a local service, or port it: see
[Apps not written in JavaScript](other-languages.md).

## A worked example: Realms of Shod

[Realms of Shod](https://realmsofshod.com), a campaign app for groups, attaches OCF character sheets
to the characters in a realm. It runs the engine on the server only:

- **Packs are pinned per realm.** A realm chooses its games, and the server pins each pack's
  version. Loaded rulesets are cached by those versions, so loading happens once per set.
- **The character file is a database row.** Each sheet is stored as JSON beside a version number.
  A save succeeds only if nobody saved since the sheet was read, and every other member of the
  realm is told the sheet changed.
- **App data stays in the file.** Realms of Shod keeps its own settings for a sheet under
  `extensions`, so the file stays a valid OCF character that any other app can read.
- **The server sends a view, not engine output.** After each call the server turns the engine's
  output into a ready-to-render view, text included. The browser renders it and sends back small
  requests: set this value, add this item, roll this action, answer this creation step.
- **The browser never loads the engine.** API routes cover the sheet, its changes, rolls,
  character creation and the content catalog; each one loads the ruleset, calls the engine, saves
  and returns the new view.

The result is a sheet every player in the realm sees the same way, with the rules enforced in one
place.

## Next

- [Packs and rulesets](packs-and-rulesets.md): level 1 in depth, starting with getting packs.
- [Two kinds of app](README.md#two-kinds-of-app): building for one game or for any game.
