import { ParsedUrlQuery } from 'querystring';
import { GetServerSidePropsResult, PreviewData } from 'next/types';
import { GetServerSidePropsContext } from 'next';
import { NextApiRequestCookies } from 'next/dist/server/api-utils';
import { Request } from 'express';

export type GetServerSidePropsContextExpress<
  Q extends ParsedUrlQuery = ParsedUrlQuery,
  D extends PreviewData = PreviewData
> = GetServerSidePropsContext<Q, D> & { req: Request & { cookies: NextApiRequestCookies } }

export type GetServerSidePropsExpress<
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery,
  D extends PreviewData = PreviewData
> = (
  context: GetServerSidePropsContextExpress<Q, D>
) => Promise<GetServerSidePropsResult<P>>

