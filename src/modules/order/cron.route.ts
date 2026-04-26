import { Hono } from "hono";
import { checkAndCancelExpiredOrders } from "./order.service";

export const cronRouter = new Hono().get("/check-expired", async (c) => {
	try {
		// Note: Tambahkan cek authorization khusus cron Vercel jika diperlukan
		// const authHeader = c.req.header("Authorization");
		// if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		//   return c.json({ message: "Unauthorized" }, 401);
		// }

		const result = await checkAndCancelExpiredOrders();
		return c.json(result, 200);
	} catch (error) {
		console.error("Cron Error check-expired:", error);
		return c.json({ message: "Internal server error" }, 500);
	}
});
