import DiscordProvider from 'next-auth/providers/discord';

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      // If we have a target guild ID, we can enforce it here
      const targetGuildId = process.env.DISCORD_GUILD_ID || '1231649939223707748'; // Use ID or env
      
      try {
        const res = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        });

        if (res.ok) {
          const guilds = await res.ok ? await res.json() : [];
          const isInGuild = guilds.some((guild) => guild.id === targetGuildId);
          if (isInGuild) return true;
          
          // If not in guild, redirect to a special error or just deny
          return '/#join-discord'; // Custom redirect or just false
        }
      } catch (e) {
        console.error('Discord Guild Check Error:', e);
      }
      
      return true; // Fallback to allow login if check fails to avoid blocking users unnecessarily if API is down
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub;
        session.user.discordId = token.discordId;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.discordId = profile?.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
