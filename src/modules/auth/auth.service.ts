import { HTTPException } from "hono/http-exception";
import { type Role, VerificationPurpose } from "../../generated/prisma/enums";
import { sendOtpEmail, upsertVerificationCode } from "../../lib/email";
import { hashPassword, verifyPassword } from "../../utils/hash";
import { signAccessToken } from "../../utils/jwt";
import { prisma } from "../../utils/prisma";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailOtpInput,
} from "./auth.schema";

export async function registerService(
  data: RegisterInput,
  role: Role = "BUYER",
) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new HTTPException(400, { message: "Email sudah terdaftar" });
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: passwordHash,
      role,
    },
  });

  const verificationCode = await upsertVerificationCode(
    user.id,
    VerificationPurpose.VERIFY_EMAIL,
  );

  await sendOtpEmail({
    email: user.email,
    code: verificationCode.code,
    purpose: VerificationPurpose.VERIFY_EMAIL,
  });

  return {
    message: "Register berhasil, silahkan verifikasi email OTP",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function verifyEmailOtpService(data: VerifyEmailOtpInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  const verificationCode = await prisma.verificationCode.findUnique({
    where: {
      userId: user.id,
      purpose: VerificationPurpose.VERIFY_EMAIL,
    },
  });

  if (!verificationCode) {
    throw new HTTPException(404, {
      message: "Verification code tidak ditemukan",
    });
  }

  if (verificationCode.expiresAt < new Date()) {
    await prisma.verificationCode.delete({
      where: { id: verificationCode.id },
    });
    throw new HTTPException(400, {
      message: "Verifikasi kode sudah tidak berlaku",
    });
  }

  if (verificationCode.code !== data.code) {
    throw new HTTPException(400, { message: "Kode verifikasi tidak valid" });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    }),
    prisma.verificationCode.delete({
      where: { id: verificationCode.id },
    }),
  ]);

  return { message: "Email berhasil diverifikasi" };
}

export async function resendVerificationOtpService(input: { email: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  if (user.isVerified) {
    throw new HTTPException(400, { message: "Email sudah diverifikasi" });
  }

  const verificationCode = await upsertVerificationCode(
    user.id,
    VerificationPurpose.VERIFY_EMAIL,
  );
  await sendOtpEmail({
    email: user.email,
    code: verificationCode.code,
    purpose: VerificationPurpose.VERIFY_EMAIL,
  });

  return { message: "Verification OTP berhasil dikirim ulang" };
}

export async function loginService(data: LoginInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!existingUser) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  if (existingUser.onBanned) {
    throw new HTTPException(403, { message: "User dibanned" });
  }

  if (!existingUser.password) {
    throw new HTTPException(400, { message: "Akun ini didaftarkan menggunakan Google, silakan login dengan Google." });
  }

  const isPasswordValid = await verifyPassword(
    data.password,
    existingUser.password,
  );

  if (!isPasswordValid) {
    throw new HTTPException(400, { message: "Email atau password salah" });
  }

  if (!existingUser.isVerified) {
    throw new HTTPException(403, { message: "Email belum diverifikasi" });
  }

  const accessToken = signAccessToken({
    sub: existingUser.id,
    email: existingUser.email,
    role: existingUser.role,
  });

  return {
    message: "Login berhasil",
    accessToken,
  };
}

export async function forgotPasswordService(data: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  const verificationCode = await upsertVerificationCode(
    user.id,
    VerificationPurpose.RESET_PASSWORD,
  );
  await sendOtpEmail({
    email: user.email,
    code: verificationCode.code,
    purpose: VerificationPurpose.RESET_PASSWORD,
  });

  return { message: "Verification OTP berhasil dikirim ulang" };
}

export async function resetPasswordService(data: ResetPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  const verificationCode = await prisma.verificationCode.findUnique({
    where: {
      userId: user.id,
      purpose: VerificationPurpose.RESET_PASSWORD,
    },
  });

  if (!verificationCode) {
    throw new HTTPException(404, {
      message: "Verification code tidak ditemukan",
    });
  }

  if (verificationCode.expiresAt < new Date()) {
    await prisma.verificationCode.delete({
      where: { id: verificationCode.id },
    });
    throw new HTTPException(400, {
      message: "Verifikasi kode sudah tidak berlaku",
    });
  }

  if (verificationCode.code !== data.code) {
    throw new HTTPException(400, { message: "Kode verifikasi tidak valid" });
  }

  const passwordHash = await hashPassword(data.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    }),
    prisma.verificationCode.delete({
      where: { id: verificationCode.id },
    }),
  ]);

  return { message: "Password berhasil direset" };
}

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  return { user };
}

export async function googleCallbackService(googleUser: {
  email: string;
  name: string;
  picture?: string;
}) {
  // 1. Cek apakah user dibanned
  const existingUser = await prisma.user.findUnique({
    where: { email: googleUser.email },
  });

  if (existingUser?.onBanned) {
    throw new HTTPException(403, { message: "User dibanned" });
  }

  // 2. Upsert user (buat baru jika belum ada, atau pakai yang sudah ada)
  const user = await prisma.user.upsert({
    where: { email: googleUser.email },
    update: {
      ...(googleUser.picture && { avatarUrl: googleUser.picture }),
    },
    create: {
      name: googleUser.name,
      email: googleUser.email,
      avatarUrl: googleUser.picture,
      isVerified: true, // Email Google sudah terverifikasi
    },
  });

  // 3. Issue JWT
  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    message: "Login dengan Google berhasil",
    accessToken: token,
  };
}

export async function changePasswordService(
  userId: string,
  data: ChangePasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new HTTPException(404, { message: "User tidak ditemukan" });
  }

  if (!user.password) {
    throw new HTTPException(400, {
      message: "Akun ini menggunakan login Google, tidak memiliki password",
    });
  }

  const isValid = await verifyPassword(data.currentPassword, user.password);

  if (!isValid) {
    throw new HTTPException(400, { message: "Password lama tidak sesuai" });
  }

  const newHash = await hashPassword(data.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: newHash },
  });

  return { message: "Password berhasil diubah" };
}
