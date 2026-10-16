# Building an app with OCF

These guides are for people building apps that use OCF characters: a VTT, a character builder,
a campaign manager, a Discord bot, a game server. They explain how to load packs, store a
character, show a sheet, change it, roll for it and upgrade it, using the reference engine.

The [specification](../../../packages/spec/docs/README.md) defines the formats and the engine
calls for people implementing them. These guides cover using them. When a guide and the spec
disagree, the spec wins.

> Parts of the engine interface marked PROVISIONAL in the spec may still change.

## Your app doesn't implement the rules

The most important idea in OCF is the split between the engine and your app:

**The engine knows the rules. The app owns the experience.**

You never write a game's math. Your app doesn't know that a 5E Strength modifier is
`floor((score - 10) / 2)`, that Mage Armor competes with Unarmored Defense, or that a FitD
roll of 6 is a full success. The packs say that, and the engine works it out. Your app asks the
engine questions and shows the answers.

| The engine does                                                  | Your app does                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Computes every value, with a breakdown of where it came from     | Stores characters, however it likes                                   |
| Says which choices are pending and which options are eligible    | Decides whether to ask the player or pick the recommended one         |
| Applies changes, checking them against the rules                 | Decides who may change what, and when                                 |
| Builds rolls, does the dice math, proposes the resulting changes | Decides who rolls the dice and how they look, and applies the changes |
| Upgrades saved characters to new pack versions                   | Decides when to upgrade, and shows the player what changed            |
| Returns keys, codes and data                                     | Turns them into text in the player's language                         |
| Never tracks time                                                | Turns temporary effects (Bless, Poisoned) on and off                  |

So "implementing characters" in your app means four things: storing a file, calling the engine,
rendering what it returns, and routing changes back through it.

## The loop

Almost every OCF app runs the same loop:

<div class="ocf-diagram">
<svg class="ocf-loop" viewBox="0 0 720 400" role="img" aria-labelledby="ocf-loop-title">
<title id="ocf-loop-title">The OCF loop: packs load into a ruleset once; computeSheet turns the character file into a sheet; your UI renders it; the player's edits, picks and rolls become changes; applyChanges writes them into a new character file.</title>
<defs><marker id="ocf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<rect class="box" x="20" y="20" width="150" height="56" rx="10"/>
<text class="name" x="95" y="54" text-anchor="middle">Packs</text>
<line class="flow" x1="170" y1="48" x2="268" y2="48" marker-end="url(#ocf-arrow)"/>
<text class="call" x="219" y="38" text-anchor="middle">loadRuleset</text>
<rect class="box" x="270" y="20" width="180" height="56" rx="10"/>
<text class="name" x="360" y="44" text-anchor="middle">Ruleset</text>
<text class="note" x="360" y="64" text-anchor="middle">loaded once, cached</text>
<line class="flow dashed" x1="360" y1="76" x2="360" y2="168" marker-end="url(#ocf-arrow)"/>
<text class="note" x="372" y="128">every call uses it</text>
<rect class="box key" x="20" y="150" width="200" height="64" rx="10"/>
<text class="name" x="120" y="178" text-anchor="middle">Character file</text>
<text class="note" x="120" y="199" text-anchor="middle">inputs, items, picks</text>
<line class="flow" x1="220" y1="182" x2="498" y2="182" marker-end="url(#ocf-arrow)"/>
<text class="call" x="290" y="202" text-anchor="middle">computeSheet</text>
<rect class="box" x="500" y="150" width="200" height="64" rx="10"/>
<text class="name" x="600" y="178" text-anchor="middle">Sheet</text>
<text class="note" x="600" y="199" text-anchor="middle">values, actions, choices</text>
<line class="flow" x1="600" y1="214" x2="600" y2="308" marker-end="url(#ocf-arrow)"/>
<text class="note" x="612" y="266">render</text>
<rect class="box" x="500" y="310" width="200" height="64" rx="10"/>
<text class="name" x="600" y="338" text-anchor="middle">Your UI</text>
<text class="note" x="600" y="359" text-anchor="middle">the player acts</text>
<line class="flow" x1="500" y1="342" x2="222" y2="342" marker-end="url(#ocf-arrow)"/>
<text class="note" x="361" y="332" text-anchor="middle">edits, picks and rolls</text>
<text class="call" x="361" y="362" text-anchor="middle">startAction · continueAction</text>
<rect class="box" x="20" y="310" width="200" height="64" rx="10"/>
<text class="name" x="120" y="338" text-anchor="middle">Changes</text>
<text class="note" x="120" y="359" text-anchor="middle">checked against the rules</text>
<line class="flow" x1="120" y1="310" x2="120" y2="216" marker-end="url(#ocf-arrow)"/>
<text class="call" x="132" y="260">applyChanges</text>
<text class="note" x="132" y="278">then save</text>
</svg>
</div>

1. Load the packs a character uses into a **ruleset**, once.
2. Call **`computeSheet`** and render the result.
3. When the player does something, turn it into **changes** (or run an **action**, which
   proposes changes) and call **`applyChanges`**.
4. Save the new character file and go back to step 2.

The character file only ever holds base state: the inputs, owned items and picks. Everything
your UI shows comes from `computeSheet`, so the sheet can never disagree with the rules.

## The guides

Read them in order the first time.

### Start here

- **[Quick start](quick-start.md):** load a pack, compute a sheet, apply a change, in about
  twenty lines.
- **[Implementing OCF](implementing.md):** the view from above: how much of OCF your app needs,
  level by level, and where the engine runs, with Realms of Shod as a worked example.
- **[Apps not written in JavaScript](other-languages.md):** ports, the test suite, and running
  the reference engine from another language.

### Showing characters

- **[Packs and rulesets](packs-and-rulesets.md):** where packs come from, load order, homebrew,
  pinned versions and caching.
- **[Storing characters](storing-characters.md):** the character file, IDs, your own data in
  `extensions`, change logs, undo and sync.
- **[Showing a sheet](showing-a-sheet.md):** reading `computeSheet`, breakdowns, display hints,
  competing options and rules issues.
- **[Text and translation](text-and-translation.md):** turning keys and codes into text in the
  player's language.
- **[Showing text](showing-text.md):** a helper that turns engine output into finished text:
  prompts, options, issues, rolls and dice.

### Changing characters

- **[Changing characters](changing-characters.md):** the change types, errors and rules issues,
  strict mode, damage and resistance.
- **[Building characters](building-characters.md):** character creation, choices,
  `listOptions`, level-ups and items.
- **[Upgrading characters](upgrading-characters.md):** moving a character to a new pack version
  and showing what changed.

### Playing

- **[Rolling dice](rolling-dice.md):** actions, checkpoint policies, your own dice, paused
  actions and logs.
- **[Other characters](other-characters.md):** attacks on a target, monsters and NPCs, effects
  cast by one character on another, linked sheets such as a FitD crew.

## Two kinds of app

- **A game-specific app** (a 5E builder) can refer to fields and content by ID:
  `5e-srd-5.1:combat.ac`, `5e-srd-5.1:classes.fighter`. IDs are permanent and never reused,
  so this is safe. Hand-design the sheet and let the engine fill it in.
- **An any-game app** (a VTT) can't know any IDs ahead of time. It builds its sheet from the
  pack's [display hints](showing-a-sheet.md#laying-out-the-sheet) and its actions and choices
  from what `computeSheet` lists. This is more work up front, and any pack works afterwards,
  homebrew included.

Most apps end up in between: a hand-designed sheet for the games they care about most, and a
generic one for the rest.
