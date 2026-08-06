import { Box, Container, Link, Typography } from '@mui/material';

export function ThirdPartyNotices() {
  return (
    <Container>
      <Box sx={{ p: 5, pl: 20 }}>
        <Typography variant='h4'>Third party notices</Typography>
        <Typography>Some information shown on the site is gathered through the
          following services.
        </Typography>
        <br />
        <Link
          href='https://api.mangadex.org/docs/'
          rel='noopener noreferrer'
          target='_blank'
        >Mangadex API
        </Link>
      </Box>
    </Container>
  );
}
