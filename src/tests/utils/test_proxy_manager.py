import logging
import random
import unittest
from pathlib import Path
from typing import override

import pytest
import responses

from src.utils.proxy_manager import ProxyManager

PROXY_LIST_RESPONSE = """1.2.3.4:8080
1.1.1.1:80
2.2.2.2:100
3.3.3.3:8080
4.4.4.4:8080
5.5.5.5:8080
6.6.6.6:8080
7.7.7.7:8080
8.8.8.8:8080
9.9.9.9:8080
"""

RESPONSE_URL = 'https://raw.githubusercontent.com/iplocate/free-proxy-list/refs/heads/main/protocols/http.txt'

PROXY_LIST_FILE: Path = Path(__file__).parent.joinpath('proxy_list_test.txt')


class TestUtilities(unittest.TestCase):
    proxy_manager: ProxyManager

    @override
    def setUp(self) -> None:
        self.proxy_manager = ProxyManager()
        self.proxy_manager.PROXY_LIST_FILE = PROXY_LIST_FILE
        super().setUp()

    @pytest.fixture(autouse=True)
    def _caplog(self, caplog: pytest.LogCaptureFixture):
        self.caplog = caplog

    @responses.activate
    def test_getting_proxy(self):
        # Set random seed for predictable random results
        random.seed(42)
        PROXY_LIST_FILE.unlink(missing_ok=True)

        response_mock = responses.add(
            responses.GET,
            RESPONSE_URL,
            body=PROXY_LIST_RESPONSE
        )

        random_proxy = self.proxy_manager.get_random_proxy()

        # Make sure a correct proxy is assigned
        assert response_mock.call_count == 1
        assert random_proxy == '1.1.1.1:80'
        assert random_proxy == self.proxy_manager.current_proxy
        assert self.proxy_manager.proxy_list is not None
        assert len(self.proxy_manager.proxy_list) == 10

        # Assert that a cached proxy is returned on later calls
        assert random_proxy == self.proxy_manager.get_random_proxy()
        assert response_mock.call_count == 1

        # Assert that a new proxy is returned after invalidating the current one
        self.proxy_manager.invalidate_current_proxy()
        new_proxy = self.proxy_manager.get_random_proxy()
        assert random_proxy != new_proxy
        assert response_mock.call_count == 1
        assert new_proxy == '1.2.3.4:8080'

    @responses.activate
    def test_too_few_proxies(self):
        # Set random seed for predictable random results
        random.seed(42)
        PROXY_LIST_FILE.unlink(missing_ok=True)

        response_mock = responses.add(
            responses.GET,
            RESPONSE_URL,
            body=PROXY_LIST_RESPONSE[:99]
        )

        logger = logging.getLogger('src.utils.proxy_manager')

        with self.caplog.at_level(logging.ERROR, logger=logger.name):
            random_proxy = self.proxy_manager.get_random_proxy()

        # Make sure a correct proxy is assigned
        assert response_mock.call_count == 1
        assert random_proxy is None
        assert self.proxy_manager.proxy_list is None
        assert self.proxy_manager.current_proxy is None

        self.assertLogs(logger, logging.ERROR)
        assert 'Too few proxies in proxy list.' in self.caplog.text


if __name__ == '__main__':
    pytest.main()
