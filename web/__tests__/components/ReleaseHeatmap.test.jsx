import { Typography } from '@material-ui/core';
import React from 'react';
import { createMount, createShallow } from '@material-ui/core/test-utils';
import ReactFrappeChart from 'react-frappe-charts';

import ReleaseHeatmap from '../../src/components/ReleaseHeatmap';

describe('Release heatmap', () => {
  const data = [
    { timestamp: 1564088400, count: 3 },
    { timestamp: 1589662800, count: 1 },
    { timestamp: 1590267600, count: 28 },
    { timestamp: 1590872400, count: 1 },
    { timestamp: 1591477200, count: 1 },
    { timestamp: 1592082000, count: 2 },
    { timestamp: 1592686800, count: 2 },
    { timestamp: 1593118800, count: 2 },
  ];

  it('Should use given id and title', () => {
    const wrapper = createShallow()(
      <ReleaseHeatmap dataRows={data} id='test-id' title='test title' />
    );

    expect(wrapper.exists('div#test-id')).toBeTrue();
    expect(wrapper.find(Typography).get(0).props.children).toStrictEqual('test title');
  });

  it('Should work without data', () => {
    const wrapper = createShallow()(
      <ReleaseHeatmap dataRows={undefined} id='test-id' />
    );

    expect(wrapper.exists('div#test-id')).toBeTrue();
  });

  it('Should work without data', () => {
    const wrapper = createShallow()(
      <ReleaseHeatmap dataRows={undefined} id='test-id' />
    );

    expect(wrapper.exists('div#test-id')).toBeTrue();
  });

  it('Should update data when it changes', () => {
    const wrapper = createShallow()(
      <ReleaseHeatmap dataRows={undefined} />
    );

    expect(wrapper.exists(ReactFrappeChart)).toBeFalse();

    wrapper.setProps({ dataRows: data });
    wrapper.update();

    expect(wrapper.exists(ReactFrappeChart)).toBeTrue();
  });
});
