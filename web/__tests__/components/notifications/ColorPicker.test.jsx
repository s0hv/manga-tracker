import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Form } from 'react-final-form';
import ColorPicker from '../../../src/components/notifications/ColorPicker';

const Root = ({ children }) => <Form onSubmit={jest.fn()} render={() => children} />;

// https://github.com/omgovich/react-colorful/blob/c7e87161d71be9156b0c149d0e110fa24fd7037d/tests/components.test.js#L36
// Mock `HTMLElement.getBoundingClientRect` to be able to read element sizes
// See https://github.com/jsdom/jsdom/issues/135#issuecomment-68191941
Object.defineProperties(HTMLElement.prototype, {
  getBoundingClientRect: {
    get: () => () => ({
      left: 5,
      top: 5,
      x: 5,
      y: 5,
      width: 100,
      height: 100,
    }),
  },
});

// Fix to pass `pageX` and `pageY`
// See https://github.com/testing-library/react-testing-library/issues/268
class FakeMouseEvent extends MouseEvent {
  constructor(type, values = {}) {
    super(type, { buttons: 1, bubbles: true, ...values });

    Object.assign(this, {
      pageX: values.pageX || 0,
      pageY: values.pageY || 0,
    });
  }
}

describe('ColorPicker', () => {
  const testLabel = 'Color label for testing';

  const Rendered = () => (
    <Root>
      <ColorPicker
        name='color'
        label={testLabel}
      />
    </Root>
  );

  const expectColorWheelExist = () => {
    expect(screen.getByRole('slider', { name: /color/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /hue/i })).toBeInTheDocument();
  };

  it('Renders correctly', async () => {
    render(<Rendered />);

    const user = userEvent.setup();

    expect(screen.queryByRole('slider', { name: /color/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /hue/i })).not.toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: testLabel });
    expect(input).toBeInTheDocument();

    await user.click(input);

    expectColorWheelExist();
  });

  it('Does not blur when clicking color wheel', async () => {
    render(<Rendered />);

    const user = userEvent.setup();

    const input = screen.getByRole('textbox', { name: testLabel });
    expect(input).toBeInTheDocument();

    await user.click(input);

    expectColorWheelExist();

    const colorSlider = screen.getByRole('slider', { name: /color/i });

    // user.pointer does not work here. input.value evaluates to #NaNNaNNaN
    fireEvent(colorSlider, new FakeMouseEvent('mousedown', { pageX: 0, pageY: 0 }));
    fireEvent(colorSlider, new FakeMouseEvent('mousemove', { pageX: 10, pageY: 10 }));

    expect(input.value).toMatch(/#[a-f\d]{6}/i);

    expectColorWheelExist();
  });

  it('Filters out non hex color values for input', async () => {
    render(<Rendered />);


    const user = userEvent.setup();

    const input = screen.getByRole('textbox', { name: testLabel });
    expect(input).toBeInTheDocument();

    await user.type(input, 'mlkptyu');

    expect(input.value).toBe('');
  });

  it('Filters out allow hex color values for input', async () => {
    render(<Rendered />);

    const user = userEvent.setup();

    const input = screen.getByRole('textbox', { name: testLabel });
    expect(input).toBeInTheDocument();

    const color = '#FF0AE5';
    await user.type(input, color);

    expect(input.value).toBe(color);
  });
});
