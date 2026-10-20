import jwt from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config()


const generateJWTtoken =(userId , res)=>{

     const token = jwt.sign({id:userId},process.env.JWT_SECRET,{expiresIn:"7d"})
     res.cookie("jwt",token,{
        maxAge: 7*24*60*60*1000,// millisecinds
        httpOnly:true,// prevent XSS attacks // cross site scripting
        sameSite: process.env.NODE_ENV === "production"
      ? "none"
      : "strict",
        secure: process.env.NODE_ENV=="production"? true :false,
        path:"/",
     });

     return token  
} 

export default generateJWTtoken