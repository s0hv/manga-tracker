import React from 'react';
import { render, screen, act, within } from '@testing-library/react';
import { create } from 'react-test-renderer';

import MangaAliases from '../../src/components/MangaAliases';

describe('MangaAliases renders correctly', () => {
  it('Should render correctly without aliases', () => {
    expect(create(<MangaAliases />)).toMatchSnapshot();
    expect(create(<MangaAliases aliases={[]} />)).toMatchSnapshot();
  });

  it('Should render correctly with aliases', () => {
    expect(create(<MangaAliases aliases={['a', 'b', 'c']} />)).toMatchSnapshot();
  });

  it('Should render correctly with editing allowed', () => {
    expect(create(<MangaAliases aliases={['a', 'b', 'c']} allowEdits />)).toMatchSnapshot();
  });
});
