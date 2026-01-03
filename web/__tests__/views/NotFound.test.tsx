import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';


import NotFound from '@/views/NotFound';

describe('404 page should render correctly', () => {
  it('Should match snapshot', () => {
    const { container } = render(<NotFound />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="MuiBox-root css-1gt7mqe"
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
