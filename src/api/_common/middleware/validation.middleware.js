import Joi from 'joi';

/**
 * validate - returns an Express middleware that validates req.params, req.query and/or req.body
 * Accepts an object with optional keys: params, query, body — each a Joi schema.
 * On success, the validated & (possibly) coerced values replace the originals on req.
 * On failure, responds with 400 and { errors: [ { message, path } ] }
 */
export const validate = (schemas = {}) => {
	return async (req, res, next) => {
		try {
			if (schemas.params) {
				const value = await schemas.params.validateAsync(req.params, { abortEarly: false, stripUnknown: true });
				// Attempt to replace req.params; in some environments req properties may be read-only
				try {
					req.params = value;
				} catch (e) {
					// Fallback: attach validated values under req.validated.params
					req.validated = req.validated || {};
					req.validated.params = value;
					// Legacy per-property fallback used in some modules
					req.validated_params = value;
				}
			}

			if (schemas.query) {
				const value = await schemas.query.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
				// Some frameworks make req.query a getter-only property; avoid direct assignment
				try {
					req.query = value;
				} catch (e) {
					req.validated = req.validated || {};
					req.validated.query = value;
					// Legacy per-property fallback used in some modules
					req.validated_query = value;
				}
			}

			if (schemas.body) {
				const value = await schemas.body.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
				try {
					req.body = value;
				} catch (e) {
					req.validated = req.validated || {};
					req.validated.body = value;
					// Legacy per-property fallback used in some modules
					req.validated_body = value;
				}
			}

			return next();
		} catch (err) {
			// Joi validation error
			if (err && err.isJoi && Array.isArray(err.details)) {
				const errors = err.details.map(d => ({ message: d.message, path: Array.isArray(d.path) ? d.path.join('.') : d.path }));
				return res.status(400).json({ errors });
			}
			return next(err);
		}
	};
};

// convenience default export
export default validate;
