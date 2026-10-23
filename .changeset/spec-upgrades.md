---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Characters get spec-level upgrades. A spec version that changes the character file's shape ships
a spec upgrade (`spec-upgrade.schema.json`, listed in `data/spec-upgrades.json`; none yet).
`upgrade` runs the ones between the character's `specVersion` and the engine's, before the packs'
scripts, then writes the engine's `SPEC_VERSION`, so an upgraded character no longer keeps a stale
stamp. The report's `spec` gives the old version and the steps that changed the file. A character
from a newer spec is refused with the new error `character-spec-unsupported`.
