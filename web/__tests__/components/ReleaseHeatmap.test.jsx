import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import ReleaseHeatmap from '../../src/components/ReleaseHeatmap';

describe('Release heatmap', () => {
  // https://stackoverflow.com/a/65606342/6046713
  // mock ResizeObserver
  window.ResizeObserver =
    window.ResizeObserver ||
    vi.fn().mockImplementation(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    }));

  const data = [
    { timestamp: 1564088400, count: 3 },
    { timestamp: 1589662800, count: 1 },
    { timestamp: 1590267600, count: 28 },
    { timestamp: 1590872400, count: 1 },
    { timestamp: 1591477200, count: 1 },
    { timestamp: 1592082000, count: 2 },
    { timestamp: 1592686800, count: 2 },
    { timestamp: 1593118800, count: 2 },
  ];

  it('Should render correctly', () => {
    const title = 'Test title';
    render(
      <ReleaseHeatmap dataRows={data} title={title} />
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getAllByText(/\d+ \((\d+|no) releases\)/i)).toBeTruthy();
  });

  it('Should work without data', () => {
    render(
      <ReleaseHeatmap dataRows={undefined} title={null} />
    );

    // No text should be rendered
    expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
  });

  it('Should update data when it changes', () => {
    const { rerender } = render(
      <ReleaseHeatmap dataRows={undefined} />
    );

    expect(screen.queryByText(/\d+ \((\d+|no) releases\)/)).not.toBeInTheDocument();

    rerender(
      <ReleaseHeatmap dataRows={data} />
    );

    expect(screen.getAllByText(/\d+ \((\d+|no) releases\)/)).toBeTruthy();
  });
});
