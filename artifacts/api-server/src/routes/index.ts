import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicenowRouter from "./servicenow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicenowRouter);

export default router;
