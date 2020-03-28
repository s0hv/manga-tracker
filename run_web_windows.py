from gevent import monkey, pywsgi
monkey.patch_all()
import falcon
import os

import setup_logging

from web.app import Handler

setup_logging.setup()

api = falcon.API(media_type=falcon.MEDIA_XML)
api.add_route("/", Handler())
port = os.getenv('PORT', 9090)
server = pywsgi.WSGIServer(("localhost", port), api)
print(f'Live on http://localhost:{port}')
server.serve_forever()
