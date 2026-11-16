# Language Icons — Provenance

Icons embedded in the generated `assets/generated/languages.svg` come from two
upstream icon projects. This document records the source, licence and trademark
status of every vendored logo for traceability.

## Collections

### Simple Icons — https://github.com/simple-icons/simple-icons

- **Collection-level licence**: CC0-1.0 Universal (upstream `LICENSE.md`
  confirms this verbatim).
- **Per-icon licence metadata** (upstream `data/simple-icons.json`): only two
  icons we vendor carry explicit metadata — `JavaScript` (`license: { type: "MIT" }`) and
  `GNU Bash` (`license: { type: "MIT" }`). Every other icon's per-icon licence
  is **unspecified** upstream; we record them as unspecified rather than
  imposing CC0 on them.
- **Pinned upstream commit**: `17cd4ee07612198a1d8777a060d4100423762a8b`
  (branch `develop`; all raw URLs below reference this SHA).

### Devicon — https://github.com/devicons/devicon

- **Collection licence**: MIT (© 2015 konpa, upstream `LICENSE`).
- **Pinned upstream commit**: `32fe1d3b3f36ad11f90ab94f7db59738139c2bf6`
  (branch `master`; all raw URLs below reference this SHA).

## Per-icon table

All Simple Icons entries are embedded verbatim (path `d` attribute only, no
modifications). Devicon entries embed each upstream `<path>` with its own
`fill` (except for R, whose authored gradients are reproduced exactly), plus
`viewBox` and R's `<linearGradient>` definitions.

| Language                        | Upstream icon         | Project      | Source URL (pinned)                                                                                                    | Per-icon licence                                                                          |
| ------------------------------- | --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| JavaScript                      | `javascript.svg`      | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/javascript.svg`    | **MIT** (upstream `data/simple-icons.json`)                                               |
| HTML                            | `html5.svg`           | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/html5.svg`         | Unspecified                                                                               |
| TypeScript                      | `typescript.svg`      | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/typescript.svg`    | Unspecified                                                                               |
| Kotlin                          | `kotlin.svg`          | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/kotlin.svg`        | Unspecified                                                                               |
| C                               | `c.svg`               | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/c.svg`             | Unspecified                                                                               |
| CSS                             | `css.svg`             | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/css.svg`           | Unspecified                                                                               |
| Shell (GitHub Linguist “Shell”) | `gnubash.svg`         | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/gnubash.svg`       | **MIT** (upstream `data/simple-icons.json`; shell-scripting represented by GNU Bash mark) |
| Python                          | `python.svg`          | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/python.svg`        | Unspecified                                                                               |
| Lua                             | `lua.svg`             | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/lua.svg`           | Unspecified                                                                               |
| Rust                            | `rust.svg`            | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/rust.svg`          | CC-BY-SA-4.0                                                                              |
| Ruby                            | `ruby.svg`            | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/ruby.svg`          | CC-BY-SA-2.5                                                                              |
| PHP                             | `php.svg`             | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/php.svg`           | CC-BY-SA-4.0                                                                              |
| Swift                           | `swift.svg`           | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/swift.svg`         | Unspecified                                                                               |
| Dart                            | `dart.svg`            | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/dart.svg`          | Unspecified                                                                               |
| Scala                           | `scala.svg`           | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/scala.svg`         | Unspecified                                                                               |
| Perl                            | `perl.svg`            | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/perl.svg`          | Unspecified                                                                               |
| Haskell                         | `haskell.svg`         | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/haskell.svg`       | Unspecified                                                                               |
| Clojure                         | `clojure.svg`         | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/clojure.svg`       | Unspecified                                                                               |
| Elixir                          | `elixir.svg`          | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/elixir.svg`        | Unspecified                                                                               |
| Svelte                          | `svelte.svg`          | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/svelte.svg`        | Unspecified                                                                               |
| C++                             | `cplusplus.svg`       | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/cplusplus.svg`     | Unspecified                                                                               |
| Go                              | `go.svg`              | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/go.svg`            | Unspecified                                                                               |
| EJS                             | `ejs.svg`             | Simple Icons | `raw.githubusercontent.com/simple-icons/simple-icons/17cd4ee07612198a1d8777a060d4100423762a8b/icons/ejs.svg`           | Unspecified                                                                               |
| Java                            | `java-original.svg`   | Devicon      | `raw.githubusercontent.com/devicons/devicon/32fe1d3b3f36ad11f90ab94f7db59738139c2bf6/icons/java/java-original.svg`     | MIT                                                                                       |
| C#                              | `csharp-original.svg` | Devicon      | `raw.githubusercontent.com/devicons/devicon/32fe1d3b3f36ad11f90ab94f7db59738139c2bf6/icons/csharp/csharp-original.svg` | MIT                                                                                       |
| Vue                             | `vuejs-original.svg`  | Devicon      | `raw.githubusercontent.com/devicons/devicon/32fe1d3b3f36ad11f90ab94f7db59738139c2bf6/icons/vuejs/vuejs-original.svg`   | MIT                                                                                       |
| R                               | `r-original.svg`      | Devicon      | `raw.githubusercontent.com/devicons/devicon/32fe1d3b3f36ad11f90ab94f7db59738139c2bf6/icons/r/r-original.svg`           | MIT                                                                                       |

Languages with no authentic logo in either collection (e.g. Makefile, Mustache) render a
neutral slate tile (`#243447`) carrying the language's initial letters — this is clearly not
a brand logo.

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
`vuejs-original.svg` (MIT) instead. R, Rust, Ruby and PHP remain in Simple Icons with the
per-icon licences recorded in the table above.
