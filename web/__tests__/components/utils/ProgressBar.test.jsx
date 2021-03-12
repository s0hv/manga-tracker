import { render } from '@testing-library/react';


describe('ProgressBar', () => {
  const routerMock = {};
  jest.mock('next/router', () => routerMock);

  // This mock has to be done before requiring ProgressBar.
  const mockNProgress = jest.genMockFromModule('nprogress');
  jest.mock('nprogress', () => mockNProgress);

  it('Correctly sets handlers', () => {
    require('../../../src/components/utils/ProgressBar');

    expect(routerMock.onRouteChangeStart).toBeFunction();
    expect(routerMock.onRouteChangeComplete).toBeFunction();
    expect(routerMock.onRouteChangeError).toBeFunction();
    expect(mockNProgress.configure).toHaveBeenCalled();
  });

  it('Returns null when rendered', () => {
    const { ProgressBar } = require('../../../src/components/utils/ProgressBar');
    const { container } = render(<ProgressBar />);
    expect(container.children).toBeEmpty();
  });
});
