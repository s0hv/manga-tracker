import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockRequestJson, setupMockServer, TestRoot } from '@/tests/utils';
import { MangaStatus } from '@/common/mangaStatus';
import {
  type FiltersForm,
  MangaSearchFilters,
} from '@/components/manga/MangaSearch/MangaSearchFilters';
import { testServices } from '@/tests/constants';
import type { ServiceForApi } from '@/types/api/services';


const server = setupMockServer();

const extraService: ServiceForApi = {
  ...testServices[0],
  serviceId: 3,
  name: 'Not in search results',
};

const doRender = (serviceIds: number[] | undefined, onSubmit = vi.fn()) => {
  // Reversed to make sure the options are sorted by service id
  mockRequestJson(server, '/api/services', { data: [extraService, ...testServices].reverse() });

  render(
    <TestRoot>
      <MangaSearchFilters serviceIds={serviceIds} onSubmit={onSubmit} />
    </TestRoot>
  );

  return onSubmit;
};

const getCheckboxNames = () => screen.getAllByRole('checkbox')
  .map(checkbox => checkbox.closest('label')?.textContent);

describe('MangaSearchFilters', () => {
  it('Shows only the services found in the search results in service id order', async () => {
    doRender([2, 1]);

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'MANGA Plus' })).toBeInTheDocument());

    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: extraService.name })).not.toBeInTheDocument();
    expect(getCheckboxNames()).toEqual([
      'MANGA Plus',
      'MangaDex',
      'Ongoing',
      'Completed',
      'Dropped',
      'Hiatus',
    ]);
  });

  it('Shows only the status filters before the search results have loaded', async () => {
    const servicesMock = mockRequestJson(server, '/api/services', { data: testServices });
    render(
      <TestRoot>
        <MangaSearchFilters serviceIds={undefined} onSubmit={vi.fn()} />
      </TestRoot>
    );

    await waitFor(() => expect(servicesMock).toHaveBeenCalled());

    expect(getCheckboxNames()).toEqual(['Ongoing', 'Completed', 'Dropped', 'Hiatus']);
  });

  it('Submits the selected filters immediately on every change', async () => {
    const onSubmit = doRender([1, 2]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'MangaDex' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.lastCall?.[0]).toEqual({
      serviceIds: [2],
      status: [],
    } satisfies FiltersForm);

    await user.click(screen.getByRole('checkbox', { name: 'Completed' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hiatus' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));
    expect(onSubmit.mock.lastCall?.[0]).toEqual({
      serviceIds: [2],
      status: [MangaStatus.COMPLETED, MangaStatus.HIATUS],
    } satisfies FiltersForm);

    await user.click(screen.getByRole('checkbox', { name: 'MangaDex' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(4));
    expect(onSubmit.mock.lastCall?.[0]).toEqual({
      serviceIds: [],
      status: [MangaStatus.COMPLETED, MangaStatus.HIATUS],
    } satisfies FiltersForm);
  });
});
