from typing import Annotated

from pydantic import Field

SmallInt = Annotated[int, Field(ge=-32768, le=32767)]
