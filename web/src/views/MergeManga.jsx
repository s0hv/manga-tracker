import fetch from 'cross-fetch';
import React from 'react';
import Typography from '@material-ui/core/Typography';
import Container from '@material-ui/core/Container';
import {makeStyles} from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Paper from '@material-ui/core/Paper'
import Grid from '@material-ui/core/Grid'
import Search from "../components/Search";
import PartialManga from "../components/PartialManga";

const host = process.env.HOST || 'http://localhost:3000';

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '400px',
    minWidth: '900px',
    padding: theme.spacing(2),
  },
  mangaView: {
    width: '48%',
  },
  searchInput: {
    width: "100%",
    marginLeft: '1em',
  },
  inputRoot: {
    width: "100%",
    color: "inherit",
  },
  mergeButton: {
    padding: theme.spacing(2),
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: theme.spacing(2),
  }
}));


function MergeManga(props) {
  const {
    isAuthenticated,
    user,
  } = props;

  const classes = useStyles();

  const [manga1, setManga1] = React.useState({});
  const [manga2, setManga2] = React.useState({});
  const [result, setResult] = React.useState({});

  const getMangaData = (manga_id, cb) => {
    fetch(`${host}/api/manga/${manga_id}`)
      .then(res => res.json())
      .then(cb)
      .catch(err => {
        console.error(err);
        cb({});
      })
  }

  const mergeManga = () => {
    if (!manga1.manga_id || !manga2.manga_id || manga1.manga_id == manga2.manga_id) return;
    fetch(`${host}/api/manga/merge/?base=${manga1.manga_id}&to_merge=${manga2.manga_id}`,
      {credentials: 'include', method: 'post'})
      .then(res => {
        if (res.status != 200) {
          setResult({error: true, message: `${res.status} ${res.statusText}`});
          return;
        }
        return res.json();
      })
      .then(json => {
        if (!json) return;
        setResult({message: `Moved ${json.alias_count} aliase(s) and ${json.chapter_count} chapter(s)`});
        setManga2({});
      })
      .catch(err => setResult({error: true, message: err.message}));
  }

  const renderItem = (setManga) => (option, index, props) => {
    return (
      <li key={index} >
        <div{...props} onClick={(e) => {
          e.currentTarget.parentElement.blur();
          getMangaData(option.manga_id, setManga);
        }}>{option.title}</div>
      </li>
    );
  }

  return (
    <Container maxWidth='xl'>
      <Paper className={classes.root}>
        <Grid
          container
          justify='space-between'
        >
          <div className={classes.mangaView}>
            <Search
              inputClasses={{
                input: classes.searchInput,
                root: classes.inputRoot,
              }}
              closeOnClick
              popperProps={{
                placement: 'bottom-start'
              }}
              renderItem={renderItem(setManga1)}

            />
            <PartialManga mangaData={manga1} showId/>
          </div>
          <div className={classes.mangaView}>
            <Search
              inputClasses={{
                input: classes.searchInput,
                root: classes.inputRoot,
              }}
              closeOnClick
              popperProps={{
                placement: 'bottom-start'
              }}
              renderItem={renderItem(setManga2)}
            />
            <PartialManga mangaData={manga2} showId />
          </div>
        </Grid>
        <Grid className={classes.mergeButton}>
          {manga1.manga_id && manga2.manga_id && manga1.manga_id !== manga2.manga_id &&
          <Button variant='contained' color='primary' onClick={mergeManga}>Merge</Button>}
          <Typography
            color={result.error ? 'error' : 'initial'}
            className={classes.errorMessage}
          >
            {result.message || null}
          </Typography>
        </Grid>
      </Paper>
    </Container>
  )
}
export default MergeManga;