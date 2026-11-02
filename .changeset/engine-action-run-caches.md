---
'@opencharacter/engine': patch
---

Actions run several times faster: the rules actions content names with `use` are found once per ruleset, and an action reuses the actor's sheet across its start and resumes instead of rebuilding it each time. What a run returns is its own copy, so a caller editing a result can't change a later run. No answer changes.
