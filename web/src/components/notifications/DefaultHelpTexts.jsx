import FormatHelpText from './FormatHelpText';

const DefaultHelpTexts = () => (
  <>
    <FormatHelpText
      name='$TITLE'
      description='Title of the chapter'
    />
    <FormatHelpText
      name='$CHAPTER_NUMBER'
      description='Chapter number, e.g. 3 or 10.5'
    />
    <FormatHelpText
      name='$RELEASE_DATE'
      description='Release date as an ISO formatted string'
    />
    <FormatHelpText
      name='$UNIX_TIMESTAMP'
      description='Release date as a unix timestamp'
    />
    <FormatHelpText
      name='$URL'
      description='URL to the chapter'
    />
    <FormatHelpText
      name='$GROUP'
      description='Group who produced this chapter'
    />
    <FormatHelpText
      name='$MANGA_TITLE'
      description='Name of the manga'
    />
    <FormatHelpText
      name='$MANGA_COVER'
      description='URL to the cover of the manga if available'
    />
    <FormatHelpText
      name='$MANGA_URL'
      description='URL to the manga'
    />
    <FormatHelpText
      name='$PLATFORM_NAME'
      description='Name of the platform on which the chapter was published. e.g. MANGA Plus'
    />
    <FormatHelpText
      name='$PLATFORM_URL'
      description='URL to the platform which published the chapter'
    />
  </>
);

export default DefaultHelpTexts;
