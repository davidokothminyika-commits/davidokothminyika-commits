# Language Icons — Provenance

Icons embedded in the generated `assets/generated/languages.svg` come from two
upstream icon projects. This document records the source, licence and trademark
status of every vendored logo for traceability. It is descriptive, not legal
advice, and it makes no claim of complete legal compliance.

## Collections

### Simple Icons — https://github.com/simple-icons/simple-icons

- **Collection-level licence**: CC0-1.0 Universal. Upstream `LICENSE.md`
  confirms this verbatim at the pinned commit
  (https://raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/LICENSE.md).
  CC0 dedicates the collection to the public domain; a per-icon licence in
  the metadata supersedes that dedication for the icons carrying one.
- **Per-icon licence metadata** (upstream `data/simple-icons.json` at the pinned
  commit): five of the 23 icons we vendor carry an explicit `license` field —
  `JavaScript` and `GNU Bash` are MIT, `PHP` and `Rust` are CC-BY-SA-4.0, and
  `Ruby` is CC-BY-SA-2.5. The remaining 18 entries have **no `license` field
  at all** in the pinned metadata; we record them as unspecified rather than
  imposing a licence on them.
- **Pinned upstream commit**: `17cd4ee07612198a1d8777a060d4100423762a8b`
  (branch `develop`; all raw URLs below reference this SHA).
- **Upstream metadata shape**: each entry in `data/simple-icons.json` exposes
  `title`, `hex`, `source` (origin page), and optionally `guidelines` and
  `license: { type }`. It does **not** expose creator names, pseudonyms,
  copyright-notice text, or a designated attribution party for any of the icons
  we vendor. The upstream `.svg` files carry no embedded copyright or licence
  comment headers (verified at the pinned commit). Where a licence requires
  identification of the creator, that information is simply not available from
  the pinned upstream source; see “Attribution requirements and limits” below.

### Devicon — https://github.com/devicons/devicon

- **Collection licence**: MIT. Upstream `LICENSE` at the pinned commit
  (https://raw.githubusercontent.com/devicons/devicon/32fe1d3b3f36ad11f90ab94f7db59738139c2bf6/LICENSE)
  reads, in full:

  > The MIT License (MIT)
  >
  > Copyright (c) 2015 konpa
  >
  > Permission is hereby granted, free of charge, to any person obtaining a copy
  > of this software and associated documentation files (the “Software”), to deal
  > in the Software without restriction, including without limitation the rights
  > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  > copies of the Software, and to permit persons to whom the Software is
  > furnished to do so, subject to the following conditions:
  >
  > The above copyright notice and this permission notice shall be included in
  > all copies or substantial portions of the Software.
  >
  > THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  > THE SOFTWARE.

  Devicon's `devicon.json` carries no per-icon licence fields; all Devicon
  glyphs ship under the collection's MIT, identified by that one notice.

- **Pinned upstream commit**: `32fe1d3b3f36ad11f90ab94f7db59738139c2bf6`
  (branch `master`; all raw URLs below reference this SHA).

## Per-icon table

All Simple Icons entries are embedded verbatim (path `d` attribute only, no
modifications). Devicon entries embed each upstream `<path>` with its own
`fill` (except for R, whose authored gradients are reproduced exactly), plus
`viewBox` and R's `<linearGradient>` definitions. “Pinned raw URL” is the
exact file vendored into `src/generators/language-icons.js`; “Upstream
origin” is the `source` field from the pinned upstream metadata.

| Language                        | Upstream icon         | Project      | Pinned raw URL                                            | Per-icon licence |
| ------------------------------- | --------------------- | ------------ | --------------------------------------------------------- | ---------------- |
| JavaScript                      | `javascript.svg`      | Simple Icons | `.../simple-icons/17cd4ee.../icons/javascript.svg`        | **MIT**          |
| HTML                            | `html5.svg`           | Simple Icons | `.../simple-icons/17cd4ee.../icons/html5.svg`             | Unspecified      |
| TypeScript                      | `typescript.svg`      | Simple Icons | `.../simple-icons/17cd4ee.../icons/typescript.svg`        | Unspecified      |
| Kotlin                          | `kotlin.svg`          | Simple Icons | `.../simple-icons/17cd4ee.../icons/kotlin.svg`            | Unspecified      |
| C                               | `c.svg`               | Simple Icons | `.../simple-icons/17cd4ee.../icons/c.svg`                 | Unspecified      |
| CSS                             | `css.svg`             | Simple Icons | `.../simple-icons/17cd4ee.../icons/css.svg`               | Unspecified      |
| Shell (GitHub Linguist “Shell”) | `gnubash.svg`         | Simple Icons | `.../simple-icons/17cd4ee.../icons/gnubash.svg`           | **MIT**          |
| Python                          | `python.svg`          | Simple Icons | `.../simple-icons/17cd4ee.../icons/python.svg`            | Unspecified      |
| Lua                             | `lua.svg`             | Simple Icons | `.../simple-icons/17cd4ee.../icons/lua.svg`               | Unspecified      |
| Rust                            | `rust.svg`            | Simple Icons | `.../simple-icons/17cd4ee.../icons/rust.svg`              | **CC-BY-SA-4.0** |
| Ruby                            | `ruby.svg`            | Simple Icons | `.../simple-icons/17cd4ee.../icons/ruby.svg`              | **CC-BY-SA-2.5** |
| PHP                             | `php.svg`             | Simple Icons | `.../simple-icons/17cd4ee.../icons/php.svg`               | **CC-BY-SA-4.0** |
| Swift                           | `swift.svg`           | Simple Icons | `.../simple-icons/17cd4ee.../icons/swift.svg`             | Unspecified      |
| Dart                            | `dart.svg`            | Simple Icons | `.../simple-icons/17cd4ee.../icons/dart.svg`              | Unspecified      |
| Scala                           | `scala.svg`           | Simple Icons | `.../simple-icons/17cd4ee.../icons/scala.svg`             | Unspecified      |
| Perl                            | `perl.svg`            | Simple Icons | `.../simple-icons/17cd4ee.../icons/perl.svg`              | Unspecified      |
| Haskell                         | `haskell.svg`         | Simple Icons | `.../simple-icons/17cd4ee.../icons/haskell.svg`           | Unspecified      |
| Clojure                         | `clojure.svg`         | Simple Icons | `.../simple-icons/17cd4ee.../icons/clojure.svg`           | Unspecified      |
| Elixir                          | `elixir.svg`          | Simple Icons | `.../simple-icons/17cd4ee.../icons/elixir.svg`            | Unspecified      |
| Svelte                          | `svelte.svg`          | Simple Icons | `.../simple-icons/17cd4ee.../icons/svelte.svg`            | Unspecified      |
| C++                             | `cplusplus.svg`       | Simple Icons | `.../simple-icons/17cd4ee.../icons/cplusplus.svg`         | Unspecified      |
| Go                              | `go.svg`              | Simple Icons | `.../simple-icons/17cd4ee.../icons/go.svg`                | Unspecified      |
| EJS                             | `ejs.svg`             | Simple Icons | `.../simple-icons/17cd4ee.../icons/ejs.svg`               | Unspecified      |
| Java                            | `java-original.svg`   | Devicon      | `.../devicon/32fe1d3.../icons/java/java-original.svg`     | MIT              |
| C#                              | `csharp-original.svg` | Devicon      | `.../devicon/32fe1d3.../icons/csharp/csharp-original.svg` | MIT              |
| Vue                             | `vuejs-original.svg`  | Devicon      | `.../devicon/32fe1d3.../icons/vuejs/vuejs-original.svg`   | MIT              |
| R                               | `r-original.svg`      | Devicon      | `.../devicon/32fe1d3.../icons/r/r-original.svg`           | MIT              |

The `.../` prefixes stand for
`https://raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons`
and
`https://raw.githubusercontent.com/devicons/devicon/32fe1d3b3f36ad11f90ab94f7db59738139c2bf6/icons`
respectively. The full pinned URLs are recorded per entry in
`src/generators/language-icons.js` (`source` field) and test-enforced to
contain the pinned SHAs.

Languages with no authentic logo in either collection (e.g. Makefile, Mustache)
render a neutral slate tile (`#243447`) carrying the language's initial letters —
this is clearly not a brand logo.

## Per-entry attribution detail (explicit licence entries)

### JavaScript — MIT

- Upstream origin (pinned upstream metadata `source`):
  `https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/js.svg`
- Upstream repository licence: MIT, © 2011 Christopher Williams
  <chris@iterativedesigns.com> — `LICENSE` fetched verbatim at that SHA.
- Modifications: none. The `d` path attribute is embedded verbatim; fill
  `#F7DF1E` and viewBox `0 0 24 24` match upstream metadata. The project
  re-renders the glyph on its own SVG canvas; the artwork geometry is
  unmodified.

### Shell (rendered as GNU Bash) — MIT

- Upstream origin (pinned upstream metadata `source`):
  `https://github.com/odb/official-bash-logo/tree/61eff022f2dad3c7468f5deb4f06652d15f2c143`
- Upstream repository licence: MIT, © 2016 ol' dirty bashnerds — `LICENSE`
  fetched verbatim at that SHA.
- Upstream guidelines: `https://github.com/odb/official-bash-logo` (per pinned
  metadata `guidelines`).
- Modifications: none. Path data embedded verbatim; fill `#4EAA25` and viewBox
  match upstream metadata.
- Note: GitHub Linguist classifies the vendored bytes as "Shell"; the mark used
  is GNU's Bash logo, which is what upstream Simple Icons ships for Bash.

### PHP — CC-BY-SA-4.0

- Upstream origin (pinned upstream metadata `source`):
  `https://php.net/download-logos.php`
- Licence: CC Attribution-ShareAlike 4.0 International —
  https://creativecommons.org/licenses/by-sa/4.0/legalcode
- Creator identification and copyright notice: **not supplied** in the pinned
  upstream metadata or in the upstream `php.svg` (which carries no copyright
  comment header). This project does not invent a creator name; it records the
  above origin page as the place where the licensor publishes the mark.
- Modifications: none. Path data embedded verbatim; fill `#777BB4` matches
  upstream metadata.

### Ruby — CC-BY-SA-2.5

- Upstream origin (pinned upstream metadata `source`):
  `https://www.ruby-lang.org/en/about/logo/`
- Licence: CC Attribution-ShareAlike 2.5 Generic —
  https://creativecommons.org/licenses/by-sa/2.5/legalcode
- Creator identification and copyright notice: **not supplied** in the pinned
  upstream metadata or in the upstream `ruby.svg` (which carries no copyright
  comment header). The Ruby logo origin page above is where the licensor
  publishes the mark and its terms.
- Modifications: none. Path data embedded verbatim; fill `#CC342D` matches
  upstream metadata.

### Rust — CC-BY-SA-4.0

- Upstream origin (pinned upstream metadata `source`): `https://www.rust-lang.org`
- Upstream guidelines (pinned upstream metadata `guidelines`):
  `https://www.rust-lang.org/policies/media-guide`
- Licence: CC Attribution-ShareAlike 4.0 International —
  https://creativecommons.org/licenses/by-sa/4.0/legalcode
- Creator identification and copyright notice: **not supplied** in the pinned
  upstream metadata or in the upstream `rust.svg` (which carries no copyright
  comment header). The Rust media guide above is where the licensor publishes
  the mark and its usage policy.
- Modifications: none. Path data embedded verbatim; fill `#000000` matches
  upstream metadata.

## Attribution requirements and limits

**What the CC licences require.** CC BY-SA 4.0 §3(a) requires, when sharing
the material (including unmodified), retaining what the licensor supplied
(creator identification; copyright notice; licence notice; disclaimer of
warranties; URI to the material, to the extent reasonably practicable),
indicating modifications, and indicating the licence with a link. CC BY-SA 2.5
§4(c) analogously requires keeping intact any copyright notices and providing,
reasonably for the medium, the original author name if supplied, any
designated attribution party, the title if supplied, and any URI the licensor
specifies. Both licences permit collective works to include the material with
the per-material credit, rather than the whole work inheriting the licence.

**What this project provides.** For each vendored icon this repository
records: the icon title; the upstream collection; the immutable pinned raw URL
of the exact file vendored; the upstream origin page (for the explicit entries
above); the licence identifier and, above, a link to the licence text; and the
modification status (path data verbatim; artwork geometry unmodified). The generated
`assets/generated/languages.svg` embeds the glyphs inline and does **not**
carry per-icon licence annotations inside the file itself; the attribution
record above lives in this document, which ships in the same public repository
as the generated asset.

**What this project cannot provide.** The pinned upstream metadata supplies no
creator name, pseudonym, copyright-notice text, or designated attribution
party for PHP, Ruby or Rust, and the upstream SVGs contain no such notices.
Accordingly, for those three icons this document does **not** name a creator,
and cannot. We record the licensor-operated origin pages above instead. We do
not claim that this alone satisfies every element of CC BY-SA §3(a) or §4(c);
nothing in this repository should be read as a warranty that every attribution
element is satisfied or that a licensor would raise no objection. If a
licensor requests that a credit be removed or corrected — CC BY-SA 2.5 §4(a)
expressly contemplates credit-removal requests for collective works, and any
licensor may reasonably ask the same — we will remove or correct it promptly.

**Modifications and share-alike.** The vendored artwork is unmodified, so no
derivative work of any CC-BY-SA icon is distributed, and the generated profile
SVG is not offered as a derivative work of any icon. If that ever changes, the
share-alike terms would attach to the modified material and this document
would be updated accordingly.

**MIT entries.** For Devicon (all four entries) and the two per-icon-MIT
Simple Icons entries (JavaScript, GNU Bash), the copyright notice and
permission-notice text are reproduced or linked above. MIT requires that
notice be included in copies or substantial portions; this repository treats
its vendored copy plus this document as the accompanying notice. The
generated SVG does not embed the MIT text inline.

**Trademark reminder.** Nothing in these copyright licences transfers
trademark rights; see below.

## Copyright vs. trademark

Licences above cover **copyright** — the right to copy and embed the artwork in our
generated SVG. They do **not** transfer **trademark** rights. Logos are used only to
identify the language on a GitHub profile README; they are never redesigned, re-coloured,
presented as a claim of trademark ownership, or used to imply endorsement by the project.
Nominative fair use is jurisdiction-dependent; we do not assert that it applies everywhere,
only that we use each logo for identification in the ordinary sense of a programming-language
logo and make no broader claim.

Note on Vue: Simple Icons' `vuedotjs` entry is per-icon licenced **CC-BY-NC-SA-4.0**
(non-commercial — unsuitable for this open-source project); we use Devicon's
`vuejs-original.svg` (MIT) instead. R is Devicon's `r-original.svg` (MIT). Rust, Ruby and
PHP remain in Simple Icons with the per-icon licences recorded in the table above.
