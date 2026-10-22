---
'@opencharacter/spec': minor
---

A character `id`, its `links` values and a view's `id` may be up to 2048 characters, so a URL (IRI) can be a character's global ID across apps; a UUID stays fine for app-local IDs (#39). An object value under `extensions` may carry `$schema`, the URI of a JSON Schema the extending app publishes for its data; OCF doesn't host, fetch or check it, and other value shapes stay allowed (#40).
