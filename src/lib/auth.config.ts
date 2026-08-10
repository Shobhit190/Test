import type { NextAuthConfig } from "next-auth";

export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.systemRole = (user as { systemRole: string }).systemRole;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.systemRole = token.systemRole as "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
