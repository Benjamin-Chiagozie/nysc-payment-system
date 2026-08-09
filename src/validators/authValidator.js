// ============================================================
// NYSC Payment Platform — Auth Input Validators
// Validates all incoming data before it touches the database
// Uses Joi schema validation library
// ============================================================

const Joi = require('joi');

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),
});

// Register validation schema
const registerSchema = Joi.object({
  full_name: Joi.string()
    .min(3)
    .max(150)
    .required()
    .messages({
      'string.min': 'Full name must be at least 3 characters',
      'any.required': 'Full name is required',
    }),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
  role: Joi.string()
    .valid('admin', 'finance_officer', 'state_coordinator')
    .required()
    .messages({
      'any.only': 'Role must be admin, finance_officer, or state_coordinator',
      'any.required': 'Role is required',
    }),
  state: Joi.string()
    .max(50)
    .optional()
    .allow(null, ''),
});

// Generic validator function
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((d) => d.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }
  next();
};

module.exports = {
  validateLogin: validate(loginSchema),
  validateRegister: validate(registerSchema),
};