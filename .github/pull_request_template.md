## What and why

<!-- What this changes and why. Link the issue it closes. -->

## Checklist

- [ ] Every commit is signed off (`git commit -s`, see CONTRIBUTING.md).
- [ ] `pnpm check` passes (and `pnpm release` and `pnpm build:website` for pack, script or docs changes).
- [ ] Changes to the engine or a pack come with a conformance case.
- [ ] A change to a published package or pack has a changeset (`pnpm changeset`).
- [ ] A change to saved state's shape has an upgrade script and a fixture in `scripts/release/upgrade-fixtures/`.
- [ ] Docs, guides and READMEs the change touches are updated.

**For pack content:**

- [ ] Its source and license are named here, and the pack declares that license: <!-- source -->
- [ ] No rules text from a game that isn't openly licensed, unless the rights holder gave permission (a `LicenseRef-` license with a `permission` notice); mechanics-only packs get no prose.
- [ ] No names, trademarks or setting terms the source's license bars.
- [ ] Player-facing text is in `i18n/`, not next to the mechanics.
