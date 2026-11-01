---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

An offered follow-up that the content adding the option or changes doesn't declare (nor its
content type) falls back to the content defining the action, then to the rules, as the spec
says: content adding to a rules action's tagged step can offer the rules' follow-up. Before,
it was `unknown-reference` (#184).
