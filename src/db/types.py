from pydantic import ConstrainedInt


class SmallInt(ConstrainedInt):
    ge = -32768
    le = 32767


class ColorInt(ConstrainedInt):
    ge = 0
    le = 16777216
