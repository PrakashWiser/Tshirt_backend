import 'dotenv/config';
import app from './app.js';
import connectDatabase from './config/database.js';

const startServer = async () => {
  try {
    await connectDatabase();
    const port = Number(process.env.PORT || 3100);
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error.message);
    process.exit(1);
  }
};

startServer();
