export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Something went wrong';

  const errorResponseBody = {
    success: false,
    message,
    data: null,
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponseBody.stack = err.stack;
  }
  res.status(statusCode).json(errorResponseBody);
};
