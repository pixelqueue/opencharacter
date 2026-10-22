import { describe, expect, it } from 'vitest';
import {
  packageName,
  parseTrustList,
  releaseLinks,
  trustArgs,
  placeholderManifest,
  publishedPackages,
  registryUrl,
  stagedId,
  trustCommand,
} from './npm-setup.ts';

describe('npm setup', () => {
  it('names packages from pack IDs', () => {
    expect(packageName('orc-sf-2e')).toBe('@opencharacter/orc-sf-2e');
    expect(packageName('@opencharacter/engine')).toBe('@opencharacter/engine');
  });

  it('never stages a real version', () => {
    expect(placeholderManifest('@opencharacter/x').version).toBe('0.0.0-trust');
  });

  it('reads the staged ID from npm output', () => {
    expect(
      stagedId(
        '+ @opencharacter/x@0.0.0-trust (staged with id d3dfa087-f83e-4f5f-8be8-c52872fb7cfe)',
      ),
    ).toBe('d3dfa087-f83e-4f5f-8be8-c52872fb7cfe');
    expect(stagedId('npm notice nothing')).toBeUndefined();
  });

  it('builds the registry URL and trust command', () => {
    expect(registryUrl('@opencharacter/x')).toBe('https://registry.npmjs.org/@opencharacter%2fx');
    expect(trustCommand('@opencharacter/x')).toBe(
      'npm trust github @opencharacter/x --file release.yml --repo pixelqueue/opencharacter --allow-publish -y',
    );
  });

  it('lists the public workspace packages, sorted', () => {
    expect(
      publishedPackages([
        { name: '@opencharacter/spec' },
        { name: '@opencharacter/web-editor', private: true },
        { name: '@opencharacter/5e-srd-5.1' },
      ]),
    ).toEqual(['@opencharacter/5e-srd-5.1', '@opencharacter/spec']);
  });

  it('reads back-to-back JSON objects from npm trust list', () => {
    const out = `{
  "id": "a1",
  "type": "github",
  "file": "release.yml",
  "repository": "pixelqueue/opencharacter",
  "permissions": { "publish": true }
}
{
  "id": "b2",
  "type": "github",
  "file": "other.yml",
  "repository": "pixelqueue/opencharacter"
}`;
    const links = parseTrustList(out);
    expect(links.map((l) => l.id)).toEqual(['a1', 'b2']);
    expect(releaseLinks(links).map((l) => l.id)).toEqual(['a1']);
    expect(parseTrustList('')).toEqual([]);
    expect(parseTrustList('{ "id": "x}", "type": "gitlab" }')).toEqual([
      { id: 'x}', type: 'gitlab' },
    ]);
  });

  it('builds the trust arguments', () => {
    expect(trustArgs('@opencharacter/x')).toEqual([
      'trust',
      'github',
      '@opencharacter/x',
      '--file',
      'release.yml',
      '--repo',
      'pixelqueue/opencharacter',
      '--allow-publish',
      '-y',
    ]);
  });
});
