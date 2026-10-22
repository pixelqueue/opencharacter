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
  return `npm trust github ${name} --file release.yml --repo pixelqueue/opencharacter --allow-publish -y`;
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
