// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { Password } from "@convex-dev/auth/providers/Password";

/**
 * Owners and employees sign in with their mobile number and password.
 * Passwords are hashed with Scrypt on the server by Convex Auth and the
 * browser only ever receives an opaque session token.
 *
 * Mobile numbers are mapped to an internal account identifier on the client
 * and in server actions; the generated address is never shown in the UI.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({
    profile(params) {
      if (params.flow === "signUp") throw new ConvexError("ساخت حساب فقط توسط صاحب سایت مجاز است.");
      return { email: String(params.email ?? "") };
    },
  })],
});
