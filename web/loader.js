// https://github.com/TypeStrong/ts-node/discussions/1450#discussioncomment-1806115
// Taken from this lifesaver answer

// eslint-disable-next-line import/no-unresolved,import/no-extraneous-dependencies
import { resolve as resolveTs } from 'ts-node/esm';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as tsConfigPaths from 'tsconfig-paths';
import { pathToFileURL } from 'url';
import fs from 'fs';

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig();
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);

export function resolve(specifier, ctx, defaultResolve) {
  let match = matchPath(specifier);
  // Only resolve extensions for path shortcuts
  if (specifier.startsWith('@') && match && match.indexOf('.') === -1) {
    // If match is a directory point to the index file
    if (fs.existsSync(match) && fs.lstatSync(match).isDirectory()) {
      match = `${match}/index`;
    }

    // First try .ts extension and then .js
    const newFile = `${match}.ts`;
    match = fs.existsSync(newFile) ?
      newFile :
      `${match}.js`;
  }

  return match ?
    resolveTs(pathToFileURL(`${match}`).href, ctx, defaultResolve) :
    resolveTs(specifier, ctx, defaultResolve);
}

// eslint-disable-next-line import/no-unresolved,import/no-extraneous-dependencies
export { load, transformSource } from 'ts-node/esm';
