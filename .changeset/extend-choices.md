---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

Additive choice options: a pack's rules' `extendChoices` adds items, written values or inline options to a dependency's content or rules-level choice (`<pack>:<content id>` or `<pack>:rules`, then the choice, `<choice>/<option>/<choice>` for a nested one) without overriding the owner, after the choice's own and in load order, so two add-ons never collide. Added inline options read the adding pack's fields and are named in its text under the owner's key; the ruleset's `optionOrigins` names each added value's and inline option's pack, which `createText` takes. The rules' `option` and `changes` effects now reach tagged action steps too (`<pack>:rules#<id>`, named `rules.options.<id>.name`), so an add-on offers its own option in a dependency's creation step. A bad addition is `invalid-extension`; dropping one is an interface change (`extension-removed`).
