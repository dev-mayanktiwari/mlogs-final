import { z } from "zod";
import { EUserTypeConstants } from "../constant/application";
import { MIN_LENGTH_MESSAGE, MAX_LENGTH_MESSAGE } from "../constant/responseMessage";

export const registerUserSchema = z.object({
  name: z
    .string()
    .min(EUserTypeConstants.MIN_NAME_LENGTH, MIN_LENGTH_MESSAGE("Name", EUserTypeConstants.MIN_NAME_LENGTH))
    .max(EUserTypeConstants.MAX_NAME_LENGTH, MAX_LENGTH_MESSAGE("Name", EUserTypeConstants.MAX_NAME_LENGTH)),
  email: z.string().email(),
  username: z
    .string()
    .min(EUserTypeConstants.MIN_USERNAME_LENGTH, MIN_LENGTH_MESSAGE("Username", EUserTypeConstants.MIN_USERNAME_LENGTH))
    .max(EUserTypeConstants.MAX_USERNAME_LENGTH, MAX_LENGTH_MESSAGE("Username", EUserTypeConstants.MAX_USERNAME_LENGTH)),
  password: z
    .string()
    .min(EUserTypeConstants.MIN_PASSWORD_LENGTH, MIN_LENGTH_MESSAGE("Password", EUserTypeConstants.MIN_PASSWORD_LENGTH))
    .max(EUserTypeConstants.MAX_PASSWORD_LENGTH, MAX_LENGTH_MESSAGE("Password", EUserTypeConstants.MAX_PASSWORD_LENGTH))
});

export const loginUserSchema = z.object({
  email: z.string(),
  password: z
    .string()
    .min(EUserTypeConstants.MIN_PASSWORD_LENGTH, MIN_LENGTH_MESSAGE("Password", EUserTypeConstants.MIN_PASSWORD_LENGTH))
    .max(EUserTypeConstants.MAX_PASSWORD_LENGTH, MAX_LENGTH_MESSAGE("Password", EUserTypeConstants.MAX_PASSWORD_LENGTH))
});

export type RegisterUserType = z.infer<typeof registerUserSchema>;
export type LoginUserType = z.infer<typeof loginUserSchema>;
