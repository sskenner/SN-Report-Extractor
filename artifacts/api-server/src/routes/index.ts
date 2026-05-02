import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicenowRouter from "./servicenow";
import reportsRouter from "./reports";
import runRouter from "./run";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicenowRouter);
router.use(reportsRouter);
router.use(runRouter);

export default router;
