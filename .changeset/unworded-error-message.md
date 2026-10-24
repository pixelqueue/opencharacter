---
'@opencharacter/text': patch
'@opencharacter/spec': patch
---

An error with no text of its own, or whose text misses an argument, reads as its `data.message`
when it has one, before `errors.other`. The spec's `errors.other` no longer shows the code to a
player ("Something went wrong."); it still gets `{code}`, and the guides say to log the code and
data for developers.
