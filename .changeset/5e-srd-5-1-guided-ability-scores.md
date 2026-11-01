---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Guided creation (`create-character`) recommends the ability scores: each method (rolled, point buy, standard array) recommends them by the class's ability priority, the highest to its first ability (point buy at the same spread), as 5.2's does, so an automatic run no longer stops at the allocation. Conformance suite: `5e-create-guided-array` expects the recommended array and the pause at the first pending pick.
