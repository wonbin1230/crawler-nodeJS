import { Request, Response } from "express";

export default {
    getVal: (req: Request, res: Response) => {
        try {
            res.send("AAAAAAA");
        }
        catch (error) {
            res.send(error);
        }
    }
};