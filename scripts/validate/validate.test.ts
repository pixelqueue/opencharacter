import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateRepo } from './index.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const broken = fileURLToPath(new URL('./fixtures/broken', import.meta.url));
const unused = (key: string) => `translation key "${key}" does not belong to anything in this pack`;

describe('pnpm validate', () => {
  it('passes on the repository packs and example characters', () => {
    const { reporter, packs, characters } = validateRepo(repoRoot);
    expect(reporter.errors).toEqual([]);
    expect(packs).toEqual([
      '5e-srd-5.1',
      'divine-heroes-core',
      'fate-core',
      'fitd-crew',
      'fitd-scoundrel',
      'mork-borg-core',
      'mothership-1e',
      'orc-2e',
      'wn-cyber',
      'wn-fantasy',
      'wn-scifi',
      'wn-apocalypse',
    ]);
    expect(characters.length).toBeGreaterThanOrEqual(5);
    // A first run parses every pack file: seconds, more on a busy machine.
  }, 30_000);

  describe('on a broken pack', () => {
    const { reporter } = validateRepo(broken, {
      packs: `${broken}/packs`,
      characters: `${broken}/characters`,
    });
    const messages = reporter.errors.map((e) => e.message);
    const expectError = (pattern: RegExp) =>
      expect(
        messages.some((m) => pattern.test(m)),
        `no error matching ${pattern}:\n${messages.join('\n')}`,
      ).toBe(true);

    it.each([
      ['a CC-BY pack without a credit line', /must have required property 'credit'/],
      ['a pack ID that does not follow its folders', /pack id "broken" must be "test-broken"/],
      [
        'an id that does not match its path',
        /id "weapons.mace" must match its path \("weapons.club"\)/,
      ],
      ['an item field the content type does not declare', /field "weight" is not declared/],
      [
        "a grant's state key the granted item doesn't declare",
        /grant of "tricks.hop" sets state key "shots", which it doesn't declare/,
      ],
      ['a missing required item field', /missing required field "damage"/],
      ['an effect on an unknown field', /unknown target field "combat.armor"/],
      ['an op that cannot target rolls', /op "multiply" cannot target rolls/],
      [
        'a formula naming an unknown field',
        /unknown-name: "abilities.strength.score" is not a bound root or a visible field/,
      ],
      ['a formula calling an unknown function', /unknown-function: unknown function clamp\(\)/],
      ['fields that depend on each other in a loop', /circular-formula: .*cyc\.a/],
      [
        'a field ID that starts with a context root',
        /field IDs cannot start with the context root "self"/,
      ],
      ['a typo in an item field (typed item root)', /unknown-name: "item\.damge" names nothing/],
      ['a typo in a step ID (typed steps root)', /unknown-name: "steps\.hitt" names nothing/],
      ['suppressing an effect the content type does not have', /suppress names "nope"/],
      ['a slot keyed like another choice', /duplicate choice id "perk-2"/],
      [
        "an exclusivity group of a pack that isn't a dependency",
        /exclusivity group "other-pack:knacks" names a pack that isn't this one or a dependency/,
      ],
      ['a pick under a slot the choice does not list', /choices\.perk-3: no such choice here/],
      ['an item field default naming an unknown field', /default: unknown field "skills\.nope"/],
      ['an item field default not of its enum', /grade default: expected one of plain, fine/],
      [
        'a template field the template may not set',
        /field "sharpness" is neither a template field nor a field of "weapon"/,
      ],
      ['a template field default not of its enum', /rarity default: expected one of common, rare/],
      ['a typo in a template field formula', /unknown-name: "base\.damag" names nothing/],
      ['a proposed addItem of unknown content', /unknown content "weapons\.nope"/],
      ['an entry object on a change other than addItem', /entry object is only for addItem/],
      ['copies on a change that is not per copy', /copies is only for per-copy changes/],
      ['copies of an unknown content type', /unknown content type "gadget"/],
      [
        'entry: picked outside a choice step over copies',
        /entry: picked is only for the changes of a choice step over copies/,
      ],
      ['an adjustQuantity without by', /adjustQuantity needs a by/],
      [
        'a quantity that is not an integer',
        /formula 1\.5: type-mismatch: is decimal, expected int/,
      ],
      [
        'a state default formula with a typo',
        /state ammo default: formula "item\.magazinee": unknown-name/,
      ],
      [
        'a passed-on where that reads a map',
        /formula "steps\.hit != null": type-mismatch: "steps\.hit" is a map/,
      ],
      ['a state bound with a typo', /state charge max: formula "item\.chargee": unknown-name/],
      ['a computed value reusing a state key', /computed value "ammo" reuses a state key/],
      [
        'a computed value reusing a core property',
        /computed value "equipped" reuses a core property/,
      ],
      [
        'where on a parameter that is not a field or content parameter',
        /param who: where is only for field and content parameters/,
      ],
      ['a field parameter that allows no field', /param stat allows no field/],
      ['ifEmpty on a part without dice', /ifEmpty is only for dice parts/],
      [
        'an upgrade script whose versions are not in order',
        /upgrade script: from 0\.0\.1 must be below to 0\.0\.1/,
      ],
      [
        'an upgrade step naming a field the pack lacks',
        /renameField: "abilities\.nope" is not an input field/,
      ],
      [
        'a reserved word in a field ID',
        /"loop" is a reserved word and cannot be part of a field ID/,
      ],
      [
        'a formula of the wrong type',
        /field check\.cond: formula "abilities\.str\.score": type-mismatch: is int, expected bool/,
      ],
      ['a context root used where it is not bound', /unknown-name: "steps\.attack\.total"/],
      ['an undeclared tag', /unknown-tag: "attack" is not declared/],
      ['an undeclared tag in members', /field resists members: unknown-tag: "fire"/],
      ['a default outside members', /field resists default: "melee.blunt" is not one of/],
      ['a saved parent tag outside members', /values.broken:resists: "melee" is not one of/],
      ['a saved excepted tag', /values.broken:resists: "melee.blunt" is not one of/],
      ['tags on an effect that adds no roll item', /tags are only for add effects on rolls/],
      ['multiplied on an effect on a field', /\/effects\/0\/target must be object/],
      [
        'absorbedBy on a derived field',
        /absorbedBy and overflow are only for numeric input fields/,
      ],
      ['absorbedBy naming an unknown field', /absorbedBy names unknown field "hp.missing"/],
      ['a split naming a step that is not a roll', /split names "nope", which is not a roll step/],
      [
        'an activation condition reading a derived field',
        /grant: formula "combat.ac > 10": unknown-name: .*can read only input fields/,
      ],
      ['a missing translation', /missing translation key "fields.combat.ac.name"/],
      ['a choice step without a prompt', /missing translation key "actions.aim.steps.pick.prompt"/],
      [
        "a creation action's roll without a name",
        /missing translation key "actions.roll-up.steps.luck.name"/,
      ],
      ['a parameter without a label', /missing translation key "actions.aim.params.range.name"/],
      [
        "an enum field's value without a name",
        /missing translation key "fields.mood.values.angry.name"/,
      ],
      [
        "an enum parameter's value without a name",
        /missing translation key "actions.aim.params.stance.values.high.name"/,
      ],
      ['a nameFrom naming no state key', /nameFrom names unknown state key "nope"/],
      [
        "an item's own enum state value without a name",
        /missing translation key "tricks.hop.state.stance.values.high.name"/,
      ],
      [
        "an enum situational choice's value without a name",
        /missing translation key "situational.cover.values.half.name"/,
      ],
      ['an item field without a name', /missing translation key "types.weapon.fields.skill.name"/],
      ['a template field without a name', /missing translation key "templateFields.edge.name"/],
      ['a declared result without a name', /missing translation key "actions.aim.results.ok.name"/],
      [
        'a literal result the action does not declare',
        /undeclared-result: the action does not declare the result "other"/,
      ],
      ['results from an unknown band set', /actions.peek: unknown result bands "nothing"/],
      ['an undeclared choice step tag', /actions.aim step pick: unknown-tag: "ranged"/],
      ['a written option changing an unknown field', /step pick: unknown field "hp.gone"/],
      ['an option effect outside content', /option effects are only for content items/],
      [
        'an actions group over content',
        /group moves: an actions group's members must be "type: action"/,
      ],
      [
        'a content group over fields',
        /group kit: a content group's members must name a content type/,
      ],
      ['a field in an actions group', /field "combat.ac" is in actions display group "attacks"/],
      [
        'a section key of the wrong type',
        /group arsenal sectionBy: formula "item\.damage": type-mismatch/,
      ],
      ['hints for an unknown content type', /display hints for unknown content type "gadget"/],
      ['hints for an unknown state key', /display hints for weapon: unknown state key "nope"/],
      ['hints for an unknown item field', /display hints for weapon: unknown item field "heft"/],
      ['a unit without text', /missing translation key "units.furlong.short"/],
      ['a field rolling an unknown action', /field "combat.ac" rolls unknown action "nope"/],
      [
        'a field roll with an unknown parameter',
        /field "combat.ac" rolls aim: no parameter "reach"/,
      ],
      [
        'a field roll parameter of the wrong type',
        /field "combat.ac" rolls aim: parameter "range" expects a whole number, got "far"/,
      ],
      ['a field its own companion', /field "combat.ac" with combat.ac: a value isn't its own/],
      ['a max companion of a boolean', /with check.cond: a max companion pairs numbers/],
      ['an unknown companion', /field "combat.ac" with hp.gone: unknown companion/],
      ['a companion role twice', /field "combat.ac": companion role "detail" twice/],
      ['a hidden companion', /with abilities.str.mod: a hidden value can't be a companion/],
      ['a chained companion', /with combat.ac: a companion has no companions of its own/],
      ['then on a rules effect', /effect break-me: then-without-copy/],
      [
        'an added option without a name',
        /missing translation key "weapons.mace.options.parry.name"/,
      ],
      ['an added option changing an unknown field', /effect: unknown field "hp.nope"/],
      ['a pinned pack version that does not exist', /pins broken 9.9.9, but the pack is 0.1.0/],
      ['a saved derived value', /"broken:abilities.str.mod" is derived/],
      ['an input value out of range', /expected at most 30/],
      ['unknown content in a character', /unknown content "broken:weapons.sword"/],
      ['a link slot naming a pack the repo lacks', /link crew: unknown pack "test-nope"/],
      ['a declared link field nesting another', /"tier" is also the start of another declared/],
      ['a bare field in a change sent to a link', /a change sent to a link names its field/],
      ['a change sent to an undeclared link', /unknown link "ship"/],
      ['a saved link to an undeclared slot', /links: unknown link slot "broken:ghost"/],
      ['a stored derived follow-up', /followUps\[strong-1\]: "broken:strong" is a derived offer/],
      ['a stored unknown follow-up', /followUps\[lost-1\]: unknown follow-up "broken:lost"/],
      ['a stored follow-up ID used twice', /followUps\[lost-1\]: duplicate follow-up id/],
      ['a homebrew item of an unknown type', /unknown content type "raygun"/],
      [
        'a homebrew effect on an unknown field',
        /gear.lance effect: unknown target field "hp.nope"/,
      ],
      ['homebrew text missing a name', /missing translation key "gear.lance.name"/],
      ['unknown homebrew content', /unknown content "homebrew:gear.missing"/],
      ['a role field the pack lacks', /role lookout: "lookout.eyes" is not a field of broken/],
      ['each over an undeclared role', /step bribe: each names undeclared role "ghost"/],
      ['changes to an undeclared role', /step tip: to names undeclared role "accomplice"/],
      ['an applyEffect of unknown content', /step hex: unknown content "weapons.nothing"/],
      ['an applied entry named both ways', /step hex: a change names its entries by applied or/],
      ['applied on a change that takes no query', /step hex: applied is only for removeEffect/],
      ['an applyTemplate of unknown content', /step oil: unknown content "templates.nothing"/],
      ['an equip without equipped', /step oil: equip needs equipped/],
      ['a follow-up naming an unknown action', /follow-up followUps.shout: unknown action "shout"/],
      ['change in a becomes follow-up', /follow-up notice: formula "change.by > 0": unknown-name/],
      ['entry: self in a rules follow-up', /followUps.mark: entry: self is only for follow-ups/],
      ['a creation start naming no action', /creation ghost: unknown action "haunt"/],
      ['a linked character for an undeclared slot', /followUps.ship-sheet: unknown link "ship"/],
      [
        'a linked character from an undeclared start',
        /followUps.crew-ghost: unknown creation start "nowhere"/,
      ],
      [
        "a linked character from a start the slot's pack lacks",
        /followUps.crew-roll: creation start "roll" is broken's, which a character using test-nope/,
      ],
      [
        "a linked character's parameter the start lacks",
        /followUps.crew-roll: creation start "roll"'s action has no parameter "size"/,
      ],
      ['a source that defines no such action', /step lunge: unknown action "lunge"/],
      [
        'a creation start missing a parameter',
        /creation bare: action "needs-kind" needs parameter "kind"/,
      ],
      [
        'an immunity to unknown content',
        /weapons.mace immunity stun: unknown item "weapons.nothing"/,
      ],
      ['a duplicate rules immunity', /immunity calm: duplicate id/],
      ['an immunity query over templates', /immunity calm: a query over "template" matches no/],
      [
        'an immunity reading a derived field',
        /rules immunity calm: formula "abilities.str.mod > 0": unknown-name/,
      ],
      ['an allocate step matching no field', /step points: fields matches no integer input field/],
      [
        'an allocate recommendation of an unknown field',
        /recommend names unknown field "nope.field"/,
      ],
      [
        "rules-level standard copies over their type's copies.max",
        /rules standardCopies: too-many-copies: the standard copies of "weapon" \(1\) exceed its copies.max \(0\)/,
      ],
      [
        'HTML in a description',
        /"weapons.mace.description": a description is Markdown without HTML \(found "<b>"\)/,
      ],
      [
        "a block's argument its type doesn't give",
        /"types.weapon.block": the block's argument \{has_heft\} is nothing its type gives/,
      ],
      [
        "a block's state argument its type doesn't declare",
        /"types.weapon.block": the block's argument \{self_nope\} is nothing its type gives/,
      ],
      [
        'an enum value a block names without a name',
        /"types.weapon.block": \{grade_name\} needs a name for "fine" \("types.weapon.fields.grade.values.fine.name"\)/,
      ],
      ['a block that does not parse', /"weapons.mace.block": the block doesn't parse as ICU/],
      [
        'a tag test naming no declared tag',
        /"types.weapon.block": the block's argument \{tag_nope\} is nothing its type gives/,
      ],
      [
        "a template block's formula field",
        /"templates.keen.block": the block's argument \{damage\} is nothing its type gives/,
      ],
      [
        'a headline argument naming no field',
        /"headline": the argument \{field_nope\} is no field_, type_ or link_ the pack sees/,
      ],
      [
        'a headline argument naming no content type',
        /"headline": the argument \{type_nope_each\} is no field_, type_ or link_ the pack sees/,
      ],
      [
        'a headline argument naming no link slot',
        /"headline": the argument \{link_nope\} is no field_, type_ or link_ the pack sees/,
      ],
      [
        "a headline piece's argument its type doesn't give",
        /"types.weapon.headline": the headline piece's argument \{self_nope\} is nothing its type gives/,
      ],
    ])('reports %s', (_, pattern) => expectError(pattern));

    it('accepts a headline naming fields, types and links', () => {
      expect(messages.filter((m) => m.startsWith('"headline"'))).toHaveLength(3);
      expect(reporter.warnings.map((w) => w.message)).not.toContain(unused('headline.separator'));
    });

    it('accepts a block naming fields, texts and state', () => {
      const block = messages.filter((m) => m.includes('"types.weapon.block"'));
      expect(block).toHaveLength(4);
      expect(messages.filter((m) => m.includes('"templates.keen.block"'))).toHaveLength(1);
      expect(reporter.warnings.map((w) => w.message)).toContain(
        unused('types.weapon.fields.grade.values.gold.name'),
      );
      expect(reporter.warnings.map((w) => w.message)).not.toContain(
        unused('types.weapon.fields.grade.values.plain.name'),
      );
    });

    it('reports an ORC pack without its credit line or a required notice', () => {
      const orc = reporter.errors
        .filter((e) => e.file === 'packs/test/orc/pack.yaml')
        .map((e) => e.message);
      expect(orc).toEqual([
        "/ must have required property 'credit'",
        "/notices must have required property 'reserved-material'",
      ]);
    });

    it("accepts an action step that uses its source's own action", () => {
      expect(messages.filter((m) => /unknown action "whirl"/.test(m))).toEqual([]);
    });

    it('warns about an action with an outcome but no declared results', () => {
      expect(reporter.warnings.map((w) => w.message)).toContain(
        'actions.swing: has an outcome step but declares no results',
      );
    });

    it('warns about a decimal literal with more than six places', () => {
      expect(reporter.warnings.map((w) => w.message)).toContain(
        'field carry.rate: decimal 0.12345678 has more than six places; it is rounded to 0.123457',
      );
    });

    it('warns about steps a random creation run would pause at', () => {
      const warnings = reporter.warnings.map((w) => w.message);
      expect(warnings).toContain(
        'creation roll: step "origin" of broken:roll-up has no recommend, so a random run pauses there',
      );
      expect(warnings).toContain(
        'creation roll: step "trick" of broken:roll-up has no recommend, so a random run pauses there',
      );
      expect(warnings.some((w) => w.includes('step "favorite"'))).toBe(false);
      expect(warnings).toContain(
        'creation roll: step "points" of broken:spread has no recommend, so a random run pauses there',
      );
    });

    it("warns about a slotted choice's prompt without {slot}", () => {
      expect(reporter.warnings.map((w) => w.message)).toContain(
        `"rules.choices.perk.prompt": a slotted choice's prompt should name its slot as {slot}`,
      );
    });

    it('warns about translation keys nothing uses', () => {
      expect(reporter.warnings.map((w) => w.message)).toContain(
        'translation key "stray.key" does not belong to anything in this pack',
      );
    });

    it('warns about named texts and tags the pack does not declare', () => {
      const warnings = reporter.warnings.map((w) => w.message);
      expect(warnings).toContain(unused('weapons.mace.texts.motto'));
      expect(warnings).toContain(unused('tags.ranged.name'));
      for (const key of [
        'weapons.mace.texts.inscription',
        'types.weapon.state.ammo.name',
        'types.weapon.computed.ammo.name',
        'tags.melee.name',
      ])
        expect(warnings).not.toContain(unused(key));
      expect(messages.filter((m) => m.includes('without HTML'))).toHaveLength(1);
    });
  });
});

function copyBroken() {
  const root = mkdtempSync(join(tmpdir(), 'ocf-validate-'));
  cpSync(broken, root, { recursive: true });
  return { root, options: { packs: join(root, 'packs'), characters: join(root, 'characters') } };
}

describe('repeated runs', () => {
  const club = 'packs/test/broken/content/weapons/club.yaml';
  const mismatch = /id "weapons.mace" must match its path/;

  it('sees a file edited between two runs', () => {
    const { root, options } = copyBroken();
    try {
      const first = validateRepo(root, options);
      expect(first.reporter.errors.some((e) => mismatch.test(e.message))).toBe(true);
      // Same size, so only the file's times tell the versions apart.
      const text = readFileSync(join(root, club), 'utf8');
      writeFileSync(join(root, club), text.replace('id: weapons.mace', 'id: weapons.club'));
      const second = validateRepo(root, options);
      expect(second.reporter.errors.some((e) => mismatch.test(e.message))).toBe(false);
      writeFileSync(join(root, club), 'id: [');
      expect(validateRepo(root, options).reporter.errors).toContainEqual({
        file: club,
        message: expect.stringMatching(/^YAML parse error/),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('forgets a file deleted between two runs', () => {
    const { root, options } = copyBroken();
    try {
      const has = (r: ReturnType<typeof validateRepo>) =>
        r.loaded.some((p) => p.content.some((c) => c.file === club));
      expect(has(validateRepo(root, options))).toBe(true);
      rmSync(join(root, club));
      const second = validateRepo(root, options);
      expect(has(second)).toBe(false);
      expect(second.reporter.errors.filter((e) => e.file === club)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('gives each caller its own copy of an unchanged result', () => {
    const { root, options } = copyBroken();
    try {
      const first = validateRepo(root, options);
      const count = first.reporter.errors.length;
      first.reporter.error('x', 'added by the caller');
      first.loaded.length = 0;
      const second = validateRepo(root, options);
      expect(second.reporter.errors).toHaveLength(count);
      expect(second.loaded.length).toBeGreaterThan(0);
      // Parsed documents are shared between runs, so they can't be changed.
      expect(Object.isFrozen(second.loaded[0]?.manifest)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
