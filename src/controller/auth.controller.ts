/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NextFunction, Request, Response } from "express";
import httpResponse from "../utils/httpResponse";
import { EErrorStatusCode, EResponseStatusCode } from "../constant/application";
import httpError from "../utils/httpError";
import quicker from "../utils/quicker";
import moment from "moment";
import { loginUserSchema, registerUserSchema } from "../types/userTypes";
import userAuthDbServices from "../services/userAuthDbServices";
import { ENTITY_EXISTS, EResponseMessage } from "../constant/responseMessage";
import { IUserInterface } from "../types/userInterface";
import { sendVerificationEmail, accountConfirmedEmail } from "../services/sendEmailService";
import { IUser } from "../types/prismaUserTypes";
import { AppConfig } from "../config";
import { IDecryptedToken } from "../middleware/authentication";

interface IConfirmRequest extends Request {
  params: {
    token: string;
  };
  query: {
    code: string;
  };
}

interface IAuthenticatedRequest extends Request {
  authenticatedUser: IUser;
}

export default {
  self: (req: Request, res: Response, next: NextFunction) => {
    try {
      throw new Error("This is an error");
      httpResponse(req, res, EResponseStatusCode.OK, "Hello World", { name: "John Doe" });
    } catch (error) {
      httpError(next, error, req);
    }
  },

  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body } = req;
      const parsed = registerUserSchema.safeParse(body);
      if (!parsed.success) {
        const errorMessage = parsed.error?.issues.map((issue) => issue.message).join(", ");
        return httpError(next, new Error(errorMessage || "Invalid inputs"), req, EErrorStatusCode.BAD_REQUEST);
      }

      // Checking account with given email exists
      const userWithEmail = await userAuthDbServices.findUserByEmail(parsed.data.email);
      if (userWithEmail) {
        return httpError(next, new Error(ENTITY_EXISTS("User")), req, EErrorStatusCode.BAD_REQUEST);
      }

      // Checking if the username is already taken
      const userWithUsername = await userAuthDbServices.findUserByUsername(parsed.data.username);
      if (userWithUsername) {
        return httpError(next, new Error(EResponseMessage.USERNAME_TAKEN), req, EErrorStatusCode.BAD_REQUEST);
      }

      // Hash the password
      const hashedPassword = await quicker.hashPassword(parsed.data.password);

      // Account confirmation data

      const token = quicker.generateRandomToken();
      const code = quicker.generateOTP();

      // Register the user
      const payload: IUserInterface = {
        name: parsed.data.name,
        username: parsed.data.username,
        email: parsed.data.email,
        password: hashedPassword,
        accountConfirmation: {
          token,
          code,
          timestamp: null,
          isVerified: false
        }
      };

      // Send email to the user
      await sendVerificationEmail(parsed.data.email, parsed.data.name, token, code);

      const newUser = await userAuthDbServices.createUser(payload);

      httpResponse(req, res, EResponseStatusCode.CREATED, "User registered successfully", newUser);
    } catch (error) {
      httpError(next, error, req);
    }
  },

  confirmation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { params, query } = req as IConfirmRequest;
      const { token } = params;
      const { code } = query;

      // Fetch User by token and code
      const user: IUser | null = await userAuthDbServices.findUserByTokenAndCode({ token, code });

      if (!user) {
        return httpError(next, new Error(EResponseMessage.INVALID_TOKEN_CODE), req, EErrorStatusCode.UNAUTHORIZED);
      }

      // Check if account is already confirmed
      if (user.accountConfirmation?.isVerified) {
        return httpError(next, new Error(EResponseMessage.ACCOUNT_ALREADY_VERIFIED), req, EErrorStatusCode.BAD_REQUEST);
      }

      // Confirm the account
      if (!user.userId) {
        return httpError(next, new Error(EResponseMessage.USER_ID_NOT_FOUND), req, EErrorStatusCode.INTERNAL_SERVER_ERROR);
      }
      const updatedUser = await userAuthDbServices.confirmAccount(user.userId);

      // Send account confirmed email
      await accountConfirmedEmail(updatedUser.email, updatedUser.name);

      // Return response
      httpResponse(req, res, EResponseStatusCode.OK, "Account confirmed successfully", { user: updatedUser });
    } catch (error) {
      httpError(next, error, req);
    }
  },
  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body } = req;
      // Validate the request body
      const parsed = loginUserSchema.safeParse(body);
      if (!parsed.success) {
        const errorMessage = parsed.error?.issues.map((issue) => issue.message).join(", ");
        return httpError(next, new Error(errorMessage || "Invalid inputs"), req, EErrorStatusCode.BAD_REQUEST);
      }

      // Check if user exists
      const user: IUser | null = await userAuthDbServices.findUserByEmailOrUsername(parsed.data.email);

      if (!user) {
        return httpError(next, new Error(EResponseMessage.INVALID_CREDENTIALS), req, EErrorStatusCode.UNAUTHORIZED);
      }

      // Check if password matches
      const isPasswordMatch = await quicker.comparePassword(parsed.data.password, user.password as string);

      if (!isPasswordMatch) {
        return httpError(next, new Error(EResponseMessage.INVALID_CREDENTIALS), req, EErrorStatusCode.UNAUTHORIZED);
      }

      //Generate JWT token
      const accessToken = quicker.generateToken(
        {
          userId: user.userId,
          email: user.email,
          username: user.username
        },
        AppConfig.get("ACCESS_TOKEN_SECRET") as string,
        AppConfig.get("ACCESS_TOKEN_EXPIRY") as string
      );

      const refreshToken = quicker.generateToken(
        {
          userId: user.userId,
          email: user.email,
          username: user.username
        },
        AppConfig.get("REFRESH_TOKEN_SECRET") as string,
        AppConfig.get("REFRESH_TOKEN_EXPIRY") as string
      );

      // Update last login and refresh token
      await userAuthDbServices.updateUserLastLogin(user.userId as string);
      await userAuthDbServices.updateRefreshToken(user.userId as string, refreshToken);

      // Set Cookie
      res
        .cookie("accessToken", accessToken, {
          path: "/api/v1",
          domain: AppConfig.get("DOMAIN") as string,
          sameSite: "strict",
          httpOnly: true,
          secure: !(AppConfig.get("ENV") === "development"),
          maxAge: AppConfig.get("ACCESS_TOKEN_EXPIRY") as number
        })
        .cookie("refreshToken", refreshToken, {
          path: "/api/v1",
          domain: AppConfig.get("DOMAIN") as string,
          sameSite: "strict",
          httpOnly: true,
          secure: !(AppConfig.get("ENV") === "development"),
          maxAge: AppConfig.get("REFRESH_TOKEN_EXPIRY") as number
        });

      // Return response
      httpResponse(req, res, EResponseStatusCode.OK, EResponseMessage.LOGIN_SUCCESS, {
        accessToken: `Bearer ${accessToken}`,
        refreshToken: `Bearer ${refreshToken}`
      });
    } catch (error) {
      httpError(next, error, req);
    }
  },

  health: (req: Request, res: Response, next: NextFunction) => {
    try {
      const healthData = {
        application: quicker.getApplicationHealth(),
        system: quicker.getSystemHealth(),
        time: moment(new Date().toISOString()).format("YYYY-MM-DD HH:mm:ss")
      };
      httpResponse(req, res, EResponseStatusCode.OK, "Health Check", healthData);
    } catch (error) {
      httpError(next, error, req);
    }
  },

  selfIdentification: (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authenticatedUser } = req as IAuthenticatedRequest;
      httpResponse(req, res, EResponseStatusCode.OK, EResponseMessage.USER_FOUND, authenticatedUser);
    } catch (error) {
      httpError(next, error, req);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cookies } = req;
      const { authenticatedUser } = req as IAuthenticatedRequest;
      const { refreshToken } = cookies as { refreshToken: string | undefined };

      // Utility function to clear cookies
      const clearAuthCookies = () => {
        const cookieOptions = {
          path: "/api/v1",
          domain: AppConfig.get("DOMAIN") as string,
          sameSite: "strict" as const,
          httpOnly: true,
          secure: !(AppConfig.get("ENV") === "development"),
          expires: new Date(0) // Expire immediately
        };

        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);
      };

      // Clear refresh token from database if present
      if (refreshToken) {
        await userAuthDbServices.deleteRefreshToken(authenticatedUser.userId as string);
      }

      // Clear cookies
      clearAuthCookies();

      // Send response after successful logout
      httpResponse(req, res, EResponseStatusCode.OK, EResponseMessage.LOGOUT_SUCCESS, {});
    } catch (error) {
      httpError(next, error, req, EErrorStatusCode.INTERNAL_SERVER_ERROR);
    }
  },
  refreshToken: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cookies } = req;
      const { refreshToken, accessToken } = cookies as { refreshToken: string | undefined; accessToken: string | undefined };

      if (accessToken) {
        return httpError(next, new Error(EResponseMessage.ACCESS_DENIED), req, EErrorStatusCode.FORBIDDEN);
      }

      if (!refreshToken) {
        return httpError(next, new Error(EResponseMessage.NO_TOKEN_FOUND), req, EErrorStatusCode.UNAUTHORIZED);
      }

      // Verify the refresh token
      const { userId, email, username } = quicker.verifyToken(refreshToken, AppConfig.get("REFRESH_TOKEN_SECRET") as string) as IDecryptedToken;

      // Check if refresh token in DB matches
      const dbRefreshToken = await userAuthDbServices.getRefreshToken(userId);
      if (!dbRefreshToken || dbRefreshToken.token !== refreshToken) {
        return httpError(next, new Error(EResponseMessage.NO_SNIRFING), req, EErrorStatusCode.UNAUTHORIZED);
      }

      // Generate new access token
      const newAccessToken = quicker.generateToken(
        { userId, email, username },
        AppConfig.get("ACCESS_TOKEN_SECRET") as string,
        AppConfig.get("ACCESS_TOKEN_EXPIRY") as string
      );

      // Set access token in cookies
      res.cookie("accessToken", newAccessToken, {
        path: "/api/v1",
        domain: AppConfig.get("DOMAIN") as string,
        sameSite: "strict",
        httpOnly: true,
        secure: !(AppConfig.get("ENV") === "development"),
        maxAge: Number(AppConfig.get("ACCESS_TOKEN_EXPIRY")) // In milliseconds
      });

      // Send response
      httpResponse(req, res, EResponseStatusCode.OK, EResponseMessage.LOGIN_SUCCESS, {
        accessToken: `Bearer ${newAccessToken}`
      });
    } catch (error) {
      httpError(next, error, req);
    }
  }
};

