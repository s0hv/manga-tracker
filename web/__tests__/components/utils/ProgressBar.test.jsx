import { render } from '@testing-library/react';


describe('ProgressBar', () => {
  const routerMock = {};
  jest.mock('next/router', () => routerMock);

  // This mock has to be done before requiring ProgressBar.
  const mockNProgress = jest.genMockFromModule('nprogress');
  jest.mock('nprogress', () => mockNProgress);

  it('Should not do anything on import', () => {
    require('../../../src/components/utils/ProgressBar');

    expect(routerMock.onRouteChangeStart).toBeUndefined();
    expect(routerMock.onRouteChangeComplete).toBeUndefined();
    expect(routerMock.onRouteChangeError).toBeUndefined();
    expect(mockNProgress.configure).not.toHaveBeenCalled();
  });

  it('Correctly sets handlers', () => {
    const { default: ProgressBar } = require('../../../src/components/utils/ProgressBar');
    const { container } = render(<ProgressBar />);
    expect(container.children).toBeEmpty();

    expect(routerMock.onRouteChangeStart).toBeFunction();
    expect(routerMock.onRouteChangeComplete).toBeFunction();
    expect(routerMock.onRouteChangeError).toBeFunction();
    expect(mockNProgress.configure).toHaveBeenCalled();
  });
});
