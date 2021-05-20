const { pattern } = require('iso8601-duration');
const {
  param,
  query,
  body,
  validationResult,
} = require('express-validator');
const { Forbidden, StatusError, Unauthorized } = require('./errors');

const databaseIdValidation = (field, fromParam, msg) => (fromParam ?
  param(field) :
  query(field)
)
  .isInt({ min: 0 })
  .withMessage(msg);
module.exports.databaseIdValidation = databaseIdValidation;
// Technically the same behavior
module.exports.limitValidation = databaseIdValidation;

const mangaIdValidation = (fromParam) => databaseIdValidation('manga_id', fromParam, 'Manga id must be a positive integer');
module.exports.mangaIdValidation = mangaIdValidation;

const serviceIdValidation = (fromParam) => databaseIdValidation('service_id', fromParam, 'Service id must be a positive integer');
module.exports.serviceIdValidation = serviceIdValidation;

const positiveTinyInt = (field) => query(field).isInt({ min: 0, max: 127 });
module.exports.positiveTinyInt = positiveTinyInt;

const passwordRequired = (value, { req, path }) => {
  if (value === undefined) return true;
  if (!req.body?.password) throw new Unauthorized(`Password required for modifying ${path}`);
  return true;
};
module.exports.passwordRequired = passwordRequired;

const newPassword = (newPass, repeatPass) => body(newPass)
  .if(body(newPass).exists())
  .custom(passwordRequired)
  .bail()
  .trim()
  .isString()
  .withMessage('Password must be a string')
  .bail()
  .isLength({ min: 8, max: 72 })
  .withMessage('Password must be between 8 and 72 characters long')
  .bail()
  .custom((value, { req }) => {
    if (req.body[repeatPass] !== value) {
      throw new Error(`${newPass} did not match ${repeatPass}`);
    }

    return true;
  });
module.exports.newPassword = newPassword;

const validateUser = () => body('')
  .custom((value, { req }) => {
    if (!req.user) {
      throw new Unauthorized('User not authenticated');
    }
    return true;
  });
module.exports.validateUser = validateUser;

const validateAdminUser = () => validateUser()
  .bail()
  .custom((value, { req }) => {
    if (!req.user.admin) {
      throw new Forbidden('Forbidden to perform this action');
    }
    return true;
  });
module.exports.validateAdminUser = validateAdminUser;

/**
 * @returns {boolean} true if validation errors occurred. false otherwise
 */
const hadValidationError = (req, res, sendAllErrors=true) => {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    errors = errors.array();

    const customError = errors.find(err => err.msg instanceof StatusError)?.msg;

    if (customError) {
      res.status(customError.status).json({ error: customError.message });
    } else if (sendAllErrors) {
      res.status(400).json({ error: errors });
    } else {
      res.status(400).json({ error: errors[0] });
    }

    return true;
  }

  return false;
};
module.exports.hadValidationError = hadValidationError;

const handleValidationErrors = (req, res, next) => {
  if (hadValidationError(req, res)) return;
  next();
};
module.exports.handleValidationErrors = handleValidationErrors;

/**
 * @param {import('express-validator').ValidationChain} chain
 * @return {import('express-validator').ValidationChain}
 */
module.exports.isISO8601Duration = (chain) => chain.custom((value) => pattern.test(value))
  .withMessage('Value must be a valid ISO 8601 duration');
