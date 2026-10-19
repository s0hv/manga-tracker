import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MangaCover } from '@/components/MangaCover';

const mangadexCover = 'https://uploads.mangadex.org/covers/manga-id/cover-id.jpg';
const otherCover = 'https://example.com/cover.jpg';
const title = 'Test manga';

describe('MangaCover', () => {
  it('Uses the thumbnail proxy for MangaDex covers with the given size', () => {
    const { rerender } = render(<MangaCover url={mangadexCover} alt={title} />);

    const cover = screen.getByRole('img', { name: title });
    expect(cover).toHaveAttribute('src', '/thumbnails/mangadex/manga-id/cover-id.jpg?size=256');
    expect(cover).toHaveAttribute('width', '256');
    expect(cover).toHaveAttribute('loading', 'lazy');

    rerender(<MangaCover url={mangadexCover} alt={title} size={512} />);

    expect(screen.getByRole('img', { name: title }))
      .toHaveAttribute('src', '/thumbnails/mangadex/manga-id/cover-id.jpg?size=512');
  });

  it('Uses covers hosted elsewhere as is', () => {
    render(<MangaCover url={otherCover} alt={title} />);

    expect(screen.getByRole('img', { name: title })).toHaveAttribute('src', otherCover);
  });

  it('Renders nothing without a cover by default', () => {
    const { container } = render(<MangaCover url={null} alt={title} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('Renders the alt text as a placeholder without a cover when usePlaceholder is set', () => {
    render(<MangaCover url={undefined} alt={title} usePlaceholder />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('Does not render the placeholder when a cover exists', () => {
    render(<MangaCover url={otherCover} alt={title} usePlaceholder />);

    expect(screen.getByRole('img', { name: title })).toBeInTheDocument();
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });
});
