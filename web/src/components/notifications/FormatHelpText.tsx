import { type FC, ReactNode } from 'react';
import Info from '@mui/icons-material/Info';
import { Box, Tooltip } from '@mui/material';

export type FormatHelpTextProps = {
  name: ReactNode
  description: ReactNode
};
const FormatHelpText: FC<FormatHelpTextProps> = ({ name, description }) => (
  <Box sx={{ display: 'flex' }}>
    {name}
    <Tooltip title={description} sx={{ ml: 1 }}>
      <Info />
    </Tooltip>
    <br />
  </Box>
);

export default FormatHelpText;
