import {create} from "zustand"
import api from "../lib/axios";
import toast from "react-hot-toast";


export const useAuthStore= create((set,get)=>({

    authUser:null,
    isCheckingAuth:true,
    isSigningUp:false,
    isLoggingIn:false,
    isLoggingOut:false,

    checkAuth: async () => {
        try {
            const res = await api.get("/auth/check");
            set({ authUser: res.data.user });
        } catch (error) {
            console.log("Error at checking auth", error);
            set({ authUser: null });

        } finally {
            set({ isCheckingAuth: false })
        }
    },

    signUp:async(formData)=>{
       
        set({isSigningUp:true})
        try{
  
            const res = await api.post("/auth/register",formData);
            set({authUser:res.data.user})
           
            toast.success("Account created successfully!");
        }catch(error){
            const message =
            error.response?.data?.message ||
            error.message ||
            "Something went wrong during signup";

            toast.error(message);
        }finally{
            set({isSigningUp:false})
        }
    },
    
    login:async(data)=>{
       
        set({isLoggingIn:true})
        try{
            const res = await api.post("/auth/login",data);
            set({authUser:res.data.user})
          
            toast.success("Logged in successfully!");
             
        }catch(error){
            const message =
            error.response?.data?.message ||
            error.message ||
            "Something went wrong during signup";
            set({authUser:null})
            toast.error(message);
        }finally{
            set({isLoggingIn:false})
        }
    },

    logout:async()=>{
        set({isLoggingOut:true})
        try{
            const res= await api.post("/auth/logout");
             set({authUser:null})
            toast.success("Logging out")  

        }catch(error){
            toast.error(error.response.data.message)
        }finally{
          set({isLoggingOut:false})
        }
    },
}))
