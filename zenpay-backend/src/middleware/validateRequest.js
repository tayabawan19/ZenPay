/**
 * Express middleware to validate that required fields are present in the request body
 * @param {Array<string>} requiredFields 
 * @returns {Function} Express middleware function
 */
const validateRequest = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    requiredFields.forEach((field) => {
      if (req.body[field] === undefined || req.body[field] === null || String(req.body[field]).trim() === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    next();
  };
};

module.exports = validateRequest;
