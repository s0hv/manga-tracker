import { getServicesForApi } from '@/db/services/serviceInfo';
import { handleError } from '@/db/utils';


export default app => {
  /**
   *  @openapi
   *  /services:
   *    get:
   *      summary: Get all services that might have chapters associated with them
   *      responses:
   *        200:
   *          description: Returns the list of services
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: array
   *                    items:
   *                      $ref: '#/components/schemas/service'
   *                required:
   *                  - data
   */
  app.get('/api/services', (req, res) => {
    getServicesForApi()
      .then(services => res.json({ data: services }))
      .catch(err => handleError(err, res));
  });
};
