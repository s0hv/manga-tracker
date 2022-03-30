import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Form } from 'react-final-form';
import ColorPicker from '../../../src/components/notifications/ColorPicker';

const Root = ({ children }) => <Form onSubmit={jest.fn()} render={() => children} />;

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
    const { x, y } = colorSlider.getBoundingClientRect();
    await user.pointer([
      { keys: '[MouseLeft>]', target: colorSlider, coords: { pageX: x + 1, pageY: y + 1 }},
      { keys: '[/MouseLeft]' },
    ]);

    expect(input.value).toMatch(/#\d{6}/i);

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
