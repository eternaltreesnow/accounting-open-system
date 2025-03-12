import NextAuth from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // 这里可以添加更多认证方式（如GitHub、Google等）
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    }
  }
});