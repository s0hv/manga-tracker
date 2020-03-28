import falcon

import setup_logging
from web.app import Handler

setup_logging.setup()
api = falcon.API(media_type=falcon.MEDIA_XML)
api.add_route("/", Handler())
