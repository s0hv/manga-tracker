from gevent import monkey, pywsgi
monkey.patch_all()
import falcon

from web.app import Handler


api = falcon.API(media_type=falcon.MEDIA_XML)
api.add_route("/", Handler())
port = 9090
server = pywsgi.WSGIServer(("localhost", port), api)
print(f'Live on http://localhost:{port}')
server.serve_forever()
