from math import ceil
from typing import TypeVar, Sequence, Any, overload, Literal, Optional

import psycopg

T = TypeVar('T')


@overload
def execute_values(cur: psycopg.Cursor[T],
                   sql: str,
                   values: Sequence[Sequence[Any]],
                   *,
                   fetch: Literal[False],
                   cols_count: Optional[int] = None,
                   template: Optional[str] = None,
                   page_size=100) -> None: ...


@overload
def execute_values(cur: psycopg.Cursor[T],
                   sql: str,
                   values: Sequence[Sequence[Any]],
                   *,
                   fetch: Literal[True],
                   cols_count: Optional[int] = None,
                   template: Optional[str] = None,
                   page_size=100) -> list[T]: ...


@overload
def execute_values(cur: psycopg.Cursor[T],
                   sql: str,
                   values: Sequence[Sequence[Any]],
                   *,
                   cols_count: Optional[int] = None,
                   template: Optional[str] = None,
                   page_size=100,
                   fetch: bool = False) -> list[T] | None: ...


def execute_values(cur: psycopg.Cursor[T],
                   sql: str,
                   values: Sequence[Sequence[Any]],
                   *,
                   cols_count: Optional[int] = None,
                   template: Optional[str] = None,
                   page_size=100,
                   fetch: bool | Literal[True] | Literal[False] = False) -> list[T] | None:
    """
    Execute multiple values in a VALUES statement.
    Unlike psycopg2 execute_values, this requires syntax like this "VALUES (%s)".
    This is to make it play nicer with syntax checkers
    Args:
        cur: Cursor object
        sql: The sql statement with a single "VALUES %s"
        cols_count: How many items each of the values has. Calculated from the first value if not given.
        values: List of values
        template: Template string to use for values. e.g. "(%s, %s, 10)"
        page_size: How many values to process per execute statement.
        fetch: Whether to fetch the results or not.
    """
    if not values:
        return [] if fetch else None

    batches = ceil(len(values) / page_size)
    prepare = batches > 3
    if template is None:
        if cols_count is None:
            cols_count = len(values[0])

        template = f'({",".join(["%s"] * cols_count)})'

    result: list[T] = []
    for batch in range(batches):
        batch_values = values[batch * page_size:batch * page_size + page_size]
        template_list = ','.join(template for _ in range(len(batch_values)))

        args = [val for group in batch_values for val in group]
        cur.execute(sql % template_list, args,
                    prepare=prepare)
        if fetch:
            result.extend(cur.fetchall())

    if fetch:
        return result

    return None
