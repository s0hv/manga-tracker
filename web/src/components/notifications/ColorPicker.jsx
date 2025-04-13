import { HexColorPicker } from 'react-colorful';
import { useCallback, useRef, useState } from 'react';
import { TextField } from 'mui-rff';
import { Box, InputAdornment, Popper } from '@mui/material';
import { useField, useForm } from 'react-final-form';
import PropTypes from 'prop-types';


const ColorPicker = ({
  name,
  label,
  sx,
  ...pickerProps
}) => {
  const { input: color } = useField(name);
  const [open, setOpen] = useState(false);

  const anchorEl = useRef(null);
  const pickerRef = useRef(null);
  const form = useForm();

  const onBlur = useCallback((event) => {
    // check if element that caused blur is within color picker
    if (pickerRef.current.contains(event.relatedTarget)) {
      event.preventDefault();
      return;
    }

    setOpen(false);
  }, [pickerRef]);

  const onInputChange = useCallback((event) => {
    // https://github.com/omgovich/react-colorful/blob/master/src/components/HexColorInput.tsx
    let col = event.target.value.replace(/([^0-9A-F]+)/gi, '').slice(0, 6);
    col = col ? '#' + col : col;

    form.change(name, col);
  }, [form, name]);

  const onColorChange = useCallback(c => {
    form.change(name, c);
  }, [form, name]);

  return (
    <Box sx={sx}>
      <TextField
        name={name}
        label={label}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onChange={onInputChange}
        inputRef={anchorEl}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start' onClick={() => setOpen(true)}>
                <Box style={{ backgroundColor: color.value, width: '1em', height: '1em' }} />
              </InputAdornment>),
          },
        }}
      />
      <Popper
        open={open}
        anchorEl={anchorEl.current}
        placement='top-start'
        style={{ zIndex: 500 }}
      >
        <Box
          ref={pickerRef}
          sx={{
            mb: 2,
          }}
        >
          <HexColorPicker
            color={color.value || '#FFFFFF'}
            onChange={onColorChange}
            {...pickerProps}
          />
        </Box>
      </Popper>
    </Box>
  );
};
ColorPicker.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  sx: PropTypes.object,
};

export default ColorPicker;
