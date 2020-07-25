from typing import Collection, TypeVar, Callable, Any, List, Union

T = TypeVar('T')
E = TypeVar('E')


def default_get_id(entry):
    return entry.id


def default_compare_id(entry_id: T, last_id: T):
    return entry_id == last_id


def get_latest_entries(entries: Collection[E], last_id: T, get_id: Callable[[Any], T] = default_get_id,
                       comp_id: Callable[[T, T], bool] = default_compare_id, sort_f=None) -> Union[Collection[E], List[E]]:
    """

    Args:
        entries (list): List of all feed entries
        last_id: Latest id in the feed
        get_id ((entry) => id of the entry):
            Function that gets an entry and returns its id
            Default is default_get_id
        comp_id ((entry_id, last_id) => bool):
            Function that takes entry_id and last_id as parameters and returns
            a boolean denoting if a match was found. Usually this function will
            find if the entry was before last_id
            Default is default_compare_id

        sort_f: A key for the sorted function.
            If provided will be used to sort entries before proceeding

    Returns:
        Entries up until last_id
    """
    if not last_id:
        return entries

    if sort_f:
        entries = sorted(entries, key=sort_f)

    new_entries = []

    for entry in entries:
        entry_id = get_id(entry)
        if comp_id(entry_id, last_id):
            break

        new_entries.append(entry)

    return new_entries
