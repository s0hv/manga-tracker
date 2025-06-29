import Info from '@mui/icons-material/Info';
import { Box, Tooltip } from '@mui/material';

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
