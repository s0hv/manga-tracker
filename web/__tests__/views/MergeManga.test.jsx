import React from 'react';
import renderer from 'react-test-renderer';
import MergeManga from '../../src/views/MergeManga';

describe('Merge manga page should render correctly', () => {
  it('should render correctly by default', () => {
    const tree = renderer
      .create(<MergeManga />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });
});
