import requests.adapters
from urllib3 import Retry

# id for the group named "No group"
NO_GROUP = 1

# Default retry policy for requests
DEFAULT_RETRY_POLICY = Retry(
    total=3,
    backoff_jitter=10,
    backoff_factor=3,
    status_forcelist=[500, 502, 503, 504]
)

DEFAULT_REQUEST_ADAPTER = requests.adapters.HTTPAdapter(max_retries=DEFAULT_RETRY_POLICY)

USER_AGENT = 'Mozilla/5.0 (Windows; Windows NT 10.1; WOW64; en-US) AppleWebKit/602.37 (KHTML, like Gecko) Chrome/55.0.1613.185 Safari/534.6 Edge/10.86787'
