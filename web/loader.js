// https://github.com/TypeStrong/ts-node/discussions/1450#discussioncomment-1806115
// Taken from this lifesaver answer

// eslint-disable-next-line import/no-unresolved,import/no-extraneous-dependencies
import { resolve as resolveTs } from 'ts-node/esm';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as tsConfigPaths from 'tsconfig-paths';
import { pathToFileURL } from 'url';

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig();
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);

export function resolve(specifier, ctx, defaultResolve) {
  const match = matchPath(specifier);
  return match ?
    resolveTs(pathToFileURL(`${match}`).href, ctx, defaultResolve) :
    resolveTs(specifier, ctx, defaultResolve);
}

// eslint-disable-next-line import/no-unresolved,import/no-extraneous-dependencies
export { load, transformSource } from 'ts-node/esm';
