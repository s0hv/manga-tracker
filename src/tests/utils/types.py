from io import BufferedReader

from responses import Response

ResponsesBody = str | BaseException | Response | BufferedReader | bytes | None
