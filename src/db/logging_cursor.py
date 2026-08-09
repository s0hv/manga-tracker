import inspect
import logging
from types import FrameType, ModuleType
from typing import Self, cast, override

from psycopg import Cursor
from psycopg.abc import Params, Query, QueryNoTemplate
from psycopg.rows import DictRow

db_logger = logging.getLogger('database')


class LoggingCursor(Cursor[DictRow]):
    @override
    def execute(
        self,
        query: Query,
        params: Params | None = None,
        *,
        prepare: bool | None = None,
        binary: bool | None = None,
    ) -> Self:
        try:
            # Must cast Query to QueryNoTemplate for now as mypy does not like it for some reason
            return super().execute(cast(QueryNoTemplate, query), params, prepare=prepare, binary=binary)
        finally:
            # No need to calculate coverage for this, as it's not used in tests
            # GCOVR_EXCL_START
            if db_logger.isEnabledFor(logging.DEBUG):

                caller = cast(FrameType, inspect.currentframe()).f_back
                module = cast(ModuleType, inspect.getmodule(caller)).__name__

                # If the caller was dbutil, try to find the real caller
                if module.endswith('.dbutils'):
                    for _ in range(4):
                        caller = cast(FrameType, caller).f_back
                        current_module = cast(ModuleType, inspect.getmodule(caller)).__name__
                        if not current_module.endswith('dbutils'):
                            module = current_module
                            break

                param_string = '' if not params else f', {params}'
                if isinstance(query, bytes):
                    db_logger.debug(f'{query.decode("utf-8")}{param_string}', extra={'originalmodule': module})
                else:
                    db_logger.debug(f'{query}{param_string}', extra={'originalmodule': module})
            # GCOVR_EXCL_STOP
