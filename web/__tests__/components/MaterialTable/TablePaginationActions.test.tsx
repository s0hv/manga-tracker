import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import TablePaginationActions, {
  type TablePaginationActionsProps,
} from '@/components/MaterialTable/TablePaginationActions';

const defaultProps: Omit<TablePaginationActionsProps, 'onPageChange'> = {
  count: 30,
  page: 1,
  rowsPerPage: 10,
};

const buttonNames = {
  first: /first page/i,
  previous: /previous page/i,
  next: /next page/i,
  last: /last page/i,
};

const renderActions = (props: Partial<TablePaginationActionsProps> = {}) => {
  const onPageChange = vi.fn();

  render(
    <TablePaginationActions
      {...defaultProps}
      {...props}
      onPageChange={onPageChange}
    />
  );

  return { onPageChange };
};

const getButton = (name: RegExp) => screen.getByRole('button', { name });

describe('TablePaginationActions', () => {
  describe('button state', () => {
    it('disables first and previous, but enables next and last on the first page', () => {
      renderActions({ page: 0, count: 30, rowsPerPage: 10 });

      expect(getButton(buttonNames.first)).toBeDisabled();
      expect(getButton(buttonNames.previous)).toBeDisabled();
      expect(getButton(buttonNames.next)).toBeEnabled();
      expect(getButton(buttonNames.last)).toBeEnabled();
    });

    it('enables first and previous, but disables next and last on the last page', () => {
      // count 30, rowsPerPage 10 => pages 0, 1, 2, so 2 is the last page
      renderActions({ page: 2, count: 30, rowsPerPage: 10 });

      expect(getButton(buttonNames.first)).toBeEnabled();
      expect(getButton(buttonNames.previous)).toBeEnabled();
      expect(getButton(buttonNames.next)).toBeDisabled();
      expect(getButton(buttonNames.last)).toBeDisabled();
    });

    it('enables every button on a page that is neither first nor last', () => {
      renderActions({ page: 1, count: 30, rowsPerPage: 10 });

      expect(getButton(buttonNames.first)).toBeEnabled();
      expect(getButton(buttonNames.previous)).toBeEnabled();
      expect(getButton(buttonNames.next)).toBeEnabled();
      expect(getButton(buttonNames.last)).toBeEnabled();
    });

    it('disables next and last when there is only a single page', () => {
      renderActions({ page: 0, count: 5, rowsPerPage: 10 });

      expect(getButton(buttonNames.next)).toBeDisabled();
      expect(getButton(buttonNames.last)).toBeDisabled();
    });
  });

  describe('page change callbacks', () => {
    const expectClickChangesPage = async (
      buttonName: RegExp,
      expectedPage: number,
      props?: Partial<TablePaginationActionsProps>
    ) => {
      const { onPageChange } = renderActions(props);

      const user = userEvent.setup();
      await user.click(getButton(buttonName));

      expect(onPageChange).toHaveBeenCalledExactlyOnceWith(expect.anything(), expectedPage);
    };

    it('goes to the first page when the first page button is clicked', async () => {
      await expectClickChangesPage(buttonNames.first, 0, { page: 2, count: 30, rowsPerPage: 10 });
    });

    it('goes to the previous page when the previous page button is clicked', async () => {
      await expectClickChangesPage(buttonNames.previous, 1, { page: 2, count: 30, rowsPerPage: 10 });
    });

    it('goes to the next page when the next page button is clicked', async () => {
      await expectClickChangesPage(buttonNames.next, 2, { page: 1, count: 30, rowsPerPage: 10 });
    });

    it('goes to the last page when the last page button is clicked', async () => {
      await expectClickChangesPage(buttonNames.last, 2, { page: 0, count: 30, rowsPerPage: 10 });
    });
  });
});
