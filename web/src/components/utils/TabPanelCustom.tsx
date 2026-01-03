import React, {
  type FC,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type TabPanelCustomProps = {
  value: number
  index: number
  noRerenderOnChange?: boolean
};
export const TabPanelCustom: FC<PropsWithChildren<TabPanelCustomProps>> = props => {
  const {
    children,
    value,
    index,
    noRerenderOnChange = false,
    ...other
  } = props;

  const [rendered, setRendered] = useState(value === index);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRendered(rendered || value === index),
    [index, rendered, value]);

  const style = useMemo(() => {
    if (value === index || !noRerenderOnChange) return { display: undefined };
    return { display: 'none' };
  }, [value, index, noRerenderOnChange]);

  return (
    <div
      role='tabpanel'
      hidden={!noRerenderOnChange && value !== index}
      style={style}
      {...other}
    >
      {((rendered && noRerenderOnChange) || value === index) && children}
    </div>
  );
};
