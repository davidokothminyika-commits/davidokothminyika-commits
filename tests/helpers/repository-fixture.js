export const DEFAULT_LOGIN = 'davidokothminyika-commits';

/**
 * Build a complete GitHub repository payload. Unknown tests can override only
 * the fields they care about while keeping schema validation satisfied.
 */
export function createRepository(overrides = {}) {
  const ownerLogin = overrides.owner?.login ?? DEFAULT_LOGIN;
  const name = overrides.name ?? 'profile-project';

  return {
    id: 1001,
    private: false,
    fork: false,
    archived: false,
    disabled: false,
    description: 'A demo repository',
    language: 'JavaScript',
    topics: ['nodejs'],
    stargazers_count: 3,
    forks_count: 1,
    watchers_count: 3,
    size: 120,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
    pushed_at: '2024-02-01T00:00:00Z',
    ...overrides,
    owner: { login: ownerLogin },
    name,
    full_name: overrides.full_name ?? `${ownerLogin}/${name}`,
    html_url: overrides.html_url ?? `https://github.com/${ownerLogin}/${name}`,
  };
}

export function createPrivateRepository(overrides = {}) {
  return createRepository({
    id: 9001,
    name: 'private-project',
    private: true,
    description: 'Confidential roadmap and internal notes',
    topics: ['internal-only'],
    ...overrides,
  });
}

export function createIdentity(overrides = {}) {
  return {
    login: DEFAULT_LOGIN,
    id: 238948285,
    name: 'David Okoth Minyka',
    type: 'User',
    publicRepositoryCount: 1,
    ownedPrivateRepositoryCount: 0,
    totalPrivateRepositoryCount: 0,
    privateRepositoryCount: 0,
    followers: 0,
    following: 3,
    tokenKind: 'classic',
    scopes: ['read:user', 'repo'],
    ...overrides,
  };
}
