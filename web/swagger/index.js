const fs = require('fs');
const util = require('util');
const swaggerJsdoc = require('swagger-jsdoc').default;
const YAML = require('yaml');

const readFile = util.promisify(fs.readFile);
const options = {
  definition: {
    openapi: '3.0.0',
    servers: [{
      url: process.env.BASE_URL || '/api',
    }],
    info: {
      title: 'Manga tracker public API',
      version: '0.2.0',
    },
  },
  apis: ['./api/**/*.js'], // Path relative to application root
};

module.exports.getOpenapiSpecification = async () => {
  // Read component definitions
  options.definition.components = YAML.parse(
    (await readFile('./swagger/components.yaml')).toString('utf-8')
  ).components;
  return swaggerJsdoc(options);
};
