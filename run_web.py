import falcon

from web.app import Handler

api = falcon.API(media_type=falcon.MEDIA_XML)
api.add_route("/", Handler())
