# Manga tracker project guidelines
This project consists of two parts, a web scraper written in Python 
and a frontend web application that shows the data created by scraping 
written in React + TypeScript.

## High-level file structure
- `src` - The Python code lives here
- `web` - The frontend code lives here
- `migrations`- For database migrations. You should not read or write to this folder
- `app.json` - Dokku configuration file for the frontend app
- `Dockerfile` - Dokku app Dockerfile used to build the frontend app
- `run.py` - This is used to run the scraper in production
- `run_specific.py` - This is used for one-off runs of the scraper

## Python scraper specifics
The scraper runs on Python >=3.13 and uses `uv` for managing packages and the Python installation.
`mypy` is used for type checking and `ruff` for formatting. `uv` should be used to run all Python code and related tools.

## Web app specifics
The web app runs on Node and uses pnpm for package management.
It consists of a Node server, which serves the API, and a React
app using tanstack-start, which uses the Node server to serve the
frontend files.

Cypress tests exist, but you should never run them unless explicitly asked to run them. Just because you create or 
modify the Cypress tests does not mean to run them.

Here are some relevant commands for different tasks:
- `pnpm run tsc` - Runs type checking for the frontend, node server, 
frontend tests, and cypress tests
- `pnpm run test` - Runs the frontend tests
- `pnpm run lint` - Runs eslint
- `pnpm run build` - Builds the frontend. This command is not that fast,
so it should only be used at the end of large changes.

### Web app file structure
The most important files and folders are as follows

- `web/src` - The React code lives here
  - `api` - API endpoints that fetch from the Node server and define the tanstack-query options
  - `components` - React components
  - `middleware` - Tanstack Start middleware
  - `resources` - Static resources
  - `routes` - Tanstack Start routes that define the app's routes
  - `schemas` - Frontend schemas for responses from the API
  - `serverFunctions` - Tanstack Start server functions that should only be used in code run on the server
  - `store` - Zustand stores
  - `utils` - Miscellaneous utility files for the frontend
  - `views` - Files that compose components to create the pages. Routes should import from here.
- `web/server` - The Node server code lives here
  - `api` - The API endpoints
  - `db` - Database functions
  - `util` - Miscellaneous utility files
- `web/common` - Code common to both the React frontend and the Node server lives here, such as common zod schemas and utility functions
- `web/types` - Common TypeScript types
