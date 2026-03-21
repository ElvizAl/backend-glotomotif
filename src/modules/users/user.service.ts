import { HTTPException } from "hono/http-exception";
import { prisma } from "../../utils/prisma";
import type {
	BanUserInput,
	UpdateUserInput,
	UserQueryInput,
} from "./user.schema";

export async function getAllUsersService(query: UserQueryInput) {
	const { page, limit, search } = query;
	const skip = (page - 1) * limit;

	const where = search
		? {
				OR: [
					{ name: { contains: search, mode: "insensitive" as const } },
					{ email: { contains: search, mode: "insensitive" as const } },
				],
			}
		: {};

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				isVerified: true,
				onBanned: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.user.count({ where }),
	]);

	return {
		data: users,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function updateUserService(id: string, data: UpdateUserInput) {
	const user = await prisma.user.findUnique({ where: { id } });

	if (!user) {
		throw new HTTPException(404, { message: "User tidak ditemukan" });
	}

	const updatedUser = await prisma.user.update({
		where: { id },
		data,
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			isVerified: true,
			onBanned: true,
			updatedAt: true,
		},
	});

	return { message: "User berhasil diperbarui", user: updatedUser };
}

export async function deleteUserService(id: string) {
	const user = await prisma.user.findUnique({ where: { id } });

	if (!user) {
		throw new HTTPException(404, { message: "User tidak ditemukan" });
	}

	await prisma.user.delete({ where: { id } });

	return { message: "User berhasil dihapus" };
}

export async function banUserService(id: string, data: BanUserInput) {
	const user = await prisma.user.findUnique({ where: { id } });

	if (!user) {
		throw new HTTPException(404, { message: "User tidak ditemukan" });
	}

	// Jangan izinkan admin membanned dirinya sendiri
	if (user.role === "ADMIN" && data.onBanned) {
		throw new HTTPException(403, {
			message: "Tidak dapat banned sesama ADMIN",
		});
	}

	const updatedUser = await prisma.user.update({
		where: { id },
		data: { onBanned: data.onBanned },
		select: {
			id: true,
			name: true,
			email: true,
			onBanned: true,
		},
	});

	const action = data.onBanned ? "dibanned" : "di-unbanned";
	return { message: `User berhasil ${action}`, user: updatedUser };
}
