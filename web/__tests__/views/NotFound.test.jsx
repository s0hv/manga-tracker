import React from 'react';
import { render } from '@testing-library/react';
import NotFound from '../../src/views/NotFound';

describe('404 page should render correctly', () => {
  it('Should match snapshot', () => {
    const { container } = render(<NotFound />);
    expect(container.firstChild).toMatchInlineSnapshot(`
<div
  class="MuiPaper-root MuiPaper-elevation MuiPaper-elevation1 css-1w3d1px-MuiPaper-root"
>
  <h1
    class="MuiTypography-root MuiTypography-h1 css-zze3tp-MuiTypography-root"
  >
    404 Not found
  </h1>
</div>
`);
  });
});
