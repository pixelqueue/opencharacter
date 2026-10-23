---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Exports: `export.schema.json` is one file of characters with every pack version they pin, each by
reference (`id`, `version`, optional `url` and `integrity`) or embedded as a pack release (a
bundle). `integrity` is the SHA-256 of the release's canonical JSON, and decides whether the
receiving app's own copy is the same release. The engine adds `createExport`, `readExport` and
`releaseIntegrity`.
