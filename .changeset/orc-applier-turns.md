---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
---

Effects put on other creatures end by their applier's turns (#208). A new `turn-boundary` clock
action, which the app runs on every creature at each turn change, ends a condition or effect
whose new `duration` state is `next-start` when its applier's turn starts, and one that is
`next-end` when its applier's next turn ends. orc-2e: Debilitating Strike and the racket feats'
debilitations last until the end of the rogue's next turn, and a new debilitation first ends the
rogue's earlier ones wherever they are (`to: applied`). orc-sf-2e: Get 'Em! lasts until the start
of the envoy's next turn, and a new one ends the earlier one on the envoy and on every ally. The
new state keys have defaults, so saved characters are unchanged.
