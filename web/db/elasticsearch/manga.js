const client = require('.');

const index = 'manga';

const mangaSearch = (query, count) => client.search({
  index,
  body: {
    size: count || 5,
    fields: ['manga_id', 'title'],
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
                    'manga_alias.title^3',
                    'manga_alias.title.ngram',
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

module.exports = {
  mangaSearch,
  index,
};
