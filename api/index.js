// Vercel serverless entry point: re-export the Express app.
// server.js only calls app.listen() when run directly, so requiring it here is safe.
module.exports = require('../server.js');
