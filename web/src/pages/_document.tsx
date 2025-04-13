// https://github.com/mui/material-ui/blob/34d8f6ac1f6e969e2cedabc844fc8a9896569ca5/examples/material-next-ts/pages/_document.tsx
/* eslint-disable */
import * as React from 'react';
import {
  type DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from 'next/document';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { roboto, theme } from '../utils/theme';
import {
  documentGetInitialProps,
  DocumentHeadTags,
  type DocumentHeadTagsProps,
} from '@mui/material-nextjs/v15-pagesRouter';

export default function MyDocument(props: DocumentHeadTagsProps) {
  return (
    <Html lang="en" className={roboto.className}>
      <Head>
        {/* PWA primary color */}
        <meta name="theme-color" content={theme.colorSchemes.dark?.palette.primary.main} />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="emotion-insertion-point" content="" />
        <DocumentHeadTags {...props} />
      </Head>
      <body>
        <InitColorSchemeScript defaultMode='system' attribute='class' />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

MyDocument.getInitialProps = async (ctx: DocumentContext) => {
  const finalProps = await documentGetInitialProps(ctx);
  return finalProps;
};
