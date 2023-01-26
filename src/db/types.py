from pydantic import ConstrainedInt


class SmallInt(ConstrainedInt):
    ge = -32768
    le = 32767
