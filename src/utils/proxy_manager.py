import logging
import time
from datetime import timedelta
from pathlib import Path
from random import choice
from threading import Lock

import requests

logger = logging.getLogger(__name__)


class ProxyManager:
    PROXY_LIST_FILE = Path(__file__).parent.parent.parent / 'data' / 'proxy_list.txt'
    PROXY_LIST_LOCK = Lock()
    PROXY_LIST_MAX_AGE = timedelta(hours=24)

    def __init__(self) -> None:
        self.proxy_list: list[str] | None = None
        self.current_proxy: str | None = None

    def get_random_proxy(self) -> str | None:
        if self.current_proxy:
            return self.current_proxy

        with self.PROXY_LIST_LOCK:
            if self.proxy_list:
                return self._get_and_set_random_proxy()

            self._update_proxy_list()
            if not self.PROXY_LIST_FILE.exists():
                return None

            self.proxy_list = self.PROXY_LIST_FILE.read_text().splitlines()

            return self._get_and_set_random_proxy()

    def invalidate_current_proxy(self) -> None:
        """
        Invalidates the current proxy. Should be used when the proxy does not work
        """
        logger.info(f'Invalidating current proxy {self.current_proxy}', )
        self.current_proxy = None

    def _get_and_set_random_proxy(self) -> str:
        if not self.proxy_list:
            raise Exception('Proxy list not initialized')

        # Assign and return local variable instead to avoid warning about return type
        current_proxy = choice(self.proxy_list)
        logger.info(f'Using proxy {current_proxy}')
        self.current_proxy = current_proxy
        return current_proxy

    def _update_proxy_list(self) -> None:
        now = time.time()

        # If proxy file exists and is not older than 24 hours, don't update
        if self.PROXY_LIST_FILE.exists() and self.PROXY_LIST_FILE.stat().st_mtime > (now - self.PROXY_LIST_MAX_AGE.total_seconds()):
            return

        logger.info('Updating proxy list')
        r = requests.get('https://raw.githubusercontent.com/iplocate/free-proxy-list/refs/heads/main/protocols/http.txt')

        if not r.ok:
            logger.error(f'Failed to update proxy list due to request error. {r.status_code}')
            return

        proxy_content = r.text

        if len(proxy_content) < 100:
            logger.error(f'Too few proxies in proxy list. Content length: {len(proxy_content)}')
            return

        try:
            self.PROXY_LIST_FILE.parent.mkdir(exist_ok=True)

            with self.PROXY_LIST_FILE.open('w') as f:
                f.write(proxy_content)
        except OSError as e:
            logger.error(f'Failed to write proxy list. {e}')
            return


# Global instance of proxy manager
proxy_manager: ProxyManager = ProxyManager()
