import express from "express"
import prisma from "./lib/prisma.js"
import authRouter from './routes/auth.routes.js'
import githubRouter from "./routes/github.routes.js"
import cookieParser from 'cookie-parser'
import projectRouter from "./routes/project.routes.js"
import cors from "cors"
import { attachTerminal } from "./lib/terminal.js"
const app= express();


app.use(
  cors({
    origin: ["http://localhost:5173",'http://192.168.1.114:5173'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());


// routes
app.use('/api/auth',authRouter)
app.use("/api/projects",projectRouter)
app.use("/api/github", githubRouter);

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

const server=app.listen(PORT, "0.0.0.0",() => {
  console.log(`Server running on port ${PORT}`);
});
attachTerminal(server)