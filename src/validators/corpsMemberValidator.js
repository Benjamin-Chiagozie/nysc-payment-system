// ============================================================
// NYSC Payment Platform — Corps Member Validators
// ============================================================

const Joi = require('joi');

const updateBankDetailsSchema = Joi.object({
  bank_name: Joi.string().max(100).required().messages({
    'any.required': 'Bank name is required',
  }),
  bank_code: Joi.string().max(10).required().messages({
    'any.required': 'Bank code is required',
  }),
  account_number: Joi.string()
    .length(10)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': 'Account number must be exactly 10 digits',
      'string.pattern.base': 'Account number must contain only digits',
      'any.required': 'Account number is required',
    }),
  account_name: Joi.string().max(150).optional().allow(null, ''),
});

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
  validateBankDetails: validate(updateBankDetailsSchema),
};