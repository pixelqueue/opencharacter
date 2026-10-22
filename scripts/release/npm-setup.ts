export const PLACEHOLDER_VERSION = '0.0.0-trust';
export const PLACEHOLDER_TAG = 'placeholder';

export function packageName(arg: string): string {
  return arg.startsWith('@') ? arg : `@opencharacter/${arg}`;
}

export function placeholderManifest(name: string): Record<string, string> {
  return {
    name,
    version: PLACEHOLDER_VERSION,
    description: 'Placeholder for trusted publishing setup. Not for use.',
    license: 'UNLICENSED',
  };
}

export function stagedId(output: string): string | undefined {
  return /staged with id ([0-9a-f-]+)/i.exec(output)?.[1];
}

export function registryUrl(name: string): string {
  return `https://registry.npmjs.org/${name.replace('/', '%2f')}`;
}

export function trustCommand(name: string): string {
  return ['npm', ...trustArgs(name)].join(' ');
}

export interface WorkspacePackage {
  name: string;
  private?: boolean;
}

/** The workspace packages that publish to npm (not private), sorted by name. */
export function publishedPackages(packages: WorkspacePackage[]): string[] {
  return packages
    .filter((p) => p.private !== true)
    .map((p) => p.name)
    .toSorted();
}

export const TRUST_REPOSITORY = 'pixelqueue/opencharacter';
export const TRUST_FILE = 'release.yml';

export interface TrustLink {
  id?: string;
  type?: string;
  file?: string;
  repository?: string;
}

/** `npm trust list --json` prints one JSON object per link, back to back (nothing when none). */
export function parseTrustList(output: string): TrustLink[] {
  const links: TrustLink[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < output.length; i++) {
    const c = output[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' && depth > 0 && --depth === 0) {
      links.push(JSON.parse(output.slice(start, i + 1)) as TrustLink);
    }
  }
  return links;
}

/** The links that let this repo's release workflow publish. */
export function releaseLinks(links: TrustLink[]): TrustLink[] {
  return links.filter(
    (l) => l.type === 'github' && l.repository === TRUST_REPOSITORY && l.file === TRUST_FILE,
  );
}

export function trustArgs(name: string): string[] {
  return [
    'trust',
    'github',
    name,
    '--file',
    TRUST_FILE,
    '--repo',
    TRUST_REPOSITORY,
    '--allow-publish',
    '-y',
  ];
}
