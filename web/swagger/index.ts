import fs from 'fs';
import util from 'util';

import swaggerJsdoc, { type Options } from 'swagger-jsdoc';
import YAML from 'yaml';

const readFile = util.promisify(fs.readFile);
const options = {
  definition: {
    openapi: '3.0.0',
    servers: [{
      url: `${process.env.HOST}/api`,
    }],
    info: {
      title: 'Manga tracker public API',
      version: '0.4.0',
    },
    components: undefined,
  },
  failOnErrors: true,
  apis: ['./server/api/**/*.js', './server/api/**/*.ts'], // Path relative to application root
} satisfies Options;

export const getOpenapiSpecification = async () => {
  // Read component definitions
  options.definition.components = YAML.parse(
    (await readFile('./swagger/components.yaml')).toString('utf-8')
  ).components;
  return swaggerJsdoc(options);
};
