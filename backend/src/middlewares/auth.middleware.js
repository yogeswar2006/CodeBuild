import jwt from "jsonwebtoken"
import "dotenv/config"
import prisma from "../lib/prisma.js"

 const ProtectedRoute=async(req,res,next)=>{

   try{
         const token=req.cookies.jwt
            if(!token){
                return res.status(401).json({message:"Unauthorized"});
            }
        
        const decoded=  jwt.verify(token,process.env.JWT_SECRET)

        if(!decoded){
            return res.status(401).json({message:"unauthorized"})
        }

        const user= await prisma.user.findUnique({
            where:{id:decoded.id}
        })

        if(!user){
            return res.status(401).json({message:"Unauthorized"})
        }

            req.user=user
            next();

   }catch(err){
  
     return res.status(401).json({message:"Invalid or Expired Token",err})
   }

}

export default ProtectedRoute