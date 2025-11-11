import logging
import os

from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)

INDEX_NAME = os.getenv('ES_INDEX', 'manga')
INDEX_SETTINGS = {
    'analysis': {
        'analyzer': {
            'trigram_analyzer': {
                'filter': ['lowercase'],
                'type': 'custom',
                'tokenizer': 'trigram_tokenizer',
            }
        },
        'tokenizer': {
            'trigram_tokenizer': {
                'token_chars': ['letter', 'digit'],
                'min_gram': '3',
                'type': 'ngram',
                'max_gram': '3',
            }
        },
    }
}
INDEX_MAPPINGS = {
    'properties': {
        'manga_id': {'type': 'integer'},
        'title': {
            'type': 'text',
            'fields': {'ngram': {'type': 'text', 'analyzer': 'trigram_analyzer'}},
        },
        'views': {'type': 'integer', 'null_value': 0},
        'aliases': {
            'properties': {
                'title': {
                    'type': 'text',
                    'fields': {'ngram': {'type': 'text', 'analyzer': 'trigram_analyzer'}},
                }
            }
        },
        'services': {
            'properties': {
                'service_id': {'type': 'short'},
                'service_name': {
                    'type': 'text',
                    'fields': {'keyword': {'type': 'keyword', 'ignore_above': 256}},
                },
            }
        },
    }
}


def get_client() -> Elasticsearch:
    auth = (
        None
        if 'ELASTIC_USERNAME' not in os.environ
        else (os.getenv('ELASTIC_USERNAME'), os.getenv('ELASTIC_PASSWORD'))
    )
    client = Elasticsearch([os.getenv('ELASTIC_NODE')], http_auth=auth)

    if os.getenv('PING_ELASTIC', None):
        logger.info('Pinging elasticsearch')
        if not client.ping(request_timeout=5):
            raise ConnectionError('Failed to connect to elasticsearch')

    return client
