import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';


import NotFound from '../../src/views/NotFound';

describe('404 page should render correctly', () => {
  it('Should match snapshot', () => {
    const { container } = render(<NotFound />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="MuiPaper-root MuiPaper-elevation MuiPaper-elevation1 css-44fik2-MuiPaper-root"
        style="--Paper-shadow: 0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12);"
      >
        <h1
          class="MuiTypography-root MuiTypography-h1 css-4nqirp-MuiTypography-root"
        >
          404 Not found
        </h1>
      </div>
    `);
  });
});
