import React from 'react';
import { render } from '@testing-library/react';
import NotFound from '../../src/views/NotFound';

describe('404 page should render correctly', () => {
  it('Should match snapshot', () => {
    const { container } = render(<NotFound />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="MuiPaper-root makeStyles-paper-1 MuiPaper-elevation1"
      >
        <h1
          class="MuiTypography-root makeStyles-text-2 MuiTypography-h1"
        >
          404 Not found
        </h1>
      </div>
    `);
  });
});
