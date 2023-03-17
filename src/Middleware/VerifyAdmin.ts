import { NextFunction,Request,Response } from "express";
import SignJWT from "../utils/SignJWT";

export const VerifyAdmin = async (req: Request, res: Response, next: NextFunction) => { 
    const bearerHeader = req.headers[ 'authorization' ];
    
    if (!bearerHeader) return res.status(401).json({ message: "Unauthorized" });
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[ 1 ];  
    try {
        const decoded = SignJWT.verify(bearerToken, process.env.JWT_SECRET as string) as any;
        if (decoded && (decoded.type === "admin" || decoded.type==="anonymous") ) {
            next();
        }
        else {
            res.status(401).json({ message: "Unauthorized" });
        }
    }
    catch (err) { 
        console.log(err);
        res.status(401).json({ message: "Unauthorized" });
    }
}
