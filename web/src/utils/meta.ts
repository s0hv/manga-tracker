// Stripped down version of these
// https://git.paperclover.net/clo/sitegen/src/branch/master/lib/render/meta.ts
// https://paperclover.net/blog/webdev/one-year-next-app-router#next-metadata
import type {
  DetailedHTMLProps,
  MetaHTMLAttributes, ReactElement,
} from 'react';

export interface Meta {
  /** Required for all pages. `<title>{content}</title>` */
  title: string
  /** Recommended for all pages. `<meta name="description" content="{...}" />` */
  description?: string | null

  /** Automatically generate both OpenGraph and Twitter meta tags */
  embed?: AutoEmbed | null
  /** Add a robots tag for `noindex` and `nofollow` */
  denyRobots?: boolean | null
  /** Add 'og:*' meta tags */
  openGraph?: OpenGraph | null
  /** Refer to an oEmbed file. See https://oembed.com */
  oEmbed?: string
  /**
   * '#sitegen/meta' intentionally excludes a lot of exotic tags.
   * Add these manually using JSX syntax:
   *
   *     extra: [
   *       <meta name="site-verification" content="waffles" />,
   *     ],
   */
  extra?: ReactElement<MetaDescriptor>[]

  /** Adds `<meta name="author" content="{...}" />` */
  authors?: string[]
  /** Adds `<meta name="keywords" content="{keywords.join(', ')}" />` */
  keywords?: string[]
  /** Adds `<meta name="publisher" content="{...}" />` */
  publisher?: string | null
  /** Defaults to `width=device-width, initial-scale=1.0` for mobile compatibility. */
  viewport?: string
}

export interface AutoEmbed {
  /* Defaults to the page title. */
  title?: string | null
  /* Defaults to the page description. */
  description?: string | null
  /* Provide to add an embed image. */
  thumbnail?: string | null
  /** @default "banner", which applies twitter:card = "summary_large_image" */
  thumbnailSize?: 'banner' | 'icon'
  /* Ignored if not passed */
  siteTitle?: string | null
}

/** See https://ogp.me for extra rules. */
export interface OpenGraph {
  /** The title of your object as it should appear within the graph */
  title?: string
  /** A one to two sentence description of your object. */
  description?: string | null
  /** The type of your object, e.g., "video.movie". Depending on the type you specify, other properties may also be required */
  type?: string
  /** An image URL which should represent your object within the graph */
  image?: OpenGraphField
  /** The canonical URL of your object that will be used as its permanent ID in the graph, e.g., "https://www.imdb.com/title/tt0117500/" */
  url?: string
  /** A URL to an audio file to accompany this object */
  audio?: OpenGraphField
  /** The word that appears before this object's title in a sentence.
   * An enum of (a, an, the, "", auto). If auto is chosen, the consumer
   * of your data should choose between "a" or "an". Default is "" (blank) */
  determiner?: string
  /** The locale these tags are marked up in. Of the format language_TERRITORY. Default is en_US */
  locale?: string
  /** An array of other locales this page is available in */
  'locale:alternate'?: string[]
  /** If your object is part of a larger website, the name which should be displayed for the overall site. e.g., "IMDb" */
  site_name?: string
  /** A URL to a video file that complements this object */
  video?: OpenGraphField
  [field: string]: OpenGraphField
}

/**
 * When passing an array, the property is duplicated.
 * When passing an object, the fields are emitted as namespaced with ':'.
 */
type OpenGraphField =
  | string
  | {[field: string]: OpenGraphField }
  | Array<OpenGraphField>
  | (null | undefined);

type MetaDescriptor = DetailedHTMLProps<
  MetaHTMLAttributes<HTMLMetaElement>,
  HTMLMetaElement
>;

export const DEFAULT_OPEN_GRAPH: OpenGraph = {
  title: 'Manga tracker',
  site_name: 'Manga tracker',
  type: 'website',
  locale: 'en_IE',
};

export function defineMeta(meta: Meta) {
  const title = meta.title
    ? `${meta.title} - Manga tracker`
    : 'Manga tracker';

  const description = meta.description ?? null;
  const denyRobots = Boolean(meta.denyRobots);
  const authors = meta.authors ?? null;
  const keywords = meta.keywords ?? null;
  const publisher = meta.publisher ?? null;

  const embed = meta.embed ?? null;
  let openGraph = {
    ...DEFAULT_OPEN_GRAPH,
    ...meta.openGraph,
  };

  if (embed) {
    const { thumbnail, siteTitle } = embed;
    openGraph = {
      type: 'website',
      title: embed.title ?? title,
      description: embed.description ?? description,
      ...openGraph,
    };

    if (thumbnail) {
      openGraph.image = embed.thumbnail;
    }
    if (siteTitle) {
      openGraph.site_name = siteTitle;
    }
  }

  const metaTags: MetaDescriptor[] = [{ title }];

  if (description) {
    metaTags.push({ name: 'description', content: description });
  }

  for (const author of authors ?? []) {
    metaTags.push({ name: 'author', content: author });
  }

  if (keywords) {
    metaTags.push({ name: 'keywords', content: keywords.join(', ') });
  }

  if (publisher) {
    metaTags.push({ name: 'publisher', content: publisher });
  }

  if (denyRobots) {
    metaTags.push({ name: 'robots', content: 'noindex,nofollow' });
  }

  if (openGraph) {
    renderOpenGraph(metaTags, 'og:', openGraph);
  }

  if (meta.extra) {
    for (const { type, props } of meta.extra) {
      if (type === 'meta') {
        metaTags.push(props as (typeof metaTags)[number]);
      }
    }
  }

  return metaTags;
}

function renderOpenGraph(
  tags: MetaDescriptor[],
  name: string,
  content: OpenGraphField
): void {
  if (!content) return;

  if (typeof content === 'string') {
    tags.push({ name, content });
    return;
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      renderOpenGraph(tags, name, item);
    }
    return;
  }

  for (const [key, item] of Object.entries(content)) {
    renderOpenGraph(tags, `${name}:${key}`, item);
  }
}
