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
} from '@material-ui/core';

import { makeStyles } from '@material-ui/core/styles';

import {
  Edit as EditIcon,
  Settings as SettingsIcon,
} from '@material-ui/icons';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCSRF } from '../utils/csrf';
import { useUser } from '../utils/useUser';
import { followUnfollow } from '../utils/utilities';
import ChapterList from './ChapterList';
import MangaAliases from './MangaAliases';
import MangaInfo from './MangaInfo';

import MangaSourceList from './MangaSourceList';
import ReleaseHeatmap from './ReleaseHeatmap';
import { TabPanelCustom } from './utils/TabPanelCustom';
import { getMangaReleases } from '../api/chapter';


const useStyles = makeStyles((theme) => ({
  title: {
    width: '75%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  titleBarButtonsContainer: {
    display: 'flex',
  },
  thumbnail: {
    maxWidth: '250px',
    maxHeight: '355px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '200px',
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '250px',
    },
  },
  details: {
    display: 'flex',
    flexFlow: 'row',
    [theme.breakpoints.down('xs')]: {
      flexFlow: 'wrap',
      justifyContent: 'center',
    },
  },
  detailText: {
    marginLeft: '5px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '3px',
    },
  },
  infoTable: {
    marginLeft: '30px',
    marginTop: '3px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '20px',
    },
    [theme.breakpoints.down('xs')]: {
      marginLeft: '10px',
    },
  },
  sourceList: {
    marginLeft: '35px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '23px',
    },
    [theme.breakpoints.down('xs')]: {
      marginLeft: '13px',
    },
  },
  followButton: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  paper: {
    padding: '1em',
    minWidth: '440px',
  },
  infoGrid: {
    marginLeft: theme.spacing(4),
    width: 'fit-content',
    [theme.breakpoints.down('xs')]: {
      marginLeft: '0px',
    },
  },
  rootGrid: {
    [theme.breakpoints.down('xs')]: {
      justifyContent: 'center',
    },
  },
}));


function Manga(props) {
  const {
    mangaData: {
      manga,
      chapters,
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

  const { isAuthenticated, user } = useUser();

  const classes = useStyles();
  const [editing, setEditing] = useState(false);
  const startEditing = useCallback(() => setEditing(!editing), [editing]);

  const serviceUrlFormats = useMemo(() => {
    const serviceMap = {};
    services.forEach(service => { serviceMap[service.serviceId] = service.urlFormat });
    return serviceMap;
  }, [services]);

  const mangaChapters = React.useMemo(() => {
    if (!chapters) return [];
    const serviceMap = {};
    services.forEach(service => { serviceMap[service.serviceId] = service.urlFormat });
    return chapters.map(chapter => {
      const newChapter = { ...chapter };
      newChapter.releaseDate = new Date(chapter.releaseDate);
      newChapter.url = serviceMap[chapter.serviceId].replace('{}', chapter.chapterIdentifier);
      return newChapter;
    });
  }, [chapters, services]);

  return (
    <Container maxWidth='lg' disableGutters>
      <Paper className={classes.paper}>
        <div className={classes.titleBar}>
          <Typography className={classes.title} variant='h4'>{manga.title}</Typography>
          {user?.admin && (
            <div className={classes.titleBarButtonsContainer}>
              <Link href={`/admin/manga/${manga.mangaId}`} prefetch={false}>
                <Tooltip title='Admin page'>
                  <IconButton>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </Link>
              <Tooltip title='Edit chapters'>
                <IconButton onClick={startEditing}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </div>
          )}
        </div>
        <div className={classes.details}>
          <a href={manga.mal} target='_blank' rel='noreferrer noopener'>
            <img
              src={manga.cover}
              className={classes.thumbnail}
              alt={manga.title}
            />
          </a>
          <Grid
            container
            justify='space-between'
            className={classes.rootGrid}
          >
            <Grid
              container
              direction='column'
              className={classes.infoGrid}
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
        </div>
        {isAuthenticated && (
          <Button
            variant='contained'
            color='primary'
            onClick={followUnfollow(csrf, manga.mangaId, null)}
            className={classes.followButton}
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
            serviceUrlFormats={serviceUrlFormats}
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
