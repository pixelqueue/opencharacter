---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Aura of Protection, Countercharm and the Rod of Alertness's Protective Aura are auras (`auras`): computeSheet lists them while they are up (Aura of Protection while the paladin is conscious, at `aura.range`; Countercharm while the bard performs; the rod while planted) for the app to place on allies inside. Aura of Protection's entry reads the paladin's live Charisma modifier through `appliers`. The paladin's own bonus now needs it conscious, as the SRD says. A creature counts one Aura of Protection or rod bonus (stackKey `source`), so the holder in its own aura and an ally with an older `ally` entry aren't counted twice. The `ally` actions stay. Conformance suite: `5e-aura-of-protection-holder` and `5e-aura-of-protection-ally`.

An aura is up only through its holder's own entry (one with no applier or applied by the holder), so a creature standing in another's Countercharm, Rod of Alertness, Spirit Guardians or Pass without Trace doesn't project it too, and Countercharm's `countercharm` and `end-countercharm` look at the bard's own performance only. Countercharm's bonus to saves against charm and fear counts once (stackKey `source`).
