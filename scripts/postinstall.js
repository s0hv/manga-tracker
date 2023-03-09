const { execSync } = require('child_process');

if (process.env.SKIP_POSTINSTALL) {
  process.exit(0);
} else {
  try {
    execSync('pnpm install --frozen-lockfile', { stdio: 'inherit' });
  }
  catch (e) {
    process.exit(e.status || 1);
  }

  process.exit(0);
}

