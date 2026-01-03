import { forwardRef } from 'react';
import { Link as MuiLink, LinkProps as MuiLinkProps } from '@mui/material';
import { type LinkComponent, createLink } from '@tanstack/react-router';

const MuiLinkComponent = forwardRef<HTMLAnchorElement, MuiLinkProps>(
  (props, ref) => <MuiLink ref={ref} {...props} />
);

export const CreatedLink = createLink(MuiLinkComponent);

export const RouteLink: LinkComponent<typeof MuiLinkComponent> = props => {
  return <CreatedLink {...props} />;
};
