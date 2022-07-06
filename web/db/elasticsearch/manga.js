import client from './index.js';

export const index = 'manga';

export const mangaSearch = (query, count, withServices = false) => {
  const fields = ['manga_id', 'title'];
  if (withServices) {
    fields.push('services.service_name');
    fields.push('services.service_id');
  }

  return client.search({
    index,
    body: {
      size: count || 5,
      fields,
      _source: false,

      query: {
        function_score: {
          query: {
            dis_max: {
              queries: [
                {
                  multi_match: {
                    query,
                    type: 'most_fields',
                    fields: [
                      'title^3',
                      'title.ngram',
                    ],
                  },
                },
                {
                  multi_match: {
                    query,
                    type: 'most_fields',
                    fields: [
                      'aliases.title^3',
                      'aliases.title.ngram',
                    ],
                  },
                },
              ],
            },
          },
          field_value_factor: {
            field: 'views',
            factor: 0.2,
            modifier: 'log2p',
          },
        },
      },
    },
  });
};

