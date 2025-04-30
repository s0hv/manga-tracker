import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabPanelCustom } from '../../../src/components/utils/TabPanelCustom';

const testId = 'testId';
const DummyComponent = () => <span data-testid={testId}>test</span>;

describe('TabPanelCustom should handle rerender logic correctly', () => {
  it('Should render when initial index matches value', () => {
    render(
      <TabPanelCustom value={0} index={0}>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('Should not render when initial index does not match value', () => {
    render(
      <TabPanelCustom value={0} index={1}>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  });

  it('Should not render when initial index does not match value and norerender is true', () => {
    render(
      <TabPanelCustom value={0} index={1} noRerenderOnChange>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  });

  it('Should hide and not render the element on change', () => {
    const { rerender } = render(
      <TabPanelCustom value={0} index={0}>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(screen.getByTestId(testId)).toBeInTheDocument();

    rerender(
      <TabPanelCustom value={1} index={0}>
        <DummyComponent />
      </TabPanelCustom>
    );

    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  });

  it('Should hide the element while keeping it rendered on change with noRerenderOnChange', () => {
    const { rerender } = render(
      <TabPanelCustom value={0} index={0} noRerenderOnChange>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(screen.getByTestId(testId)).toBeInTheDocument();

    rerender(
      <TabPanelCustom value={1} index={0} noRerenderOnChange>
        <DummyComponent />
      </TabPanelCustom>
    );

    expect(screen.getByTestId(testId)).toBeInTheDocument();

    // The panel should still exist in the document tree as hidden
    expect(screen.getByRole('tabpanel', { hidden: true }).style)
      .toHaveProperty('display', 'none');

    rerender(
      <TabPanelCustom value={0} index={0} noRerenderOnChange>
        <DummyComponent />
      </TabPanelCustom>
    );

    expect(screen.getByTestId(testId)).toBeInTheDocument();

    expect(screen.getByRole('tabpanel').style)
      .toHaveProperty('display', '');
  });
});
