import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '../../src/config/index.js';
import { buildTemplateContext } from '../../src/templates/index.js';
import {
  generateBannerSvg,
  generateLanguageChartSvg,
  renderReadme,
  validateMarkdown,
  validateSvg,
} from '../../src/generators/index.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

const PROJECT_ROOT = process.cwd();

const PAYLOAD = {
  statistics: {
    stars: 5,
    forks: 0,
    contributions: { total: 321 },
    activity: {
      items: [
        {
          type: 'PushEvent',
          repository: 'davidokothminyika-commits/davidokothminyika-commits',
          createdAt: '2026-10-20T12:31:37.000Z',
        },
      ],
      coverage: { complete: true },
    },
  },
  languages: {
    languages: [
      { name: 'JavaScript', displayPercentage: 39.42 },
      { name: 'HTML', displayPercentage: 36.43 },
      { name: 'TypeScript', displayPercentage: 9.78 },
    ],
  },
  featured: [{ fullName: 'davidokothminyika-commits/hotelsystem', stars: 1, forks: 0 }],
};

function renderWith(config) {
  const source = readFileSync(join(PROJECT_ROOT, 'main.mustache'), 'utf8');
  const publicRepositories = [
    createRepository(),
    createPrivateRepository({ name: 'secret-project' }),
  ];
  const context = buildTemplateContext({
    config,
    publicPayload: PAYLOAD,
    identity: { name: 'David Okoth Minyika' },
    now: new Date('2026-11-15T12:00:00Z'),
  });

  const { markdown } = renderReadme({ context, source });
  const validation = validateMarkdown({ markdown, repositories: publicRepositories });

  if (!validation.valid) {
    throw new Error(`Rendered README failed validation: ${validation.errors.join('; ')}`);
  }

  return { markdown, validation };
}

describe('generated profile README', () => {
  const config = loadConfig();

  it('embeds the banner image with alt text', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('<img src="assets/generated/banner.svg"');
    expect(markdown).toContain('alt="David Okoth Minyika — Full-stack developer');
  });

  it('embeds the language chart with alt text', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('<img src="assets/generated/languages.svg"');
    expect(markdown).toContain('alt="Language distribution: JavaScript 39.42%');
  });

  it('embeds the three-dimensional contribution graph', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('<img src="assets/3d/profile-3d-contrib.svg"');
    expect(markdown).toContain('alt="Three-dimensional contribution graph');
  });

  it('links the alternative 3D themes without embedding them', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('[night](assets/3d/profile-3d-contrib-night.svg)');
    expect(markdown).toContain('[purple](assets/3d/profile-3d-contrib-purple.svg)');
    expect(markdown).not.toContain('<img src="assets/3d/profile-3d-contrib-night.svg"');
    expect(markdown).not.toContain('<img src="assets/3d/profile-3d-contrib-purple.svg"');
  });

  it('uses repository-relative image paths for local assets and trusted HTTPS hosts for remote images', () => {
    const { markdown } = renderWith(config);
    const imageRefs = [...markdown.matchAll(/<img\s+src="([^"]+)"/g)].map((match) => match[1]);

    for (const ref of imageRefs) {
      if (ref.startsWith('assets/')) continue;
      expect(ref.startsWith('https://skillicons.dev/')).toBe(true);
    }
    expect(imageRefs.filter((ref) => ref.startsWith('https://skillicons.dev/'))).toHaveLength(3);
    expect(imageRefs.filter((ref) => ref.startsWith('assets/'))).toHaveLength(3);
  });

  it('renders the configurable tech stack section with skillicons.dev URLs', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('## Tech stack');
    expect(markdown).toContain('skillicons.dev/icons?i=');
    expect(markdown).not.toContain('tech-stack.svg');
    expect(markdown).toContain(
      'https://skillicons.dev/icons?i=nodejs,express,mysql&theme=dark&perline=3',
    );
    expect(markdown).toContain('https://skillicons.dev/icons?i=react,js,html&theme=dark&perline=3');
    expect(markdown).toContain(
      'https://skillicons.dev/icons?i=kotlin,bash,git,githubactions,vscode&theme=dark&perline=5',
    );
    for (const group of config.profile.technology) {
      for (const item of group.items) {
        expect(markdown).toContain(item.name);
      }
    }
  });

  it('links tech stack icons to skillicons.dev with meaningful alt text and a textual fallback', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain(
      '<a href="https://skillicons.dev"><img src="https://skillicons.dev/',
    );
    expect(markdown).toContain('alt="Backend: Node.js, Express, MySQL"');
    expect(markdown).toContain('alt="Frontend: React, JavaScript, HTML"');
    expect(markdown).toContain(
      'alt="Languages &amp; tooling: Kotlin, Shell, Git, GitHub Actions, VS Code"',
    );

    // Textual fallback stays readable when remote images fail to load.
    expect(markdown).toContain('- Node.js, Express, MySQL');
    expect(markdown).toContain('- React, JavaScript, HTML');
    expect(markdown).toContain('- Kotlin, Shell, Git, GitHub Actions, VS Code');
  });

  it('omits the tech stack section when it is disabled in configuration', () => {
    const minimal = structuredClone(config);
    minimal.rendering.sections.technology = false;

    const { markdown } = renderWith(minimal);

    expect(markdown).not.toContain('## Tech stack');
    expect(markdown).not.toContain('skillicons.dev');
  });

  it('renders currently working on from configuration', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('## Currently working on');
    expect(markdown).toContain('Node.js, Express, React, and MySQL');
    expect(markdown).toContain('Learning: Node.js');
  });

  it('omits currently working on when no entries are configured', () => {
    const minimal = structuredClone(config);
    minimal.profile.currentWork = { projects: [], focus: [], learning: [] };

    const { markdown } = renderWith(minimal);

    expect(markdown).not.toContain('## Currently working on');
  });

  it('renders connect links and filters unsafe URLs', () => {
    const styled = renderWith(config);
    expect(styled.markdown).toContain('[Email](mailto:');
    expect(styled.markdown).toContain('[GitHub](https://github.com/davidokothminyika-commits)');

    const withUnsafeLink = structuredClone(config);
    withUnsafeLink.profile.socials = [
      ...config.profile.socials,
      { label: 'Test', url: 'javascript:alert(1)', icon: 'globe' },
      { label: 'TestFTP', url: 'ftp://example.com/file', icon: 'globe' },
    ];

    const filtered = renderWith(withUnsafeLink);
    expect(filtered.markdown).not.toContain('javascript:alert');
    expect(filtered.markdown).not.toContain('ftp://');
  });

  it('renders the configured footer message and attribution', () => {
    const { markdown } = renderWith(config);

    expect(markdown).toContain('Open to collaborating on Node.js and backend projects.');
    expect(markdown).toContain('Generated automatically from my GitHub activity');
  });

  it('contains no private repository identifiers', () => {
    const { markdown } = renderWith(config);

    expect(markdown).not.toContain('secret-project');
  });

  it('omits sections whose configuration is missing', () => {
    const minimal = structuredClone(config);
    minimal.profile.socials = [];
    minimal.profile.technology = [];
    minimal.rendering.sections.footer = false;
    minimal.rendering.sections.threeDimensionalGraph = false;

    const { markdown } = renderWith(minimal);

    expect(markdown).not.toContain('## Connect');
    expect(markdown).not.toContain('## Tech stack');
    expect(markdown).not.toContain('## Contribution graph');
    expect(markdown).not.toContain('Open to collaborating on Node.js and backend projects.');
  });
});

describe('generated assets referenced by the README', () => {
  const config = loadConfig();

  it('produces a valid banner SVG with the configured background', () => {
    const banner = generateBannerSvg({
      width: config.rendering.layout.maxWidth,
      height: 220,
      colors: config.rendering.theme.colors,
      title: config.profile.identity.name,
    });
    const validation = validateSvg({
      svg: banner,
      background: config.rendering.theme.colors.background,
      width: config.rendering.layout.maxWidth,
      height: 220,
    });

    expect(validation.valid).toBe(true);
  });

  it('produces a valid language chart SVG', () => {
    const chart = generateLanguageChartSvg({
      width: config.rendering.layout.languageChart.width,
      maxLanguages: config.rendering.layout.languageChart.maxLanguages,
      showLegend: config.rendering.layout.languageChart.showLegend,
      languages: PAYLOAD.languages.languages,
      colors: config.rendering.theme.colors,
    });
    const validation = validateSvg({
      svg: chart,
      background: config.rendering.theme.colors.background,
      width: config.rendering.layout.languageChart.width,
    });

    expect(validation.valid).toBe(true);
  });
});
