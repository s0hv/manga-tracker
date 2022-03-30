import { Tooltip, Box } from '@mui/material';
import { Info } from '@mui/icons-material';

const FormatHelpText = ({ name, description }) => (
  <Box sx={{ display: 'flex' }}>
    {name}
    <Tooltip title={description} sx={{ ml: 1 }}>
      <Info />
    </Tooltip>
    <br />
  </Box>
);

export default FormatHelpText;
