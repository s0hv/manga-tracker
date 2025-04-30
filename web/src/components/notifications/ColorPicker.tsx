import { HexColorPicker } from 'react-colorful';
import {
  type ChangeEvent,
  ComponentProps,
  type FocusEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import { TextFieldElement } from 'react-hook-form-mui';
import {
  type Control,
  FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form';
import { Box, InputAdornment, Popper, type SxProps } from '@mui/material';

type HexColorPickerProps = ComponentProps<typeof HexColorPicker>
export type ColorPickerProps<T extends FieldValues> = Omit<HexColorPickerProps, 'onChange' | 'color'> & {
  control?: Control<T>
  name: FieldPathByValue<T, string | undefined | null>
  label: string
  sx?: SxProps
};
const ColorPicker = <T extends FieldValues>({
  control,
  name,
  label,
  sx,
  ...pickerProps
}: ColorPickerProps<T>) => {
  const [open, setOpen] = useState(false);

  const anchorEl = useRef<HTMLElement | null>(null);
  const pickerRef = useRef<HTMLElement | null>(null);

  const { field } = useController({ name, control });
  const {
    value,
    onChange: onFieldChange,
    onBlur: onFieldBlur,
  } = field;
  const color = value as string | undefined | null;

  const onBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
    // check if the element that caused blur is within color picker
    if (pickerRef.current!.contains(event.relatedTarget)) {
      event.preventDefault();
      return;
    }

    setOpen(false);
  }, [pickerRef]);

  const onInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    // https://github.com/omgovich/react-colorful/blob/master/src/components/HexColorInput.tsx
    let col = event.target.value.replace(/([^0-9A-F]+)/gi, '').slice(0, 6);
    col = col ? '#' + col : col;

    onFieldChange(col);
    onFieldBlur();
  }, [onFieldChange, onFieldBlur]);

  const onColorChange = useCallback((c: string) => {
    onFieldChange(c);
    onFieldBlur();
  }, [onFieldChange, onFieldBlur]);

  return (
    <Box sx={sx}>
      <TextFieldElement
        control={control}
        name={name}
        label={label}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onChange={onInputChange}
        inputRef={anchorEl}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start' onClick={() => setOpen(true)}>
                <Box style={{ backgroundColor: color ?? undefined, width: '1em', height: '1em' }} />
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
            color={color || '#FFFFFF'}
            onChange={onColorChange}
            {...pickerProps}
          />
        </Box>
      </Popper>
    </Box>
  );
};

export default ColorPicker;
