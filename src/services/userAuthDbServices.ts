import moment from "moment";
import { IUserInterface } from "../types/userInterface";
import prisma from "./generatePrismaClient";

export default {
  findUserByEmail: (email: string) => {
    return prisma.user.findUnique({
      where: {
        email
      }
    });
  },

  findUserByUsername: (username: string) => {
    return prisma.user.findUnique({
      where: {
        username
      }
    });
  },

  createUser: (payload: IUserInterface) => {
    return prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        username: payload.username,
        password: payload.password,
        accountConfirmation: {
          create: {
            token: payload.accountConfirmation.token,
            code: payload.accountConfirmation.code,
            isVerified: payload.accountConfirmation.isVerified,
            timestamp: payload.accountConfirmation.timestamp
          }
        }
      },
      select: {
        userId: true,
        name: true,
        email: true,
        username: true,
        accountConfirmation: true
        // Remove accountConfirmation if not needed
      }
    });
  },

  findUserByTokenAndCode: (payload: { token: string; code: string }) => {
    const user = prisma.user.findFirst({
      where: {
        accountConfirmation: {
          token: payload.token,
          code: payload.code
        }
      },
      select: {
        userId: true,
        username: true,
        email: true,
        accountConfirmation: true,
        password: false
      }
    });

    return user;
  },

  confirmAccount: async (id: string) => {
    const updatedUser = await prisma.user.update({
      where: {
        userId: id
      },
      data: {
        accountConfirmation: {
          update: {
            isVerified: true,
            timestamp: moment.utc().toISOString()
          }
        }
      },
      include: {
        accountConfirmation: true
      }
    });

    return updatedUser;
  },

  findUserByEmailOrUsername: async (key: string) => {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: key }, { username: key }],
        accountConfirmation: {
          isVerified: true
        }
      }
    });

    return user;
  },

  updateUserLastLogin: (id: string) => {
    return prisma.user.update({
      where: {
        userId: id
      },
      data: {
        lastLoginAt: moment.utc().toISOString()
      }
    });
  },

  updateRefreshToken: (id: string, refreshToken: string) => {
    return prisma.refreshToken.upsert({
      where: { userId: id },
      update: {
        token: refreshToken,
        updatedAt: new Date()
      },
      create: {
        token: refreshToken,
        userId: id
      }
    });
  },

  findUserById: (id: string) => {
    return prisma.user.findUnique({
      where: {
        userId: id
      },
      select: {
        userId: true,
        name: true,
        email: true,
        username: true,
        password: false,
        accountConfirmation: true,
        likedPosts: true,
        comments: true,
        savedPosts: true,
        passwordRecovery: true,
        refreshToken: true
      }
    });
  },

  deleteRefreshToken: (id: string) => {
    return prisma.refreshToken.delete({
      where: {
        userId: id
      }
    });
  },

  getRefreshToken: (id: string) => {
    return prisma.refreshToken.findUnique({
      where: {
        userId: id
      }
    });
  },

  findUserByResetToken: (token: string) => {
    return prisma.passwordRecovery.findFirst({
      where: {
        token
      }
    });
  },

  saveResetPasswordCode: (id: string, token: string, date: string) => {
    return prisma.passwordRecovery.upsert({
      where: {
        userId: id
      },
      update: {
        token,
        expiry: date
      },
      create: {
        userId: id,
        token,
        expiry: date
      }
    });
  },

  updateUserPasswordbyId: (id: string, password: string) => {
    return prisma.user.update({
      where: {
        userId: id
      },
      data: {
        password
      }
    });
  },

  getExpiryTime: (id: string) => {
    return prisma.passwordRecovery.findFirst({
      orderBy: {
        recoverId: "desc"
      },
      where: {
        userId: id
      },
      select: {
        expiry: true
      }
    });
  },

  getPasswordbyUserId: (id: string) => {
    return prisma.user.findUnique({
      where: {
        userId: id
      },
      select: {
        password: true
      }
    });
  },

  changePasswordbyUserId: (id: string, password: string) => {
    return prisma.user.update({
      where: {
        userId: id
      },
      data: {
        password
      }
    });
  },

  clearResetTokenAndExpiry: (id: string) => {
    return prisma.passwordRecovery.update({
      where: {
        userId: id
      },
      data: {
        token: null,
        expiry: null
      }
    });
  },

  updateLastPasswordChange: (id: string) => {
    return prisma.user.update({
      where: {
        userId: id
      },
      data: {
        passwordRecovery: {
          update: {
            lastResetAt: new Date()
          }
        }
      }
    });
  }
};
