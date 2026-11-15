# Architecture

## Goals

This repository generates the public GitHub profile README for
`davidokothminyika-commits` from data owned by that account. The design has
three non-negotiable properties:

1. **Automated and reproducible.** Every displayed statistic is derived from
   GitHub APIs or from committed configuration. No production statistic is
   typed by hand.
2. **Private by construction.** Authorized private repositories may contribute
   to aggregate statistics, but their names, URLs, descriptions, topics, and
   individual language breakdowns can never reach a public asset.
3. **Fail closed.** If collection is incomplete or output validation fails, the
   previous published README and SVG assets are preserved.

## Runtime

| Concern      | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| Runtime      | Node.js 26 LTS (`.nvmrc`, `engines.node >= 26`)              |
| Modules      | Native ES Modules                                            |
| Package      | npm with committed `package-lock.json`                       |
| REST         | `@octokit/rest` 22                                           |
| GraphQL      | `@octokit/graphql` 9                                         |
| REST version | `2026-03-10` (`X-GitHub-Api-Version`)                        |
| Resilience   | `@octokit/plugin-retry` 8, `@octokit/plugin-throttling` 11   |
| Validation   | Zod 4                                                        |
| Templates    | Mustache 4                                                   |
| Tests        | Vitest 5 with V8 coverage                                    |
| Quality      | ESLint 10 flat config, Prettier 3                            |
| CI           | GitHub Actions validation and scheduled collection workflows |
| 3D graph     | `yoshi389111/github-profile-3d-contrib` v0.9.3 (pinned SHA)  |

Versions are exact in `package.json` and locked. Configuration was chosen after
checking each package's current npm metadata and Node engine requirements.

## Layers

```
config/                 Human-maintained profile, collection and rendering data
src/schemas/            Zod schemas for configuration, environment and API data
src/config/             Config loading, cross-file invariants, environment loading
src/api/                Authenticated REST/GraphQL clients and pagination
src/collectors/         Repository, language, contribution and activity collection
src/processors/         Aggregation, ranking, statistics and privacy sanitisation
src/generators/         SVG and README generation
src/templates/          Mustache templates and static template fragments
src/utils/              Logging, redaction, filesystem safety, shared helpers
src/pipeline/           Shared collection-to-public-payload orchestration
src/publisher/          Staging and atomic publish of validated assets
scripts/                CLI entry points and validation utilities
tests/                  Unit and integration tests with fixtures
assets/generated/       Generated SVG assets referenced by the README
assets/3d/              Validated 3D contribution graph assets
.github/workflows/      Validation, collection and publish workflows
```

The dependency direction is one-way:

```
config -> api -> collectors -> processors -> generators -> publisher
```

Presentation code never calls GitHub directly. Collectors never render text.
The privacy sanitizer sits between processing and generation so public output
cannot read unsanitised repository objects.

## Configuration

Configuration is split so a content edit cannot accidentally change collection
semantics, and a collection change cannot change visual design.

| File                     | Responsibility                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `config/profile.json`    | Public identity, about text, contact links, technology groups, featured-repository policy                    |
| `config/collection.json` | Visibility, forks/archived/empty handling, pagination, language collection, privacy coverage, publish policy |
| `config/rendering.json`  | Theme tokens, layout limits, output paths, section switches, timestamp                                       |
| `config/3d-themes.json`  | Generator-specific settings for the three required graph variants                                            |

`loadConfig()` validates all four documents with strict Zod schemas, then applies
cross-file invariants:

- Profile URL matches the configured GitHub username.
- Contact email matches the `mailto:` social link.
- Collection affiliation includes `owner`.
- Private language aggregation is enabled when collecting private repositories
  only.
- Private repository names and private language breakdowns are never publishable.
- All paths are relative and contained by the repository root.
- README output is Markdown; generated assets are SVG.
- 3D target assets live under `assets/3d/`.
- The `midnight`, `night`, and `purple` variants are present exactly once.
- Every generated 3D filename maps to one theme and one target.
- The timestamp locale and IANA time zone are valid.

The result is deeply frozen. Invalid configuration fails with a file- and
field-specific error, not a partial configuration.

## API access layer

`src/api/client.js` creates one authenticated Octokit instance with retry and
throttling plugins. GraphQL requests reuse that instance through
`withCustomRequest`, so both APIs share authentication, retry, throttling and
the pinned `X-GitHub-Api-Version: 2026-03-10` header.

`verifyAuthenticatedUser()` performs two independent identity checks:

1. REST `GET /user`
2. GraphQL `viewer { login databaseId }`

The logins and numeric IDs must match each other and the configured profile
login. A token for another account, an organization account, or a REST/GraphQL
identity mismatch aborts before collection. The function returns only a safe
summary; the token is never returned to callers.

Octokit's internal request logger is disabled because it logs request URLs,
which may include private repository names. Our logger emits structured records
and redacts credential-shaped keys and values. API failures are converted to
stable codes with generic messages; raw response bodies, GraphQL error messages,
queries, variables and repository URLs are never copied into errors.

REST pagination is bounded by `collection.pagination.maxPages`. Hitting the cap
raises `PaginationLimitError` instead of silently truncating collection. Pages
must be arrays; an unexpected page shape raises `UnexpectedPageError`.

## Repository discovery and coverage

`src/api/repositories.js` enumerates owned repositories with
`GET /user/repos?affiliation=owner&visibility=<configured>&sort=full_name`.
Collaborator repositories and repositories reached only through organization
membership are deliberately excluded: the profile reports work owned by the
profile account. Pagination uses the configured `perPage` and `maxPages`.

Each record is validated against the Zod schema in
`src/schemas/github.schema.js`. Unknown GitHub fields are stripped so later
layers only see the documented metadata allow-list. A malformed record aborts
collection with `GITHUB_INVALID_REPOSITORY_RESPONSE`; raw values are never
copied into the error.

`src/collectors/repository-collector.js` then:

1. Deduplicates by the immutable numeric repository `id`. Duplicate records for
   the same ID are counted; conflicting records abort with
   `REPOSITORY_ID_CONFLICT`.
2. Confirms every record is owned by the authenticated login.
3. Compares observed counts with the authenticated `/user` response before
   filters are applied.
4. Applies exclusion, fork, archived and empty-repository rules.
5. Records coverage and only then returns the included repositories.

Coverage rules are fail-closed:

- With public repositories in scope, the observed public count must equal
  `public_repos`.
- With private repositories in scope, the observed private count must equal
  `owned_private_repos` when `requirePrivateCoverage` is true.
- If GitHub omits `owned_private_repos`, private coverage is unverifiable and
  collection aborts. A token-scope problem is never treated as "zero private
  repositories".
- Any observed count mismatch aborts, including when private coverage is not
  required. Filters cannot hide an inaccessible repository because they run
  after coverage counting.

This count comparison is a consistency check, not cryptographic proof. GitHub
does not expose a signed manifest of private repositories. Coverage is only as
strong as the token's ability to read the profile private counts and enumerate
every owned repository. If a repository is created or deleted between the
`/user` and `/user/repos` calls, the run fails closed rather than reporting
partial statistics. Disabled or organization-restricted repositories that are
absent from `/user/repos` also produce a mismatch.

The `includeEmpty` rule treats GitHub's `size == 0` as empty. A repository with
files but no detected languages is not empty; it contributes a valid empty
language map.

## Language collection

`src/api/languages.js` calls
`GET /repos/{owner}/{repo}/languages`. GitHub returns an object whose values are
byte counts; `{}` is valid when no languages are detected. Byte counts must be
non-negative safe integers, and the response must be an object.

`src/collectors/language-collector.js` fetches these maps with bounded
concurrency (`collection.languages.concurrency`), reusing the shared Octokit
retry and throttling behaviour. A failed request is never converted to `{}`.

- Authentication (`401`), rate-limit (`403`/`429` with rate-limit metadata) and
  malformed-response failures are always fatal.
- Other failures follow `collection.languages.failurePolicy`:
  - `fail` (default) aborts the run.
  - `skip` records the failed repository internally and marks coverage
    incomplete. Aggregation refuses incomplete input by default.
- Private repository names, full names and URLs are never logged or copied into
  errors.

When `collection.languages.includePrivate` is false, private repositories are
intentionally excluded from language aggregation and the result records that
scope. This is a configuration choice, not a silent partial failure. The
default is `true`.

## Language aggregation

`src/processors/language-aggregator.js` aggregates across included repositories:

```
percentage(language) = languageBytes / totalLanguageBytes * 100
```

Exact integer bytes are retained. Percentages are calculated from those exact
values without intermediate rounding. Languages are sorted by descending bytes,
then by name for determinism. Ranks use competition ranking, so tied byte counts
share a rank and the next rank skips.

Display values are rounded to two decimals with the largest-remainder method.
When total bytes are non-zero, displayed percentages sum to exactly `100.00`
even though individual exact percentages may not terminate. Zero total bytes is
handled without division: totals are zero and every percentage is `0`.

Aggregation deduplicates by repository ID. Identical duplicate entries are
counted once; conflicting duplicates abort. Incomplete coverage or any recorded
failure aborts aggregation unless a caller explicitly opts into a diagnostic
run. The publication pipeline must never enable that override.

## Privacy boundary

`src/processors/privacy.js` builds the public language summary by allow-list:
only aggregate byte totals, aggregate language percentages and ranks, the public
repository count, and (when explicitly configured) the aggregate private
repository count. Private repository records never cross this boundary.

Before returning, the summary is checked against every discovered private
repository. Any private name, full name, URL, description, topic or identifier
in the candidate output raises `PRIVATE_REPOSITORY_LEAK`. The check inspects
string values and identity fields, not arbitrary numeric statistics, so an
aggregate byte count that happens to equal a repository ID does not cause a
false positive.

Raw private responses remain in memory only. No collection cache is written to
a tracked path.

## Security model

- `PROFILE_GITHUB_TOKEN` is read from the environment (or a local `.env` that is
  git-ignored). It is never written to generated files or logs.
- The token only needs read access. Publishing uses the workflow-scoped
  `GITHUB_TOKEN`.
- Raw API responses may contain private metadata. They stay in memory; only
  sanitised aggregates may cross into generators. No raw collection snapshot is
  written to a tracked path.
- The sanitizer is a separate, tested boundary. It allow-lists public fields and
  detects private repository identifiers before rendering.
- If the account has private repositories and the token cannot see all of them,
  collection fails. The pipeline never publishes a statistic based on partial
  coverage.
- Output is staged, validated, and only then published. Generation failure leaves
  the previous README and assets untouched.

## 3D contribution graph

The upstream action was inspected before integration:

- Repository: `yoshi389111/github-profile-3d-contrib`, latest release `v0.9.3`.
- Action runtime is Node 24 and the distributable entry point is `dist/index.js`.
- It is configured with `GITHUB_TOKEN`, `USERNAME`, optional `MAX_REPOS`,
  optional `SETTING_JSON`, optional `YEAR`, and optional `GITHUB_ENDPOINT`.
- It writes into the fixed output folder `./profile-3d-contrib/`, using the
  `fileName` from each settings object. It does not accept arbitrary output
  folders.
- Supported documented settings fields used here are `type: "normal"`,
  `fileName`, `backgroundColor`, `foregroundColor`, `strongColor`, `weakColor`,
  `radarColor`, `growingAnimation`, and a five-entry `contribColors` array.

Our three theme documents request the filenames:

```
profile-3d-contrib.svg
profile-3d-contrib-night.svg
profile-3d-contrib-purple.svg
```

After generation, a validation/publish step must verify each file is a non-empty
SVG, then move it to the configured `assets/3d/` target. If any file is missing
or invalid, existing assets are retained and publication fails.

The action's contribution query is a genuine GitHub GraphQL contribution
calendar. Private contribution coverage depends on token access and the account's
"Include private contributions on my profile" setting; this will be verified in
Phase 4 rather than assumed.

## Generation and publish pipeline

The pipeline is implemented as follows:

1. Validate configuration and environment.
2. Authenticate and confirm the authenticated login matches the configured user.
3. Discover every owned repository, including authorized private repositories,
   with pagination and an explicit public/private count check.
4. Collect metadata and language bytes with bounded concurrency, tolerating
   empty language maps but never treating a failure as empty data.
5. Collect the contribution calendar through the GraphQL contributions
   collection, then collect bounded public activity events.
6. Aggregate languages, contributions, streaks, activity, stars, forks and
   deterministic public repository rankings; fail closed on incomplete data.
7. Sanitize: replace private repositories with aggregate-only data.
8. Render the Markdown README from the Mustache template, validate it, and
   generate the banner and language-chart SVGs from validated public data.
9. Validate privacy, SVG structure, Markdown structure and determinism.
10. Publish atomically; never partially update tracked output.

The shared orchestration lives in `src/pipeline/profile-pipeline.js`. `npm run
collect` prints the public-safe aggregate summary; `npm run publish` renders the
README and SVG assets, validates them, stages them under the configured staging
directory and publishes them onto their configured targets. `npm run publish:3d`
validates the SVGs generated by the upstream 3D contribution graph action and
publishes them onto their targets. Both commands fail closed: incomplete
collection, invalid output, or a failed publish aborts the run and leaves the
previously published README and assets untouched.

## Phase status

- [x] Phase 1: repository initialization, configuration, schemas, tooling
- [x] Phase 2: authenticated GitHub REST/GraphQL clients, errors, pagination
- [x] Phase 3: repository discovery, coverage checks, language collection and aggregation
- [x] Phase 4: contributions and statistics
- [x] Phase 5: processing and privacy
- [x] Phase 6: SVG assets and 3D graph
- [x] Phase 7: templates and README rendering
- [x] Phase 8: unit and integration tests
- [x] Phase 9: GitHub Actions
- [x] Phase 10: deployment and documentation

Phase 4 status: implemented and verified. The authenticated contribution calendar
is collected through the GraphQL contributions collection with one-year windows,
validated against the calendar total, and reduced to aggregate statistics plus
optional public per-repository splits. Public activity is collected only from
`/users/{username}/events/public` with bounded pages and a public-only filter. The
public statistics summary omits private repository splits, private contribution
details and activity event identifiers. All Phase 4 tests are mocked and network
free; live collection still requires `PROFILE_GITHUB_TOKEN`.

Phase 5 status: implemented and verified. Collectors and processors now bind the
Phase 4 public views (statistics summary, language summary, featured ranking) into
a single frozen publishable payload with a final private-repository leak gate before
any generator stage may consume it. The final gate rejects payloads that reintroduce
private names, identifiers, splits or activity metadata. The full suite is mocked
and network free; live collection still requires `PROFILE_GITHUB_TOKEN`.

Phase 6 status: implemented and verified for local SVG asset generation and 3D
settings preparation. Banner and language-chart SVG generators, SVG validation, and
three-dimensional settings preparation are covered by mocked unit tests and pass the
full quality gate. Upstream 3D action execution and writing generated assets into the
staging directory remain part of the later rendering and publication pipeline.

Phase 7 status: implemented and verified. Mustache rendering, the public template
context, README validation and rendering determinism are covered by mocked unit tests.
The staged README renders from `main.mustache` through the public context built only
from public configuration and public payload data. Markdown validation rejects empty
output, missing trailing newlines, unresolved placeholders and private leaks.

Phase 8 status: implemented and verified. The final mocked integration test runs the
complete profile pipeline from repository discovery through aggregation, sanitisation,
SVG generation, Markdown rendering and validation, then asserts the published Markdown
and assets remain private-safe and valid.

Phase 9 status: implemented and verified for repository automation. CI now runs
formatting, configuration validation, lint and the full mocked test suite. A scheduled
collection workflow runs the authenticated collection on a weekly cadence and fails
closed without a usable token. Live workflow execution requires the repository secrets
described in the deployment guide.

Phase 10 status: implemented and verified. The publish pipeline is now wired end to
end: `src/pipeline/profile-pipeline.js` shares the fail-closed collection
orchestration between `npm run collect` and `npm run publish`; `src/publisher/`
stages validated outputs and publishes them onto their configured targets; a
weekly publish workflow renders and publishes the README and SVG assets, generates
the pinned 3D contribution graph and commits the results back to the repository.
Deployment requirements, secrets and rollback procedures are documented in
[`docs/DEPLOYMENT.md`](DEPLOYMENT.md). Live publication still requires the
`PROFILE_GITHUB_TOKEN` secret on the repository.
