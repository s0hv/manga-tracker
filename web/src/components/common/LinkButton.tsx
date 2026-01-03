import React from 'react';
import { Button } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import { type LinkComponent, createLink } from '@tanstack/react-router';

type MUIButtonLinkProps = ButtonProps<'a'>;

const MUIButtonLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MUIButtonLinkProps
>((props, ref) => <Button ref={ref} component='a' {...props} />);

const CreatedButtonLinkComponent = createLink(MUIButtonLinkComponent);

export const LinkButton: LinkComponent<typeof MUIButtonLinkComponent> = props => {
  return <CreatedButtonLinkComponent {...props} />;
};
