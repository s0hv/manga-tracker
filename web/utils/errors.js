function HttpError(statusCode, message) {
    if (!message && statusCode === 404) {
        message = 'Not found';
    }
    message = message || 'Internal server error';
    const err = new Error(message);
    err.status = statusCode;
    return err;
}

module.exports.HttpError = HttpError;

function RenderError(statusCode) {
    throw HttpError(statusCode);
}

module.exports.RenderError = RenderError;