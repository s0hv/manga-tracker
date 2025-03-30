import logging
from typing import Literal, override

from colors import color as get_color

type ColorType = str | int | tuple[int]


class LoggingFormatter(logging.Formatter):
    def __init__(
            self,
            fmt: str | None = None,
            datefmt: str | None = None,
            style: Literal['%', '{', '$'] = '%',
            override_colors: dict | None = None,
    ):
        super().__init__(fmt, datefmt, style)

        self.colors = {
            logging.NOTSET:   {'fg': 'default'},
            logging.DEBUG:    {'fg': 'CYAN'},
            logging.INFO:     {'fg': 'GREEN'},
            logging.WARNING:  {'fg': 'YELLOW'},
            logging.ERROR:    {'fg': 'red'},
            logging.CRITICAL: {'fg': 'RED', 'style': 'negative'},
            'EXCEPTION':      {'fg': 'RED'}
        }  # Style for exception traceback

        if override_colors:
            self.colors.update(override_colors)

    @staticmethod
    def get_color(
            *, fg: ColorType | None = None, bg: ColorType | None = None, style: str | None = None
    ) -> str | None:
        color = get_color('', fg=fg, bg=bg, style=style)
        if color:
            return color[:-4]

        return color

    @override
    def format(self, record: logging.LogRecord) -> str:
        """
        Format the specified record as text.
        The record's attribute dictionary is used as the operand to a
        string formatting operation which yields the returned string.
        Before formatting the dictionary, a couple of preparatory steps
        are carried out. The message attribute of the record is computed
        using LogRecord.getMessage(). If the formatting string uses the
        time (as determined by a call to usesTime(), formatTime() is
        called to format the event time. If there is exception information,
        it is formatted using formatException() and appended to the message.
        """
        record.message = record.getMessage()
        if self.usesTime():
            record.asctime = self.formatTime(record, self.datefmt)
        color = self.get_color(**self.colors.get(record.levelno, {}))
        if color:
            record.color = color
            record.colorend = '\x1b[0m'

        s = self.formatMessage(record)
        if record.exc_info and not record.exc_text:
            # Cache the traceback text to avoid converting it multiple times
            # (it's constant anyway)
            record.exc_text = self.formatException(record.exc_info)

        if record.exc_text:
            if s[-1:] != '\n':
                s = s + '\n'
            color = self.get_color(**self.colors.get('EXCEPTION', {}))
            if color:
                s = s + color + record.exc_text + '\x1b[0m'
            else:
                s = s + record.exc_text
        if record.stack_info:
            if s[-1:] != '\n':
                s = s + '\n'
            s = s + self.formatStack(record.stack_info)
        return s
