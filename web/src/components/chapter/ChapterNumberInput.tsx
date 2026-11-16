import React, { type FC, useState } from 'react';
import { TextField } from '@mui/material';

import { type ChapterNumber, parseChapterNumber } from '@/webUtils/chapterNumber';

export type ChapterNumberInputProps = {
  defaultValue: string;
  /** Receives null when the input is not a valid chapter number */
  onChange: (chapterNumber: ChapterNumber | null) => void;
};

export const ChapterNumberInput: FC<ChapterNumberInputProps> = ({ defaultValue, onChange }) => {
  const [isValid, setIsValid] = useState(true);

  return (
    <TextField
      defaultValue={defaultValue}
      error={!isValid}
      helperText={isValid ? undefined : 'Invalid chapter number'}
      slotProps={{ htmlInput: { 'aria-label': 'Chapter number' }}}
      variant='standard'
      sx={{ width: '100%', minWidth: '100px' }}
      onChange={event => {
        const chapterNumber = parseChapterNumber(event.target.value);
        setIsValid(chapterNumber !== null);
        onChange(chapterNumber);
      }}
    />
  );
};
