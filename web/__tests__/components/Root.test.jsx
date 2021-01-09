import React from 'react';
import renderer from 'react-test-renderer';
import { createMount, createShallow } from '@material-ui/core/test-utils';

import Root from '../../src/components/Root';
import { adminUser, mockUTCDates, withUser } from '../utils';

const DummyComponent = () => <div />;

describe('Root component should render correctly', () => {
  mockUTCDates();

  // Replace current year with a fixed year
  jest.spyOn(Date.prototype, 'getFullYear')
    .mockImplementation(jest.fn(() => 2020));

  it('Should render with empty input', () => {
    const tree = renderer
      .create(<Root><DummyComponent /></Root>)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('Should render with empty input and correct status code', () => {
    const tree = renderer
      .create(<Root statusCode={200}><DummyComponent /></Root>)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('should render correctly with data', () => {
    const tree = createMount()(
      <Root
        statusCode={200}
        activeTheme={1}
        setTheme={() => null}
      >
        <DummyComponent />
      </Root>
    );

    expect(tree).toMatchSnapshot();
  });

  it('should render correctly with user', async () => {
    const elem = await withUser(
      adminUser,
      <Root
        statusCode={200}
        activeTheme={1}
        setTheme={() => null}
      >
        <DummyComponent />
      </Root>
    );
    const tree = createMount()(elem);

    expect(tree).toMatchSnapshot();
  });

  it('Should only return children on non 200 status code', () => {
    const wrapper = createShallow()(
      <Root
        statusCode={400}
        activeTheme={1}
        setTheme={() => null}
      >
        <DummyComponent />
      </Root>
    );
    // Check that dummy is the top level component
    expect(wrapper.find(DummyComponent).parent()).toHaveLength(0);
  });
});
