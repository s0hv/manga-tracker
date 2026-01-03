import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import withError from '@/webUtils/withError';

describe('withError()', () => {
  const Comp = withError(() => <div>Successful render</div>);

  it('should render error when error prop is defined', () => {
    const { container } = render(<Comp error={new Error('fail')} />);
    expect(container).toMatchInlineSnapshot(`
      <div>
        <div
          class="MuiBox-root css-1gt7mqe"
        >
          <h1
            class="MuiTypography-root MuiTypography-h1 css-4nqirp-MuiTypography-root"
          >
            404 Not found
          </h1>
        </div>
      </div>
    `);
  });

  it('should render component when error is not defined', () => {
    const { container } = render(<Comp />);
    expect(container).toMatchInlineSnapshot(`
<div>
  <div>
    Successful render
  </div>
</div>
`);
  });
});
