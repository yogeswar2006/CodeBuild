import express from "express"
import prisma from "./lib/prisma.js"
import authRouter from './routes/auth.routes.js'
import cookieParser from 'cookie-parser'
import projectRouter from "./routes/project.routes.js"

const app= express();

app.use(express.json());
app.use(cookieParser());


// routes
app.use('/api/auth',authRouter)
app.use("/api/projects",projectRouter)

// app.get('/', (req, res) => {
//   res.send('Code Editor API is running');
// });

app.get('/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({ message: 'Database connected successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});