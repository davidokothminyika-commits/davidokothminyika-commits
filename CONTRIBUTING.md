# Contributing and local setup

This repository builds the automated GitHub profile for
`davidokothminyika-commits`. The profile README is generated; edit configuration
and templates, not `README.md`.

## Prerequisites

- Node.js 26 LTS (the active LTS line; see `.nvmrc`)
- npm 11 or newer (the repository is developed with npm 12)
- Git

```bash
nvm use
npm ci
```

## Environment

Copy the example file and add a read-only token:

```bash
cp .env.example .env
```

`PROFILE_GITHUB_TOKEN` must be able to read every repository that should count
toward the statistics.

- **Classic token:** `read:user` and `repo` scopes. `repo` is required to read
  private repository languages; it is read-only in this project's use.
- **Fine-grained token:** read-only repository permissions for Metadata and
  Contents on all owned repositories, plus profile read permission.
- To include private contributions in the contribution calendar, enable
  **Settings → Public profile → Contributions & Activity → Include private
  contributions on my profile**.

Never commit `.env`. Never paste a token into an issue, log, or generated asset.
The publishing workflow uses the automatic `GITHUB_TOKEN`, not this personal
token.

## Commands

| Command                   | Purpose                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run auth:check`      | Verify REST + GraphQL access for the configured account                                    |
| `npm run collect`         | Discover repositories, collect languages, contributions, activity and aggregate statistics |
| `npm run publish`         | Generate, validate, stage and publish the README and generated SVG assets                  |
| `npm run publish:3d`      | Validate and publish the generated 3D contribution graphs                                  |
| `npm run validate:config` | Validate config files, invariants and environment shape                                    |
| `npm run validate`        | Config validation + ESLint + tests                                                         |
| `npm test`                | Run the Vitest suite                                                                       |
| `npm run test:watch`      | Run Vitest in watch mode                                                                   |
| `npm run test:coverage`   | Run tests with V8 coverage                                                                 |
| `npm run lint`            | Run ESLint                                                                                 |
| `npm run lint:fix`        | Apply safe ESLint fixes                                                                    |
| `npm run format`          | Format JavaScript, JSON and documentation with Prettier                                    |
| `npm run format:check`    | Verify formatting without writing                                                          |

`npm run auth:check`, `npm run collect`, `npm run publish` and `npm run publish:3d`
are the only commands that contact GitHub. `npm run collect` prints only aggregate
public-safe output; `npm run publish` writes the rendered README and generated
assets to the working tree. Neither command writes raw API responses. Unit tests
never use the network or require a token.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for secrets, workflow permissions
and the rollback procedure.

## Configuration

| File                     | Use                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `config/profile.json`    | Name, headline, about text, contact, socials, stack, featured repositories                 |
| `config/collection.json` | Visibility, forks/archived/empty handling, pagination, language collection, privacy policy |
| `config/rendering.json`  | Midnight theme tokens, layout, output paths, section toggles, timestamp                    |
| `config/3d-themes.json`  | 3D contribution graph colours and generated filenames                                      |

Configuration is validated strictly. Unknown fields, invalid colours, unsafe
paths, and contradictory privacy settings are rejected. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for every invariant.

### Private repositories and coverage

Repository discovery requests only repositories owned by the authenticated
account (`affiliation=owner`). Private repositories may contribute to aggregate
language bytes and statistics. The public output must never contain private
repository:

- names,
- URLs,
- descriptions,
- topics,
- commit messages,
- identifiers, or
- individual language breakdowns.

`config/collection.json` enforces `privateRepositoryNames: false` and
`privateLanguageBreakdown: false`. Aggregate private contribution counts remain
internal unless `publish.privateRepositoryCount` is explicitly enabled after
review.

Collection fails closed when coverage cannot be established:

- The observed public repository count must match `/user.public_repos`.
- The observed private repository count must match `/user.owned_private_repos`
  when `requirePrivateCoverage` is true.
- If GitHub omits `owned_private_repos`, a token-scope problem, SSO restriction,
  or fine-grained repository selection can hide private repositories. The run
  aborts rather than assuming zero.
- Hitting `collection.pagination.maxPages` aborts instead of truncating.
- A count mismatch caused by a repository being created or deleted mid-run also
  aborts.

The count comparison is a consistency check, not a cryptographic proof. GitHub
does not publish a signed manifest of private repositories. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#repository-discovery-and-coverage)
for the exact limits.

### Language collection failure policy

`collection.languages.failurePolicy` is `fail` by default. Any failed repository
language request aborts the run. Authentication, rate-limit and malformed-
response failures are always fatal. Setting the policy to `skip` is intended for
diagnostics: failures are recorded and aggregation refuses the incomplete data
unless a caller explicitly overrides it. Do not use `skip` for publication.

`collection.languages.includePrivate` defaults to `true`. Setting it to `false`
is an explicit public-only aggregate, not a silent failure.

## Contribution collection and statistics (Phase 4)

`npm run collect` now performs the Phase 4 collection stages in order:

1. Collect the contribution calendar through the GraphQL
   `contributionsCollection` query with a one-year window
   (`collection.contributions.windowDays`, default `365`) and a
   per-repository breakdown cap (`collection.contributions.maxRepositories`,
   default `100`).
2. Collect recent public activity through
   `GET /users/{username}/events/public` with
   `collection.recentActivity.maxPages`, `maxAgeDays` and `limit`.

The contribution window is configurable but the GraphQL API itself is limited
to one year. Daily counts are reconciled against the calendar total; category
totals are checked against the total; the per-repository breakdown is only
exposed when its sum reconciles with the total commit count.

Streaks and active days come from the collected calendar with the collection
window end as the reference date.

The public activity feed is a display sample: it is bounded by pages, age and
item limits, and incomplete feeds are reported rather than silently treated as
exhaustive.

`npm run collect` prints only the public-safe aggregate output described above.

## Language percentages

Language bytes are collected from the GitHub repository languages endpoint, one
repository at a time with bounded concurrency, and summed. Percentages use the
sum of all language bytes across included repositories:

```
percentage(language) = languageBytes / totalLanguageBytes * 100
```

Exact byte counts are kept internally and percentages are calculated without
intermediate rounding. Ranks use competition ranking. Display percentages are
rounded to two decimals with the largest-remainder method, so displayed values
sum to `100.00` when total bytes are non-zero; zero total bytes is handled
without division.

Empty language maps contribute zero bytes but remain part of repository counts.
Repositories are deduplicated by their stable numeric GitHub ID, not by name.

## Testing

Tests use deterministic fixtures and mocked API clients. No test reaches GitHub.
Coverage includes configuration invariants, path safety, authenticated identity,
bounded pagination, repository count coverage, fork/archived/empty filtering,
private repository access failures, language endpoint errors, bounded
concurrency, exact aggregation, display rounding, and privacy sanitisation.
Live authenticated collection is not exercised by the test suite.

## 3D graph generation

The graph is produced by `yoshi389111/github-profile-3d-contrib` pinned to a
reviewed commit SHA. It writes to `profile-3d-contrib/`; the workflow validates
the three SVGs before copying them to `assets/3d/`. Existing assets are preserved
when generation fails.

Do not add undocumented environment variables or settings to the upstream
action. Documented inputs were verified against the upstream repository at
v0.9.3.

## Troubleshooting

| Symptom                                | Check                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `PROFILE_GITHUB_TOKEN: not configured` | `.env` exists, is not committed, and the token is populated                   |
| `npm run auth:check` fails             | Token expiry, account ownership, SSO authorization, or missing scopes         |
| Private repositories missing           | Token repository access, SSO authorization, and collection visibility         |
| `PRIVATE_REPOSITORY_COVERAGE_*`        | Token cannot prove private coverage; fix scopes/access, do not disable        |
| `PUBLIC_REPOSITORY_COVERAGE_*`         | Token cannot enumerate all owned public repositories                          |
| `GITHUB_PAGINATION_LIMIT`              | Increase `collection.pagination.maxPages` or narrow the scope                 |
| `LANGUAGE_COLLECTION_*`                | Repository access/rate limit; inspect safe error code and retry               |
| `CONTRIBUTION_COLLECTION_*`            | Incomplete/inconsistent contribution data; re-run after token access is fixed |
| `ACTIVITY_COLLECTION_*`                | Invalid or inconsistent public activity data; inspect safe error code         |
| Language totals look low               | Empty language maps, forks/archived excluded, or `includePrivate` off         |
| Invalid configuration error            | The error names the file and field; compare with `config/` examples           |
| Formatting failure                     | Run `npm run format`, then re-run `npm run validate`                          |
| 3D graph stale                         | Check the contribution workflow and the upstream action's run logs            |

## Security

- Do not commit `.env`, `.pem`, API dumps, or raw collection snapshots.
- Do not print tokens or full API responses. The logger redacts secrets.
- Do not weaken `requirePrivateCoverage` to make a run pass. Fix token access.
- Do not publish output from an incomplete collection.
- Report suspected leakage privately to the repository owner.
