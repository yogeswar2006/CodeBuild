import prisma from "../lib/prisma.js";
import bcryptjs from "bcrypt"
import "dotenv/config"
import generateJWTtoken from "../utils/generateJwtToken.js";


const register = async (req, res) => {

    try {

        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Please Provide all required details" })
        }

        const isUserAlreadyExists = await prisma.user.findUnique({
            where: { email }
        })

        if (isUserAlreadyExists) {
            return res.status(409).json({
                message: "User Already Exists"
            })
        }
        // hash the password
        const passwordHash = await bcryptjs.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username: username,
                email: email,
                passwordHash: passwordHash
            }
        })
        // create JWT token
        generateJWTtoken(user.id, res);

        res.status(201).json({
            message: "user created success",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            }
        })

    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).json({
            message: 'Internal server error'
        });

    }

}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() }
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const isPasswordValid = await bcryptjs.compare(
            password,
            user.passwordHash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        generateJWTtoken(user.id, res);

        return res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

const logout = async (req, res) => {

    res.clearCookie('token');

    return res.status(200).json({
        message: 'Logout successful'
    });
}

const getCurrentUser = async(req,res)=>{
   try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.status(200).json({
      message: 'User details',
      user
    });
  } catch (err) {
    console.error('Get current user error:', err);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

export default { register, login, logout,getCurrentUser };
