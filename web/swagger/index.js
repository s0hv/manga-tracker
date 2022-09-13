import fs from 'fs';
import util from 'util';
import swaggerJsdoc from 'swagger-jsdoc';
import YAML from 'yaml';

const readFile = util.promisify(fs.readFile);
const options = {
  definition: {
    openapi: '3.0.0',
    servers: [{
      url: process.env.BASE_URL ? `${process.env.BASE_URL}/api` : '/api',
    }],
    info: {
      title: 'Manga tracker public API',
      version: '0.4.0',
    },
  },
  failOnErrors: true,
  apis: ['./api/**/*.js'], // Path relative to application root
};

export const getOpenapiSpecification = async () => {
  // Read component definitions
  options.definition.components = YAML.parse(
    (await readFile('./swagger/components.yaml')).toString('utf-8')
  ).components;
  return swaggerJsdoc(options);
};
