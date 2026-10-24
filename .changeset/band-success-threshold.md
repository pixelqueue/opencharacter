---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
'@opencharacter/5e-srd-5.1': minor
'@opencharacter/awn-core': minor
'@opencharacter/cwn-srd': minor
'@opencharacter/fate-core': minor
'@opencharacter/fitd-scoundrel': minor
'@opencharacter/godbound-core': minor
'@opencharacter/mork-borg-core': minor
'@opencharacter/mothership-1e': minor
'@opencharacter/orc-2e': minor
'@opencharacter/orc-sf-2e': minor
'@opencharacter/swn-revised': minor
'@opencharacter/wwn-srd': minor
---

A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
an app shows before the roll ("what you need"). A set marks at most one. The roll summary
(`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
pack's band condition text that needs a test's value no longer shows its raw template when the
band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
