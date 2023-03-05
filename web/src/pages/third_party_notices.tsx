import { Box, Container, Link, Paper, Typography } from '@mui/material';

const ThirdPartyNotices = () => {
  return (
    <Container>
      <Box component={Paper} padding={5} paddingLeft={20}>
        <Typography variant='h4'>Third party notices</Typography>
        <Typography>Some information shown on the site is gathered through the following services.</Typography>
        <br />
        <Link href='https://api.mangadex.org/docs/' rel='noopener noreferrer' target='_blank'>Mangadex API</Link>
      </Box>
    </Container>
  );
};

export default ThirdPartyNotices;
