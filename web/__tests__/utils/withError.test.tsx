import { render } from '@testing-library/react';
import withError from '@/webUtils/withError';

describe('withError()', () => {
  const Comp = withError(() => <div>Successful render</div>);

  it('should render error when error prop is defined', () => {
    const { container } = render(<Comp error={new Error('fail')} />);
    expect(container).toMatchInlineSnapshot(`
<div>
  <div
    class="MuiPaper-root MuiPaper-elevation MuiPaper-elevation1 css-1w3d1px-MuiPaper-root"
  >
    <h1
      class="MuiTypography-root MuiTypography-h1 css-zze3tp-MuiTypography-root"
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
