import React from 'react';
import { create } from 'react-test-renderer';
import NotFound from '../../src/views/NotFound';

describe('404 page should render correctly', () => {
  it('Should match snapshot', () => {
    expect(create(<NotFound />)).toMatchSnapshot();
  });
});
