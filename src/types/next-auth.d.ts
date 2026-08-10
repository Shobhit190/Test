import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      systemRole: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    systemRole: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    systemRole: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  }
}
