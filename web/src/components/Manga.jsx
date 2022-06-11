import {
  Button,
  Container,
  Grid,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useCSRF } from '../utils/csrf';
import { useUser } from '../utils/useUser';
import { followUnfollow } from '../utils/utilities';
import ChapterList from './ChapterList';
import MangaAliases from './MangaAliases';
import MangaInfo from './MangaInfo';
import MangaSourceList from './MangaSourceList';
import { TabPanelCustom } from './utils/TabPanelCustom';
import { getMangaReleases } from '../api/chapter';
import { MangaCover } from './MangaCover';

const ReleaseHeatmap = dynamic(() => import('./ReleaseHeatmap'));


const verticalBreakpoint = 910;

const TitleBar = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
});

const MangaTitle = styled(Typography)(({ theme }) => ({
  width: '85%',
  textAlign: 'left',
  paddingBottom: '10px',
  [theme.breakpoints.down('md')]: {
    width: '100%',
  },
}));

const TitleBarButtonsContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  width: '15%',
  justifyContent: 'flex-end',
  [theme.breakpoints.down('sm')]: {
    flexFlow: 'column',
    width: '12%',
  },
}));

const PREFIX = 'Manga';
const classes = {
  sourceList: `${PREFIX}-sourceList`,
};

const DetailsContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexFlow: 'row',
  [theme.breakpoints.down(verticalBreakpoint)]: {
    flexFlow: 'wrap',
    justifyContent: 'center',
  },
  [`& .${classes.sourceList}`]: {
    marginLeft: '35px',
    [theme.breakpoints.down(verticalBreakpoint)]: {
      marginLeft: '23px',
    },
    [theme.breakpoints.down('sm')]: {
      marginLeft: '13px',
    },
  },
}));


function Manga(props) {
  const {
    mangaData: {
      manga,
      services,
      aliases,
    },
    userFollows = [],
  } = props;

  const [releaseData, setReleaseData] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const changeTab = useCallback((e, newVal) => setActiveTab(newVal), []);
  const csrf = useCSRF();

  useEffect(() => {
    getMangaReleases(manga.mangaId)
      .then(js => {
        setReleaseData(js);
      });
  }, [manga.mangaId]);

  const { isAuthenticated, isAdmin } = useUser();

  const [editing, setEditing] = useState(false);
  const startEditing = useCallback(() => setEditing(!editing), [editing]);

  const serviceMangaData = useMemo(() => {
    const serviceMap = {};
    services.forEach(service => { serviceMap[service.serviceId] = { urlFormat: service.urlFormat, titleId: service.titleId } });
    return serviceMap;
  }, [services]);

  return (
    <Container maxWidth='lg' disableGutters>
      <Paper sx={{ p: '1em', minWidth: '440px' }}>
        <TitleBar>
          <MangaTitle variant='h4'>{manga.title}</MangaTitle>
          {isAdmin && (
            <TitleBarButtonsContainer>
              <Link href={`/admin/manga/${manga.mangaId}`} passHref>
                <Tooltip title='Admin page'>
                  <IconButton size='large'>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </Link>
              <Tooltip title='Edit chapters'>
                <IconButton onClick={startEditing} size='large'>
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </TitleBarButtonsContainer>
          )}
        </TitleBar>
        <DetailsContainer>
          <a href={manga.mal} target='_blank' rel='noreferrer noopener' aria-label='myanimelist page of the manga'>
            <MangaCover
              url={manga.cover}
              alt={manga.title}
            />
          </a>
          <Grid
            container
            justifyContent='center'
            sx={{ justifyContent: { sm: 'space-between' }}}
          >
            <Grid
              container
              direction='column'
              sx={{ width: 'fit-content', overflow: 'auto', ml: { xs: 0, md: 4 }}}
            >
              <MangaInfo mangaData={manga} />
              <MangaAliases aliases={aliases} />
            </Grid>
            <MangaSourceList
              classesProp={[classes.sourceList]}
              items={services}
              userFollows={userFollows}
              followUnfollow={(serviceId) => followUnfollow(csrf, manga.mangaId, serviceId)}
            />
          </Grid>
        </DetailsContainer>
        {isAuthenticated && (
          <Button
            variant='contained'
            color='primary'
            onClick={followUnfollow(csrf, manga.mangaId, null)}
            sx={{ mt: 2, mb: 2 }}
            aria-label='Follow all releases'
          >
            {userFollows.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
          </Button>
        )}

        <Tabs onChange={changeTab} value={activeTab}>
          <Tab label='Chapters' value={0} />
          <Tab label='Stats' value={1} />
        </Tabs>
        <TabPanelCustom value={activeTab} index={0} noRerenderOnChange>
          <ChapterList
            editable={editing}
            serviceMangaData={serviceMangaData}
            mangaId={manga.mangaId}
          />
        </TabPanelCustom>
        <TabPanelCustom value={activeTab} index={1} noRerenderOnChange>
          <ReleaseHeatmap
            dataRows={releaseData}
          />
        </TabPanelCustom>
      </Paper>
    </Container>
  );
}

export default Manga;
