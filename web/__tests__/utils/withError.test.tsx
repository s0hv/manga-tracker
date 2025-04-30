import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import withError from '@/webUtils/withError';

describe('withError()', () => {
  const Comp = withError(() => <div>Successful render</div>);

  it('should render error when error prop is defined', () => {
    const { container } = render(<Comp error={new Error('fail')} />);
    expect(container).toMatchInlineSnapshot(`
      <div>
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
