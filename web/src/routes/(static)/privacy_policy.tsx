import { Container, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import type { StaticPageContext } from '@/types/tanstack-start';

export const Route = createFileRoute('/(static)/privacy_policy')({
  component: PrivacyPolicy,
  context: (): StaticPageContext => ({ isStaticPage: true }),
});

// Generated in part by https://www.gdprprivacynotice.com/
export function PrivacyPolicy() {
  return (
    <Container
      sx={{
        '& > h4': {
          mt: '2rem',
          mb: 1,
        },
      }}
    >
      <Typography variant='h2'>Privacy Policy</Typography>
      <Typography component='p'>This is the Privacy Policy for the service Manga Tracker accessible from https://manga.gachimuchi.men</Typography>
      <Typography component='p'>At Manga tracker, accessible from https://manga.gachimuchi.men, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Manga tracker and how we use it.</Typography>
      <Typography component='p'>
        Manga Tracker does not collect any data of users who have not signed up
        except for preferences such as selected theme. This data is stored locally on the users machine.
      </Typography>

      <Typography component='p'>
        By signing up for this website you acknowledge that we will collect
        a username and an email address. Necessary information is also collected
        so that the user can be identified when they log in again.
      </Typography>

      <Typography component='p'>
        Manga Tracker allows for users to track releases of manga releases.
        Only the necessary data is stored to remember the users selected preferences.
        The user can modify or remove these preferences at any time.
      </Typography>

      <Typography component='p'>
        Users who have signed up may at any time delete or request a copy of their data stored in the service
        from https://manga.gachimuchi.men/profile. Users without an account registered
        do not have any identifiable data stored remotely.
      </Typography>

      <p>If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at manga-tracker@gachimuchi.men</p>

      <Typography variant='h4'>Log Files</Typography>

      <Typography component='p'>Manga tracker follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services' analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp and referring/exit pages. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.</Typography>

      <Typography variant='h4'>Third Party Privacy Policies</Typography>

      <Typography component='p'>Manga tracker's Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options. </Typography>

      <Typography component='p'>You can choose to disable cookies through your individual browser options. To know more detailed information about cookie management with specific web browsers, it can be found at the browsers' respective websites.</Typography>

      <Typography variant='h4'>Children's Information</Typography>

      <Typography component='p'>Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity.</Typography>

      <Typography component='p'>Manga tracker does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.</Typography>

      <Typography variant='h4'>Consent</Typography>

      <Typography component='p'>By using our website, you hereby consent to our Privacy Policy and agree to its terms.</Typography>
    </Container>
  );
};
