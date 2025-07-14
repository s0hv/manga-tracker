import { ParsedUrlQuery } from 'querystring';

import { Request, Response } from 'express';
import { GetServerSidePropsContext } from 'next';
import { NextApiRequestCookies } from 'next/dist/server/api-utils';
import { GetServerSidePropsResult, PreviewData } from 'next/types';

export type GetServerSidePropsContextExpress<
  Q extends ParsedUrlQuery = ParsedUrlQuery,
  D extends PreviewData = PreviewData
> = GetServerSidePropsContext<Q, D> & { req: Request & { cookies: NextApiRequestCookies }, res: Response };

export type GetServerSidePropsExpress<
  P extends {[key: string]: any } = {[key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery,
  D extends PreviewData = PreviewData
> = (
  context: GetServerSidePropsContextExpress<Q, D>
) => Promise<GetServerSidePropsResult<P>>;

