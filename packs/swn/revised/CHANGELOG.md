# @opencharacter/swn-revised

## 0.1.1

### Patch Changes

- 153b36f: `focus-skill-points` finishes `none` for a psychic skill the character can't learn. `psionics.discipline` is an enum with named values (`none` when unset). The headline drops its separator when the class or background is missing. Psychic Succor finishes `failed` on a target whose System Strain can't take it. Starting gear stows readied gear and all but one weapon while they fit, so a weak character starts within the readied limit where the package allows. Rolled hit points are a background value, the committed Effort tiles have short labels, heal's amount reads "Hit points regained", and the discipline prerequisite text names the discipline.
