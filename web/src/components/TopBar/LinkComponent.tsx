import React, { PropsWithChildren } from 'react';
import NextLink from 'next/link';

type LinkProps<TProps> = {
  href: string,
  prefetch?: boolean
  as?: string
  Component: React.ComponentType<PropsWithChildren<TProps>>
  passHref?: boolean
} & PropsWithChildren<TProps>



// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const LinkComponent = <TProps, T extends React.ComponentType<PropsWithChildren<TProps>>>({ href, prefetch, as, Component, children, passHref=false, ...props }: LinkProps<TProps>) => (
  <NextLink href={href} prefetch={prefetch} as={as} passHref={passHref} style={{ textDecoration: 'none', color: 'inherit' }}>
    <Component {...props as unknown as React.ComponentProps<typeof Component>}>
      {children}
    </Component>
  </NextLink>
);
