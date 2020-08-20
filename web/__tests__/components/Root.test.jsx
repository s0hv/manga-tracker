import React from 'react';
import renderer from 'react-test-renderer';
import { createMount } from '@material-ui/core/test-utils';

import Root from '../../src/components/Root';
import { mockUTCDates } from '../utils';

const DummyComponent = () => <div />;

describe('Root component should render correctly', () => {
  mockUTCDates();
  it('Should render with empty input', () => {
    const tree = renderer
      .create(<Root Component={DummyComponent} />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('Should render with empty input and correct status code', () => {
    const tree = renderer
      .create(<Root Component={DummyComponent} props={{ statusCode: 200 }} />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('should render correctly with data', () => {
    const tree = createMount()(
      <Root
        Component={DummyComponent}
        props={{
          statusCode: 200,
          activeTheme: 1,
          user: {},
          setTheme: () => null,
        }}
      />
    ).html();

    expect(tree).toMatchSnapshot();
  });
});
