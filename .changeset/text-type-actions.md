---
'@opencharacter/spec': patch
'@opencharacter/text': minor
---

An action inline on a content type, which every item of the type shares, is keyed under the
type, `types.<type>.<action>…` (`types.stunt.use.name`), as `pnpm validate` already required;
i18n.md now says so. Its ID is still `<item>#<action>`, so the text helper looks under the item's
key, then, with `content` in the bundle, under its type's: `text.action`, `param`, `stepPrompt`
and the rest name a Fate stunt's Use and a free invocation's Invoke instead of showing the ID.
