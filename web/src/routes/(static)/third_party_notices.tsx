import { Box, Container, Link, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import type { StaticPageContext } from '@/types/tanstack-start';

export const Route = createFileRoute('/(static)/third_party_notices')({
  component: ThirdPartyNotices,
  context: (): StaticPageContext => ({ isStaticPage: true }),
});

function ThirdPartyNotices() {
  return (
    <Container>
      <Box padding={5} paddingLeft={20}>
        <Typography variant='h4'>Third party notices</Typography>
        <Typography>Some information shown on the site is gathered through the following services.</Typography>
        <br />
        <Link href='https://api.mangadex.org/docs/' rel='noopener noreferrer' target='_blank'>Mangadex API</Link>
      </Box>
    </Container>
  );
}
