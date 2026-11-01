---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

Picked and granted content has computed values: its type's, item's and kept templates' `computed`
are worked out per activation after every field, reading derived fields and the owning copy (with
its computed values). computeSheet lists them in `activationValues` (`{ activation, values }`),
and the content's actions and follow-ups read them as `self.<name>`. A template kept on content
without a copy may now give computed values. An item's description and named texts take a
block's arguments, so `{self_<name>}` fills them from those values: `contentCard` fills the
description, the new `contentText` gives a description or named text filled, headline pieces of
picked content read `activationValues`, and `pnpm validate` checks their arguments (#193).
